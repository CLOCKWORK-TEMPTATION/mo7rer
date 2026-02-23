import { describe, expect, it } from 'vitest'
import { buildFileOpenPipelineAction } from '../../../src/utils/file-import/open-pipeline'
import type { FileExtractionResult } from '../../../src/types/file-import'

const baseResult: FileExtractionResult = {
  text: 'نص مستخرج',
  fileType: 'docx',
  method: 'mammoth',
  usedOcr: false,
  warnings: [],
  attempts: ['mammoth'],
}

describe('open-pipeline', () => {
  it('forces paste-classifier path for docx even when structured blocks are available', () => {
    const action = buildFileOpenPipelineAction(
      {
        ...baseResult,
        method: 'app-payload',
        structuredBlocks: [{ formatId: 'action', text: 'كتلة بنيوية' }],
      },
      'replace',
    )

    expect(action.kind).toBe('import-classified-text')
    expect(action.telemetry.openPipeline).toBe('paste-classifier')
    if (action.kind === 'import-classified-text') {
      expect(action.text).toContain('نص')
    }
  })

  it('keeps structured-direct path for non-forced file types when structured blocks are available', () => {
    const action = buildFileOpenPipelineAction(
      {
        ...baseResult,
        fileType: 'txt',
        method: 'app-payload',
        structuredBlocks: [{ formatId: 'action', text: 'كتلة بنيوية' }],
      },
      'replace',
    )

    expect(action.kind).toBe('import-structured-blocks')
    expect(action.telemetry.openPipeline).toBe('structured-direct')
    if (action.kind === 'import-structured-blocks') {
      expect(action.blocks).toHaveLength(1)
    }
  })

  it('falls back to paste-classifier when only text exists', () => {
    const action = buildFileOpenPipelineAction(baseResult, 'insert')
    expect(action.kind).toBe('import-classified-text')
    expect(action.telemetry.openPipeline).toBe('paste-classifier')
    if (action.kind === 'import-classified-text') {
      expect(action.text).toContain('نص')
    }
  })

  it('rejects empty extraction result', () => {
    const action = buildFileOpenPipelineAction(
      {
        ...baseResult,
        text: '   ',
      },
      'replace',
    )
    expect(action.kind).toBe('reject')
    expect(action.toast.variant).toBe('destructive')
  })
})
