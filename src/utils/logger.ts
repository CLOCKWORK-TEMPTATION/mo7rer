/**
 * @module utils/logger
 * @description مسجّل أحداث مركزي بأربعة مستويات (info, warn, error, debug).
 * مستوى debug مقيّد ببيئة التطوير فقط عبر
 * `import.meta.env.DEV`.
 * يدعم نطاقات (scopes) لتسهيل تتبّع مصدر الرسالة.
 */

/**
 * مستويات التسجيل المتاحة.
 * - `info` — رسائل إعلامية عامة
 * - `warn` — تحذيرات غير حرجة
 * - `error` — أخطاء تتطلب انتباهاً
 * - `debug` — تفاصيل تصحيح (بيئة التطوير فقط)
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

/**
 * سياق إضافي يُمرّر مع كل رسالة تسجيل.
 * @property scope - اسم الوحدة أو النطاق (يُعرض بين أقواس مربعة)
 * @property data - بيانات تشخيصية إضافية تُطبع بجوار الرسالة
 */
export interface LogContext {
  scope?: string
  data?: unknown
}

/** يسمح بتسجيل debug فقط في بيئة التطوير */
const canDebug = import.meta.env.DEV

/** يُضيف النطاق كبادئة `[scope]` للرسالة */
const withScope = (message: string, scope?: string): string => {
  if (!scope) return message
  return `[${scope}] ${message}`
}

/**
 * كائن المسجّل المركزي — يُستخدم بدلاً من `console.*` مباشرة.
 *
 * @example
 * ```ts
 * logger.info('تم تحميل الملف', { scope: 'file-import' })
 * logger.error('فشل الاستخراج', { scope: 'extract', data: err })
 * ```
 */
export const logger = {
  info(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.info(withScope(message, context?.scope), context?.data ?? '')
  },

  warn(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.warn(withScope(message, context?.scope), context?.data ?? '')
  },

  error(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.error(withScope(message, context?.scope), context?.data ?? '')
  },

  debug(message: string, context?: LogContext): void {
    if (!canDebug) return
    // eslint-disable-next-line no-console
    console.debug(withScope(message, context?.scope), context?.data ?? '')
  },
}
