import type {
  FileExtractionResponse,
  FileExtractionResult,
  ImportedFileType,
} from '../../../types/file-import'

const DEFAULT_BACKEND_ENDPOINT =
  (import.meta.env.VITE_FILE_IMPORT_BACKEND_URL as string | undefined)?.trim() || ''

const arrayBufferToBase64 = (arrayBuffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

const normalizeEndpoint = (endpoint: string): string => endpoint.replace(/\/$/, '')

export interface BackendExtractOptions {
  endpoint?: string
  timeoutMs?: number
}

export const isBackendExtractionConfigured = (
  endpoint?: string,
): boolean => Boolean((endpoint ?? DEFAULT_BACKEND_ENDPOINT).trim())

export const extractFileWithBackend = async (
  file: File,
  fileType: ImportedFileType,
  options?: BackendExtractOptions,
): Promise<FileExtractionResult> => {
  const endpoint = (options?.endpoint ?? DEFAULT_BACKEND_ENDPOINT).trim()
  if (!endpoint) {
    throw new Error('Backend file extraction endpoint is not configured.')
  }

  const timeoutMs = options?.timeoutMs ?? 45_000
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const arrayBuffer = await file.arrayBuffer()
    const payload = {
      filename: file.name,
      extension: fileType,
      fileBase64: arrayBufferToBase64(arrayBuffer),
    }

    const response = await fetch(normalizeEndpoint(endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Backend returned HTTP ${response.status}`)
    }

    const body = (await response.json()) as FileExtractionResponse
    if (!body.success || !body.data) {
      throw new Error(body.error || 'Backend extraction failed without details.')
    }

    return {
      ...body.data,
      fileType,
      method: body.data.method ?? 'backend-api',
      warnings: body.data.warnings ?? [],
      attempts: body.data.attempts ?? ['backend-api'],
      usedOcr: Boolean(body.data.usedOcr),
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Backend extraction timed out.')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}
