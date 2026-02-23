import { describe, expect, it } from "vitest";
import {
  buildProjectionGuardReport,
  buildStructuredBlocksFromText,
  normalizeTextForStructure,
  segmentLinesStrict,
} from "../../../src/utils/file-import/structure-pipeline";
import type { ScreenplayBlock } from "../../../src/utils/file-import/document-model";

describe("structure-pipeline", () => {
  it("normalizes control characters and mixed newlines", () => {
    const input = "\uFEFFمشهد 1\r\nداخلي - ليل\rغرفة\u0000";
    const normalized = normalizeTextForStructure(input);
    expect(normalized).toContain("مشهد 1\nداخلي - ليل\nغرفة");
    expect(normalized.includes("\r")).toBe(false);
    expect(normalized.includes("\u0000")).toBe(false);
  });

  it("segments lines strictly without empty lines", () => {
    const lines = segmentLinesStrict("  مشهد 1  \n\n  داخلي - ليل \n");
    expect(lines).toEqual(["مشهد 1", "داخلي - ليل"]);
  });

  it("classifies scene-header triplet and dialogue flow", () => {
    const input = "مشهد 3\nداخلي - ليل\nغرفة الاجتماعات\nسارة:\nمستعدة";
    const result = buildStructuredBlocksFromText(input);
    expect(result.blocks.map((block) => block.formatId)).toEqual([
      "scene-header-1",
      "scene-header-2",
      "scene-header-3",
      "character",
      "dialogue",
    ]);
  });

  it("projection guard rejects destructive collapse against existing document", () => {
    const currentBlocks: ScreenplayBlock[] = new Array(14)
      .fill(null)
      .map((_, index) => ({
        formatId: index % 2 === 0 ? "dialogue" : "action",
        text: `line ${index}`,
      }));
    const nextBlocks: ScreenplayBlock[] = [
      { formatId: "action", text: "collapsed" },
    ];

    const report = buildProjectionGuardReport({
      inputLineCount: 12,
      currentBlocks,
      nextBlocks,
      policy: { classifierRole: "label-only", mergePolicy: "safe" },
    });

    expect(report.accepted).toBe(false);
    expect(report.reasons.length).toBeGreaterThan(0);
  });
});
