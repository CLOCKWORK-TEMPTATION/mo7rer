/**
 * @module extensions/classification-types
 * @description
 * تعريفات الأنواع المركزية لنظام تصنيف عناصر السيناريو.
 *
 * يُصدّر:
 * - {@link ElementType} — نوع العنصر (8 أعضاء: basmala → transition)
 * - {@link LegacyElementType} — الصيغة القديمة بـ kebab-case
 * - {@link ClassificationMethod} — طريقة التصنيف (regex | context | fallback | ml)
 * - {@link ClassifiedLine} — سطر مُصنّف بالثقة والطريقة
 * - {@link DetectorFinding} — نتيجة كاشف شبهة واحد
 * - {@link SuspicionRoutingBand} — مسار المعالجة النهائي لسطر مشبوه
 * - {@link SuspicionScoreBreakdown} — تفصيل مكونات سكور التصعيد
 * - {@link SuspiciousLine} — سطر مشبوه مع جميع النتائج والسياق
 * - {@link LLMReviewPacket} — حزمة مراجعة AI كاملة
 * - {@link ClassificationContext} — سياق التصنيف (الأنواع السابقة + أعلام الحالة)
 * - {@link ClassifiedDraft} — مسودة تصنيف مع نص وثقة
 * - {@link isElementType} — حارس نوع لـ ElementType
 * - {@link fromLegacyElementType} — محوّل من الصيغة القديمة إلى الحديثة
 * - {@link toLegacyElementType} — محوّل من الصيغة الحديثة إلى القديمة
 */

/**
 * نوع عنصر السيناريو — 8 أنواع بصيغة camelCase.
 *
 * تُستخدم في جميع أنظمة التصنيف وعُقد Tiptap وواجهة المستخدم.
 */
export type ElementType =
  | "basmala"
  | "sceneHeaderTopLine"
  | "sceneHeader3"
  | "action"
  | "character"
  | "dialogue"
  | "parenthetical"
  | "transition";

/**
 * نوع عنصر السيناريو بالصيغة القديمة (kebab-case).
 *
 * تُستخدم للتوافق مع المخرجات القديمة وواجهات API.
 * التحويل عبر {@link fromLegacyElementType} و {@link toLegacyElementType}.
 */
export type LegacyElementType =
  | "basmala"
  | "scene-header-top-line"
  | "scene-header-3"
  | "action"
  | "character"
  | "dialogue"
  | "parenthetical"
  | "transition";

/**
 * طريقة التصنيف المُستخدمة لتحديد نوع السطر.
 *
 * - `regex` — تطابق مباشر مع نمط regex (أعلى ثقة)
 * - `context` — استنتاج من سياق الأسطر السابقة
 * - `fallback` — قيمة افتراضية عند فشل القواعد الأخرى
 * - `ml` — تصحيح من مراجعة AI عبر {@link PasteClassifier}
 */
export type ClassificationMethod = "regex" | "context" | "fallback" | "ml";

/**
 * سطر مُصنّف — نتيجة نهائية لتصنيف سطر واحد.
 */
export interface ClassifiedLine {
  readonly lineIndex: number;
  readonly text: string;
  readonly assignedType: ElementType;
  readonly originalConfidence: number;
  readonly classificationMethod: ClassificationMethod;
}

/**
 * نتيجة كاشف شبهة واحد من {@link PostClassificationReviewer}.
 *
 * كل كاشف ينتج `suspicionScore` (0–100) و `reason` نصي
 * واقتراح نوع بديل اختياري `suggestedType`.
 */
export interface DetectorFinding {
  readonly detectorId: string;
  readonly suspicionScore: number;
  readonly reason: string;
  readonly suggestedType: ElementType | null;
}

/**
 * مسار التصفية النهائي للسطر بعد حساب سكور التصعيد.
 *
 * - `pass` — يمر بدون أي تدخل
 * - `local-review` — قابل للتصحيح المحلي فقط
 * - `agent-candidate` — مرشح للتصعيد للوكيل بعد فلاتر الجودة
 * - `agent-forced` — تصعيد إلزامي للوكيل
 */
export type SuspicionRoutingBand =
  | "pass"
  | "local-review"
  | "agent-candidate"
  | "agent-forced";

/**
 * تفصيل رقمي لمكونات سكور التصعيد.
 */
export interface SuspicionScoreBreakdown {
  readonly detectorBase: number;
  readonly methodPenalty: number;
  readonly confidencePenalty: number;
  readonly evidenceDiversityBoost: number;
  readonly suggestionBoost: number;
  readonly criticalMismatchBoost: number;
}

/**
 * سطر مشبوه — يجمع كل نتائج الكواشف مع السياق المحيط.
 *
 * `totalSuspicion` = مجموع `suspicionScore` لجميع النتائج.
 * `contextLines` = الأسطر المحيطة (±2 عادةً) لتوفير سياق المراجعة.
 */
export interface SuspiciousLine {
  readonly line: ClassifiedLine;
  readonly totalSuspicion: number;
  readonly findings: readonly DetectorFinding[];
  readonly contextLines: readonly ClassifiedLine[];
  readonly routingBand: SuspicionRoutingBand;
  readonly escalationScore: number;
  readonly distinctDetectors: number;
  readonly criticalMismatch: boolean;
  readonly breakdown: SuspicionScoreBreakdown;
}

/**
 * حزمة مراجعة AI — تُرسل إلى نقطة نهاية `/api/agent/review`.
 *
 * تحتوي على الأسطر المشبوهة فقط (عتبة: suspicion ≥ 74 مع ≥ 2 نتائج).
 * `suspicionRate` = نسبة الأسطر المشبوهة من إجمالي الأسطر المراجعة.
 */
export interface LLMReviewPacket {
  readonly totalSuspicious: number;
  readonly totalReviewed: number;
  readonly suspicionRate: number;
  readonly suspiciousLines: readonly SuspiciousLine[];
}

/**
 * سياق التصنيف — يُمرَّر لكل دالة تصنيف لتوفير معلومات الأسطر السابقة.
 *
 * - `previousTypes` — آخر 6 أنواع (الأحدث في النهاية)
 * - `previousType` — النوع السابق مباشرة (أو `null` للسطر الأول)
 * - `isInDialogueBlock` — `true` إذا كان السياق داخل كتلة حوار نشطة
 * - `isAfterSceneHeaderTopLine` — `true` إذا كان السطر السابق رأس مشهد علوي
 */
export interface ClassificationContext {
  readonly previousTypes: readonly ElementType[];
  readonly previousType: ElementType | null;
  readonly isInDialogueBlock: boolean;
  readonly isAfterSceneHeaderTopLine: boolean;
}

/**
 * مسودة تصنيف — نتيجة أولية قبل المراجعة اللاحقة.
 *
 * تُستخدم في {@link PasteClassifier} كمخرج وسيط.
 * `header1`/`header2` تُملأ فقط لعُقد `sceneHeaderTopLine`.
 */
export interface ClassifiedDraft {
  readonly type: ElementType;
  readonly text: string;
  readonly header1?: string;
  readonly header2?: string;
  readonly confidence: number;
  readonly classificationMethod: ClassificationMethod;
}

const LEGACY_TO_ELEMENT: Record<LegacyElementType, ElementType> = {
  basmala: "basmala",
  "scene-header-top-line": "sceneHeaderTopLine",
  "scene-header-3": "sceneHeader3",
  action: "action",
  character: "character",
  dialogue: "dialogue",
  parenthetical: "parenthetical",
  transition: "transition",
};

const ELEMENT_TO_LEGACY: Record<ElementType, LegacyElementType> = {
  basmala: "basmala",
  sceneHeaderTopLine: "scene-header-top-line",
  sceneHeader3: "scene-header-3",
  action: "action",
  character: "character",
  dialogue: "dialogue",
  parenthetical: "parenthetical",
  transition: "transition",
};

/**
 * حارس نوع — يتحقق إذا كانت السلسلة النصية عضواً صالحاً في {@link ElementType}.
 *
 * @param value - السلسلة النصية للفحص
 * @returns `true` إذا كانت نوع عنصر صالح
 */
export function isElementType(value: string): value is ElementType {
  return value in ELEMENT_TO_LEGACY;
}

/**
 * يحوّل من الصيغة القديمة (kebab-case) إلى {@link ElementType} (camelCase).
 *
 * يقبل أيضاً الصيغة الحديثة مباشرة. يُعيد `null` إذا لم يتطابق.
 *
 * @param value - السلسلة النصية (قديمة أو حديثة)
 * @returns نوع العنصر أو `null`
 *
 * @example
 * ```ts
 * fromLegacyElementType('scene-header-top-line') // 'sceneHeaderTopLine'
 * fromLegacyElementType('action')                // 'action'
 * fromLegacyElementType('unknown')               // null
 * ```
 */
export function fromLegacyElementType(value: string): ElementType | null {
  if (value in LEGACY_TO_ELEMENT) {
    return LEGACY_TO_ELEMENT[value as LegacyElementType];
  }
  if (isElementType(value)) return value;
  return null;
}

/**
 * يحوّل من {@link ElementType} (camelCase) إلى {@link LegacyElementType} (kebab-case).
 *
 * @param value - نوع العنصر الحديث
 * @returns الصيغة القديمة
 *
 * @example
 * ```ts
 * toLegacyElementType('sceneHeaderTopLine') // 'scene-header-top-line'
 * ```
 */
export function toLegacyElementType(value: ElementType): LegacyElementType {
  return ELEMENT_TO_LEGACY[value];
}
