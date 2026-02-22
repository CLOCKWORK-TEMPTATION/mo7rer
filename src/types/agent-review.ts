/**
 * @module types/agent-review
 * @description أنماط مراجعة الوكيل الذكي — تُعرّف حمولات الطلب والاستجابة
 * لنقطة النهاية `/api/agent/review` التي تستخدم Claude Opus 4.6
 *
 * يُفعّل الوكيل فقط عندما:
 * - درجة الشك (totalSuspicion) ≥ 74
 * - عدد إشارات الشك ≥ 2
 * - المهلة الزمنية: 8 ثوانٍ
 */

import type { LineType } from './screenplay'

/**
 * سطر سياقي محيط بالسطر المشبوه — يُرسل للوكيل لتوفير سياق القرار
 *
 * @property lineIndex - رقم السطر في المستند الأصلي
 * @property assignedType - النوع المُعيّن من خط أنابيب التصنيف المحلي
 * @property text - النص الحرفي للسطر
 */
export interface AgentReviewContextLine {
  lineIndex: number
  assignedType: LineType
  text: string
}

/**
 * حمولة سطر مشبوه واحد — يُرسل ضمن طلب المراجعة
 *
 * @property itemIndex - فهرس العنصر في مصفوفة الأسطر المشبوهة
 * @property lineIndex - رقم السطر في المستند الأصلي
 * @property text - النص الحرفي
 * @property assignedType - النوع المُعيّن محلياً (قبل مراجعة الوكيل)
 * @property totalSuspicion - درجة الشك الإجمالية (0-100)
 * @property reasons - أسباب الشك من الكاشفات الخمسة
 * @property contextLines - أسطر محيطة لتوفير السياق
 */
export interface AgentSuspiciousLinePayload {
  itemIndex: number
  lineIndex: number
  text: string
  assignedType: LineType
  totalSuspicion: number
  reasons: string[]
  contextLines: AgentReviewContextLine[]
}

/**
 * حمولة طلب المراجعة الكاملة — تُرسل لنقطة النهاية `/api/agent/review`
 *
 * @property sessionId - معرف الجلسة الفريد
 * @property totalReviewed - إجمالي الأسطر التي فحصها PostClassificationReviewer
 * @property reviewPacketText - تمثيل نصي مُنسّق للحزمة من `formatForLLM` (اختياري)
 * @property suspiciousLines - الأسطر التي تجاوزت عتبة الشك
 */
export interface AgentReviewRequestPayload {
  sessionId: string
  totalReviewed: number
  reviewPacketText?: string
  suspiciousLines: AgentSuspiciousLinePayload[]
}

/**
 * قرار الوكيل لسطر واحد
 *
 * @property itemIndex - فهرس العنصر في المصفوفة الأصلية (للمطابقة)
 * @property finalType - النوع النهائي بعد مراجعة الوكيل
 * @property confidence - درجة ثقة الوكيل (0-100)
 * @property reason - تبرير القرار (نص حر)
 */
export interface AgentReviewDecision {
  itemIndex: number
  finalType: LineType
  confidence: number
  reason: string
}

/**
 * حمولة استجابة المراجعة من الوكيل
 *
 * @property status - حالة الاستجابة:
 *   - `applied` — تم تطبيق القرارات بنجاح
 *   - `skipped` — تم تخطي المراجعة (لا أسطر مشبوهة كافية)
 *   - `warning` — تحذير (مثل تجاوز المهلة جزئياً)
 *   - `error` — فشل المراجعة بالكامل
 * @property model - اسم النموذج المُستخدم (مثل "claude-opus-4-6")
 * @property decisions - مصفوفة القرارات — واحد لكل سطر مشبوه
 * @property message - رسالة نصية وصفية
 * @property latencyMs - زمن الاستجابة بالمللي ثانية
 */
export interface AgentReviewResponsePayload {
  status: 'applied' | 'skipped' | 'warning' | 'error'
  model: string
  decisions: AgentReviewDecision[]
  message: string
  latencyMs: number
}
