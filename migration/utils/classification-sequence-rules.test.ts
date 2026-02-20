import { describe, expect, it } from "vitest";

import {
  CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY,
  CLASSIFICATION_VALID_SEQUENCES,
  suggestTypeFromClassificationSequence,
} from "./classification-sequence-rules";

describe("classification sequence rules", () => {
  it("keeps scene-header-1 allowing action in classifier sequences", () => {
    const allowed = CLASSIFICATION_VALID_SEQUENCES.get("scene-header-1");
    expect(allowed?.has("action")).toBe(true);
  });

  it("keeps transition allowing scene-header-1/top-line/action", () => {
    const allowed = CLASSIFICATION_VALID_SEQUENCES.get("transition");
    expect(allowed?.has("scene-header-1")).toBe(true);
    expect(allowed?.has("scene-header-top-line")).toBe(true);
    expect(allowed?.has("action")).toBe(true);
  });

  it("keeps severity scores unchanged for core violations", () => {
    expect(CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get("character→character")).toBe(
      95
    );
    expect(CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get("transition→dialogue")).toBe(
      80
    );
  });

  it("suggests dialogue or parenthetical after character based on features", () => {
    expect(
      suggestTypeFromClassificationSequence("character", {
        isParenthetical: false,
        endsWithColon: false,
        wordCount: 3,
        hasPunctuation: false,
      })
    ).toBe("dialogue");

    expect(
      suggestTypeFromClassificationSequence("character", {
        isParenthetical: true,
        endsWithColon: false,
        wordCount: 2,
        hasPunctuation: false,
      })
    ).toBe("parenthetical");
  });
});
