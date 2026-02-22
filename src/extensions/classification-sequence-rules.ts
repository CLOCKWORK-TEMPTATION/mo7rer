/**
 * @module extensions/classification-sequence-rules
 * @description
 * قواعد تسلسل التصنيف — يحدد التسلسلات الصالحة بين أنواع عناصر السيناريو
 * ودرجات خطورة الانتهاكات.
 *
 * يُصدّر:
 * - {@link SequenceSuggestionFeatures} — خصائص السطر المُستخدمة لاقتراح النوع
 * - {@link CLASSIFICATION_VALID_SEQUENCES} — خريطة التسلسلات الصالحة (نوع → أنواع تالية مسموحة)
 * - {@link CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY} — درجة خطورة كل انتهاك تسلسل
 * - {@link suggestTypeFromClassificationSequence} — يقترح النوع التالي بناءً على النوع السابق والخصائص
 *
 * يُستهلك في {@link PostClassificationReviewer} لكشف انتهاكات التسلسل.
 */
import type { ElementType } from './classification-types'

/**
 * خصائص السطر المُستخدمة في {@link suggestTypeFromClassificationSequence}
 * لاقتراح النوع الأنسب بناءً على سمات النص.
 */
export interface SequenceSuggestionFeatures {
  readonly wordCount: number
  readonly startsWithDash: boolean
  readonly isParenthetical: boolean
  readonly hasActionIndicators: boolean
  readonly endsWithColon: boolean
}

/**
 * خريطة التسلسلات الصالحة — لكل نوع عنصر، مجموعة الأنواع المسموح أن تليه.
 *
 * مثال: بعد `character` يُسمح فقط بـ `dialogue` أو `parenthetical`.
 * أي تسلسل غير موجود يُعد انتهاكاً.
 */
export const CLASSIFICATION_VALID_SEQUENCES: ReadonlyMap<ElementType, ReadonlySet<ElementType>> = new Map([
  ['basmala', new Set<ElementType>(['sceneHeaderTopLine'])],
  ['sceneHeaderTopLine', new Set<ElementType>(['sceneHeader3'])],
  ['sceneHeader3', new Set<ElementType>(['action'])],
  ['action', new Set<ElementType>(['action', 'character', 'transition', 'sceneHeaderTopLine'])],
  ['character', new Set<ElementType>(['dialogue', 'parenthetical'])],
  ['dialogue', new Set<ElementType>(['dialogue', 'character', 'action', 'transition', 'parenthetical'])],
  ['parenthetical', new Set<ElementType>(['dialogue', 'character', 'action', 'transition'])],
  ['transition', new Set<ElementType>(['sceneHeaderTopLine', 'sceneHeader3'])],
])

/**
 * درجة خطورة انتهاكات التسلسل — كلما زادت القيمة زادت الشبهة.
 *
 * المفتاح بصيغة `'نوع_سابق→نوع_حالي'`.
 * القيم: 72–90 (الأعلى = الأكثر شذوذاً).
 *
 * @example
 * ```ts
 * CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get('character→character') // 90
 * ```
 */
export const CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY: ReadonlyMap<string, number> = new Map([
  ['character→character', 90],
  ['character→action', 82],
  ['character→transition', 84],
  ['dialogue→dialogue', 72],
  ['sceneHeaderTopLine→action', 86],
  ['sceneHeaderTopLine→character', 88],
  ['sceneHeader3→character', 78],
  ['transition→dialogue', 85],
])

/**
 * يقترح النوع التالي بناءً على النوع السابق وخصائص السطر الحالي.
 *
 * ترتيب الأولوية:
 * 1. قواعد إلزامية: sceneHeaderTopLine→sceneHeader3، sceneHeader3→action، transition→sceneHeaderTopLine
 * 2. بعد character: parenthetical (إذا بين أقواس) أو dialogue
 * 3. بعد dialogue + سطر قصير بنقطتين: character
 * 4. خصائص عامة: شرطة→action، نقطتين→character، قصير→dialogue
 *
 * @param prevType - نوع العنصر السابق
 * @param features - خصائص السطر الحالي
 * @returns النوع المقترح أو `null` إذا لم يتمكن من الاقتراح
 */
export function suggestTypeFromClassificationSequence(
  prevType: ElementType,
  features: SequenceSuggestionFeatures
): ElementType | null {
  if (prevType === 'sceneHeaderTopLine') return 'sceneHeader3'
  if (prevType === 'sceneHeader3') return 'action'
  if (prevType === 'transition') return 'sceneHeaderTopLine'
  if (prevType === 'character') {
    if (features.isParenthetical) return 'parenthetical'
    return 'dialogue'
  }
  if (prevType === 'dialogue' && features.endsWithColon && features.wordCount <= 5) {
    return 'character'
  }

  if (features.isParenthetical) return 'parenthetical'
  if (features.startsWithDash || features.hasActionIndicators) return 'action'
  if (features.endsWithColon && features.wordCount <= 5) return 'character'
  if (features.wordCount <= 4) return 'dialogue'

  return null
}
