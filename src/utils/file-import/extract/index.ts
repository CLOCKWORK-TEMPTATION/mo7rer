/**
 * @module utils/file-import/extract
 * @description منسّق الاستخراج المركزي. يختار الاستراتيجية المناسبة لكل نوع ملف:
 *
 * - `doc` → Backend أولاً + best-effort داخل المتصفح عند التعذر
 * - `pdf` → متصفح أولاً + فحص جودة (عتبة {@link LOW_PDF_QUALITY_THRESHOLD})
 *   مع بديل Backend احتياطي عند الجودة المنخفضة
 * - أخرى → متصفح أولاً + بديل Backend احتياطي عند الفشل
 *
 * بعد الاستخراج يمرّ كل نتيجة عبر {@link finalizeExtraction} الذي يُطبّق
 * المعالجة المسبقة ويفحص وجود Payload Marker لاسترجاع البنية مباشرة.
 */
import type { FileExtractionResult } from "../../../types/file-import";
import { getFileType } from "../../../types/file-import";
import { extractPayloadFromText } from "../document-model";
import { logger } from "../../logger";
import {
  computeImportedTextQualityScore,
  preprocessImportedTextForClassifier,
} from "../preprocessor";
import {
  buildStructuredBlocksFromText,
  normalizeTextForStructure,
} from "../structure-pipeline";
import {
  extractFileInBrowser,
  isBrowserExtractionSupported,
} from "./browser-extract";
import {
  extractFileWithBackend,
  isBackendExtractionConfigured,
  type BackendExtractOptions,
} from "./backend-extract";

const importExtractLogger = logger.createScope("file-import.extract");

/** عتبة الجودة التي تُحفّز التحويل إلى Backend لملفات PDF */
const LOW_PDF_QUALITY_THRESHOLD = 0.42;
const STRICT_PASTE_PARITY_TYPES = new Set<FileExtractionResult["fileType"]>([
  "doc",
  "docx",
]);

/**
 * خيارات الاستخراج الموحّدة.
 * @property pdfLowQualityThreshold - عتبة الجودة لملفات PDF (الافتراضي: 0.42)
 */
export interface ExtractImportedFileOptions extends BackendExtractOptions {
  pdfLowQualityThreshold?: number;
}

/**
 * يُنهي نتيجة الاستخراج بتطبيق:
 * 1. المعالجة المسبقة ({@link preprocessImportedTextForClassifier})
 * 2. فحص Payload Marker لاسترجاع البنية
 * 3. حساب درجة الجودة ({@link computeImportedTextQualityScore})
 */
const normalizeExtractedText = (text: string): string =>
  normalizeTextForStructure(text);

const withStructuredBlocks = (
  result: FileExtractionResult
): FileExtractionResult => {
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

const finalizeExtraction = (
  result: FileExtractionResult
): FileExtractionResult => {
  const sourceText = typeof result.text === "string" ? result.text : "";

  // فتح doc/docx يجب أن يمرّ بالنص الخام كما هو لمسار اللصق القديم.
  // بدون preprocessing أو payload parsing أو بناء structured blocks.
  if (STRICT_PASTE_PARITY_TYPES.has(result.fileType)) {
    return {
      ...result,
      text: sourceText,
      normalizationApplied: result.normalizationApplied ?? [],
      qualityScore: computeImportedTextQualityScore(sourceText),
    };
  }

  const normalizedText = normalizeExtractedText(sourceText);

  if (result.method === "app-payload") {
    return {
      ...withStructuredBlocks({
        ...result,
        text: normalizedText,
      }),
      qualityScore: result.qualityScore ?? 1,
      normalizationApplied: result.normalizationApplied ?? [
        "payload-direct-restore",
      ],
    };
  }

  const payload = extractPayloadFromText(normalizedText);
  if (payload) {
    return {
      text: payload.blocks.map((block) => block.text).join("\n"),
      fileType: result.fileType,
      method: "app-payload",
      usedOcr: result.usedOcr,
      warnings: result.warnings,
      attempts: [...result.attempts, "payload-marker"],
      qualityScore: 1,
      normalizationApplied: ["payload-direct-restore"],
      structuredBlocks: payload.blocks,
      payloadVersion: payload.version,
    };
  }

  const preprocessed = preprocessImportedTextForClassifier(
    normalizedText,
    result.fileType
  );
  const normalizedApplied = [
    ...(result.normalizationApplied ?? []),
    ...preprocessed.applied,
  ];

  const finalized = withStructuredBlocks({
    ...result,
    text: preprocessed.text,
    normalizationApplied: normalizedApplied,
  });

  return {
    ...finalized,
    qualityScore:
      finalized.qualityScore ?? computeImportedTextQualityScore(finalized.text),
    normalizationApplied: normalizedApplied,
  };
};

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "خطأ غير معروف";

const isLikelyBackendConnectivityIssue = (error: unknown): boolean => {
  const message = toErrorMessage(error).toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("err_connection_refused") ||
    message.includes("timed out") ||
    message.includes("تعذر الاتصال")
  );
};

/**
 * نقطة الدخول الرئيسية لاستخراج الملفات المستوردة.
 *
 * يختار الاستراتيجية حسب نوع الملف ويُطبّق المعالجة المسبقة تلقائياً.
 *
 * @param file - كائن الملف من مربع حوار الاختيار
 * @param options - خيارات اختيارية (endpoint، مهلة، عتبة PDF)
 * @returns نتيجة الاستخراج النهائية
 * @throws {Error} إذا كان نوع الملف غير مدعوم أو فشل كل المسارات
 */
export const extractImportedFile = async (
  file: File,
  options?: ExtractImportedFileOptions
): Promise<FileExtractionResult> => {
  const fileType = getFileType(file.name);
  if (!fileType) {
    throw new Error(`نوع الملف غير مدعوم: ${file.name}`);
  }

  const backendAvailable = isBackendExtractionConfigured(options?.endpoint);
  const browserSupported = isBrowserExtractionSupported(fileType);
  importExtractLogger.telemetry("extract-started", {
    filename: file.name,
    fileType,
    backendAvailable,
    browserSupported,
  });

  if (fileType === "doc") {
    if (backendAvailable) {
      try {
        const backendResult = await extractFileWithBackend(
          file,
          fileType,
          options
        );
        importExtractLogger.telemetry("extract-completed", {
          fileType,
          strategy: "doc-backend-first",
          method: backendResult.method,
        });
        return finalizeExtraction(backendResult);
      } catch (backendError) {
        importExtractLogger.warn(
          "DOC backend extraction failed, trying browser best-effort",
          {
            backendError: toErrorMessage(backendError),
          }
        );
        const browserFallback = finalizeExtraction(
          await extractFileInBrowser(file, fileType)
        );
        importExtractLogger.telemetry("extract-completed", {
          fileType,
          strategy: "doc-browser-fallback",
          method: browserFallback.method,
        });
        return {
          ...browserFallback,
          warnings: [
            `تعذر مسار Backend لـ DOC: ${toErrorMessage(backendError)}`,
            ...browserFallback.warnings,
          ],
          attempts: [...browserFallback.attempts, "backend-doc-failed"],
        };
      }
    }

    const browserResult = finalizeExtraction(
      await extractFileInBrowser(file, fileType)
    );
    importExtractLogger.telemetry("extract-completed", {
      fileType,
      strategy: "doc-browser-best-effort",
      method: browserResult.method,
    });
    return browserResult;
  }

  if (fileType === "docx") {
    if (!backendAvailable) {
      throw new Error(
        "استخراج DOCX يتطلب Backend extraction endpoint. شغّل pnpm run dev أو اضبط VITE_FILE_IMPORT_BACKEND_URL."
      );
    }

    try {
      const backendResult = await extractFileWithBackend(
        file,
        fileType,
        options
      );
      importExtractLogger.telemetry("extract-completed", {
        fileType,
        strategy: "docx-backend",
        method: backendResult.method,
      });
      return finalizeExtraction(backendResult);
    } catch (backendError) {
      throw new Error(
        `فشل استخراج DOCX عبر Backend: ${toErrorMessage(backendError)}.`
      );
    }
  }

  if (fileType === "pdf") {
    if (backendAvailable) {
      try {
        const backendResult = finalizeExtraction(
          await extractFileWithBackend(file, fileType, options)
        );
        importExtractLogger.telemetry("extract-completed", {
          fileType,
          strategy: "pdf-backend-first",
          method: backendResult.method,
        });
        return backendResult;
      } catch (backendError) {
        importExtractLogger.warn(
          "PDF backend extraction failed, trying browser text-layer fallback",
          {
            backendError: toErrorMessage(backendError),
          }
        );

        try {
          const browserResult = finalizeExtraction(
            await extractFileInBrowser(file, fileType)
          );
          const threshold =
            options?.pdfLowQualityThreshold ?? LOW_PDF_QUALITY_THRESHOLD;
          const quality = browserResult.qualityScore ?? 0;

          const warnings = [
            `تعذر مسار Backend لـ PDF: ${toErrorMessage(backendError)}`,
            ...browserResult.warnings,
          ];

          if (quality > 0 && quality < threshold) {
            warnings.push(
              "جودة استخراج PDF عبر text-layer منخفضة؛ يُفضّل إصلاح Backend OCR."
            );
          }

          importExtractLogger.telemetry("extract-completed", {
            fileType,
            strategy: "pdf-browser-fallback",
            method: browserResult.method,
          });
          return {
            ...browserResult,
            warnings,
            attempts: [...browserResult.attempts, "backend-pdf-failed"],
          };
        } catch (browserError) {
          const backendReason = toErrorMessage(backendError);
          const browserReason = toErrorMessage(browserError);
          if (isLikelyBackendConnectivityIssue(backendError)) {
            throw new Error(
              `تعذر استخراج PDF عبر Backend: ${backendReason}. وفشل text-layer fallback: ${browserReason}.`
            );
          }
          throw new Error(
            `فشل Backend OCR لـ PDF: ${backendReason}. وفشل text-layer fallback: ${browserReason}.`
          );
        }
      }
    }

    try {
      const browserResult = finalizeExtraction(
        await extractFileInBrowser(file, fileType)
      );
      const threshold =
        options?.pdfLowQualityThreshold ?? LOW_PDF_QUALITY_THRESHOLD;
      const quality = browserResult.qualityScore ?? 0;
      if (quality > 0 && quality < threshold) {
        browserResult.warnings = [
          ...browserResult.warnings,
          "جودة استخراج PDF منخفضة ولا يوجد Backend OCR fallback مفعّل.",
        ];
      }
      importExtractLogger.telemetry("extract-completed", {
        fileType,
        strategy: "pdf-browser",
        method: browserResult.method,
      });
      return browserResult;
    } catch (browserError) {
      throw new Error(
        `فشل استخراج PDF في المتصفح: ${toErrorMessage(browserError)}. ولا يوجد Backend fallback.`
      );
    }
  }

  if (browserSupported) {
    try {
      const browserResult = await extractFileInBrowser(file, fileType);
      importExtractLogger.telemetry("extract-completed", {
        fileType,
        strategy: "browser-first",
        method: browserResult.method,
      });
      return finalizeExtraction(browserResult);
    } catch (browserError) {
      if (!backendAvailable) {
        throw new Error(`فشل استخراج الملف: ${toErrorMessage(browserError)}`);
      }

      try {
        const backendResult = await extractFileWithBackend(
          file,
          fileType,
          options
        );
        importExtractLogger.warn(
          "Browser extraction failed, backend fallback used",
          {
            fileType,
            browserError: toErrorMessage(browserError),
            backendMethod: backendResult.method,
          }
        );
        return finalizeExtraction({
          ...backendResult,
          warnings: [
            `فشل مسار المتصفح: ${toErrorMessage(browserError)}`,
            ...backendResult.warnings,
          ],
        });
      } catch (backendError) {
        throw new Error(
          `فشل مسار المتصفح: ${toErrorMessage(browserError)}. وفشل مسار Backend: ${toErrorMessage(backendError)}.`
        );
      }
    }
  }

  if (!backendAvailable) {
    throw new Error(
      `نوع الملف ${fileType} غير مدعوم في المتصفح ولا يوجد Backend fallback.`
    );
  }

  try {
    const backendResult = await extractFileWithBackend(file, fileType, options);
    importExtractLogger.telemetry("extract-completed", {
      fileType,
      strategy: "backend-only",
      method: backendResult.method,
    });
    return finalizeExtraction(backendResult);
  } catch (backendError) {
    if (!backendAvailable) {
      throw new Error(`فشل استخراج الملف: ${toErrorMessage(backendError)}`);
    }
    throw new Error(`فشل مسار Backend: ${toErrorMessage(backendError)}.`);
  }
};
