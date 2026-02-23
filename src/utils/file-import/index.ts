/**
 * @module utils/file-import
 * @description نقطة إعادة التصدير الموحدة لنظام استيراد الملفات الفرعي.
 * يجمع كل الوحدات: file-picker، preprocessor، open-pipeline، extract،
 * document-model، structure-pipeline، plain-text-to-blocks.
 *
 * @example
 * ```ts
 * import {
 *   pickImportFile,
 *   extractImportedFile,
 *   buildFileOpenPipelineAction,
 *   htmlToScreenplayBlocks,
 * } from '@/utils/file-import'
 * ```
 */
export { pickImportFile } from "./file-picker";

export {
  preprocessImportedTextForClassifier,
  normalizeDocTextFromAntiword,
  computeImportedTextQualityScore,
  type ImportPreprocessResult,
} from "./preprocessor";

export {
  buildFileOpenPipelineAction,
  type FileOpenPipelineAction,
} from "./open-pipeline";

export {
  extractImportedFile,
  type ExtractImportedFileOptions,
} from "./extract";

export {
  isBackendExtractionConfigured,
  extractFileWithBackend,
  type BackendExtractOptions,
} from "./extract/backend-extract";

export {
  htmlToScreenplayBlocks,
  screenplayBlocksToHtml,
  createPayloadFromBlocks,
  createPayloadFromHtml,
  buildPayloadMarker,
  extractEncodedPayloadMarker,
  extractPayloadFromText,
  encodeScreenplayPayload,
  decodeScreenplayPayload,
  ensurePayloadChecksum,
  SCREENPLAY_PAYLOAD_TOKEN,
  SCREENPLAY_PAYLOAD_VERSION,
  SCREENPLAY_BLOCK_FORMAT_IDS,
  type ScreenplayBlock,
  type ScreenplayFormatId,
  type ScreenplayPayloadV1,
} from "./document-model";

export {
  normalizeTextForStructure,
  segmentLinesStrict,
  buildStructuredBlocksFromText,
  buildProjectionGuardReport,
} from "./structure-pipeline";

export { plainTextToScreenplayBlocks } from "./plain-text-to-blocks";
