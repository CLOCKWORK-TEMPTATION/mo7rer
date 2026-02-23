import { describe, expect, it } from 'vitest'

import { extractDocxXmlCore } from '../../../src/utils/file-import/extract/docx-xml-core'

describe('docx xml extraction contract parity', () => {
  it('returns identical contract output for DOMParser and regex paths', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>
    <w:p>
      <w:r><w:t>مرحبا</w:t></w:r>
      <w:r><w:tab/></w:r>
      <w:r><w:t>بك</w:t></w:r>
      <w:r><w:br/></w:r>
      <w:r><w:t>Line 2</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>   </w:t></w:r></w:p>
    <w:p><w:r><w:t>فقرة ثانية</w:t></w:r></w:p>
    <w:tbl><w:tr><w:tc><w:p><w:r><w:t>داخل جدول</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    <w:drawing><wp:inline/></w:drawing>
  </w:body>
</w:document>`

    const browserLike = extractDocxXmlCore(xml, {
      domParserFactory: () => new DOMParser(),
    })
    const serverLike = extractDocxXmlCore(xml)

    expect(browserLike).toEqual(serverLike)
    expect(browserLike).toEqual({
      text: 'مرحبا\tبك\nLine 2\n\nفقرة ثانية\nداخل جدول',
      paragraphCount: 3,
      warnings: [
        'DOCX يحتوي جداول؛ نص الخلايا استُخرج كفقرات منفصلة.',
        'DOCX يحتوي صور مُضمّنة؛ تم تخطيها.',
      ],
    })
  })
})
