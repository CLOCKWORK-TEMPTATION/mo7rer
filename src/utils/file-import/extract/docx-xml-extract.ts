/**
 * @module utils/file-import/extract/docx-xml-extract
 * @description استخراج نص DOCX عبر قراءة XML المستند مباشرة (بدون Mammoth HTML).
 *
 * ملف DOCX هو أرشيف ZIP يحتوي `word/document.xml`.
 * كل `<w:p>` = فقرة مستقلة، وكل `<w:t>` = محتوى نصي، و `<w:br/>` = كسر ناعم.
 * هذا يعطينا حدود فقرات دقيقة بدون أي هيوريستيك.
 */
import { unzipSync } from 'fflate'

// ─── الأنواع ──────────────────────────────────────────────

export interface DocxXmlExtractResult {
  text: string
  paragraphCount: number
  warnings: string[]
}

interface ExtractedParagraph {
  text: string
  isEmpty: boolean
}

// ─── الخطوة 1: فك ضغط DOCX ─────────────────────────────

function unzipDocx(arrayBuffer: ArrayBuffer): Uint8Array {
  const zipData = new Uint8Array(arrayBuffer)
  const unzipped = unzipSync(zipData)
  const documentXml = unzipped['word/document.xml']
  if (!documentXml) {
    throw new Error('ملف DOCX لا يحتوي word/document.xml')
  }
  return documentXml
}

// ─── الخطوة 2: فك ترميز XML ──────────────────────────────

function decodeXmlBytes(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes)
}

// ─── الخطوة 3: استخراج الفقرات ───────────────────────────

const hasDOMParser = typeof DOMParser !== 'undefined'

/**
 * استخراج عبر DOMParser (المتصفح) — يتعامل مع namespaces بدقة.
 */
function extractParagraphsWithDOMParser(xmlString: string): ExtractedParagraph[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`خطأ تحليل XML: ${parseError.textContent?.slice(0, 200)}`)
  }

  const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0]
  if (!body) {
    throw new Error('XML المستند لا يحتوي عنصر <w:body>')
  }

  const paragraphElements = body.getElementsByTagNameNS(W_NS, 'p')
  const paragraphs: ExtractedParagraph[] = []

  for (let i = 0; i < paragraphElements.length; i++) {
    const pEl = paragraphElements[i]
    const runs = pEl.getElementsByTagNameNS(W_NS, 'r')
    const textParts: string[] = []

    for (let j = 0; j < runs.length; j++) {
      const run = runs[j]
      for (let k = 0; k < run.childNodes.length; k++) {
        const child = run.childNodes[k]
        if (child.nodeType !== Node.ELEMENT_NODE) continue
        const el = child as Element
        const localName = el.localName

        if (localName === 't') {
          textParts.push(el.textContent ?? '')
        } else if (localName === 'br') {
          textParts.push('\n')
        } else if (localName === 'tab') {
          textParts.push('\t')
        }
      }
    }

    const text = textParts.join('')
    paragraphs.push({ text, isEmpty: text.trim().length === 0 })
  }

  return paragraphs
}

/**
 * استخراج عبر regex (Node.js / fallback) — يعالج عناصر `<w:r>` بالترتيب.
 */
function extractParagraphsWithRegex(xmlString: string): ExtractedParagraph[] {
  const paragraphs: ExtractedParagraph[] = []
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>|<w:p\s*\/>/g
  let pMatch: RegExpExecArray | null

  while ((pMatch = paragraphRegex.exec(xmlString)) !== null) {
    const pXml = pMatch[0]
    const textParts: string[] = []
    const runRegex = /<w:r[\s>][\s\S]*?<\/w:r>/g
    let rMatch: RegExpExecArray | null

    while ((rMatch = runRegex.exec(pXml)) !== null) {
      const rXml = rMatch[0]
      // معالجة العناصر بالترتيب للحفاظ على تسلسل النص والكسور
      const elementRegex = /<w:t([^>]*)>([\s\S]*?)<\/w:t>|<w:br\s*\/?>|<w:tab\s*\/?>/g
      let elMatch: RegExpExecArray | null

      while ((elMatch = elementRegex.exec(rXml)) !== null) {
        const fullMatch = elMatch[0]
        if (fullMatch.startsWith('<w:t')) {
          textParts.push(elMatch[2] ?? '')
        } else if (fullMatch.startsWith('<w:br')) {
          textParts.push('\n')
        } else if (fullMatch.startsWith('<w:tab')) {
          textParts.push('\t')
        }
      }
    }

    const text = textParts.join('')
    paragraphs.push({ text, isEmpty: text.trim().length === 0 })
  }

  return paragraphs
}

// ─── الخطوة 4: تجميع الفقرات إلى نص ──────────────────────

function assembleParagraphsToText(paragraphs: ExtractedParagraph[]): string {
  const lines: string[] = []
  let lastWasEmpty = false

  for (const para of paragraphs) {
    if (para.isEmpty) {
      if (!lastWasEmpty && lines.length > 0) {
        lines.push('')
      }
      lastWasEmpty = true
      continue
    }
    lastWasEmpty = false
    lines.push(para.text)
  }

  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }

  return lines.join('\n')
}

// ─── الخطوة 5: تنظيف النص العربي ─────────────────────────

function normalizeArabicText(text: string): string {
  return text
    .replace(/[\u200B\u200C\u200D\u200E\u200F\u061C\u2060\uFEFF\u00AD]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/^\uFEFF/, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─── تحذيرات هيكلية ──────────────────────────────────────

function detectStructuralWarnings(xmlString: string): string[] {
  const warnings: string[] = []
  if (/<w:tbl[\s>]/i.test(xmlString)) {
    warnings.push('DOCX يحتوي جداول؛ نص الخلايا استُخرج كفقرات منفصلة.')
  }
  if (/<w:drawing[\s>]/i.test(xmlString) || /<wp:inline[\s>]/i.test(xmlString)) {
    warnings.push('DOCX يحتوي صور مُضمّنة؛ تم تخطيها.')
  }
  return warnings
}

// ─── الدالة العامة ────────────────────────────────────────

/**
 * يستخرج نصًا من ملف DOCX عبر قراءة `word/document.xml` مباشرة.
 * يحافظ على حدود الفقرات بدقة كما هي في المستند الأصلي.
 */
export async function extractDocxFromXml(
  arrayBuffer: ArrayBuffer,
): Promise<DocxXmlExtractResult> {
  const xmlBytes = unzipDocx(arrayBuffer)
  const xmlString = decodeXmlBytes(xmlBytes)
  const warnings = detectStructuralWarnings(xmlString)

  const paragraphs = hasDOMParser
    ? extractParagraphsWithDOMParser(xmlString)
    : extractParagraphsWithRegex(xmlString)

  if (paragraphs.length === 0) {
    warnings.push('لم يتم العثور على فقرات في XML المستند.')
  }

  const rawText = assembleParagraphsToText(paragraphs)
  const text = normalizeArabicText(rawText)

  return {
    text,
    paragraphCount: paragraphs.filter((p) => !p.isEmpty).length,
    warnings,
  }
}
