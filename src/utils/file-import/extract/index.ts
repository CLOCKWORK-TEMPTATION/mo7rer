/**
 * @module utils/file-import/extract
 * @description منسّق الاستخراج المركزي. يختار الاستراتيجية المناسبة لكل نوع ملف:
 *
 * - `doc` → Backend فقط (غير مدعوم في المتصفح)
 * - `pdf` → متصفح أولاً + فحص جودة (عتبة {@link LOW_PDF_QUALITY_THRESHOLD})
 *   مع بديل Backend احتياطي عند الجودة المنخفضة
 * - أخرى → متصفح أولاً + بديل Backend احتياطي عند الفشل
 *
 * بعد الاستخراج يمرّ كل نتيجة عبر {@link finalizeExtraction} الذي يُطبّق
 * المعالجة المسبقة ويفحص وجود Payload Marker لاسترجاع البنية مباشرة.
 */
import type { FileExtractionResult } from '../../../types/file-import'
import { getFileType } from '../../../types/file-import'
import { extractPayloadFromText } from '../document-model'
import {
  computeImportedTextQualityScore,
  preprocessImportedTextForClassifier,
} from '../preprocessor'
import {
  extractFileInBrowser,
} from './browser-extract'
import {
  extractFileWithBackend,
  isBackendExtractionConfigured,
  type BackendExtractOptions,
} from './backend-extract'

/** عتبة الجودة التي تُحفّز التحويل إلى Backend لملفات PDF */
const LOW_PDF_QUALITY_THRESHOLD = 0.42

/**
 * خيارات الاستخراج الموحّدة.
 * @property pdfLowQualityThreshold - عتبة الجودة لملفات PDF (الافتراضي: 0.42)
 */
export interface ExtractImportedFileOptions extends BackendExtractOptions {
  pdfLowQualityThreshold?: number
}

/**
 * يُنهي نتيجة الاستخراج بتطبيق:
 * 1. المعالجة المسبقة ({@link preprocessImportedTextForClassifier})
 * 2. فحص Payload Marker لاسترجاع البنية
 * 3. حساب درجة الجودة ({@link computeImportedTextQualityScore})
 */
const finalizeExtraction = (result: FileExtractionResult): FileExtractionResult => {
  if (result.method === 'app-payload') {
    return {
      ...result,
      qualityScore: result.qualityScore ?? 1,
      normalizationApplied: result.normalizationApplied ?? ['payload-direct-restore'],
    }
  }

  const preprocessed = preprocessImportedTextForClassifier(result.text, result.fileType)
  const normalizedText = preprocessed.text
  const normalizedApplied = [
    ...(result.normalizationApplied ?? []),
    ...preprocessed.applied,
  ]

  const payload = extractPayloadFromText(normalizedText)
  if (payload) {
    return {
      text: payload.blocks.map((block) => block.text).join('\n'),
      fileType: result.fileType,
      method: 'app-payload',
      usedOcr: result.usedOcr,
      warnings: result.warnings,
      attempts: [...result.attempts, 'payload-marker'],
      qualityScore: 1,
      normalizationApplied: [...normalizedApplied, 'payload-direct-restore'],
      structuredBlocks: payload.blocks,
      payloadVersion: payload.version,
    }
  }

  return {
    ...result,
    text: normalizedText,
    normalizationApplied: normalizedApplied,
    qualityScore: computeImportedTextQualityScore(normalizedText),
  }
}

/** يدمج تحذيرات ومحاولات نتيجتين استخراج متتاليتين */
const mergeResults = (
  primary: FileExtractionResult,
  secondary: FileExtractionResult,
): FileExtractionResult => ({
  ...secondary,
  warnings: [...primary.warnings, ...secondary.warnings],
  attempts: [...primary.attempts, ...secondary.attempts],
})

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'خطأ غير معروف'

/**
 * نقطة الدخول الرئيسية لاستخراج الملفات المستوردة.
 *
 * يختار الاستراتيجية حسب نوع الملف ويُطبّق المعالجة المسبقة تلقائياً.
 *
 * @param file - كائن الملف من مربع حوار الاختيار
 * @param options - خيارات اختيارية (endpoint، مهلة، عتبة PDF)
 * @returns نتيجة الاستخراج النهائية
 * @throws {Error} إذا كان نوع الملف غير مدعوم أو فشل كل المسارات
 */
export const extractImportedFile = async (
  file: File,
  options?: ExtractImportedFileOptions,
): Promise<FileExtractionResult> => {
  const fileType = getFileType(file.name)
  if (!fileType) {
    throw new Error(`نوع الملف غير مدعوم: ${file.name}`)
  }

  const backendAvailable = isBackendExtractionConfigured(options?.endpoint)

  if (fileType === 'doc') {
    if (!backendAvailable) {
      throw new Error('استيراد DOC يتطلب Backend endpoint مضبوط في VITE_FILE_IMPORT_BACKEND_URL.')
    }

    const backendResult = await extractFileWithBackend(file, fileType, options)
    return finalizeExtraction(backendResult)
  }

  if (fileType === 'pdf') {
    try {
      const browserResult = finalizeExtraction(await extractFileInBrowser(file, fileType))
      const threshold = options?.pdfLowQualityThreshold ?? LOW_PDF_QUALITY_THRESHOLD
      const quality = browserResult.qualityScore ?? 0

      if (backendAvailable && quality > 0 && quality < threshold) {
        try {
          const backendResult = finalizeExtraction(
            await extractFileWithBackend(file, fileType, options),
          )
          return mergeResults(
            {
              ...browserResult,
              warnings: [
                ...browserResult.warnings,
                'تم التحويل إلى مسار Backend بسبب انخفاض جودة text-layer في PDF.',
              ],
            },
            backendResult,
          )
        } catch (backendError) {
          return {
            ...browserResult,
            warnings: [
              ...browserResult.warnings,
              `فشل مسار Backend fallback: ${toErrorMessage(backendError)}`,
            ],
          }
        }
      }

      if (!backendAvailable && quality > 0 && quality < threshold) {
        return {
          ...browserResult,
          warnings: [
            ...browserResult.warnings,
            'جودة استخراج PDF منخفضة ولا يوجد Backend OCR fallback مفعّل.',
          ],
        }
      }

      return browserResult
    } catch (browserError) {
      if (!backendAvailable) {
        throw new Error(
          `فشل استخراج PDF في المتصفح: ${toErrorMessage(browserError)}. ولا يوجد Backend fallback.`,
        )
      }

      const backendResult = finalizeExtraction(
        await extractFileWithBackend(file, fileType, options),
      )
      return {
        ...backendResult,
        warnings: [
          `فشل text-layer في المتصفح: ${toErrorMessage(browserError)}`,
          ...backendResult.warnings,
        ],
      }
    }
  }

  try {
    const browserResult = await extractFileInBrowser(file, fileType)
    return finalizeExtraction(browserResult)
  } catch (browserError) {
    if (!backendAvailable) {
      throw new Error(`فشل استخراج الملف: ${toErrorMessage(browserError)}`)
    }

    const backendResult = await extractFileWithBackend(file, fileType, options)
    return finalizeExtraction({
      ...backendResult,
      warnings: [`فشل مسار المتصفح: ${toErrorMessage(browserError)}`, ...backendResult.warnings],
    })
  }
}
