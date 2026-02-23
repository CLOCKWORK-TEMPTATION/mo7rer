declare module 'mammoth' {
  export interface ExtractRawTextResult {
    value: string
  }

  export interface ConvertToHtmlResult {
    value: string
  }

  export function extractRawText(input: {
    arrayBuffer: ArrayBuffer
  }): Promise<ExtractRawTextResult>

  export function convertToHtml(input: {
    arrayBuffer: ArrayBuffer
  }): Promise<ConvertToHtmlResult>
}

declare module '*docx-html-to-text.mjs' {
  export const normalizeExtractedDocxText: (value: string) => string
  export const convertDocxHtmlToText: (html: string) => string
  export const chooseBestDocxTextCandidate: (
    candidates: Array<{ id: string; text: string }>,
  ) => { id: string; text: string } | null
}

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export const getDocument: (options: { data: Uint8Array }) => {
    promise: Promise<{
      numPages: number
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str?: string }> }>
      }>
      destroy?: () => Promise<void>
    }>
    destroy: () => Promise<void>
  }
}
