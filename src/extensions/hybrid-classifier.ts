/**
 * @module extensions/hybrid-classifier
 * @description
 * مصنّف هجين خفيف: regex قوي + سياق + ذاكرة قصيرة.
 *
 * يعمل كطبقة تصنيف ثانية بعد كواشف regex الأولية، ويُحسّن
 * الحالات الرمادية (السطور الغامضة) بدون تبعيات خارجية أو AI.
 *
 * يُصدّر:
 * - {@link HybridResult} — نتيجة التصنيف (نوع + ثقة + طريقة)
 * - {@link HybridClassifier} — الفئة الرئيسية مع `classifyLine()`
 *
 * سلّم الثقة:
 * | الحالة | الثقة |
 * |--------|-------|
 * | بسملة (regex) | 99 |
 * | رأس مشهد علوي (regex) | 96 |
 * | انتقال (regex) | 95 |
 * | شخصية معروفة من الذاكرة | 92 |
 * | نمط حوار ×3 | 86 |
 * | نمط وصف ×3 | 85 |
 * | قيمة احتياطية | 80 |
 *
 * يُستهلك في {@link PasteClassifier} → `classifyLines()`.
 */
import { isBasmalaLine } from "./basmala";
import type {
  ClassificationContext,
  ClassificationMethod,
  ElementType,
} from "./classification-types";
import type { ContextMemorySnapshot } from "./context-memory-manager";
import { isCompleteSceneHeaderLine } from "./scene-header-top-line";
import { isTransitionLine } from "./transition";
import { normalizeCharacterName } from "./text-utils";

/**
 * نتيجة التصنيف الهجين — نوع العنصر مع درجة الثقة وطريقة التصنيف.
 */
export interface HybridResult {
  readonly type: ElementType;
  readonly confidence: number;
  readonly classificationMethod: ClassificationMethod;
}

/**
 * مصنف هجين خفيف: regex قوي + سياق + ذاكرة قصيرة.
 * الهدف تحسين الحالات الرمادية بدون تبعيات خارجية.
 */
export class HybridClassifier {
  /**
   * يصنّف سطراً واحداً عبر سلسلة أولويات:
   * basmala → sceneHeaderTopLine → transition → شخصية معروفة → نمط سياقي → احتياطي.
   *
   * @param line - السطر الخام
   * @param fallbackType - النوع الاحتياطي من المصنّف الأولي
   * @param context - سياق التصنيف (الأنواع السابقة)
   * @param memory - لقطة ذاكرة السياق (تكرار الشخصيات + الأنواع الأخيرة)
   * @returns {@link HybridResult}
   */
  classifyLine(
    line: string,
    fallbackType: ElementType,
    context: ClassificationContext,
    memory: ContextMemorySnapshot
  ): HybridResult {
    if (isBasmalaLine(line)) {
      return { type: "basmala", confidence: 99, classificationMethod: "regex" };
    }

    if (isCompleteSceneHeaderLine(line)) {
      return {
        type: "sceneHeaderTopLine",
        confidence: 96,
        classificationMethod: "regex",
      };
    }

    if (isTransitionLine(line)) {
      return {
        type: "transition",
        confidence: 95,
        classificationMethod: "regex",
      };
    }

    if (fallbackType === "character") {
      const characterName = normalizeCharacterName(line);
      const seenCount = memory.characterFrequency.get(characterName) ?? 0;
      if (seenCount >= 1) {
        return {
          type: "character",
          confidence: 92,
          classificationMethod: "context",
        };
      }
    }

    const recentPattern = memory.recentTypes.slice(-3).join("-");
    if (
      recentPattern === "dialogue-dialogue-dialogue" &&
      context.previousType === "dialogue" &&
      fallbackType !== "action"
    ) {
      return {
        type: "dialogue",
        confidence: 86,
        classificationMethod: "context",
      };
    }

    if (
      recentPattern === "action-action-action" &&
      context.previousType === "action" &&
      fallbackType !== "dialogue"
    ) {
      return {
        type: "action",
        confidence: 85,
        classificationMethod: "context",
      };
    }

    return {
      type: fallbackType,
      confidence: 80,
      classificationMethod: "context",
    };
  }
}
