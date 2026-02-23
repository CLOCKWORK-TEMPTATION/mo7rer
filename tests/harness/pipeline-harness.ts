import { describe, expect, it } from 'vitest'
import { buildFileOpenPipelineAction, buildStructuredBlocksFromText, plainTextToScreenplayBlocks } from '../../src/utils/file-import'
import { OPEN_PIPELINE_CASES, STRUCTURE_PIPELINE_CASES } from './scenario-fixtures'

export const runStructurePipelineHarness = (): void => {
  describe('Structure Pipeline Harness', () => {
    for (const testCase of STRUCTURE_PIPELINE_CASES) {
      it(testCase.name, () => {
        const result = buildStructuredBlocksFromText(testCase.input, testCase.policy)
        expect(result.blocks.map((block) => block.formatId)).toEqual(testCase.expectedSequence)
      })
    }
  })
}

export const runPlainTextBlocksHarness = (): void => {
  describe('Plain Text To Blocks Harness', () => {
    for (const testCase of STRUCTURE_PIPELINE_CASES) {
      it(`${testCase.name} via plain-text wrapper`, () => {
        const blocks = plainTextToScreenplayBlocks(testCase.input, testCase.policy)
        expect(blocks.map((block) => block.formatId)).toEqual(testCase.expectedSequence)
      })
    }
  })
}

export const runOpenPipelineHarness = (): void => {
  describe('Open Pipeline Harness', () => {
    for (const testCase of OPEN_PIPELINE_CASES) {
      it(testCase.name, () => {
        const action = buildFileOpenPipelineAction(testCase.extraction, 'replace')
        expect(action.kind).toBe(testCase.expectedKind)
      })
    }
  })
}
