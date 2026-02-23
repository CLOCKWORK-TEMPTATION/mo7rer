import { beforeEach, describe, expect, it, vi } from 'vitest'

const pdfGetDocumentMock = vi.hoisted(() => vi.fn())
const mammothConvertToHtmlMock = vi.hoisted(() => vi.fn())
const mammothExtractRawTextMock = vi.hoisted(() => vi.fn())

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: pdfGetDocumentMock,
}))

vi.mock('mammoth', () => ({
  convertToHtml: mammothConvertToHtmlMock,
  extractRawText: mammothExtractRawTextMock,
}))

import { extractFileInBrowser } from '../../../src/utils/file-import/extract/browser-extract'

describe('browser-extract', () => {
  beforeEach(() => {
    pdfGetDocumentMock.mockReset()
    mammothConvertToHtmlMock.mockReset()
    mammothExtractRawTextMock.mockReset()
  })

  it('extracts DOC in best-effort mode when using browser path', async () => {
    const file = new File(
      ['; هذا ملف DOC نصي\nمشهد 1\nداخلي - ليل\nغرفة المعيشة'],
      'sample.doc',
      { type: 'application/msword' },
    )

    const result = await extractFileInBrowser(file, 'doc')

    expect(result.fileType).toBe('doc')
    expect(result.method).toBe('native-text')
    expect(result.text).toContain('مشهد 1')
    expect(result.attempts).toContain('doc-browser-best-effort')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('keeps successful PDF extraction even if cleanup destroy throws', async () => {
    pdfGetDocumentMock.mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getTextContent: async () => ({
            items: [{ str: 'مرحبا PDF' }],
          }),
        }),
        destroy: async () => {
          throw new Error('document destroy failure')
        },
      }),
      destroy: async () => {
        throw new Error('task destroy failure')
      },
    })

    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'sample.pdf', {
      type: 'application/pdf',
    })

    const result = await extractFileInBrowser(file, 'pdf')
    expect(result.fileType).toBe('pdf')
    expect(result.method).toBe('pdfjs-text-layer')
    expect(result.text).toContain('مرحبا PDF')
  })

  it('falls back to mammoth raw when XML extraction fails on non-ZIP data', async () => {
    mammothExtractRawTextMock.mockResolvedValueOnce({
      value: 'وهي تنهض لتواجههم\nبوسي:',
    })

    const file = new File(
      ['dummy'],
      'sample.docx',
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    )

    const result = await extractFileInBrowser(file, 'docx')
    expect(result.fileType).toBe('docx')
    expect(result.method).toBe('mammoth')
    expect(result.attempts).toContain('docx-xml-direct')
    expect(result.attempts).toContain('mammoth-raw-fallback')
    expect(result.text).toBe('وهي تنهض لتواجههم\nبوسي:')
  })

  it('reports XML failure in warnings when falling back to mammoth', async () => {
    mammothExtractRawTextMock.mockResolvedValueOnce({
      value: 'اطلع من البلدثم يخرج ورقه مكتوب عليها عنوان',
    })

    const file = new File(
      ['dummy'],
      'sample.docx',
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    )

    const result = await extractFileInBrowser(file, 'docx')
    expect(result.fileType).toBe('docx')
    expect(result.method).toBe('mammoth')
    expect(result.warnings.join('\n')).toContain('فشل docx-xml-direct')
    expect(result.attempts).toContain('mammoth-raw-fallback')
  })
})
