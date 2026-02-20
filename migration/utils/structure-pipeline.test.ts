import { describe, expect, it } from "vitest";
import {
  buildProjectionGuardReport,
  buildStructuredBlocksFromText,
} from "./structure-pipeline";

describe("structure pipeline", () => {
  it("builds strict line-preserving blocks", () => {
    const result = buildStructuredBlocksFromText(
      "بسم الله الرحمن الرحيم\nمشهد1\nداخلي - نهار\nوصف"
    );

    expect(result.normalizedLines.length).toBe(4);
    expect(result.blocks.length).toBe(4);
    expect(result.blocks.map((block) => block.text)).toEqual(result.normalizedLines);
    expect(result.blocks.map((block) => block.formatId)).toEqual([
      "basmala",
      "scene-header-1",
      "scene-header-2",
      "action",
    ]);
  });

  it("classifies scene header chain 1 -> 2 -> 3 explicitly", () => {
    const result = buildStructuredBlocksFromText(
      "مشهد 12\nداخلي - نهار\nشقة سيد - الصالة\nيدخل أحمد"
    );

    expect(result.blocks.map((block) => block.formatId)).toEqual([
      "scene-header-1",
      "scene-header-2",
      "scene-header-3",
      "action",
    ]);
  });

  it("classifies complete top line as scene-header-top-line then scene-header-3", () => {
    const result = buildStructuredBlocksFromText(
      "مشهد 5 داخلي - ليل\nفيلا العائلة - الحديقة\nيجلس الجميع"
    );

    expect(result.blocks.map((block) => block.formatId)).toEqual([
      "scene-header-top-line",
      "scene-header-3",
      "action",
    ]);
  });

  it("does not force scene-header-3 when next line is clearly action", () => {
    const result = buildStructuredBlocksFromText(
      "مشهد 2\nداخلي - نهار\nيجلس أحمد على الكرسي"
    );

    expect(result.blocks.map((block) => block.formatId)).toEqual([
      "scene-header-1",
      "scene-header-2",
      "action",
    ]);
  });

  it("rejects destructive projection collapse", () => {
    const report = buildProjectionGuardReport({
      inputLineCount: 12,
      currentBlocks: Array.from({ length: 12 }, (_, index) => ({
        formatId: index % 2 === 0 ? "action" : "dialogue",
        text: `line-${index}`,
      })),
      nextBlocks: [{ formatId: "action", text: "collapsed" }],
    });

    expect(report.accepted).toBe(false);
    expect(report.reasons.length).toBeGreaterThan(0);
  });

  it("accepts projections that keep structure ratio", () => {
    const report = buildProjectionGuardReport({
      inputLineCount: 8,
      currentBlocks: Array.from({ length: 8 }, (_, index) => ({
        formatId: index % 3 === 0 ? "character" : "action",
        text: `line-${index}`,
      })),
      nextBlocks: Array.from({ length: 8 }, (_, index) => ({
        formatId: index % 3 === 0 ? "character" : "action",
        text: `line-${index}`,
      })),
    });

    expect(report.accepted).toBe(true);
    expect(report.reasons).toEqual([]);
  });
});
