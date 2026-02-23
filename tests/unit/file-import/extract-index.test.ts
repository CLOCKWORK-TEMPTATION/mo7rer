import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileExtractionResult } from '../../../src/types/file-import'

const doubles = vi.hoisted(() => ({
  extractFileWithBackend: vi.fn(),
  isBackendExtractionConfigured: vi.fn(),
  extractFileInBrowser: vi.fn(),
}))

vi.mock('../../../src/utils/file-import/extract/backend-extract', () => ({
  extractFileWithBackend: doubles.extractFileWithBackend,
  isBackendExtractionConfigured: doubles.isBackendExtractionConfigured,
}))

vi.mock('../../../src/utils/file-import/extract/browser-extract', () => ({
  extractFileInBrowser: doubles.extractFileInBrowser,
}))

import { extractImportedFile } from '../../../src/utils/file-import/extract'

describe('extract index orchestration', () => {
  beforeEach(() => {
    doubles.extractFileWithBackend.mockReset()
    doubles.isBackendExtractionConfigured.mockReset()
    doubles.extractFileInBrowser.mockReset()
    doubles.isBackendExtractionConfigured.mockReturnValue(true)
  })

  it('falls back to DOC browser best-effort when backend path fails', async () => {
    doubles.extractFileWithBackend.mockRejectedValueOnce(new Error('Failed to fetch'))

    const browserDocResult: FileExtractionResult = {
      text: 'مشهد 1\nداخلي - ليل\nغرفة المعيشة',
      fileType: 'doc',
      method: 'native-text',
      usedOcr: false,
      warnings: ['best-effort'],
      attempts: ['doc-browser-best-effort'],
    }
    doubles.extractFileInBrowser.mockResolvedValueOnce(browserDocResult)

    const file = new File(['dummy'], 'sample.doc', { type: 'application/msword' })
    const result = await extractImportedFile(file)

    expect(doubles.extractFileWithBackend).toHaveBeenCalledTimes(1)
    expect(doubles.extractFileInBrowser).toHaveBeenCalledWith(file, 'doc')
    expect(result.fileType).toBe('doc')
    expect(result.warnings.join('\n')).toContain('تعذر مسار Backend لـ DOC')
    expect(result.attempts).toContain('backend-doc-failed')
    expect(result.text).toBe(browserDocResult.text)
    expect(result.normalizationApplied ?? []).toHaveLength(0)
  })

  it('keeps PDF extracted text raw before paste-classifier pipeline', async () => {
    const backendPdfResult: FileExtractionResult = {
      text: '• سطر أول\n• سطر ثاني',
      fileType: 'pdf',
      method: 'ocr-mistral',
      usedOcr: true,
      warnings: [],
      attempts: ['ocr-mistral'],
    }
    doubles.extractFileWithBackend.mockResolvedValueOnce(backendPdfResult)

    const file = new File(['dummy'], 'sample.pdf', { type: 'application/pdf' })
    const result = await extractImportedFile(file)

    expect(result.fileType).toBe('pdf')
    expect(result.text).toBe(backendPdfResult.text)
    expect(result.normalizationApplied ?? []).toHaveLength(0)
  })

  it('uses DOCX backend-first path and applies docx preprocessing contract', async () => {
    const backendDocxResult: FileExtractionResult = {
      text: 'سطر أول\r\n\r\nسطر ثاني\r\n',
      fileType: 'docx',
      method: 'docx-xml-direct',
      usedOcr: false,
      warnings: [],
      attempts: ['docx-xml-direct'],
    }
    doubles.extractFileWithBackend.mockResolvedValueOnce(backendDocxResult)

    const file = new File(['dummy'], 'sample.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    const result = await extractImportedFile(file)

    expect(doubles.extractFileWithBackend).toHaveBeenCalledTimes(1)
    expect(doubles.extractFileInBrowser).not.toHaveBeenCalled()
    expect(result.fileType).toBe('docx')
    expect(result.text).toBe('سطر أول\n\nسطر ثاني')
    expect(result.normalizationApplied ?? []).toContain('docx-lightweight-normalization')
  })

  it('falls back to DOCX browser best-effort when backend path fails', async () => {
    doubles.extractFileWithBackend.mockRejectedValueOnce(new Error('Failed to fetch'))

    const browserDocxResult: FileExtractionResult = {
      text: 'فقرة أولى\n\nفقرة ثانية',
      fileType: 'docx',
      method: 'docx-xml-direct',
      usedOcr: false,
      warnings: [],
      attempts: ['docx-xml-direct'],
    }
    doubles.extractFileInBrowser.mockResolvedValueOnce(browserDocxResult)

    const file = new File(['dummy'], 'sample.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const result = await extractImportedFile(file)

    expect(doubles.extractFileInBrowser).toHaveBeenCalledWith(file, 'docx')
    expect(result.fileType).toBe('docx')
    expect(result.warnings.join('\n')).toContain('تعذر مسار Backend لـ DOCX')
    expect(result.attempts).toContain('backend-docx-failed')
    expect(result.text).toBe(browserDocxResult.text)
  })

  it('returns combined PDF failure reason when browser and backend both fail', async () => {
    doubles.extractFileInBrowser.mockRejectedValueOnce(new Error('pdfjs crashed'))
    doubles.extractFileWithBackend.mockRejectedValueOnce(
      new Error('تعذر الاتصال بخدمة Backend extraction على http://localhost:8787/api/file-extract.'),
    )

    const file = new File(['dummy'], 'sample.pdf', { type: 'application/pdf' })

    let failure: unknown = null
    try {
      await extractImportedFile(file)
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(Error)
    const message = (failure as Error).message
    expect(message).toMatch(/تعذر استخراج PDF عبر Backend|فشل Backend OCR لـ PDF/)
    expect(message).toMatch(/pdfjs crashed/)
  })
})
