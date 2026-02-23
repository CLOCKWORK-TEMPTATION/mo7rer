/**
 * @module server/docx-xml-extract
 * @description استخراج نص DOCX مباشرة من `word/document.xml` بدون Mammoth.
 */
import JSZip from 'jszip'

function decodeXmlEntities(value) {
  return String(value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_match, dec) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
}

function normalizeExtractedText(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200B\u200C\u200D\u200E\u200F\u061C\u2060\uFEFF\u00AD]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function detectStructuralWarnings(xmlString) {
  const warnings = []
  if (/<w:tbl[\s>]/i.test(xmlString)) {
    warnings.push('DOCX يحتوي جداول؛ نص الخلايا استُخرج كسطور متتالية.')
  }
  if (/<w:drawing[\s>]/i.test(xmlString) || /<wp:inline[\s>]/i.test(xmlString)) {
    warnings.push('DOCX يحتوي صورًا مُضمّنة؛ تم تخطيها.')
  }
  return warnings
}

const toArrayBuffer = (value) => {
  if (value instanceof ArrayBuffer) return value
  if (value instanceof Uint8Array) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
  }
  const typed = new Uint8Array(value)
  return typed.buffer.slice(typed.byteOffset, typed.byteOffset + typed.byteLength)
}

/**
 * @param {Buffer|ArrayBuffer|Uint8Array} input - محتوى ملف DOCX
 * @returns {Promise<{ text: string, paragraphCount: number, warnings: string[], attempts: string[] }>}
 */
export async function extractDocxTextDirectly(input) {
  const zip = await JSZip.loadAsync(toArrayBuffer(input))
  const documentXml = zip.file('word/document.xml')

  if (!documentXml) {
    throw new Error('الملف غير صالح: تعذر العثور على word/document.xml')
  }

  let xmlString = await documentXml.async('string')
  xmlString = xmlString.replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g, '')

  const warnings = detectStructuralWarnings(xmlString)
  const paragraphs = []
  const paragraphRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>|<w:p\b[^>]*\/>/g
  let paragraphMatch

  while ((paragraphMatch = paragraphRegex.exec(xmlString)) !== null) {
    const paragraphContent = paragraphMatch[1] ?? ''
    let paragraphText = ''
    const tokenRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:br\b[^>]*>|<w:tab\b[^>]*>/g
    let tokenMatch

    while ((tokenMatch = tokenRegex.exec(paragraphContent)) !== null) {
      const token = tokenMatch[0]
      if (token.startsWith('<w:t')) {
        paragraphText += decodeXmlEntities(tokenMatch[1] ?? '')
      } else if (token.startsWith('<w:br')) {
        paragraphText += '\n'
      } else {
        paragraphText += '\t'
      }
    }

    paragraphs.push(paragraphText)
  }

  if (paragraphs.length === 0) {
    warnings.push('لم يتم العثور على فقرات في XML المستند.')
  }

  return {
    text: normalizeExtractedText(paragraphs.join('\n')),
    paragraphCount: paragraphs.length,
    warnings,
    attempts: ['docx-xml-direct'],
  }
}

export const extractDocxFromXmlBuffer = extractDocxTextDirectly
