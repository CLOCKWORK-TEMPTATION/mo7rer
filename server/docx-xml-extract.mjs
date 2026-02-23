/**
 * @module server/docx-xml-extract
 * @description استخراج نص DOCX عبر قراءة XML المستند مباشرة — نسخة Node.js.
 * تستخدم regex بدلاً من DOMParser (غير متوفر في Node.js).
 */
import { unzipSync } from 'fflate'

// ─── فك ضغط DOCX ──────────────────────────────────────

function unzipDocx(buffer) {
  const zipData = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const unzipped = unzipSync(zipData)
  const documentXml = unzipped['word/document.xml']
  if (!documentXml) {
    throw new Error('ملف DOCX لا يحتوي word/document.xml')
  }
  return documentXml
}

// ─── فك ترميز XML ──────────────────────────────────────

function decodeXmlBytes(bytes) {
  return new TextDecoder('utf-8').decode(bytes)
}

// ─── استخراج الفقرات عبر regex ──────────────────────────

function extractParagraphsWithRegex(xmlString) {
  const paragraphs = []
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>|<w:p\s*\/>/g
  let pMatch

  while ((pMatch = paragraphRegex.exec(xmlString)) !== null) {
    const pXml = pMatch[0]
    const textParts = []
    const runRegex = /<w:r[\s>][\s\S]*?<\/w:r>/g
    let rMatch

    while ((rMatch = runRegex.exec(pXml)) !== null) {
      const rXml = rMatch[0]
      const elementRegex = /<w:t([^>]*)>([\s\S]*?)<\/w:t>|<w:br\s*\/?>|<w:tab\s*\/?>/g
      let elMatch

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

// ─── تجميع الفقرات إلى نص ───────────────────────────────

function assembleParagraphsToText(paragraphs) {
  const lines = []
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

// ─── تنظيف النص العربي ──────────────────────────────────

function normalizeArabicText(text) {
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

// ─── تحذيرات هيكلية ─────────────────────────────────────

function detectStructuralWarnings(xmlString) {
  const warnings = []
  if (/<w:tbl[\s>]/i.test(xmlString)) {
    warnings.push('DOCX يحتوي جداول؛ نص الخلايا استُخرج كفقرات منفصلة.')
  }
  if (/<w:drawing[\s>]/i.test(xmlString) || /<wp:inline[\s>]/i.test(xmlString)) {
    warnings.push('DOCX يحتوي صور مُضمّنة؛ تم تخطيها.')
  }
  return warnings
}

// ─── الدالة العامة ───────────────────────────────────────

/**
 * يستخرج نصًا من ملف DOCX عبر قراءة word/document.xml مباشرة.
 * @param {Buffer|ArrayBuffer|Uint8Array} buffer - محتوى ملف DOCX
 * @returns {{ text: string, paragraphCount: number, warnings: string[] }}
 */
export async function extractDocxFromXmlBuffer(buffer) {
  const xmlBytes = unzipDocx(buffer)
  const xmlString = decodeXmlBytes(xmlBytes)
  const warnings = detectStructuralWarnings(xmlString)

  const paragraphs = extractParagraphsWithRegex(xmlString)

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
