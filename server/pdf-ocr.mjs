import process from "node:process";
import { Mistral } from "@mistralai/mistralai";

const MISTRAL_OCR_MODEL = process.env.MISTRAL_OCR_MODEL || "mistral-ocr-latest";
const OCR_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;

let mistralClient = null;

/**
 * التحقق من توفر مفتاح Mistral API
 * @returns {boolean} true إذا كان المفتاح متاحاً
 */
export function isMistralConfigured() {
  return Boolean(process.env.MISTRAL_API_KEY);
}

/**
 * إرجاع موديل OCR الحالي المستخدم في الباك إند.
 * @returns {string}
 */
export function getPdfOcrModel() {
  return MISTRAL_OCR_MODEL;
}

/**
 * الحصول على عميل Mistral أو إنشاء واحد جديد
 * @returns {Mistral} عميل Mistral
 * @throws {Error} إذا لم يكن هناك مفتاح API
 */
function getMistralClient() {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "MISTRAL_API_KEY غير مُعرَّف. يرجى إضافته في متغيرات البيئة."
    );
  }

  if (!mistralClient) {
    mistralClient = new Mistral({ apiKey });
  }

  return mistralClient;
}

/**
 * تحويل Buffer إلى Data URL
 * @param {Buffer} fileBuffer - محتوى الملف
 * @returns {string} Data URL
 */
function buildPdfDataUrl(fileBuffer) {
  const base64Pdf = fileBuffer.toString("base64");
  return `data:application/pdf;base64,${base64Pdf}`;
}

/**
 * تنظيف النص المستخرج من OCR
 * @param {string} text - النص المراد تنظيفه
 * @returns {string} النص المنظف
 */
function cleanExtractedText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * تحويل استجابة OCR إلى نص
 * @param {object} response - استجابة Mistral OCR
 * @returns {string} النص المستخرج
 * @throws {Error} إذا كانت الاستجابة فارغة أو غير صالحة
 */
function mapOcrResponseToText(response) {
  const pages = response?.pages;
  if (!Array.isArray(pages)) {
    throw new Error("استجابة Mistral OCR لا تحتوي على صفحات قابلة للقراءة.");
  }

  const mergedText = pages
    .map((page) => ({
      index:
        typeof page?.index === "number" && Number.isFinite(page.index)
          ? page.index
          : Number.MAX_SAFE_INTEGER,
      markdown: typeof page?.markdown === "string" ? page.markdown : "",
    }))
    .sort((a, b) => a.index - b.index)
    .map((page) => page.markdown)
    .join("\n\n");

  const cleaned = cleanExtractedText(mergedText);
  if (!cleaned) {
    throw new Error("Mistral OCR أعاد نصًا فارغًا.");
  }

  return cleaned;
}

/**
 * إضافة timeout لـ Promise
 * @param {Promise} promise - الـ Promise الأصلي
 * @param {number} timeoutMs - الوقت بالملي ثانية
 * @returns {Promise} Promise مع timeout
 */
function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => {
        const timeoutError = new Error(
          `انتهت مهلة Mistral OCR بعد ${timeoutMs}ms`
        );
        timeoutError.name = "TimeoutError";
        reject(timeoutError);
      }, timeoutMs)
    ),
  ]);
}

/**
 * تشغيل OCR على المستند
 * @param {string} documentUrl - رابط المستند
 * @returns {Promise<string>} النص المستخرج
 */
async function runMistralOcr(documentUrl) {
  const client = getMistralClient();
  const response = await withTimeout(
    client.ocr.process({
      document: {
        type: "document_url",
        documentUrl,
      },
      model: MISTRAL_OCR_MODEL,
      includeImageBase64: false,
    }),
    OCR_TIMEOUT_MS
  );

  return mapOcrResponseToText(response);
}

/**
 * استخراج نص من ملف PDF باستخدام Mistral OCR SDK الرسمي
 * @param {Buffer} fileBuffer - محتوى الملف كـ Buffer
 * @param {string} filename - اسم الملف الأصلي
 * @returns {Promise<string>} النص المستخرج من جميع الصفحات
 */
export async function extractTextWithMistralOcr(fileBuffer, filename) {
  const documentUrl = buildPdfDataUrl(fileBuffer);
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await runMistralOcr(documentUrl);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === MAX_RETRIES) break;
      // انتظار متزايد بين المحاولات (exponential backoff)
      const delay = 1000 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(
    `فشل OCR من Mistral بعد ${MAX_RETRIES + 1} محاولة: ${
      lastError?.message ?? "خطأ غير معروف"
    }`
  );
}

/**
 * Alias متوافق مع السيرفر الحالي.
 * @param {Buffer} fileBuffer
 * @param {(value: string) => string} [normalizeText]
 * @returns {Promise<string>}
 */
export async function extractPdfTextWithOcr(fileBuffer, normalizeText) {
  const raw = await extractTextWithMistralOcr(fileBuffer, "document.pdf");
  if (typeof normalizeText === "function") {
    return normalizeText(raw);
  }
  return raw;
}
