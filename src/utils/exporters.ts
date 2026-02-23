import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx'
import { jsPDF } from 'jspdf'
import type { ScreenplayBlock } from './file-import'

export type ExportFormat = 'html' | 'docx' | 'pdf'

export interface ExportRequest {
  html: string
  text?: string
  blocks?: ScreenplayBlock[]
  fileNameBase?: string
  title?: string
}

const DEFAULT_EXPORT_FILE_BASE = 'screenplay'

const DOCX_BOLD_FORMATS = new Set<ScreenplayBlock['formatId']>([
  'basmala',
  'scene-header-1',
  'scene-header-2',
  'scene-header-3',
  'character',
  'transition',
])

const sanitizeLine = (value: string): string => (value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()

const getParagraphSpacingByFormat = (formatId: ScreenplayBlock['formatId']) => {
  if (formatId === 'dialogue') {
    return { after: 120, line: 320 }
  }
  if (formatId === 'scene-header-1' || formatId === 'scene-header-2' || formatId === 'scene-header-3') {
    return { before: 160, after: 120, line: 320 }
  }
  return { after: 140, line: 320 }
}

const downloadBlob = (fileName: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export const sanitizeExportFileBaseName = (fileNameBase?: string): string => {
  const candidate = (fileNameBase ?? DEFAULT_EXPORT_FILE_BASE).trim()
  const normalized = candidate.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-')
  return normalized || DEFAULT_EXPORT_FILE_BASE
}

export const buildFullHtmlDocument = (bodyHtml: string, title = 'تصدير محرر السيناريو'): string => `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body {
      margin: 0 auto;
      width: min(794px, 100%);
      padding: 28px;
      direction: rtl;
      text-align: right;
      font-family: 'Cairo', system-ui, sans-serif;
      line-height: 1.8;
      color: #0f172a;
      background: #ffffff;
      box-sizing: border-box;
    }
    [data-type='character'], [data-type='scene-header-1'], [data-type='scene-header-2'], [data-type='scene-header-3'], [data-type='basmala'], [data-type='transition'] {
      font-weight: 700;
    }
    [data-type='scene-header-top-line'] {
      margin: 0 0 12px 0;
    }
    [data-type] {
      margin-bottom: 10px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`

const toDocxParagraphs = (request: ExportRequest): Paragraph[] => {
  if (Array.isArray(request.blocks) && request.blocks.length > 0) {
    return request.blocks.map((block) => {
      const text = sanitizeLine(block.text)
      return new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: getParagraphSpacingByFormat(block.formatId),
        children: [
          new TextRun({
            text,
            bold: DOCX_BOLD_FORMATS.has(block.formatId),
            size: 26,
          }),
        ],
      })
    })
  }

  const lines = (request.text ?? '')
    .split(/\r?\n/g)
    .map((line) => sanitizeLine(line))
    .filter((line) => line.length > 0)

  return lines.map((line) =>
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      spacing: { after: 140, line: 320 },
      children: [new TextRun({ text: line, size: 26 })],
    }),
  )
}

export const exportAsHtml = (request: ExportRequest): void => {
  const fileBase = sanitizeExportFileBaseName(request.fileNameBase)
  const fullDoc = buildFullHtmlDocument(request.html, request.title)
  const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' })
  downloadBlob(`${fileBase}.html`, blob)
}

export const exportAsDocx = async (request: ExportRequest): Promise<void> => {
  const fileBase = sanitizeExportFileBaseName(request.fileNameBase)
  const documentRef = new Document({
    sections: [
      {
        properties: {},
        children: toDocxParagraphs(request),
      },
    ],
  })

  const blob = await Packer.toBlob(documentRef)
  downloadBlob(`${fileBase}.docx`, blob)
}

export const exportAsPdf = async (request: ExportRequest): Promise<void> => {
  const fileBase = sanitizeExportFileBaseName(request.fileNameBase)
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.width = '794px'
  container.style.background = '#fff'
  container.style.direction = 'rtl'
  container.style.padding = '24px'
  container.innerHTML = request.html
  document.body.appendChild(container)

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true,
    })
    pdf.setR2L(true)

    await pdf.html(container, {
      x: 24,
      y: 24,
      margin: [24, 24, 24, 24],
      autoPaging: 'text',
      width: 547,
      windowWidth: 794,
      html2canvas: {
        scale: 1.2,
      },
    })

    pdf.save(`${fileBase}.pdf`)
  } finally {
    container.remove()
  }
}

export const exportDocument = async (
  request: ExportRequest,
  format: ExportFormat,
): Promise<void> => {
  if (!request.html.trim()) {
    throw new Error('لا يوجد محتوى قابل للتصدير.')
  }

  if (format === 'html') {
    exportAsHtml(request)
    return
  }

  if (format === 'docx') {
    await exportAsDocx(request)
    return
  }

  if (format === 'pdf') {
    await exportAsPdf(request)
    return
  }
}
