// @vitest-environment jsdom

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { extractImportedFile } from '../../src/utils/file-import/extract'
import { buildFileOpenPipelineAction } from '../../src/utils/file-import/open-pipeline'
import { readBackendHealth, readFixtureAsFile, startBackendServerHarness, type BackendServerHarness } from '../harness/backend-server-harness'
import type { FileExtractionResult, ImportedFileType } from '../../src/types/file-import'

const extractViaBackend = async (
  baseUrl: string,
  relativeFixturePath: string,
  extension: ImportedFileType,
): Promise<FileExtractionResult> => {
  const fixturePath = resolve(process.cwd(), relativeFixturePath)
  const content = await readFile(fixturePath)
  const response = await fetch(`${baseUrl}/api/files/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: relativeFixturePath.split('/').pop() ?? 'fixture',
      extension,
      fileBase64: content.toString('base64'),
    }),
  })

  if (!response.ok) {
    throw new Error(`backend extraction failed with HTTP ${response.status}`)
  }

  const payload = await response.json() as {
    success: boolean
    data?: FileExtractionResult
    error?: string
  }
  if (!payload.success || !payload.data) {
    throw new Error(payload.error ?? 'backend extraction returned empty payload')
  }
  return payload.data
}

describe('integration: file extraction + open pipeline', () => {
  const port = 9880 + Math.floor(Math.random() * 100)
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

  it('extracts DOCX fixture via backend and builds open action', async () => {
    const extraction = await extractViaBackend(
      harness.baseUrl,
      'tests/fixtures/regression/12.docx',
      'docx',
    )

    expect(extraction.fileType).toBe('docx')
    expect(extraction.text.trim().length).toBeGreaterThan(0)

    const action = buildFileOpenPipelineAction(extraction, 'replace')
    expect(action.kind).not.toBe('reject')
  }, 60_000)

  it('extracts DOC fixture through backend path and builds open action', async () => {
    if (!health.antiwordBinaryAvailable || !health.antiwordHomeExists) {
      return
    }

    const file = await readFixtureAsFile('tests/fixtures/regression/12.doc', 'application/msword')
    const extraction = await extractImportedFile(file, {
      endpoint: `${harness.baseUrl}/api/files/extract`,
      timeoutMs: 60_000,
    })

    expect(extraction.fileType).toBe('doc')
    expect(extraction.method).toBe('doc-converter-flow')
    expect(extraction.text.trim().length).toBeGreaterThan(0)

    const action = buildFileOpenPipelineAction(extraction, 'insert')
    expect(action.kind).toBe('import-classified-text')
  }, 60_000)
})
