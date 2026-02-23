import type { FileExtractionResult } from '../../src/types/file-import'
import type { StructurePipelinePolicy } from '../../src/types/structure-pipeline'
import type { ScreenplayBlock } from '../../src/utils/file-import'

export interface StructurePipelineHarnessCase {
  name: string
  input: string
  expectedSequence: ScreenplayBlock['formatId'][]
  policy?: Partial<StructurePipelinePolicy>
}

export interface OpenPipelineHarnessCase {
  name: string
  extraction: FileExtractionResult
  expectedKind: 'import-structured-blocks' | 'import-classified-text' | 'reject'
}

export const STRUCTURE_PIPELINE_CASES: readonly StructurePipelineHarnessCase[] = [
  {
    name: 'scene-header triplet is classified deterministically',
    input: 'مشهد 12\nداخلي - ليل\nغرفة الاجتماعات',
    expectedSequence: ['scene-header-1', 'scene-header-2', 'scene-header-3'],
  },
  {
    name: 'speaker cue followed by dialogue',
    input: 'أحمد:\nأنا جاهز الآن',
    expectedSequence: ['character', 'dialogue'],
  },
  {
    name: 'transition line detected before scene',
    input: 'قطع إلى:\nمشهد 5',
    expectedSequence: ['transition', 'scene-header-1'],
  },
] as const

export const OPEN_PIPELINE_CASES: readonly OpenPipelineHarnessCase[] = [
  {
    name: 'structured payload imports directly',
    extraction: {
      text: 'سطر',
      fileType: 'txt',
      method: 'app-payload',
      usedOcr: false,
      warnings: [],
      attempts: ['payload-marker'],
      structuredBlocks: [{ formatId: 'action', text: 'سطر' }],
      payloadVersion: 1,
    },
    expectedKind: 'import-structured-blocks',
  },
  {
    name: 'plain text falls back to classified import',
    extraction: {
      text: 'نص خام',
      fileType: 'docx',
      method: 'mammoth',
      usedOcr: false,
      warnings: [],
      attempts: ['mammoth'],
    },
    expectedKind: 'import-classified-text',
  },
  {
    name: 'empty text is rejected',
    extraction: {
      text: '   ',
      fileType: 'pdf',
      method: 'pdfjs-text-layer',
      usedOcr: false,
      warnings: [],
      attempts: ['pdfjs-text-layer'],
    },
    expectedKind: 'reject',
  },
] as const
