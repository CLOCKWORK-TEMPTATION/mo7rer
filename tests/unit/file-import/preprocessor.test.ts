import { describe, expect, it } from 'vitest'
import { preprocessImportedTextForClassifier } from '../../../src/utils/file-import/preprocessor'

describe('file-import preprocessor', () => {
  it('applies lightweight normalization for DOCX (no line merging)', () => {
    const input = [
      'مشهد1\tنهار -داخلي',
      'غرفة المعيشة',
    ].join('\n')

    const result = preprocessImportedTextForClassifier(input, 'docx')

    // DOCX XML يحفظ حدود الفقرات — تطبيع مسافات فقط بدون دمج أسطر
    expect(result.text).toBe('مشهد1 نهار -داخلي\nغرفة المعيشة')
    expect(result.applied).toContain('docx-lightweight-normalization')
  })

  it('splits glued trailing character cue for DOC normalization path', () => {
    const input = 'يرفع محمود يده معترضامحمود:\nوهي تنهض لتواجههمبوسي:'

    const result = preprocessImportedTextForClassifier(input, 'doc')

    expect(result.text).toContain('يرفع محمود يده معترضا\nمحمود:')
    expect(result.text).toContain('وهي تنهض لتواجههم\nبوسي:')
    expect(result.applied).toContain('antiword-wrapped-lines-normalized')
  })
})
