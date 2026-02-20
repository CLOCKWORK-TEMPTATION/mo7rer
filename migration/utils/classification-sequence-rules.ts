import type { LineType } from "@/types/screenplay";

/**
 * قواعد تسلسل التصنيف المستخدمة في classifier فقط.
 * لا تعتمد على قواعد الكتابة المباشرة داخل المحرر.
 */
export const CLASSIFICATION_VALID_SEQUENCES: ReadonlyMap<
  string,
  ReadonlySet<string>
> = new Map([
  ["character", new Set(["dialogue", "parenthetical"])],
  ["parenthetical", new Set(["dialogue"])],
  [
    "dialogue",
    new Set(["dialogue", "action", "character", "transition", "parenthetical"]),
  ],
  [
    "action",
    new Set([
      "action",
      "character",
      "transition",
      "scene-header-1",
      "scene-header-top-line",
    ]),
  ],
  ["transition", new Set(["scene-header-1", "scene-header-top-line", "action"])],
  [
    "scene-header-top-line",
    new Set([
      "action",
      "character",
      "transition",
      "scene-header-1",
      "scene-header-top-line",
    ]),
  ],
  [
    "scene-header-1",
    new Set(["scene-header-2", "scene-header-3", "action", "scene-header-top-line"]),
  ],
  ["scene-header-2", new Set(["scene-header-3", "action"])],
  ["scene-header-3", new Set(["action", "character"])],
  ["basmala", new Set(["scene-header-top-line", "scene-header-1", "action", "character"])],
]);

export const CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY: ReadonlyMap<string, number> =
  new Map([
    ["character→character", 95],
    ["parenthetical→action", 90],
    ["parenthetical→character", 90],
    ["parenthetical→transition", 90],
    ["transition→dialogue", 80],
    ["transition→character", 75],
    ["scene-header-1→dialogue", 70],
    ["scene-header-2→dialogue", 70],
    ["scene-header-3→dialogue", 70],
    ["scene-header-1→action", 75],
    ["scene-header-1→character", 75],
    ["scene-header-2→action", 75],
    ["scene-header-2→character", 75],
  ]);

export interface ClassificationSequenceSuggestionFeatures {
  isParenthetical: boolean;
  endsWithColon: boolean;
  wordCount: number;
  hasPunctuation: boolean;
}

export const suggestTypeFromClassificationSequence = (
  prevType: string,
  features: ClassificationSequenceSuggestionFeatures
): LineType | null => {
  if (prevType === "character") {
    return features.isParenthetical
      ? ("parenthetical" as LineType)
      : ("dialogue" as LineType);
  }

  if (prevType === "parenthetical") {
    return "dialogue" as LineType;
  }

  if (prevType === "dialogue") {
    if (features.endsWithColon || (features.wordCount <= 3 && !features.hasPunctuation)) {
      return "character" as LineType;
    }
    return "action" as LineType;
  }

  if (prevType === "transition") {
    return "scene-header-1" as LineType;
  }

  if (prevType === "scene-header-1") {
    return "scene-header-2" as LineType;
  }

  if (prevType === "scene-header-2") {
    return "scene-header-3" as LineType;
  }

  if (prevType === "scene-header-3") {
    return "action" as LineType;
  }

  return null;
};
