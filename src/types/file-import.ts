/**
 * @module types/file-import
 * @description أنماط استيراد الملفات — تُعرّف الأنواع المدعومة وطرق الاستخراج ونتائج العملية
 *
 * يدعم التطبيق 6 صيغ ملفات: doc, docx, txt, pdf, fountain, fdx
 * ويستخدم 7 طرق استخراج مختلفة حسب نوع الملف وبيئة التشغيل.
 *
 * @see utils/file-import/ — خط أنابيب الاستيراد الكامل
 */

import type { ScreenplayBlock } from '../utils/file-import/document-model'

/**
 * وضع الاستيراد — يُحدد كيفية تعامل المحرر مع المحتوى المستورد
 * - `replace` — استبدال المستند الحالي بالكامل
 * - `insert` — إدراج المحتوى عند موضع المؤشر
 */
export type FileImportMode = 'replace' | 'insert'

/**
 * نوع الملف المستورد — صيغ الملفات الستة المدعومة
 * - `doc` — Microsoft Word القديم (.doc)
 * - `docx` — Microsoft Word الحديث (.docx)
 * - `txt` — نص عادي (.txt)
 * - `pdf` — مستند PDF (.pdf)
 * - `fountain` — صيغة سيناريو Fountain (.fountain)
 * - `fdx` — Final Draft XML (.fdx)
 */
export type ImportedFileType =
  | 'doc'
  | 'docx'
  | 'txt'
  | 'pdf'
  | 'fountain'
  | 'fdx'

/**
 * طريقة الاستخراج — الأسلوب المُستخدم لاستخراج النص من الملف
 * - `native-text` — قراءة مباشرة كنص عادي (txt, fountain)
 * - `mammoth` — مكتبة Mammoth لتحويل docx إلى نص
 * - `pdfjs-text-layer` — طبقة النص في PDF.js
 * - `doc-converter-flow` — تحويل doc عبر خدمة خارجية
 * - `ocr-mistral` — التعرف البصري على الحروف عبر Mistral
 * - `backend-api` — استخراج عبر واجهة برمجية خلفية
 * - `app-payload` — حمولة تطبيق أفان تيتر المُشفّرة (Base64 + FNV1a)
 */
export type ExtractionMethod =
  | 'native-text'
  | 'mammoth'
  | 'pdfjs-text-layer'
  | 'doc-converter-flow'
  | 'ocr-mistral'
  | 'backend-api'
  | 'app-payload'

/**
 * نتيجة استخراج الملف — المُخرج النهائي لعملية الاستخراج
 *
 * @property text - النص المُستخرج من الملف
 * @property fileType - نوع الملف الأصلي
 * @property method - طريقة الاستخراج المُستخدمة
 * @property usedOcr - هل استُخدم التعرف البصري على الحروف (OCR)
 * @property warnings - تحذيرات أثناء الاستخراج (مثل فقدان تنسيق)
 * @property attempts - سجل المحاولات (الطرق المُجرّبة بالترتيب)
 * @property qualityScore - درجة جودة الاستخراج (0-100، اختياري)
 * @property normalizationApplied - قواعد التطبيع المُطبّقة (اختياري)
 * @property structuredBlocks - كتل سيناريو مُهيكلة مسبقاً (لحمولات التطبيق، اختياري)
 * @property payloadVersion - إصدار الحمولة (لحمولات التطبيق، اختياري)
 */
export interface FileExtractionResult {
  text: string
  fileType: ImportedFileType
  method: ExtractionMethod
  usedOcr: boolean
  warnings: string[]
  attempts: string[]
  qualityScore?: number
  normalizationApplied?: string[]
  structuredBlocks?: ScreenplayBlock[]
  payloadVersion?: number
}

/**
 * طلب استخراج ملف — يُرسل لنقطة النهاية الخلفية
 *
 * @property filename - اسم الملف الأصلي
 * @property extension - نوع الملف (الامتداد)
 * @property fileBase64 - محتوى الملف مُشفّر بـ Base64
 */
export interface FileExtractionRequest {
  filename: string
  extension: ImportedFileType
  fileBase64: string
}

/**
 * استجابة استخراج الملف — الرد من نقطة النهاية الخلفية
 *
 * @property success - هل نجحت عملية الاستخراج
 * @property data - نتيجة الاستخراج (في حالة النجاح)
 * @property error - رسالة الخطأ (في حالة الفشل)
 */
export interface FileExtractionResponse {
  success: boolean
  data?: FileExtractionResult
  error?: string
}

/**
 * الامتدادات المقبولة — سلسلة نصية لعنصر `<input accept="...">`
 *
 * @example
 * ```html
 * <input type="file" accept={ACCEPTED_FILE_EXTENSIONS} />
 * ```
 */
export const ACCEPTED_FILE_EXTENSIONS = '.doc,.docx,.txt,.pdf,.fountain,.fdx' as const

/**
 * استخراج نوع الملف من اسمه — يُعيد `null` إذا كان الامتداد غير مدعوم
 *
 * @param filename - اسم الملف الكامل (مثل "script.docx")
 * @returns نوع الملف المُطابق أو `null`
 *
 * @example
 * ```typescript
 * getFileType('my-script.docx') // 'docx'
 * getFileType('image.png')      // null
 * ```
 */
export function getFileType(filename: string): ImportedFileType | null {
  const ext = filename.toLowerCase().split('.').pop()
  switch (ext) {
    case 'doc':
      return 'doc'
    case 'docx':
      return 'docx'
    case 'txt':
      return 'txt'
    case 'pdf':
      return 'pdf'
    case 'fountain':
      return 'fountain'
    case 'fdx':
      return 'fdx'
    default:
      return null
  }
}
