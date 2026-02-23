import { describe, expect, it } from "vitest";
import {
  buildFullHtmlDocument,
  sanitizeExportFileBaseName,
} from "../../src/utils/exporters";

describe("exporters", () => {
  it("sanitizes export file names for cross-platform compatibility", () => {
    expect(sanitizeExportFileBaseName(" draft:scene*01 ")).toBe(
      "draft-scene-01"
    );
    expect(sanitizeExportFileBaseName("")).toBe("screenplay");
  });

  it("builds a full standalone HTML export document", () => {
    const output = buildFullHtmlDocument(
      '<div data-type="action">اختبار</div>',
      "اختبار"
    );
    expect(output).toContain("<!DOCTYPE html>");
    expect(output).toContain('dir="rtl"');
    expect(output).toContain("<title>اختبار</title>");
  });
});
