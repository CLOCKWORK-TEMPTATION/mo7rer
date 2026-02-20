/**
 * file-extraction.ts - منطق استخراج النصوص من الملفات (Server-side)
 * يدعم: txt, fountain, fdx, docx, pdf, doc
 */

import type {
  ExtractionMethod,
  FileExtractionResult,
  ImportedFileType,
} from "@/types/file-import";
import {
  computeImportedTextQualityScore,
} from "./file-import-preprocessor";
import { convertDocBufferToText } from "./doc-converter-flow";
import { runPdfConverterFlow } from "./pdf-converter-flow-runner";
import { extractPayloadFromText } from "./document-model";
import { buildStructuredBlocksFromText, normalizeTextForStructure } from "./structure-pipeline";

type ExtractionCoreResult = {
  text: string;
  method: ExtractionMethod;
  usedOcr: boolean;
  warnings: string[];
  attempts: string[];
  qualityScore?: number;
  normalizationApplied?: string[];
  structuredBlocks?: FileExtractionResult["structuredBlocks"];
  payloadVersion?: number;
};

function normalizeExtractedText(text: string): string {
  return normalizeTextForStructure(text);
}

const withStructuredBlocks = (
  result: ExtractionCoreResult
): ExtractionCoreResult => {
  const normalizedText = normalizeExtractedText(result.text);
  if (result.structuredBlocks && result.structuredBlocks.length > 0) {
    return {
      ...result,
      text: normalizedText,
    };
  }

  const structuredBlocks = buildStructuredBlocksFromText(normalizedText, {
    mergePolicy: "none",
    classifierRole: "label-only",
  }).blocks;

  return {
    ...result,
    text: normalizedText,
    structuredBlocks,
  };
};

function extractTextFromBuffer(buffer: Buffer): string {
  const utf8Text = buffer.toString("utf-8");
  const hasReplacementChars =
    utf8Text.includes("\uFFFD") || utf8Text.includes("�");
  if (!hasReplacementChars) return utf8Text;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const iconv = require("iconv-lite");
    const win1256Text = iconv.decode(buffer, "windows-1256") as string;
    if (win1256Text && !win1256Text.includes("\uFFFD")) {
      return win1256Text;
    }
  } catch {
    // pass
  }

  return buffer.toString("latin1");
}

const payloadToExtractionResult = (
  payload: NonNullable<ReturnType<typeof extractPayloadFromText>>,
  attempts: string[],
  warnings: string[]
): ExtractionCoreResult => {
  return {
    text: payload.blocks.map((block) => block.text).join("\n"),
    method: "app-payload",
    usedOcr: false,
    warnings,
    attempts,
    qualityScore: 1,
    normalizationApplied: ["payload-direct-restore"],
    structuredBlocks: payload.blocks,
    payloadVersion: payload.version,
  };
};

async function extractTextFromDocx(buffer: Buffer): Promise<ExtractionCoreResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mammoth = (await import("mammoth")) as any;
  const extractRawText =
    mammoth.extractRawText || mammoth.default?.extractRawText;
  const result = await extractRawText({ buffer });
  const text = normalizeExtractedText(result.value as string);
  const payload = extractPayloadFromText(text);
  if (payload) {
    return payloadToExtractionResult(payload, ["mammoth", "payload-marker"], []);
  }

  return {
    text,
    method: "mammoth",
    usedOcr: false,
    warnings: [],
    attempts: ["mammoth"],
    qualityScore: computeImportedTextQualityScore(text),
  };
}

async function extractTextFromPdf(
  buffer: Buffer,
  filename: string
): Promise<ExtractionCoreResult> {
  const warnings: string[] = [];
  const attempts: string[] = [];

  try {
    const converted = await runPdfConverterFlow(buffer, filename);
    attempts.push(...converted.attempts);
    warnings.push(...converted.warnings);

    const outputText = normalizeExtractedText(converted.text);
    if (!outputText.trim()) {
      throw new Error("pdf-converter-flow أعاد ملف TXT فارغًا.");
    }

    return {
      text: outputText,
      method: "ocr-mistral",
      usedOcr: true,
      warnings,
      attempts,
      qualityScore: computeImportedTextQualityScore(outputText),
    };
  } catch (error) {
    warnings.push(
      `فشل pdf-converter-flow: ${error instanceof Error ? error.message : "خطأ غير معروف"}`
    );
    throw new Error(`فشل استخراج نص من PDF.\nالتحذيرات:\n${warnings.join("\n")}`, {
      cause: error,
    });
  }
}

async function extractTextFromDoc(
  buffer: Buffer,
  filename: string
): Promise<ExtractionCoreResult> {
  const result = await convertDocBufferToText(buffer, filename);
  return {
    text: result.text,
    method: result.method,
    usedOcr: false,
    warnings: [...result.warnings],
    attempts: [...result.attempts],
    qualityScore: computeImportedTextQualityScore(result.text),
  };
}

export async function extractFileText(
  buffer: Buffer,
  filename: string,
  fileType: ImportedFileType
): Promise<FileExtractionResult> {
  switch (fileType) {
    case "txt":
    case "fountain":
    case "fdx": {
      const text = normalizeExtractedText(extractTextFromBuffer(buffer));
      const structuredBlocks = buildStructuredBlocksFromText(text, {
        mergePolicy: "none",
        classifierRole: "label-only",
      }).blocks;
      return {
        text,
        fileType,
        method: "native-text",
        usedOcr: false,
        warnings: [],
        attempts: ["native-text"],
        qualityScore: computeImportedTextQualityScore(text),
        structuredBlocks,
      };
    }

    case "docx": {
      const result = withStructuredBlocks(await extractTextFromDocx(buffer));
      return {
        ...result,
        fileType,
      };
    }

    case "pdf": {
      const result = withStructuredBlocks(await extractTextFromPdf(buffer, filename));
      return {
        ...result,
        fileType,
      };
    }

    case "doc": {
      const result = withStructuredBlocks(await extractTextFromDoc(buffer, filename));
      return {
        ...result,
        fileType,
      };
    }

    default:
      throw new Error(`نوع الملف غير مدعوم: ${fileType}`);
  }
}
