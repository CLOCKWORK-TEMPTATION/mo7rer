// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { readBackendHealth, startBackendServerHarness, type BackendServerHarness } from '../harness/backend-server-harness'

interface FixtureSpec {
  name: string
  extension: 'doc' | 'docx' | 'pdf'
  relativePath: string
  expectedMethod: 'doc-converter-flow' | 'mammoth' | 'docx-xml-direct' | 'ocr-mistral'
  requires: 'none' | 'antiword' | 'ocr'
}

const FIXTURES: readonly FixtureSpec[] = [
  {
    name: 'DOC regression fixture',
    extension: 'doc',
    relativePath: 'tests/fixtures/regression/12.doc',
    expectedMethod: 'doc-converter-flow',
    requires: 'antiword',
  },
  {
    name: 'DOCX regression fixture',
    extension: 'docx',
    relativePath: 'tests/fixtures/regression/12.docx',
    expectedMethod: 'docx-xml-direct',
    requires: 'none',
  },
  {
    name: 'PDF regression fixture',
    extension: 'pdf',
    relativePath: 'tests/fixtures/regression/12.pdf',
    expectedMethod: 'ocr-mistral',
    requires: 'ocr',
  },
] as const

describe('integration: backend extract regression (DOC/DOCX/PDF)', () => {
  const port = 9980 + Math.floor(Math.random() * 100)
  let harness: BackendServerHarness
  let health: Awaited<ReturnType<typeof readBackendHealth>>

  beforeAll(async () => {
    harness = await startBackendServerHarness(port)
    health = await readBackendHealth(harness.baseUrl)
  }, 30_000)

  afterAll(async () => {
    if (harness) {
      await harness.stop()
    }
  })

  for (const fixture of FIXTURES) {
    it(fixture.name, async () => {
      if (fixture.requires === 'antiword' && (!health.antiwordBinaryAvailable || !health.antiwordHomeExists)) {
        return
      }
      if (fixture.requires === 'ocr' && !health.ocrConfigured) {
        return
      }

      const fixturePath = resolve(process.cwd(), fixture.relativePath)
      const content = await readFile(fixturePath)

      const response = await fetch(`${harness.baseUrl}/api/files/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: fixture.relativePath.split('/').pop(),
          extension: fixture.extension,
          fileBase64: content.toString('base64'),
        }),
      })

      expect(response.ok).toBe(true)
      const payload = await response.json() as {
        success: boolean
        data?: {
          method?: string
          text?: string
        }
      }

      expect(payload.success).toBe(true)
      expect(payload.data?.method).toBe(fixture.expectedMethod)
      expect((payload.data?.text ?? '').trim().length).toBeGreaterThan(0)
    }, 120_000)
  }

  it('rejects invalid extract contract payload with HTTP 400', async () => {
    const response = await fetch(`${harness.baseUrl}/api/files/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: 'broken.docx',
        extension: 'docx',
      }),
    })

    expect(response.status).toBe(400)
    const payload = await response.json() as { success?: boolean; error?: string }
    expect(payload.success).toBe(false)
    expect((payload.error ?? '').length).toBeGreaterThan(0)
  })

  it('rejects invalid agent-review contract payload with HTTP 400', async () => {
    const response = await fetch(`${harness.baseUrl}/api/agent/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        totalReviewed: 5,
        suspiciousLines: [],
      }),
    })

    expect(response.status).toBe(400)
    const payload = await response.json() as { status?: string; message?: string }
    expect(payload.status).toBe('error')
    expect((payload.message ?? '').length).toBeGreaterThan(0)
  })
})
