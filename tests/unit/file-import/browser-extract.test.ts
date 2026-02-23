import { beforeEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'

const pdfGetDocumentMock = vi.hoisted(() => vi.fn())

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: pdfGetDocumentMock,
}))

import { extractFileInBrowser } from '../../../src/utils/file-import/extract/browser-extract'

const createDocxFile = async (xml: string, name = 'sample.docx'): Promise<File> => {
  const zip = new JSZip()
  zip.file('word/document.xml', xml)
  const bytes = await zip.generateAsync({ type: 'uint8array' })
  return new File([bytes], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

describe('browser-extract', () => {
  beforeEach(() => {
    pdfGetDocumentMock.mockReset()
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

  it('extracts DOCX directly from XML while preserving paragraph and soft break boundaries', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' +
      '<w:p><w:r><w:t>مشهد 1</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>بوسي:</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>وهي تنهض لتواجههم</w:t></w:r></w:p>' +
      '</w:body></w:document>'

    const file = await createDocxFile(xml)
    const result = await extractFileInBrowser(file, 'docx')

    expect(result.fileType).toBe('docx')
    expect(result.method).toBe('docx-xml-direct')
    expect(result.attempts).toEqual(['docx-xml-direct'])
    expect(result.text).toBe('مشهد 1\nبوسي:\nوهي تنهض لتواجههم')
  })

  it('throws when DOCX payload is not a valid zip', async () => {
    const file = new File(
      ['dummy'],
      'sample.docx',
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    )

    await expect(extractFileInBrowser(file, 'docx')).rejects.toThrow()
  })
})
