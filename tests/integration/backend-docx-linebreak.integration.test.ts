// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import { startBackendServerHarness, type BackendServerHarness } from '../harness/backend-server-harness'

const buildDocxWithSoftLineBreak = async (): Promise<Buffer> => {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun('شهلي يا ختي ... مش الوكالة اللي جابهالك ابوكي دي .. انتوا تتاخروا على مزاجكوا لكن انا لو اتأخرت ساعة ع الشهرية ... اطلع من البلد'),
              new TextRun({ break: 1, text: 'ثم يخرج ورقه مكتوب عليها عنوان' }),
            ],
          }),
        ],
      },
    ],
  })

  const arrayBuffer = await Packer.toBuffer(doc)
  return Buffer.from(arrayBuffer)
}

describe('integration: backend DOCX uses XML-direct extraction contract', () => {
  const port = 9940 + Math.floor(Math.random() * 100)
  let harness: BackendServerHarness

  beforeAll(async () => {
    harness = await startBackendServerHarness(port)
  }, 30_000)

  afterAll(async () => {
    if (harness) {
      await harness.stop()
    }
  })

  it('extracts DOCX text عبر XML مباشر مع عقد محاولات ثابت', async () => {
    const docx = await buildDocxWithSoftLineBreak()
    const response = await fetch(`${harness.baseUrl}/api/files/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: 'line-break.docx',
        extension: 'docx',
        fileBase64: docx.toString('base64'),
      }),
    })

    expect(response.ok).toBe(true)
    const payload = (await response.json()) as {
      success: boolean
      data?: {
        method?: string
        text?: string
        attempts?: string[]
      }
    }

    expect(payload.success).toBe(true)
    expect(payload.data?.method).toBe('docx-xml-direct')
    expect(payload.data?.attempts).toContain('docx-xml-direct')
    const extractedText = payload.data?.text ?? ''
    expect(extractedText.trim().length).toBeGreaterThan(0)
    expect(extractedText).toContain('اطلع من البلد')
    expect(extractedText).toContain('ثم يخرج ورقه مكتوب عليها عنوان')
    expect(extractedText).toMatch(/اطلع من البلد\s*\n\s*ثم يخرج ورقه مكتوب عليها عنوان/u)
  }, 60_000)
})
