/**
 * @module types/index
 * @description ملف البرميل (barrel) لمجلد الأنماط — يُعيد تصدير جميع الأنماط والقيم من الوحدات الفرعية
 *
 * يُتيح الاستيراد الموحد من `@/types` بدلاً من تحديد المسار الكامل لكل ملف:
 * ```typescript
 * import type { LineType, DocumentStats, EditorEngineAdapter } from '@/types'
 * ```
 */

export type { DocumentStats, LineType } from './screenplay'
export type {
  FileImportMode,
  ImportedFileType,
  ExtractionMethod,
  FileExtractionResult,
  FileExtractionRequest,
  FileExtractionResponse,
} from './file-import'
export { ACCEPTED_FILE_EXTENSIONS, getFileType } from './file-import'
export type {
  StructurePipelineMergePolicy,
  StructurePipelineClassifierRole,
  StructurePipelineProfile,
  StructurePipelinePolicy,
  StructurePipelineResult,
  ProjectionGuardReport,
} from './structure-pipeline'
export { DEFAULT_STRUCTURE_PIPELINE_POLICY } from './structure-pipeline'
export {
  FILMLANE_CLIPBOARD_MIME,
} from './editor-clipboard'
export type {
  ClipboardSourceKind,
  ClipboardOrigin,
  EditorClipboardPayload,
} from './editor-clipboard'
export type {
  RunEditorCommandOptions,
  EditorEngineAdapter,
} from './editor-engine'
export type {
  TypingSystemMode,
  TypingWorkflowScope,
  PasteWorkflowRunSource,
  PasteWorkflowReviewProfile,
  PasteWorkflowPolicyProfile,
  RunDocumentThroughPasteWorkflowOptions,
  TypingSystemSettings,
} from './typing-system'
export {
  DEFAULT_TYPING_SYSTEM_SETTINGS,
  sanitizeTypingSystemSettings,
  minutesToMilliseconds,
} from './typing-system'
export type {
  AgentReviewContextLine,
  AgentSuspiciousLinePayload,
  AgentReviewRequestPayload,
  AgentReviewDecision,
  AgentReviewResponsePayload,
} from './agent-review'
