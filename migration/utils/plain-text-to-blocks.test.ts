import { describe, expect, it } from "vitest";
import { plainTextToScreenplayBlocks } from "./plain-text-to-blocks";

describe("plainTextToScreenplayBlocks strict structure pipeline", () => {
  it("keeps each source line as an independent block (no auto-merge)", () => {
    const blocks = plainTextToScreenplayBlocks(
      ["بسم الله الرحمن الرحيم", "مشهد1", "داخلي - نهار", "وصف أول", "وصف ثاني"].join(
        "\n"
      )
    );

    expect(blocks).toHaveLength(5);
    expect(blocks.map((block) => block.text)).toEqual([
      "بسم الله الرحمن الرحيم",
      "مشهد1",
      "داخلي - نهار",
      "وصف أول",
      "وصف ثاني",
    ]);
  });

  it("normalizes mixed line endings and keeps strict segmentation", () => {
    const text = "سطر1\r\nسطر2\rسطر3\u2028سطر4\u2029سطر5";
    const blocks = plainTextToScreenplayBlocks(text);

    expect(blocks).toHaveLength(5);
    expect(blocks.map((block) => block.text)).toEqual([
      "سطر1",
      "سطر2",
      "سطر3",
      "سطر4",
      "سطر5",
    ]);
  });
});
