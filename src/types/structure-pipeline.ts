import type { ScreenplayBlock } from '../utils/file-import/document-model'

export type StructurePipelineMergePolicy = 'none' | 'safe' | 'aggressive'

export type StructurePipelineClassifierRole = 'label-only' | 'limited-rewrite'

export type StructurePipelineProfile = 'strict-structure' | 'interactive-legacy'

export interface StructurePipelinePolicy {
  mergePolicy: StructurePipelineMergePolicy
  classifierRole: StructurePipelineClassifierRole
}

export interface StructurePipelineResult {
  normalizedText: string
  normalizedLines: string[]
  blocks: ScreenplayBlock[]
  policy: StructurePipelinePolicy
}

export interface ProjectionGuardReport {
  accepted: boolean
  reasons: string[]
  inputLineCount: number
  outputBlockCount: number
  currentBlockCount?: number
  currentNonActionCount?: number
  outputNonActionCount: number
  fallbackApplied: boolean
}

export const DEFAULT_STRUCTURE_PIPELINE_POLICY: StructurePipelinePolicy = {
  mergePolicy: 'none',
  classifierRole: 'label-only',
}
