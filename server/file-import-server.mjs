import http from 'node:http'
import process from 'node:process'
import { execFile, execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { config as loadEnv } from 'dotenv'
import mammoth from 'mammoth'
import { Mistral } from '@mistralai/mistralai'

loadEnv()

const HOST = process.env.FILE_IMPORT_HOST || '127.0.0.1'
const PORT = Number(process.env.FILE_IMPORT_PORT || 8787)
const MAX_BODY_SIZE = 40 * 1024 * 1024

const OCR_MODEL = process.env.MISTRAL_OCR_MODEL || 'mistral-ocr-latest'
const ANTHROPIC_REVIEW_MODEL = process.env.ANTHROPIC_REVIEW_MODEL || 'claude-opus-4-6'
const REVIEW_TEMPERATURE = 0.0
const REVIEW_TIMEOUT_MS = 60_000

const DOC_CONVERTER_TIMEOUT_MS = 30_000
const DOC_CONVERTER_MAX_BUFFER = 64 * 1024 * 1024
const DEFAULT_ANTIWORD_PATH = 'antiword'
const DEFAULT_ANTIWORD_HOME = '/usr/share/antiword'

const SUPPORTED_EXTENSIONS = new Set(['txt', 'fountain', 'fdx', 'docx', 'pdf', 'doc'])
const ALLOWED_LINE_TYPES = new Set([
  'action',
  'dialogue',
  'character',
  'scene-header-1',
  'scene-header-2',
  'scene-header-3',
  'scene-header-top-line',
  'transition',
  'parenthetical',
  'basmala',
])

const REVIEW_SYSTEM_PROMPT = `أنت مراجع نهائي لتصنيفات سيناريو عربي.

المطلوب:
- استلام فقط السطور المشتبه فيها مع سياقها.
- القرار يكون تصحيح نوع السطر أو تأكيده.
- لا تضف أي شرح خارج JSON.
- لا تستخدم أي نوع خارج القائمة المسموحة.

القائمة المسموحة للنوع النهائي:
action, dialogue, character, scene-header-1, scene-header-2, scene-header-3, scene-header-top-line, transition, parenthetical, basmala

صيغة الإخراج الإلزامية (JSON فقط):
{
  "decisions": [
    {
      "itemIndex": 12,
      "finalType": "action",
      "confidence": 0.96,
      "reason": "سبب قصير"
    }
  ]
}

قواعد مهمة:
- confidence رقم بين 0 و 1.
- itemIndex لازم يطابق المدخل.
- لا ترجع أي مفاتيح إضافية.
- لو مافيش تعديل، ارجع نفس النوع الحالي.`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const normalizeText = (value) =>
  String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders,
  })
  res.end(JSON.stringify(payload))
}

const readBody = async (req) =>
  new Promise((resolve, reject) => {
    let total = 0
    const chunks = []

    req.on('data', (chunk) => {
      total += chunk.length
      if (total > MAX_BODY_SIZE) {
        reject(new Error('Request body exceeded max allowed size.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Invalid JSON body.'))
      }
    })

    req.on('error', reject)
  })

const decodeBase64 = (input) => {
  if (!input || typeof input !== 'string') {
    throw new Error('Missing fileBase64.')
  }

  const normalized = input.replace(/\s+/g, '')
  if (!normalized) {
    throw new Error('fileBase64 is empty.')
  }

  return Buffer.from(normalized, 'base64')
}

const decodeUtf8Buffer = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  return new TextDecoder('utf-8').decode(value)
}

const extractTextFromAnthropicBlocks = (content) => {
  if (!Array.isArray(content)) return ''
  const chunks = []
  for (const block of content) {
    if (block?.type === 'text' && typeof block.text === 'string') {
      chunks.push(block.text)
    }
  }
  return chunks.join('')
}

const clampConfidence = (value) => {
  if (!Number.isFinite(value)) return 0.5
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

const parseReviewDecisions = (rawText) => {
  const source = String(rawText ?? '').trim()
  if (!source) return []

  const parseCandidate = (candidate) => {
    const parsed = JSON.parse(candidate)
    const decisions = Array.isArray(parsed?.decisions) ? parsed.decisions : []
    const normalized = []

    for (const decision of decisions) {
      if (!decision || typeof decision !== 'object') continue

      const itemIndex =
        typeof decision.itemIndex === 'number' ? Math.trunc(decision.itemIndex) : -1
      const finalType =
        typeof decision.finalType === 'string' ? decision.finalType.trim() : ''
      const reason =
        typeof decision.reason === 'string'
          ? decision.reason.trim()
          : 'قرار بدون سبب مفصل'
      const confidenceRaw =
        typeof decision.confidence === 'number' ? decision.confidence : 0.5

      if (itemIndex < 0) continue
      if (!ALLOWED_LINE_TYPES.has(finalType)) continue

      normalized.push({
        itemIndex,
        finalType,
        confidence: clampConfidence(confidenceRaw),
        reason,
      })
    }

    return normalized
  }

  try {
    return parseCandidate(source)
  } catch {
    const start = source.indexOf('{')
    const end = source.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      return []
    }

    try {
      return parseCandidate(source.slice(start, end + 1))
    } catch {
      return []
    }
  }
}

const buildReviewUserPrompt = (request) => {
  const payload = {
    totalReviewed: request.totalReviewed,
    suspiciousLines: request.suspiciousLines,
  }

  return `راجع عناصر التصنيف المشتبه فيها فقط، وارجع JSON بالمخطط المطلوب حرفيًا.\n\n${JSON.stringify(payload, null, 2)}`
}

const requestAnthropicReview = async (request) => {
  const startedAt = Date.now()
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return {
      status: 'warning',
      model: ANTHROPIC_REVIEW_MODEL,
      decisions: [],
      message: 'ANTHROPIC_API_KEY غير موجود؛ تم تخطي مرحلة الوكيل.',
      latencyMs: Date.now() - startedAt,
    }
  }

  if (!Array.isArray(request?.suspiciousLines) || request.suspiciousLines.length === 0) {
    return {
      status: 'skipped',
      model: ANTHROPIC_REVIEW_MODEL,
      decisions: [],
      message: 'لا توجد سطور مشتبه فيها لإرسالها للوكيل.',
      latencyMs: Date.now() - startedAt,
    }
  }

  const maxTokens = Math.min(3000, Math.max(600, request.suspiciousLines.length * 180))
  const params = {
    model: ANTHROPIC_REVIEW_MODEL,
    max_tokens: maxTokens,
    temperature: REVIEW_TEMPERATURE,
    system: REVIEW_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildReviewUserPrompt(request),
      },
    ],
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REVIEW_TIMEOUT_MS)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text()
      return {
        status: 'error',
        model: ANTHROPIC_REVIEW_MODEL,
        decisions: [],
        message: `فشل الوكيل: HTTP ${response.status} - ${body}`,
        latencyMs: Date.now() - startedAt,
      }
    }

    const payload = await response.json()
    const text = extractTextFromAnthropicBlocks(payload?.content)
    const decisions = parseReviewDecisions(text).filter((decision) =>
      request.suspiciousLines.some((line) => line.itemIndex === decision.itemIndex),
    )

    if (decisions.length === 0) {
      return {
        status: 'skipped',
        model: ANTHROPIC_REVIEW_MODEL,
        decisions: [],
        message: 'الوكيل لم يرجع قرارات قابلة للتطبيق.',
        latencyMs: Date.now() - startedAt,
      }
    }

    return {
      status: 'applied',
      model: ANTHROPIC_REVIEW_MODEL,
      decisions,
      message: `تم استلام ${decisions.length} قرار من الوكيل.`,
      latencyMs: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      status: 'error',
      model: ANTHROPIC_REVIEW_MODEL,
      decisions: [],
      message: `فشل الوكيل: ${error instanceof Error ? error.message : String(error)}`,
      latencyMs: Date.now() - startedAt,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

const resolveAntiwordRuntime = () => {
  const antiwordPath = process.env.ANTIWORD_PATH?.trim() || DEFAULT_ANTIWORD_PATH
  const antiwordHome = process.env.ANTIWORDHOME?.trim() || DEFAULT_ANTIWORD_HOME

  return {
    antiwordPath,
    antiwordHome,
    runtimeSource: process.env.ANTIWORD_PATH?.trim() ? 'env' : 'path-default',
  }
}

const runAntiwordPreflight = () => {
  const runtime = resolveAntiwordRuntime()
  const warnings = []
  let binaryAvailable = false

  try {
    execFileSync(runtime.antiwordPath, ['-h'], {
      stdio: 'pipe',
      timeout: 5000,
      windowsHide: true,
      env: {
        ...process.env,
        ANTIWORDHOME: runtime.antiwordHome,
      },
    })
    binaryAvailable = true
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : ''
    if (code === 'ENOENT') {
      warnings.push(`antiword binary غير موجود على المسار الحالي: ${runtime.antiwordPath}`)
    } else if (code === 'EACCES') {
      warnings.push(`antiword binary موجود لكنه غير قابل للتنفيذ: ${runtime.antiwordPath}`)
    } else {
      // antiword قد يرجع exit code غير صفري مع -h رغم وجوده.
      binaryAvailable = true
    }
  }

  const antiwordHomeExists = existsSync(runtime.antiwordHome)
  if (!antiwordHomeExists) {
    warnings.push(`ANTIWORDHOME غير موجود أو غير صحيح: ${runtime.antiwordHome}`)
  }

  return {
    ...runtime,
    binaryAvailable,
    antiwordHomeExists,
    warnings,
  }
}

const ANTIWORD_PREFLIGHT = runAntiwordPreflight()

const runAntiword = async (antiwordPath, args, antiwordHome) =>
  new Promise((resolve, reject) => {
    execFile(
      antiwordPath,
      args,
      {
        encoding: 'buffer',
        timeout: DOC_CONVERTER_TIMEOUT_MS,
        maxBuffer: DOC_CONVERTER_MAX_BUFFER,
        windowsHide: true,
        env: {
          ...process.env,
          ANTIWORDHOME: antiwordHome,
        },
      },
      (error, stdout, stderr) => {
        const stdoutBuffer = Buffer.isBuffer(stdout)
          ? stdout
          : Buffer.from(stdout ?? '', 'utf-8')
        const stderrBuffer = Buffer.isBuffer(stderr)
          ? stderr
          : Buffer.from(stderr ?? '', 'utf-8')

        if (error) {
          const wrappedError = error
          wrappedError.stdout = stdoutBuffer
          wrappedError.stderr = stderrBuffer
          reject(wrappedError)
          return
        }

        resolve({ stdout: stdoutBuffer, stderr: stderrBuffer })
      },
    )
  })

const resolveTempFilename = (filename) => {
  const base = basename(filename || 'document.doc')
  const hasDocExt = extname(base).toLowerCase() === '.doc'
  return hasDocExt ? base : `${base}.doc`
}

const cleanExtractedDocText = (text) =>
  normalizeText(text)
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[^\S\r\n]{2,}/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const convertDocBufferToText = async (buffer, filename) => {
  const warnings = []
  const attempts = ['doc-converter-flow']
  const runtime = resolveAntiwordRuntime()
  let tempDirPath = null

  try {
    tempDirPath = await mkdtemp(join(tmpdir(), 'doc-converter-flow-'))
    const tempFilePath = join(tempDirPath, resolveTempFilename(filename))
    await writeFile(tempFilePath, buffer)

    const { stdout, stderr } = await runAntiword(
      runtime.antiwordPath,
      ['-m', 'UTF-8.txt', '-w', '0', tempFilePath],
      runtime.antiwordHome,
    )

    const stderrText = decodeUtf8Buffer(stderr).trim()
    if (stderrText) warnings.push(stderrText)

    const decoded = decodeUtf8Buffer(stdout)
    const cleaned = cleanExtractedDocText(decoded)
    if (!cleaned) {
      throw new Error('antiword أعاد نصًا فارغًا')
    }

    return {
      text: cleaned,
      method: 'doc-converter-flow',
      usedOcr: false,
      attempts,
      warnings,
      antiword: runtime,
    }
  } catch (error) {
    const stderrText = decodeUtf8Buffer(error?.stderr).trim()
    if (stderrText) warnings.push(stderrText)
    throw new Error(
      `فشل تحويل ملف DOC عبر antiword (${runtime.antiwordPath}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  } finally {
    if (tempDirPath) {
      await rm(tempDirPath, { recursive: true, force: true }).catch(() => {})
    }
  }
}

let mistralClient = null
const getMistralClient = () => {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is not configured on backend.')
  }

  if (!mistralClient) {
    mistralClient = new Mistral({ apiKey })
  }

  return mistralClient
}

const mapOcrResponseToText = (response) => {
  const pages = Array.isArray(response?.pages) ? response.pages : []
  if (pages.length === 0) {
    throw new Error('Mistral OCR returned no readable pages.')
  }

  const merged = pages
    .map((page) => ({
      index: Number.isFinite(page?.index) ? page.index : Number.MAX_SAFE_INTEGER,
      markdown: typeof page?.markdown === 'string' ? page.markdown : '',
    }))
    .sort((a, b) => a.index - b.index)
    .map((page) => page.markdown)
    .join('\n\n')

  const cleaned = normalizeText(merged)
  if (!cleaned) {
    throw new Error('Mistral OCR returned empty text.')
  }

  return cleaned
}

const runMistralOcr = async (buffer, mimeType) => {
  const client = getMistralClient()
  const documentUrl = `data:${mimeType};base64,${buffer.toString('base64')}`

  const response = await client.ocr.process({
    document: {
      type: 'document_url',
      documentUrl,
    },
    model: OCR_MODEL,
    includeImageBase64: false,
  })

  return mapOcrResponseToText(response)
}

const decodeUtf8Fallback = (buffer) => {
  const utf8Text = buffer.toString('utf8')
  const hasReplacementChars = utf8Text.includes('\uFFFD') || utf8Text.includes('�')
  if (!hasReplacementChars) return utf8Text
  return buffer.toString('latin1')
}

const extractByType = async (buffer, extension, filename) => {
  if (extension === 'txt' || extension === 'fountain' || extension === 'fdx') {
    return {
      text: normalizeText(decodeUtf8Fallback(buffer)),
      method: 'native-text',
      usedOcr: false,
      attempts: ['native-text'],
      warnings: [],
    }
  }

  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ buffer })
    return {
      text: normalizeText(result.value ?? ''),
      method: 'mammoth',
      usedOcr: false,
      attempts: ['mammoth'],
      warnings: [],
    }
  }

  if (extension === 'pdf') {
    const text = await runMistralOcr(buffer, 'application/pdf')
    return {
      text,
      method: 'ocr-mistral',
      usedOcr: true,
      attempts: ['ocr-mistral'],
      warnings: [],
    }
  }

  if (extension === 'doc') {
    if (!ANTIWORD_PREFLIGHT.binaryAvailable) {
      throw new Error(
        `تعذر استخراج DOC: antiword غير متاح. راجع health endpoint والتأكد من ANTIWORD_PATH.`,
      )
    }
    if (!ANTIWORD_PREFLIGHT.antiwordHomeExists) {
      throw new Error(
        `تعذر استخراج DOC: مسار ANTIWORDHOME غير صالح (${ANTIWORD_PREFLIGHT.antiwordHome}).`,
      )
    }
    return convertDocBufferToText(buffer, filename)
  }

  throw new Error(`Unsupported extension: ${extension}`)
}

const handleExtract = async (req, res) => {
  try {
    const body = await readBody(req)

    const filename = typeof body?.filename === 'string' ? body.filename : 'document'
    const extension = typeof body?.extension === 'string' ? body.extension.toLowerCase() : ''

    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      sendJson(res, 400, {
        success: false,
        error: `Unsupported extension: ${extension || 'unknown'}`,
      })
      return
    }

    const buffer = decodeBase64(body?.fileBase64)
    const extracted = await extractByType(buffer, extension, filename)

    sendJson(res, 200, {
      success: true,
      data: {
        text: extracted.text,
        fileType: extension,
        method: extracted.method,
        usedOcr: extracted.usedOcr,
        warnings: extracted.warnings,
        attempts: extracted.attempts,
      },
      meta: {
        filename,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    sendJson(res, 500, {
      success: false,
      error: message,
    })
  }
}

const handleAgentReview = async (req, res) => {
  try {
    const body = await readBody(req)
    const response = await requestAnthropicReview(body)
    sendJson(res, 200, response)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    sendJson(res, 500, {
      status: 'error',
      model: ANTHROPIC_REVIEW_MODEL,
      decisions: [],
      message,
      latencyMs: 0,
    })
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 404, { success: false, error: 'Not found.' })
    return
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders)
    res.end()
    return
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'file-import-backend',
      ocrConfigured: Boolean(process.env.MISTRAL_API_KEY),
      antiwordPath: process.env.ANTIWORD_PATH || DEFAULT_ANTIWORD_PATH,
      antiwordHome: process.env.ANTIWORDHOME || DEFAULT_ANTIWORD_HOME,
      antiwordBinaryAvailable: ANTIWORD_PREFLIGHT.binaryAvailable,
      antiwordHomeExists: ANTIWORD_PREFLIGHT.antiwordHomeExists,
      antiwordWarnings: ANTIWORD_PREFLIGHT.warnings,
      agentReviewConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      model: OCR_MODEL,
      reviewModel: ANTHROPIC_REVIEW_MODEL,
    })
    return
  }

  if (req.method === 'POST' && (url.pathname === '/api/file-extract' || url.pathname === '/api/files/extract')) {
    await handleExtract(req, res)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/agent/review') {
    await handleAgentReview(req, res)
    return
  }

  sendJson(res, 404, { success: false, error: 'Route not found.' })
})

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`file-import backend running on http://${HOST}:${PORT}`)
  // eslint-disable-next-line no-console
  console.log(`extract endpoint: http://${HOST}:${PORT}/api/file-extract`)
  // eslint-disable-next-line no-console
  console.log(`review endpoint:  http://${HOST}:${PORT}/api/agent/review`)
  // eslint-disable-next-line no-console
  console.log(`health:           http://${HOST}:${PORT}/health`)
  if (ANTIWORD_PREFLIGHT.warnings.length > 0) {
    // eslint-disable-next-line no-console
    console.warn('[antiword preflight] warnings:')
    for (const warning of ANTIWORD_PREFLIGHT.warnings) {
      // eslint-disable-next-line no-console
      console.warn(`- ${warning}`)
    }
  }
})
