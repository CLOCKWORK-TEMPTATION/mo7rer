/**
 * @module server/docx-xml-extract
 * @description استخراج نص DOCX عبر قراءة XML المستند مباشرة — نسخة Node.js.
 */
import { unzipSync } from 'fflate'
import { extractDocxXmlCore } from '../src/utils/file-import/extract/docx-xml-core.ts'

function unzipDocx(buffer) {
  if (Buffer.isBuffer(buffer)) {
    return unzipSync(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength))['word/document.xml']
  }

  const zipData = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const unzipped = unzipSync(zipData)
  return unzipped['word/document.xml']
}

function decodeXmlBytes(bytes) {
  return new TextDecoder('utf-8').decode(bytes)
}

/**
 * @param {Buffer|ArrayBuffer|Uint8Array} buffer
 * @returns {Promise<{ text: string, paragraphCount: number, warnings: string[] }>}
 */
export async function extractDocxFromXmlBuffer(buffer) {
  const xmlBytes = unzipDocx(buffer)
  if (!xmlBytes) {
    throw new Error('ملف DOCX لا يحتوي word/document.xml')
  }

  const xmlString = decodeXmlBytes(xmlBytes)
  return extractDocxXmlCore(xmlString)
}
