import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

export interface BackendServerHarness {
  baseUrl: string
  process: ChildProcessWithoutNullStreams
  stop: () => Promise<void>
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolveWait) => {
    setTimeout(resolveWait, ms)
  })

const waitForHealth = async (baseUrl: string, timeoutMs = 20_000): Promise<void> => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`)
      if (response.ok) return
    } catch {
      // server not ready yet
    }
    await wait(250)
  }

  throw new Error(`Backend health check timed out for ${baseUrl}`)
}

export const startBackendServerHarness = async (
  port: number,
): Promise<BackendServerHarness> => {
  const processRef = spawn('node', ['server/file-import-server.mjs'], {
    cwd: resolve(process.cwd()),
    env: {
      ...process.env,
      FILE_IMPORT_HOST: '127.0.0.1',
      FILE_IMPORT_PORT: String(port),
    },
    stdio: 'pipe',
  })

  const baseUrl = `http://127.0.0.1:${port}`
  await waitForHealth(baseUrl)

  const stop = async (): Promise<void> =>
    new Promise((resolveStop) => {
      if (processRef.killed || processRef.exitCode !== null) {
        resolveStop()
        return
      }

      processRef.once('exit', () => resolveStop())
      processRef.kill('SIGTERM')
      setTimeout(() => {
        if (processRef.exitCode === null && !processRef.killed) {
          processRef.kill('SIGKILL')
        }
      }, 4_000)
    })

  return {
    baseUrl,
    process: processRef,
    stop,
  }
}

export const readFixtureAsFile = async (
  relativePath: string,
  mimeType = 'application/octet-stream',
): Promise<File> => {
  const fixturePath = resolve(process.cwd(), relativePath)
  const buffer = await readFile(fixturePath)
  return new File([buffer], basename(fixturePath), { type: mimeType })
}

export interface BackendHealthPayload {
  ok: boolean
  ocrConfigured: boolean
  antiwordBinaryAvailable: boolean
  antiwordHomeExists: boolean
}

export const readBackendHealth = async (baseUrl: string): Promise<BackendHealthPayload> => {
  const response = await fetch(`${baseUrl}/health`)
  if (!response.ok) {
    throw new Error(`Health endpoint failed with HTTP ${response.status}`)
  }
  return (await response.json()) as BackendHealthPayload
}
