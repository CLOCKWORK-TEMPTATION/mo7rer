/**
 * @module utils/file-import/extract/docx-xml-extract
 * @description استخراج نص DOCX عبر قراءة XML المستند مباشرة (بدون Mammoth HTML).
 */
import { unzipSync } from 'fflate'
import { extractDocxXmlCore, type DocxXmlExtractContract } from './docx-xml-core'

export type DocxXmlExtractResult = DocxXmlExtractContract

function unzipDocx(arrayBuffer: ArrayBuffer): Uint8Array {
  const zipData = new Uint8Array(arrayBuffer)
  const unzipped = unzipSync(zipData)
  const documentXml = unzipped['word/document.xml']
  if (!documentXml) {
    throw new Error('ملف DOCX لا يحتوي word/document.xml')
  }
  return documentXml
}

function decodeXmlBytes(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes)
}

export async function extractDocxFromXml(
  arrayBuffer: ArrayBuffer,
): Promise<DocxXmlExtractResult> {
  const xmlBytes = unzipDocx(arrayBuffer)
  const xmlString = decodeXmlBytes(xmlBytes)

  const domParserFactory =
    typeof DOMParser !== 'undefined' ? () => new DOMParser() : undefined

  return extractDocxXmlCore(xmlString, { domParserFactory })
}
