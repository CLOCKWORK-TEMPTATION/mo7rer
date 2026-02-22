/**
 * @module utils/file-import/extract/backend-extract
 * @description استخراج النصوص عبر خادم Backend خارجي (REST API).
 *
 * يُرسل الملف بصيغة Base64 داخل جسم JSON إلى نقطة النهاية المحددة في
 * `VITE_FILE_IMPORT_BACKEND_URL`، مع مهلة زمنية افتراضية 45 ثانية
 * عبر {@link AbortController}.
 *
 * يُستخدم كبديل احتياطي (fallback) عندما يفشل الاستخراج في المتصفح
 * أو عندما تكون جودة النص المستخرج منخفضة (خاصةً لملفات PDF و DOC).
 */
import type {
  FileExtractionResponse,
  FileExtractionResult,
  ImportedFileType,
} from '../../../types/file-import'

/** نقطة نهاية Backend المأخوذة من متغير البيئة */
const ENV_BACKEND_ENDPOINT =
  (import.meta.env.VITE_FILE_IMPORT_BACKEND_URL as string | undefined)?.trim() || ''

/**
 * يحوّل ArrayBuffer إلى سلسلة Base64 عبر تقطيع القطع (chunks)
 * لتجنب تجاوز حد المكدس في `String.fromCharCode`.
 *
 * @param arrayBuffer - المخزن المؤقت المراد ترميزه
 * @returns سلسلة Base64
 */
const arrayBufferToBase64 = (arrayBuffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

/** يزيل الشرطة المائلة الزائدة من نهاية عنوان URL */
const normalizeEndpoint = (endpoint: string): string => endpoint.replace(/\/$/, '')

/**
 * خيارات استخراج الملف عبر Backend.
 * @property endpoint - عنوان URL مخصص (يتجاوز متغير البيئة)
 * @property timeoutMs - مهلة الطلب بالمللي ثانية (الافتراضي: 45000)
 */
export interface BackendExtractOptions {
  endpoint?: string
  timeoutMs?: number
}

/**
 * يتحقق ممّا إذا كان Backend مضبوطاً (عبر متغير البيئة أو endpoint صريح).
 *
 * @param endpoint - عنوان اختياري يتجاوز `VITE_FILE_IMPORT_BACKEND_URL`
 * @returns `true` إذا وُجد عنوان غير فارغ
 */
export const isBackendExtractionConfigured = (
  endpoint?: string,
): boolean => Boolean((endpoint ?? ENV_BACKEND_ENDPOINT).trim())

/**
 * يحلّ عنوان نقطة النهاية النهائي، ويرمي خطأ إذا لم يُضبط أي عنوان.
 * @throws {Error} إذا لم يكن هناك endpoint مضبوط
 */
const resolveBackendExtractionEndpoint = (endpoint?: string): string => {
  const resolved = (endpoint ?? ENV_BACKEND_ENDPOINT).trim()
  if (!resolved) {
    throw new Error(
      'VITE_FILE_IMPORT_BACKEND_URL غير مضبوط. اضبط endpoint كامل مثل: http://127.0.0.1:8787/api/file-extract',
    )
  }

  return normalizeEndpoint(resolved)
}

/**
 * يستخرج نص الملف عبر Backend API.
 *
 * يُرسل الملف كـ Base64 في جسم JSON ويستقبل {@link FileExtractionResult}.
 * يدعم مهلة زمنية عبر AbortController (الافتراضي 45 ثانية).
 *
 * @param file - كائن الملف المراد استخراجه
 * @param fileType - نوع الملف المُحدد مسبقاً
 * @param options - خيارات اختيارية (endpoint، مهلة)
 * @returns نتيجة الاستخراج
 * @throws {Error} عند فشل الاتصال أو انتهاء المهلة
 */
export const extractFileWithBackend = async (
  file: File,
  fileType: ImportedFileType,
  options?: BackendExtractOptions,
): Promise<FileExtractionResult> => {
  const endpoint = resolveBackendExtractionEndpoint(options?.endpoint)

  const timeoutMs = options?.timeoutMs ?? 45_000
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const arrayBuffer = await file.arrayBuffer()
    const payload = {
      filename: file.name,
      extension: fileType,
      fileBase64: arrayBufferToBase64(arrayBuffer),
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Backend returned HTTP ${response.status}`)
    }

    const body = (await response.json()) as FileExtractionResponse
    if (!body.success || !body.data) {
      throw new Error(body.error || 'Backend extraction failed without details.')
    }

    return {
      ...body.data,
      fileType,
      method: body.data.method ?? 'backend-api',
      warnings: body.data.warnings ?? [],
      attempts: body.data.attempts ?? ['backend-api'],
      usedOcr: Boolean(body.data.usedOcr),
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Backend extraction timed out.')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}
