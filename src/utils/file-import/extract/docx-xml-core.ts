export interface DocxXmlExtractContract {
  text: string
  paragraphCount: number
  warnings: string[]
}

interface ExtractedParagraph {
  text: string
  isEmpty: boolean
}

interface ExtractCoreOptions {
  domParserFactory?: () => DOMParser
}

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

function extractParagraphsWithDOMParser(
  xmlString: string,
  domParserFactory: () => DOMParser,
): ExtractedParagraph[] {
  const parser = domParserFactory()
  const doc = parser.parseFromString(xmlString, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`خطأ تحليل XML: ${parseError.textContent?.slice(0, 200)}`)
  }

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

        if (el.localName === 't') {
          textParts.push(el.textContent ?? '')
        } else if (el.localName === 'br') {
          textParts.push('\n')
        } else if (el.localName === 'tab') {
          textParts.push('\t')
        }
      }
    }

    const text = textParts.join('')
    paragraphs.push({ text, isEmpty: text.trim().length === 0 })
  }

  return paragraphs
}

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

export function extractDocxXmlCore(
  xmlString: string,
  options: ExtractCoreOptions = {},
): DocxXmlExtractContract {
  const warnings = detectStructuralWarnings(xmlString)
  const paragraphs = options.domParserFactory
    ? extractParagraphsWithDOMParser(xmlString, options.domParserFactory)
    : extractParagraphsWithRegex(xmlString)

  if (paragraphs.length === 0) {
    warnings.push('لم يتم العثور على فقرات في XML المستند.')
  }

  const text = normalizeArabicText(assembleParagraphsToText(paragraphs))

  return {
    text,
    paragraphCount: paragraphs.filter((p) => !p.isEmpty).length,
    warnings,
  }
}
