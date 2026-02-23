import http from 'node:http'
import process from 'node:process'
import { execFile, execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { config as loadEnv } from 'dotenv'
import mammoth from 'mammoth'
import { extractPdfTextWithOcr, getPdfOcrModel } from './pdf-ocr.mjs'
import { normalizeExtractedDocxText } from '../src/utils/file-import/extract/docx-html-to-text.mjs'
import { extractDocxFromXmlBuffer } from './docx-xml-extract.mjs'
import {
  AgentReviewValidationError,
  getAnthropicReviewModel,
  requestAnthropicReview,
  validateAgentReviewRequestBody,
} from './agent-review.mjs'

loadEnv()

const HOST = process.env.FILE_IMPORT_HOST || '127.0.0.1'
const PORT = Number(process.env.FILE_IMPORT_PORT || 8787)
const MAX_BODY_SIZE = 40 * 1024 * 1024

const OCR_MODEL = getPdfOcrModel()

const DOC_CONVERTER_TIMEOUT_MS = 30_000
const DOC_CONVERTER_MAX_BUFFER = 64 * 1024 * 1024
const DEFAULT_ANTIWORD_PATH = 'antiword'
const DEFAULT_ANTIWORD_HOME = '/usr/share/antiword'

const SUPPORTED_EXTENSIONS = new Set(['txt', 'fountain', 'fdx', 'docx', 'pdf', 'doc'])
const SUPPORTED_EXTRACTION_METHODS = new Set([
  'native-text',
  'mammoth',
  'docx-xml-direct',
  'pdfjs-text-layer',
  'doc-converter-flow',
  'ocr-mistral',
  'backend-api',
  'app-payload',
])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type',
}

class RequestValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RequestValidationError'
    this.statusCode = 400
  }
}

const isObjectRecord = (value) => typeof value === 'object' && value !== null
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0

const normalizeIncomingText = (value, maxLength = 50_000) => {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

const normalizeText = (value) =>
  String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const extractDocxBufferToText = async (buffer) => {
  const attempts = []
  const warnings = []

  // المسار الأساسي: استخراج XML مباشر
  attempts.push('docx-xml-direct')
  try {
    const result = await extractDocxFromXmlBuffer(buffer)
    warnings.push(...result.warnings)

    if (result.text.trim()) {
      return { text: result.text, attempts, warnings }
    }
    warnings.push('docx-xml-direct أعاد نصًا فارغًا؛ الهبوط إلى Mammoth.')
  } catch (xmlError) {
    warnings.push(
      `فشل docx-xml-direct: ${xmlError instanceof Error ? xmlError.message : String(xmlError)}; الهبوط إلى Mammoth.`,
    )
  }

  // المسار الاحتياطي: Mammoth extractRawText فقط
  const extractRawText = mammoth.extractRawText
  if (extractRawText) {
    try {
      const result = await extractRawText({ buffer })
      const text = normalizeExtractedDocxText(result.value ?? '')
      attempts.push('mammoth-raw-fallback')
      if (text) {
        return { text, attempts, warnings }
      }
    } catch (error) {
      warnings.push(
        `فشل mammoth-raw-fallback: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  throw new Error(`فشل استخراج DOCX عبر جميع المسارات: ${warnings.join(' | ')}`)
}

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

const validateExtractRequestBody = (rawBody) => {
  if (!isObjectRecord(rawBody)) {
    throw new RequestValidationError('Invalid extract request body.')
  }

  const filename = normalizeIncomingText(rawBody.filename, 512) || 'document'
  const extension =
    typeof rawBody.extension === 'string' ? rawBody.extension.trim().toLowerCase() : ''
  const fileBase64 =
    typeof rawBody.fileBase64 === 'string' ? rawBody.fileBase64.trim() : ''

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new RequestValidationError(`Unsupported extension: ${extension || 'unknown'}`)
  }
  if (!fileBase64) {
    throw new RequestValidationError('Missing fileBase64.')
  }

  return {
    filename,
    extension,
    fileBase64,
  }
}

const normalizeExtractionResponseData = (result, fileType) => {
  if (!isObjectRecord(result)) {
    throw new Error('Extraction returned invalid payload.')
  }

  const text = typeof result.text === 'string' ? result.text : ''
  const method = normalizeIncomingText(result.method, 64)
  const usedOcr = Boolean(result.usedOcr)
  const attempts = Array.isArray(result.attempts)
    ? result.attempts.filter((entry) => isNonEmptyString(entry)).slice(0, 24)
    : []
  const warnings = Array.isArray(result.warnings)
    ? result.warnings.filter((entry) => isNonEmptyString(entry)).slice(0, 24)
    : []

  if (!SUPPORTED_EXTRACTION_METHODS.has(method)) {
    throw new Error(`Extraction returned unsupported method: ${method}`)
  }

  return {
    text,
    fileType,
    method,
    usedOcr,
    warnings,
    attempts,
  }
}

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
    const result = await extractDocxBufferToText(buffer)
    return {
      text: result.text,
      method: result.attempts.includes('mammoth-raw-fallback') ? 'mammoth' : 'docx-xml-direct',
      usedOcr: false,
      attempts: result.attempts,
      warnings: result.warnings,
    }
  }

  if (extension === 'pdf') {
    const text = await extractPdfTextWithOcr(buffer, normalizeText)
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
    const { filename, extension, fileBase64 } = validateExtractRequestBody(body)

    const buffer = decodeBase64(fileBase64)
    const extracted = await extractByType(buffer, extension, filename)
    const normalizedData = normalizeExtractionResponseData(extracted, extension)

    sendJson(res, 200, {
      success: true,
      data: normalizedData,
      meta: {
        filename,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    const statusCode = error instanceof RequestValidationError ? error.statusCode : 500
    sendJson(res, statusCode, {
      success: false,
      error: message,
    })
  }
}

const handleAgentReview = async (req, res) => {
  try {
    const rawBody = await readBody(req)
    const body = validateAgentReviewRequestBody(rawBody)
    const response = await requestAnthropicReview(body)
    sendJson(res, 200, response)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const statusCode = error instanceof AgentReviewValidationError ? error.statusCode : 500
    sendJson(res, statusCode, {
      status: 'error',
      model: getAnthropicReviewModel(),
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
      reviewModel: getAnthropicReviewModel(),
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
