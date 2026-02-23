import { describe, expect, it } from 'vitest'
import { plainTextToScreenplayBlocks } from '../../../src/utils/file-import/plain-text-to-blocks'

describe('plain-text-to-blocks', () => {
  it('returns screenplay blocks only (without metadata)', () => {
    const blocks = plainTextToScreenplayBlocks('مشهد 9\nداخلي - ليل\nغرفة\nأحمد:\nمرحبًا')
    expect(Array.isArray(blocks)).toBe(true)
    expect(blocks.length).toBe(5)
    expect(blocks[0]?.formatId).toBe('scene-header-1')
    expect(blocks[4]?.formatId).toBe('dialogue')
  })
})
