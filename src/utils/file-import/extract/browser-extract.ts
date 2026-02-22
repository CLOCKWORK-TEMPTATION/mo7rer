/**
 * @module utils/file-import/extract/browser-extract
 * @description استخراج النصوص من الملفات داخل المتصفح بدون Backend.
 *
 * الأنواع المدعومة:
 * - `txt` / `fountain` / `fdx` — قراءة نصية مباشرة مع كشف ترميز ذكي
 *   (UTF-8 → windows-1256 → ISO-8859-1) للنصوص العربية
 * - `docx` — عبر مكتبة mammoth (extractRawText)
 * - `pdf` — عبر pdfjs-dist (text layer فقط، بدون OCR)
 * - `doc` — غير مدعوم في المتصفح (يحتاج Backend)
 *
 * كل مسار يفحص وجود Filmlane Payload Marker قبل إرجاع النص الخام.
 */
import type {
  FileExtractionResult,
  ImportedFileType,
} from '../../../types/file-import'
import {
  extractPayloadFromText,
} from '../document-model'

/** يوحّد فواصل الأسطر إلى `\n` */
const normalizeNewlines = (value: string): string =>
  (value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

/**
 * يحاول فكّ ترميز مصفوفة بايت بترميز محدد.
 * @returns النص المفكوك أو `null` عند الفشل
 */
const decodeWithEncoding = (buffer: Uint8Array, encoding: string): string | null => {
  try {
    return new TextDecoder(encoding).decode(buffer)
  } catch {
    return null
  }
}

/**
 * يفكّ ترميز ArrayBuffer إلى نص باستخدام تسلسل ترميزات:
 * UTF-8 → windows-1256 → ISO-8859-1.
 * مصمّم للتعامل مع النصوص العربية المشفّرة بترميزات مختلفة.
 */
const decodeTextBuffer = (arrayBuffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(arrayBuffer)
  const utf8Text = decodeWithEncoding(bytes, 'utf-8') ?? ''
  const hasReplacementChars =
    utf8Text.includes('\uFFFD') || utf8Text.includes('�')
  if (!hasReplacementChars) return utf8Text

  const win1256 = decodeWithEncoding(bytes, 'windows-1256')
  if (win1256 && !win1256.includes('\uFFFD')) {
    return win1256
  }

  const latin1 = decodeWithEncoding(bytes, 'iso-8859-1')
  if (latin1) return latin1

  return utf8Text
}

/**
 * يبني نتيجة استخراج من نوع `app-payload` عند اكتشاف
 * Filmlane Payload Marker في النص المستخرج.
 */
const toPayloadResult = (
  payload: NonNullable<ReturnType<typeof extractPayloadFromText>>,
  fileType: ImportedFileType,
  attempts: string[],
): FileExtractionResult => ({
  text: payload.blocks.map((block) => block.text).join('\n'),
  fileType,
  method: 'app-payload',
  usedOcr: false,
  warnings: [],
  attempts,
  qualityScore: 1,
  normalizationApplied: ['payload-direct-restore'],
  structuredBlocks: payload.blocks,
  payloadVersion: payload.version,
})

/**
 * يستخرج النص الخام من ملف DOCX عبر مكتبة mammoth (extractRawText).
 * @throws {Error} إذا تعذّر تحميل الدالة من المكتبة
 */
async function extractDocxText(file: File): Promise<{ text: string; attempts: string[] }> {
  const mammoth = (await import('mammoth')) as {
    extractRawText?: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
    default?: {
      extractRawText?: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
    }
  }

  const extractRawText = mammoth.extractRawText ?? mammoth.default?.extractRawText
  if (!extractRawText) {
    throw new Error('تعذر تحميل دالة extractRawText من مكتبة mammoth.')
  }

  const arrayBuffer = await file.arrayBuffer()
  const result = await extractRawText({ arrayBuffer })
  return {
    text: normalizeNewlines(result.value ?? ''),
    attempts: ['mammoth'],
  }
}

/**
 * يستخرج طبقة النصوص من ملف PDF عبر pdfjs-dist (بدون OCR).
 * يعمل بوضع `disableWorker: true` لتجنب الحاجة لـ Web Worker.
 * @throws {Error} إذا تعذّر تحميل `getDocument` من المكتبة
 */
async function extractPdfTextLayer(file: File): Promise<{ text: string; attempts: string[] }> {
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as {
    getDocument?: (options: { data: Uint8Array; disableWorker?: boolean }) => {
      promise: Promise<{
        numPages: number
        getPage: (pageNumber: number) => Promise<{
          getTextContent: () => Promise<{ items: Array<{ str?: string }> }>
        }>
        destroy?: () => Promise<void>
      }>
      destroy: () => Promise<void>
    }
  }

  if (!pdfjs.getDocument) {
    throw new Error('تعذر تحميل getDocument من pdfjs-dist.')
  }

  const arrayBuffer = await file.arrayBuffer()
  const task = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer), disableWorker: true })
  const documentRef = await task.promise

  try {
    const pages: string[] = []

    for (let pageNumber = 1; pageNumber <= documentRef.numPages; pageNumber += 1) {
      const page = await documentRef.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => item.str ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (text) {
        pages.push(text)
      }
    }

    return {
      text: normalizeNewlines(pages.join('\n')),
      attempts: ['pdfjs-text-layer'],
    }
  } finally {
    if (typeof documentRef.destroy === 'function') {
      await documentRef.destroy()
    }
    await task.destroy()
  }
}

/**
 * يتحقق ممّا إذا كان نوع الملف مدعوماً للاستخراج في المتصفح.
 * ملفات DOC غير مدعومة (تحتاج Backend).
 */
export const isBrowserExtractionSupported = (fileType: ImportedFileType): boolean =>
  fileType !== 'doc'

/**
 * يستخرج نص الملف داخل المتصفح حسب نوعه:
 * - `txt`/`fountain`/`fdx` → قراءة نصية مع كشف ترميز
 * - `docx` → mammoth
 * - `pdf` → pdfjs-dist text layer
 *
 * يفحص وجود Filmlane Payload Marker قبل إرجاع النص الخام.
 *
 * @param file - كائن الملف
 * @param fileType - نوع الملف المُحدد
 * @returns نتيجة الاستخراج
 * @throws {Error} للأنواع غير المدعومة (doc) أو أخطاء المكتبات
 */
export const extractFileInBrowser = async (
  file: File,
  fileType: ImportedFileType,
): Promise<FileExtractionResult> => {
  if (!isBrowserExtractionSupported(fileType)) {
    throw new Error('نوع الملف DOC يحتاج مسار Backend.')
  }

  if (fileType === 'txt' || fileType === 'fountain' || fileType === 'fdx') {
    const arrayBuffer = await file.arrayBuffer()
    const text = normalizeNewlines(decodeTextBuffer(arrayBuffer))
    const payload = extractPayloadFromText(text)
    if (payload) {
      return toPayloadResult(payload, fileType, ['native-text', 'payload-marker'])
    }

    return {
      text,
      fileType,
      method: 'native-text',
      usedOcr: false,
      warnings: [],
      attempts: ['native-text'],
    }
  }

  if (fileType === 'docx') {
    const extracted = await extractDocxText(file)
    const payload = extractPayloadFromText(extracted.text)
    if (payload) {
      return toPayloadResult(payload, fileType, [...extracted.attempts, 'payload-marker'])
    }

    return {
      text: extracted.text,
      fileType,
      method: 'mammoth',
      usedOcr: false,
      warnings: [],
      attempts: extracted.attempts,
    }
  }

  if (fileType === 'pdf') {
    const extracted = await extractPdfTextLayer(file)
    return {
      text: extracted.text,
      fileType,
      method: 'pdfjs-text-layer',
      usedOcr: false,
      warnings: [],
      attempts: extracted.attempts,
    }
  }

  throw new Error(`نوع الملف غير مدعوم في المتصفح: ${fileType}`)
}
