/**
 * @module utils/file-import/extract/docx-xml-extract
 * @description استخراج نص DOCX مباشرة من `word/document.xml` بدون أي تحويل HTML.
 */
import JSZip from 'jszip'

export interface DocxXmlExtractResult {
  text: string
  paragraphCount: number
  warnings: string[]
}

const decodeXmlEntities = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )

const normalizeExtractedText = (value: string): string =>
  String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200B\u200C\u200D\u200E\u200F\u061C\u2060\uFEFF\u00AD]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const detectStructuralWarnings = (xmlString: string): string[] => {
  const warnings: string[] = []
  if (/<w:tbl[\s>]/i.test(xmlString)) {
    warnings.push('DOCX يحتوي جداول؛ نص الخلايا استُخرج كسطور متتالية.')
  }
  if (/<w:drawing[\s>]/i.test(xmlString) || /<wp:inline[\s>]/i.test(xmlString)) {
    warnings.push('DOCX يحتوي صورًا مُضمّنة؛ تم تخطيها.')
  }
  return warnings
}

type DocxInput = ArrayBuffer | Uint8Array | Blob | File

const toArrayBuffer = async (input: DocxInput): Promise<ArrayBuffer> => {
  if (input instanceof ArrayBuffer) return input
  if (input instanceof Uint8Array) {
    const copy = new Uint8Array(input.byteLength)
    copy.set(input)
    return copy.buffer
  }
  return input.arrayBuffer()
}

/**
 * استخراج نص DOCX مع الحفاظ على الفرق بين:
 * - الفقرة `<w:p>`: حد كتلة جديد.
 * - الكسر الناعم `<w:br>`: سطر داخل نفس الفقرة.
 */
export async function extractDocxTextDirectly(input: DocxInput): Promise<DocxXmlExtractResult> {
  const zip = await JSZip.loadAsync(await toArrayBuffer(input))
  const documentXml = zip.file('word/document.xml')

  if (!documentXml) {
    throw new Error('الملف غير صالح: تعذر العثور على word/document.xml')
  }

  let xmlString = await documentXml.async('string')
  xmlString = xmlString.replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g, '')

  const warnings = detectStructuralWarnings(xmlString)
  const paragraphs: string[] = []
  const paragraphRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>|<w:p\b[^>]*\/>/g
  let paragraphMatch: RegExpExecArray | null

  while ((paragraphMatch = paragraphRegex.exec(xmlString)) !== null) {
    const paragraphContent = paragraphMatch[1] ?? ''
    let paragraphText = ''
    const tokenRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:br\b[^>]*>|<w:tab\b[^>]*>/g
    let tokenMatch: RegExpExecArray | null

    while ((tokenMatch = tokenRegex.exec(paragraphContent)) !== null) {
      const token = tokenMatch[0]

      if (token.startsWith('<w:t')) {
        paragraphText += decodeXmlEntities(tokenMatch[1] ?? '')
        continue
      }

      if (token.startsWith('<w:br')) {
        paragraphText += '\n'
        continue
      }

      paragraphText += '\t'
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
  }
}

// اسم متوافق للخلف مع الاستدعاءات الحالية.
export const extractDocxFromXml = extractDocxTextDirectly
