import type { ScreenplayBlock } from '../utils/file-import/document-model'

export type FileImportMode = 'replace' | 'insert'

export type ImportedFileType =
  | 'doc'
  | 'docx'
  | 'txt'
  | 'pdf'
  | 'fountain'
  | 'fdx'

export type ExtractionMethod =
  | 'native-text'
  | 'mammoth'
  | 'pdfjs-text-layer'
  | 'doc-converter-flow'
  | 'ocr-mistral'
  | 'backend-api'
  | 'app-payload'

export interface FileExtractionResult {
  text: string
  fileType: ImportedFileType
  method: ExtractionMethod
  usedOcr: boolean
  warnings: string[]
  attempts: string[]
  qualityScore?: number
  normalizationApplied?: string[]
  structuredBlocks?: ScreenplayBlock[]
  payloadVersion?: number
}

export interface FileExtractionRequest {
  filename: string
  extension: ImportedFileType
  fileBase64: string
}

export interface FileExtractionResponse {
  success: boolean
  data?: FileExtractionResult
  error?: string
}

export const ACCEPTED_FILE_EXTENSIONS = '.doc,.docx,.txt,.pdf,.fountain,.fdx' as const

export function getFileType(filename: string): ImportedFileType | null {
  const ext = filename.toLowerCase().split('.').pop()
  switch (ext) {
    case 'doc':
      return 'doc'
    case 'docx':
      return 'docx'
    case 'txt':
      return 'txt'
    case 'pdf':
      return 'pdf'
    case 'fountain':
      return 'fountain'
    case 'fdx':
      return 'fdx'
    default:
      return null
  }
}
