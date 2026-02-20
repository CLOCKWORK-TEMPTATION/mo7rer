declare module 'mammoth' {
  export interface ExtractRawTextResult {
    value: string
  }

  export function extractRawText(input: {
    arrayBuffer: ArrayBuffer
  }): Promise<ExtractRawTextResult>
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
