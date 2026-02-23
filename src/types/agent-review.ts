/**
 * @module types/agent-review
 * @description أنماط مراجعة الوكيل الذكي — تُعرّف حمولات الطلب والاستجابة
 * لنقطة النهاية `/api/agent/review` التي تستخدم Claude Opus 4.6
 *
 * يُفعّل الوكيل فقط عندما:
 * - يجتاز السطر جدول التصفية (routing) في مرحلة PostClassificationReviewer
 * - يقع ضمن سقف الإرسال للوكيل (وفق profile التشغيل)
 * - لا يتجاوز زمن التنفيذ الإجمالي للوكيل حد المهلة المعتمد
 */

import type { LineType } from "./screenplay";

/**
 * سطر سياقي محيط بالسطر المشبوه — يُرسل للوكيل لتوفير سياق القرار
 *
 * @property lineIndex - رقم السطر في المستند الأصلي
 * @property assignedType - النوع المُعيّن من خط أنابيب التصنيف المحلي
 * @property text - النص الحرفي للسطر
 */
export interface AgentReviewContextLine {
  lineIndex: number;
  assignedType: LineType;
  text: string;
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
 * @property escalationScore - (اختياري) سكور التصعيد النهائي بعد المزج الرقمي
 * @property routingBand - (اختياري) مسار التصفية الذي صعّد السطر
 * @property criticalMismatch - (اختياري) هل السطر ينتمي لحالة mismatch حرجة
 * @property distinctDetectors - (اختياري) عدد الكواشف المختلفة التي أطلقت الشك
 */
export interface AgentSuspiciousLinePayload {
  itemIndex: number;
  lineIndex: number;
  text: string;
  assignedType: LineType;
  totalSuspicion: number;
  reasons: string[];
  contextLines: AgentReviewContextLine[];
  escalationScore?: number;
  routingBand?: "agent-candidate" | "agent-forced";
  criticalMismatch?: boolean;
  distinctDetectors?: number;
}

/**
 * حمولة طلب المراجعة الكاملة — تُرسل لنقطة النهاية `/api/agent/review`
 *
 * @property sessionId - معرف الجلسة الفريد
 * @property totalReviewed - إجمالي الأسطر التي فحصها PostClassificationReviewer
 * @property reviewPacketText - تمثيل نصي مُنسّق للحزمة من `formatForLLM` (اختياري)
 * @property suspiciousLines - الأسطر التي تجاوزت عتبة الشك
 * @property requiredItemIndexes - جميع فهارس العناصر المطلوب أن يعود لها قرار
 * @property forcedItemIndexes - فهارس العناصر الحرجة التي لا يُقبل بقاؤها بلا حسم
 */
export interface AgentReviewRequestPayload {
  sessionId: string;
  totalReviewed: number;
  reviewPacketText?: string;
  suspiciousLines: AgentSuspiciousLinePayload[];
  requiredItemIndexes: number[];
  forcedItemIndexes: number[];
}

/**
 * بيانات تشخيص التغطية في استجابة الوكيل.
 *
 * @property requestedCount - عدد العناصر المطلوب حسمها
 * @property decisionCount - عدد القرارات المستلمة بعد التحقق
 * @property missingItemIndexes - العناصر التي لم يرجع لها الوكيل قرارًا
 * @property forcedItemIndexes - العناصر الحرجة كما أُرسلت للوكيل
 * @property unresolvedForcedItemIndexes - العناصر الحرجة غير المحسومة (مفقودة/غير فعالة)
 */
export interface AgentReviewResponseMeta {
  requestedCount: number;
  decisionCount: number;
  missingItemIndexes: number[];
  forcedItemIndexes: number[];
  unresolvedForcedItemIndexes: number[];
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
  itemIndex: number;
  finalType: LineType;
  confidence: number;
  reason: string;
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
 * @property meta - تشخيص تغطية القرارات (اختياري للتوافق العكسي)
 */
export interface AgentReviewResponsePayload {
  status: "applied" | "skipped" | "warning" | "error";
  model: string;
  decisions: AgentReviewDecision[];
  message: string;
  latencyMs: number;
  meta?: AgentReviewResponseMeta;
}
