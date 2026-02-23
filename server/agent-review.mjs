/**
 * وكيل تصنيف السيناريوهات العربية - الإصدار 3.0
 * Arabic Screenplay Classifier Agent v3.0
 *
 * تحديثات الإصدار:
 * - ترحيل النموذج إلى claude-opus-4-6
 * - Anthropic SDK كمسار أساسي + REST fallback
 * - temperature=0.0 لمهام التصنيف/المراجعة التحليلية
 * - تصدير API قابلة لإعادة الاستخدام للمراجعة النهائية
 * - تشغيل CLI فقط عند التنفيذ المباشر (مش عند الاستيراد)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import axios from "axios";
import iconv from "iconv-lite";
/* eslint-disable no-console */
import Anthropic from "@anthropic-ai/sdk";
// تحميل متغيرات البيئة
config();
const execAsync = promisify(exec);
export const MODEL_ID = "claude-opus-4-6";
const CLASSIFICATION_TEMPERATURE = 0.0;
const REVIEW_TEMPERATURE = 0.0;
const DEFAULT_TIMEOUT_MS = 60_000;
const FAST_MODE_BETA = "fast-mode-2026-02-01";
const ALLOWED_LINE_TYPES = new Set([
  "action",
  "dialogue",
  "character",
  "scene-header-1",
  "scene-header-2",
  "scene-header-3",
  "scene-header-top-line",
  "transition",
  "parenthetical",
  "basmala",
]);
const ALLOWED_ROUTING_BANDS = new Set(["agent-candidate", "agent-forced"]);
const isObjectRecord = (value) => typeof value === "object" && value !== null;
const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;
const isIntegerNumber = (value) => Number.isInteger(value) && value >= 0;
const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);
const normalizeIncomingText = (value, maxLength = 50_000) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};
export class AgentReviewValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AgentReviewValidationError";
    this.statusCode = 400;
  }
}
const normalizeReviewContextLine = (line, index) => {
  if (!isObjectRecord(line)) {
    throw new AgentReviewValidationError(
      `Invalid context line at index ${index}.`
    );
  }
  const lineIndex = line.lineIndex;
  const assignedType = normalizeIncomingText(line.assignedType, 64);
  const text = normalizeIncomingText(line.text, 4000);
  if (!isIntegerNumber(lineIndex)) {
    throw new AgentReviewValidationError(
      `Invalid context lineIndex at index ${index}.`
    );
  }
  if (!ALLOWED_LINE_TYPES.has(assignedType)) {
    throw new AgentReviewValidationError(
      `Invalid context assignedType at index ${index}.`
    );
  }
  if (!text) {
    throw new AgentReviewValidationError(
      `Empty context text at index ${index}.`
    );
  }
  return {
    lineIndex,
    assignedType,
    text,
  };
};
const normalizeSuspiciousLine = (entry, index) => {
  if (!isObjectRecord(entry)) {
    throw new AgentReviewValidationError(
      `Invalid suspicious line payload at index ${index}.`
    );
  }
  const itemIndex = entry.itemIndex;
  const lineIndex = entry.lineIndex;
  const text = normalizeIncomingText(entry.text, 6000);
  const assignedType = normalizeIncomingText(entry.assignedType, 64);
  const totalSuspicion = entry.totalSuspicion;
  const escalationScore = entry.escalationScore;
  const routingBand = normalizeIncomingText(entry.routingBand, 32);
  const criticalMismatch =
    typeof entry.criticalMismatch === "boolean"
      ? entry.criticalMismatch
      : undefined;
  const distinctDetectors = entry.distinctDetectors;
  const reasons = Array.isArray(entry.reasons)
    ? entry.reasons.filter((reason) => isNonEmptyString(reason)).slice(0, 16)
    : [];
  const contextLines = Array.isArray(entry.contextLines)
    ? entry.contextLines.map((line, ctxIndex) =>
        normalizeReviewContextLine(line, ctxIndex)
      )
    : [];
  if (!isIntegerNumber(itemIndex)) {
    throw new AgentReviewValidationError(
      `Invalid itemIndex at suspicious line ${index}.`
    );
  }
  if (!isIntegerNumber(lineIndex)) {
    throw new AgentReviewValidationError(
      `Invalid lineIndex at suspicious line ${index}.`
    );
  }
  if (!text) {
    throw new AgentReviewValidationError(
      `Empty text at suspicious line ${index}.`
    );
  }
  if (!ALLOWED_LINE_TYPES.has(assignedType)) {
    throw new AgentReviewValidationError(
      `Invalid assignedType at suspicious line ${index}.`
    );
  }
  if (
    !isFiniteNumber(totalSuspicion) ||
    totalSuspicion < 0 ||
    totalSuspicion > 100
  ) {
    throw new AgentReviewValidationError(
      `Invalid totalSuspicion at suspicious line ${index}.`
    );
  }
  if (
    escalationScore !== undefined &&
    (!isFiniteNumber(escalationScore) ||
      escalationScore < 0 ||
      escalationScore > 100)
  ) {
    throw new AgentReviewValidationError(
      `Invalid escalationScore at suspicious line ${index}.`
    );
  }
  if (routingBand && !ALLOWED_ROUTING_BANDS.has(routingBand)) {
    throw new AgentReviewValidationError(
      `Invalid routingBand at suspicious line ${index}.`
    );
  }
  if (
    distinctDetectors !== undefined &&
    (!isIntegerNumber(distinctDetectors) || distinctDetectors < 0)
  ) {
    throw new AgentReviewValidationError(
      `Invalid distinctDetectors at suspicious line ${index}.`
    );
  }
  return {
    itemIndex,
    lineIndex,
    text,
    assignedType,
    totalSuspicion,
    reasons,
    contextLines,
    escalationScore,
    routingBand: routingBand || undefined,
    criticalMismatch,
    distinctDetectors,
  };
};

const normalizeItemIndexList = (value, fieldName) => {
  if (!Array.isArray(value)) return null;
  const normalized = [];
  for (let index = 0; index < value.length; index += 1) {
    const itemIndex = value[index];
    if (!isIntegerNumber(itemIndex)) {
      throw new AgentReviewValidationError(
        `Invalid ${fieldName} entry at index ${index}.`
      );
    }
    normalized.push(itemIndex);
  }
  return [...new Set(normalized)];
};

export const validateAgentReviewRequestBody = (rawBody) => {
  if (!isObjectRecord(rawBody)) {
    throw new AgentReviewValidationError("Invalid agent-review request body.");
  }
  const sessionId = normalizeIncomingText(rawBody.sessionId, 120);
  const totalReviewed = rawBody.totalReviewed;
  const suspiciousLines = Array.isArray(rawBody.suspiciousLines)
    ? rawBody.suspiciousLines
    : null;
  const reviewPacketText = normalizeIncomingText(
    rawBody.reviewPacketText,
    120_000
  );
  if (!sessionId) {
    throw new AgentReviewValidationError(
      "Missing sessionId in agent-review request."
    );
  }
  if (!isIntegerNumber(totalReviewed)) {
    throw new AgentReviewValidationError(
      "Invalid totalReviewed in agent-review request."
    );
  }
  if (!Array.isArray(suspiciousLines)) {
    throw new AgentReviewValidationError(
      "Invalid suspiciousLines in agent-review request."
    );
  }

  const normalizedSuspiciousLines = suspiciousLines.map((entry, index) =>
    normalizeSuspiciousLine(entry, index)
  );
  const suspiciousIndexesSet = new Set(
    normalizedSuspiciousLines.map((line) => line.itemIndex)
  );
  const defaultRequired = [...suspiciousIndexesSet];
  const defaultForced = normalizedSuspiciousLines
    .filter((line) => line.routingBand === "agent-forced")
    .map((line) => line.itemIndex);

  const requiredItemIndexes =
    normalizeItemIndexList(rawBody.requiredItemIndexes, "requiredItemIndexes") ??
    defaultRequired;
  const forcedItemIndexes =
    normalizeItemIndexList(rawBody.forcedItemIndexes, "forcedItemIndexes") ??
    [...new Set(defaultForced)];

  for (const itemIndex of requiredItemIndexes) {
    if (!suspiciousIndexesSet.has(itemIndex)) {
      throw new AgentReviewValidationError(
        `requiredItemIndexes contains unknown itemIndex: ${itemIndex}.`
      );
    }
  }
  for (const itemIndex of forcedItemIndexes) {
    if (!suspiciousIndexesSet.has(itemIndex)) {
      throw new AgentReviewValidationError(
        `forcedItemIndexes contains unknown itemIndex: ${itemIndex}.`
      );
    }
    if (!requiredItemIndexes.includes(itemIndex)) {
      throw new AgentReviewValidationError(
        `forcedItemIndexes must be subset of requiredItemIndexes: ${itemIndex}.`
      );
    }
  }

  return {
    sessionId,
    totalReviewed,
    reviewPacketText: reviewPacketText || undefined,
    suspiciousLines: normalizedSuspiciousLines,
    requiredItemIndexes,
    forcedItemIndexes,
  };
};
let anthropicClientSingleton = null;
const getAnthropicClient = () => {
  if (anthropicClientSingleton) {
    return anthropicClientSingleton;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY غير موجود في متغيرات البيئة");
  }
  anthropicClientSingleton = new Anthropic({
    apiKey,
    maxRetries: 2,
    timeout: DEFAULT_TIMEOUT_MS,
  });
  return anthropicClientSingleton;
};
const extractTextFromAnthropicBlocks = (content) => {
  const chunks = [];
  for (const block of content) {
    if (block.type === "text" && typeof block.text === "string") {
      chunks.push(block.text);
    }
  }
  return chunks.join("");
};
const tryCreateMessageWithSdk = async (params) => {
  const client = getAnthropicClient();
  const useFastMode = process.env.ANTHROPIC_FAST_MODE === "1";
  if (useFastMode) {
    try {
      const betaClient = client.beta;
      const createFn = betaClient?.messages?.create;
      if (createFn) {
        return await createFn({
          ...params,
          speed: "fast",
          betas: [FAST_MODE_BETA],
        });
      }
    } catch (error) {
      console.warn(`تحذير: فشل fast mode، الرجوع للمسار القياسي: ${error}`);
    }
  }
  const message = await client.messages.create(params);
  return message;
};
// System Prompt المخصص لتصنيف السيناريوهات العربية
const SCREENPLAY_CLASSIFIER_SYSTEM_PROMPT = `
<role>
أنت وكيل متخصص حصريًا في تصنيف العناصر الهيكلية للنصوص الدرامية العربية (سيناريوهات أفلام ومسلسلات).
مهمتك الوحيدة: استخراج العناصر حرفيًا كما هي في النص، وبنفس الترتيب، دون أي تفسير أو تلخيص أو تحليل أو إعادة صياغة.
</role>

<output_contract>
الإخراج يجب أن يكون أسطر فقط.
كل سطر يطابق الصيغة:

<ELEMENT> = <VALUE>

حيث ELEMENT واحد فقط من:
BASMALA, SCENE-HEADER-1, SCENE-HEADER-2, SCENE-HEADER-3, ACTION, CHARACTER, DIALOGUE, TRANSITION

لا ترقيم. لا قوائم. لا فواصل. لا أسطر فارغة. لا عناوين. لا جُمل ختامية. لا أسئلة.
</output_contract>

<element_definitions>

  <basmala>
  إذا ظهر سطر يبدأ بـ: بسم الله الرحمن الرحيم (حتى لو بعده { أو مسافات)
  اكتب:
  BASMALA = بسم الله الرحمن الرحيم
  القيمة تُكتب كـ "بسم الله الرحمن الرحيم" فقط، لا تُلحق بها {.
  </basmala>

  <scene_header_1>
  إذا ظهر نمط: مشهد + رقم
  استخرج فقط:
  SCENE-HEADER-1 = مشهد <رقم>
  </scene_header_1>

  <scene_header_2>
  إذا ظهر في نفس سطر المشهد أو سطر قريب: نهار|ليل|صباح|مساء|فجر مع داخلي|خارجي
  استخرج:
  SCENE-HEADER-2 = <الزمن>-<داخلي/خارجي>
  احتفظ بنفس علامات النص مثل الشرطة/المسافات قدر الإمكان.
  </scene_header_2>

  <scene_header_3>
  السطر الذي يليه عادة ويكون مكانًا تفصيليًا (مثال: "منزل…/مكتب…/فيلا…")
  استخرج حرفيًا:
  SCENE-HEADER-3 = <نص المكان كما هو>
  </scene_header_3>

  <transition>
  أي سطر يساوي (أو يحتوي فقط على) كلمة انتقال مثل: قطع
  استخرج:
  TRANSITION = قطع
  كل ظهور = سطر مستقل.
  </transition>

  <character_rules>
  لا تكتب CHARACTER إلا إذا كان في النص سطر فيه اسم متبوع بـ :
  مثل: نور : ، مدحت : ، صوت عمرو دياب :

  القيمة يجب أن تنتهي بـ : كما في النص تمامًا:
  CHARACTER = نور :

  احتفظ بالنقطتين دائمًا.

    <character_critical_rule>
    الأسماء داخل الوصف ليست CHARACTER.
    أي اسم داخل سطر وصفي (مثل: "تخرج نهال سماحة…") يبقى ACTION، ولا يُستخرج منه CHARACTER.
    السبب: الاسم هنا جزء من السرد وليس متحدثًا.
    </character_critical_rule>
  </character_rules>

  <dialogue_rules>
  كل سطر نصّي يأتي بعد CHARACTER مباشرة يُصنف:
  DIALOGUE = <السطر كما هو>

  يستمر الحوار (DIALOGUE) للسطر/الأسطر التالية حتى ظهور:
  — CHARACTER جديد (سطر فيه :)
  — TRANSITION
  — SCENE-HEADER جديد
  — أو سطر وصفي واضح (ACTION)

    <dialogue_critical_rule>
    الأسماء المذكورة داخل الحوار لا تُفصل.
    إذا ذُكر اسم داخل جملة الحوار، يبقى جزءًا من DIALOGUE ولا يصبح CHARACTER.
    السبب: الاسم هنا مذكور ضمن كلام المتحدث وليس متحدثًا جديدًا.
    </dialogue_critical_rule>
  </dialogue_rules>

  <action_rules>
  أي سطر ليس BASMALA ولا Scene Header ولا TRANSITION ولا CHARACTER ولا DIALOGUE ضمن كتلة حوار
  يُكتب كما هو:
  ACTION = <السطر كما هو>

    <action_merge_rule>
    السطر الوصفي المستقل = ACTION مستقل.
    لكن إذا كان هناك سطر/أسطر استكمال تابعة لنفس الوصف (عادةً بمسافات بادئة وتكمّل نفس الجملة) يجوز ضمّها داخل ACTION واحد.
    لا تجمع سطرين مستقلين في عنصر واحد. الدمج مسموح فقط لأسطر الاستكمال (Continuation) ذات المسافات البادئة ضمن نفس الجملة.
    </action_merge_rule>
  </action_rules>

  <song_lyrics>
  إذا كانت الأغاني وصفًا داخل ACTION (مثل "نسمع … يغني قائلا …") → تبقى ACTION.
  إذا جاءت بصيغة:
  صوت <اسم> :
  <كلمات>
  → تعامل كـ CHARACTER ثم DIALOGUE.
  </song_lyrics>

</element_definitions>

<absent_element_rule>
لا تكتب "لا يوجد" إلا إذا طلب المستخدم عنصرًا محددًا ولم يظهر فعليًا في النص.
في السياق الافتراضي: لا تستخدم "لا يوجد" داخل التدفق (خصوصًا DIALOGUE).
استثناء: BASMALA فقط عند غيابها تمامًا.
</absent_element_rule>

<constraints>
استخرج حرفيًا كما هو في النص. لا تلخص ولا تعيد الصياغة ولا تشرح.
لا تصحح الإملاء أو اللغة ولا "تطبّع" النص.
لا تخترع عناصر أو شخصيات.
لا تضف أي نص خارج أسطر التصنيف.
لا تتوقف قبل نهاية النص. صنّف حتى آخر سطر.
</constraints>

<self_check>
قبل تسليم الإخراج، تحقق ذهنيًا:
— لا أسطر فارغة ولا فواصل ---
— كل CHARACTER ينتهي بـ :
— لا CHARACTER مستخرج من داخل ACTION
— لا توقف قبل نهاية النص
</self_check>
`;
const REVIEW_SYSTEM_PROMPT = `أنت مراجع نهائي لتصنيفات سيناريو عربي.

المطلوب:
- استلام فقط السطور المشتبه فيها مع سياقها.
- القرار يكون تصحيح نوع السطر أو تأكيده.
- لا تضف أي شرح خارج JSON.
- لا تستخدم أي نوع خارج القائمة المسموحة.

القائمة المسموحة للنوع النهائي:
action, dialogue, character, scene-header-1, scene-header-2, scene-header-3, scene-header-top-line, transition, parenthetical, basmala

صيغة الإخراج الإلزامية (JSON فقط):
{
  "decisions": [
    {
      "itemIndex": 12,
      "finalType": "action",
      "confidence": 0.96,
      "reason": "سبب قصير"
    }
  ]
}

قواعد مهمة:
- confidence رقم بين 0 و 1.
- itemIndex لازم يطابق المدخل.
- يجب إرجاع قرار لكل itemIndex في requiredItemIndexes.
- أي itemIndex داخل forcedItemIndexes لا يجوز أن يبقى بلا قرار.
- إذا كان السطر في forcedItemIndexes ومؤشراته تدل على "dialogue + سرد فعلي/أكشن"، يجب ألا يكون finalType = dialogue.
- لا ترجع أي مفاتيح إضافية.
- لو مافيش تعديل، ارجع نفس النوع الحالي.`;
const clampConfidence = (value) => {
  if (!Number.isFinite(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};
const parseReviewDecisions = (rawText) => {
  const source = rawText.trim();
  if (!source) return [];
  const parseCandidate = (candidate) => {
    const parsed = JSON.parse(candidate);
    const decisions = Array.isArray(parsed.decisions) ? parsed.decisions : [];
    const normalized = [];
    for (const decision of decisions) {
      if (!decision || typeof decision !== "object") continue;
      const record = decision;
      const itemIndex =
        typeof record.itemIndex === "number"
          ? Math.trunc(record.itemIndex)
          : -1;
      const finalType =
        typeof record.finalType === "string" ? record.finalType.trim() : "";
      const reason =
        typeof record.reason === "string"
          ? record.reason.trim()
          : "قرار بدون سبب مفصل";
      const confidenceRaw =
        typeof record.confidence === "number" ? record.confidence : 0.5;
      if (itemIndex < 0) continue;
      if (!ALLOWED_LINE_TYPES.has(finalType)) continue;
      normalized.push({
        itemIndex,
        finalType: finalType,
        confidence: clampConfidence(confidenceRaw),
        reason,
      });
    }
    return normalized;
  };
  try {
    return parseCandidate(source);
  } catch {
    const start = source.indexOf("{");
    const end = source.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return [];
    }
    try {
      return parseCandidate(source.slice(start, end + 1));
    } catch {
      return [];
    }
  }
};
/**
 * وكيل تصنيف السيناريوهات العربية
 *
 * @description
 * وكيل متخصص في تصنيف العناصر الهيكلية للنصوص الدرامية العربية باستخدام Claude Opus 4.
 * يقوم بتحليل النصوص واستخراج العناصر السينمائية (حوار، أكشن، شخصية، مشهد، إلخ) بدقة عالية.
 * يدعم ملفات Word (.doc) والنصوص العادية.
 *
 * @responsibilities
 * - تحويل ملفات Word إلى نص
 * - معالجة مسبقة للنصوص العربية
 * - تصنيف العناصر السينمائية باستخدام Claude
 * - حفظ النتائج في ملفات منسقة
 * - دعم النصوص الطويلة (تقسيم تلقائي)
 *
 * @boundaries
 * يفعل: تصنيف النصوص، تحويل الملفات، حفظ النتائج
 * لا يفعل: تحرير النصوص، تصحيح الإملاء، إعادة الصياغة
 *
 * @dependencies
 * - @anthropic-ai/sdk: للتواصل مع Claude API
 * - antiword (عبر WSL): لقراءة ملفات .doc
 * - axios: للـ REST fallback
 * - iconv-lite: لتحويل الترميزات
 *
 * @stateManagement
 * - Stateful: يحتفظ بإعدادات النموذج ومسار الإخراج
 * - Singleton: يستخدم Anthropic client واحد
 *
 * @architecture
 * - نمط: Service Layer
 * - النموذج: claude-opus-4-6
 * - Temperature: 0.0 (للدقة القصوى)
 * - Fallback: REST API عند فشل SDK
 *
 * @example الاستخدام الأساسي
 * ```typescript
 * const classifier = new ScreenplayClassifier();
 * const { result, outputFile } = await classifier.processFile('script.doc');
 * console.log(result); // النص المصنف
 * console.log(outputFile); // مسار الملف المحفوظ
 * ```
 *
 * @example تصنيف نص مباشر
 * ```typescript
 * const classifier = new ScreenplayClassifier();
 * const text = "مشهد 1\nداخلي - منزل - نهار\nيدخل أحمد";
 * const result = await classifier.classify(text);
 * ```
 *
 * @example تغيير النموذج
 * ```typescript
 * const classifier = new ScreenplayClassifier('claude-sonnet-4');
 * ```
 */
export class ScreenplayClassifier {
  model;
  apiKey;
  outputDir;
  /**
   * إنشاء مثيل جديد من المصنف
   *
   * @param model - معرف النموذج (افتراضي: claude-opus-4-6)
   * @throws {Error} إذا كان ANTHROPIC_API_KEY غير موجود
   */
  constructor(model = MODEL_ID) {
    this.model = model;
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.outputDir = path.resolve("output");
    // إنشاء مجلد output إذا لم يكن موجودًا
    this.ensureOutputDir();
    if (!this.apiKey) {
      throw new Error("ANTHROPIC_API_KEY غير موجود في متغيرات البيئة");
    }
  }
  async ensureOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      console.error("خطأ في إنشاء مجلد output:", error);
    }
  }
  async convertDocToText(docPath) {
    const resolvedPath = path.resolve(docPath);
    // التحقق من وجود الملف
    try {
      await fs.access(resolvedPath);
    } catch {
      throw new Error(`الملف غير موجود: ${resolvedPath}`);
    }
    const ext = path.extname(resolvedPath).toLowerCase();
    if (ext === ".txt") {
      return this.loadTextFile(resolvedPath);
    }
    if (ext !== ".doc") {
      throw new Error(`نوع الملف غير مدعوم: ${ext}`);
    }
    // ملفات .doc - استخدام antiword عبر WSL
    let wslPath = resolvedPath.replace(/\\/g, "/");
    const match = wslPath.match(/^([A-Za-z]):/);
    if (match) {
      const drive = match[1].toLowerCase();
      wslPath = wslPath.replace(/^([A-Za-z]):/, `/mnt/${drive}`);
    }
    try {
      const { stdout, stderr } = await execAsync(
        `wsl --exec antiword "${wslPath}"`,
        {
          encoding: "utf-8",
          timeout: 30000,
        }
      );
      if (stderr) {
        throw new Error(`خطأ في antiword: ${stderr}`);
      }
      return stdout;
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error("WSL أو antiword غير متوفر. يرجى التأكد من تثبيتهما.", {
          cause: error,
        });
      }
      throw error;
    }
  }
  async loadTextFile(filePath) {
    const buffer = await fs.readFile(filePath);
    const attempts = [
      { name: "utf-8", decode: () => buffer.toString("utf-8") },
      {
        name: "windows-1256",
        decode: () => iconv.decode(buffer, "windows-1256"),
      },
      { name: "latin1", decode: () => buffer.toString("latin1") },
    ];
    for (const attempt of attempts) {
      try {
        const content = attempt.decode();
        if (content.length > 0) {
          return content;
        }
      } catch {
        // نجرب المحاولة التالية
      }
    }
    return buffer.toString("utf-8");
  }
  _preprocessText(text) {
    const lines = text.split("\n");
    const outputLines = [];
    const actionBuffer = [];
    let dialogueSpeaker = null;
    const dialogueBuffer = [];
    let prevNonEmptyWasSceneHeader = false;
    const flushAction = () => {
      if (actionBuffer.length > 0) {
        const merged = actionBuffer
          .map((ln) => ln.trim())
          .filter((ln) => ln.length > 0)
          .join(" ");
        if (merged) {
          outputLines.push(merged);
        }
        actionBuffer.length = 0;
      }
    };
    const flushDialogue = () => {
      if (dialogueSpeaker !== null) {
        outputLines.push(`${dialogueSpeaker} :`);
        const merged = dialogueBuffer
          .map((ln) => ln.trim())
          .filter((ln) => ln.length > 0)
          .join(" ");
        if (merged) {
          outputLines.push(merged);
        }
        dialogueSpeaker = null;
        dialogueBuffer.length = 0;
      }
    };
    const isSeparatorLine = (s) => {
      if (!s || s.length < 5) return false;
      const uniqueChars = new Set(s);
      return (
        uniqueChars.size === 1 && (uniqueChars.has("=") || uniqueChars.has("-"))
      );
    };
    const looksLikeCharacterAndDialogue = (strippedLine) => {
      let s = strippedLine;
      if (s.startsWith("▪")) {
        s = s.replace(/^▪+/, "").trim();
      }
      if (!s.includes(":")) return null;
      const colonIndex = s.indexOf(":");
      const namePart = s.substring(0, colonIndex);
      const rest = s.substring(colonIndex + 1);
      const name = namePart.trim();
      if (!name || name.length > 50) return null;
      const dialogue = rest.trim();
      return { name, dialogue };
    };
    for (const raw of lines) {
      const line = raw.replace(/\r$/, "").replace(/\s+$/, "");
      const stripped = line.trim();
      if (stripped === "") {
        flushDialogue();
        flushAction();
        outputLines.push("");
        prevNonEmptyWasSceneHeader = false;
        continue;
      }
      if (isSeparatorLine(stripped)) {
        flushDialogue();
        flushAction();
        outputLines.push(line);
        prevNonEmptyWasSceneHeader = false;
        continue;
      }
      if (stripped.startsWith("مشهد")) {
        flushDialogue();
        flushAction();
        outputLines.push(line);
        prevNonEmptyWasSceneHeader = true;
        continue;
      }
      if (prevNonEmptyWasSceneHeader) {
        flushDialogue();
        flushAction();
        outputLines.push(line);
        prevNonEmptyWasSceneHeader = false;
        continue;
      }
      if (stripped === "قطع") {
        flushDialogue();
        flushAction();
        outputLines.push(line);
        prevNonEmptyWasSceneHeader = false;
        continue;
      }
      const charAndDialogue = looksLikeCharacterAndDialogue(stripped);
      if (charAndDialogue !== null) {
        const { name, dialogue } = charAndDialogue;
        flushAction();
        flushDialogue();
        dialogueSpeaker = name;
        if (dialogue) {
          dialogueBuffer.push(dialogue);
        }
        prevNonEmptyWasSceneHeader = false;
        continue;
      }
      const isIndentedContinuation = line.length > 0 && /\s/.test(line[0]);
      const isActionLine = stripped.startsWith("-") || stripped.startsWith("–");
      if (dialogueSpeaker !== null) {
        if (isIndentedContinuation && !isActionLine) {
          dialogueBuffer.push(stripped);
          prevNonEmptyWasSceneHeader = false;
          continue;
        }
        flushDialogue();
      }
      actionBuffer.push(line);
      prevNonEmptyWasSceneHeader = false;
    }
    flushDialogue();
    flushAction();
    return outputLines.join("\n");
  }
  _buildUserPrompt(text) {
    return `صنّف عناصر النص التالي تصنيفًا حرفيًا صارمًا وفق قواعد الـ System Prompt.

قواعد تنفيذ إلزامية:
- أخرج حتى نهاية النص بالكامل. ممنوع التوقف أو كتابة "الباقي…".
- ممنوع أي نص خارج أسطر التصنيف.
- ممنوع الأسطر الفارغة وممنوع --- وممنوع العناوين.
- كل سطر إخراج يجب أن يطابق: <ELEMENT> = <VALUE>
- ممنوع استخدام "لا يوجد" داخل التدفق.
- CHARACTER لا يُكتب إلا إذا كان في النص سطر باسم متبوع بـ :
- الأسماء داخل الوصف (ACTION) لا تتحول إلى CHARACTER.
- ACTION: كل سطر وصفي = ACTION مستقل.
- TRANSITION مثل "قطع" عنصر مستقل في كل ظهور.

النص:
${text}`;
  }
  async classifyWithSdkPrimary(text, maxTokens) {
    const response = await tryCreateMessageWithSdk({
      model: this.model,
      max_tokens: maxTokens,
      temperature: CLASSIFICATION_TEMPERATURE,
      system: SCREENPLAY_CLASSIFIER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: this._buildUserPrompt(text) }],
    });
    return extractTextFromAnthropicBlocks(response.content);
  }
  async classifyWithRestFallback(text, maxTokens) {
    const apiKey = this.apiKey;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY غير موجود");
    }
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: this.model,
        max_tokens: maxTokens,
        temperature: CLASSIFICATION_TEMPERATURE,
        system: SCREENPLAY_CLASSIFIER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: this._buildUserPrompt(text) }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        timeout: 600000,
      }
    );
    return response.data.content[0]?.text ?? "";
  }
  async classifyWithAPI(text) {
    const lines = text.split("\n");
    // تحديد المعاملات حسب النموذج
    let maxTokens;
    let linesThreshold;
    let chunkSize;
    if (this.model.includes("opus")) {
      maxTokens = 12000;
      linesThreshold = 400;
      chunkSize = 300;
    } else if (this.model.includes("sonnet")) {
      maxTokens = 8000;
      linesThreshold = 200;
      chunkSize = 150;
    } else {
      maxTokens = 4096;
      linesThreshold = 100;
      chunkSize = 75;
    }
    if (lines.length <= linesThreshold) {
      try {
        return await this.classifyWithSdkPrimary(text, maxTokens);
      } catch (error) {
        console.warn(`تحذير: فشل SDK، الرجوع إلى REST fallback: ${error}`);
        return this.classifyWithRestFallback(text, maxTokens);
      }
    }
    return this._classifyLongText(text, maxTokens, chunkSize);
  }
  async _classifyLongText(text, maxTokens, chunkSize) {
    const lines = text.split("\n");
    const results = [];
    const totalChunks = Math.ceil(lines.length / chunkSize);
    console.log(`  سيتم تقسيم النص إلى ${totalChunks} جزء...`);
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize).join("\n");
      const chunkNum = Math.floor(i / chunkSize) + 1;
      console.log(`  جاري معالجة الجزء ${chunkNum}/${totalChunks}...`);
      try {
        const chunkResult = await this.classifyWithSdkPrimary(chunk, maxTokens);
        results.push(chunkResult);
      } catch (error) {
        console.warn(
          `تحذير: فشل SDK في الجزء ${chunkNum}، الرجوع إلى REST: ${error}`
        );
        const chunkResult = await this.classifyWithRestFallback(
          chunk,
          maxTokens
        );
        results.push(chunkResult);
      }
      console.log(`  ✓ تم معالجة الجزء ${chunkNum}/${totalChunks}`);
    }
    return results.join("\n");
  }
  async classify(text) {
    return this.classifyWithAPI(text);
  }
  async saveResult(result, sourceFile) {
    const sourceName = path.basename(sourceFile, path.extname(sourceFile));
    const timestamp = new Date()
      .toISOString()
      .replace(/[:T]/g, "_")
      .split(".")[0];
    const outputFile = path.join(
      this.outputDir,
      `${sourceName}_classified_${timestamp}.txt`
    );
    const header = [
      `# تصنيف السيناريو: ${sourceFile}`,
      `# التاريخ: ${new Date().toLocaleString("ar-EG")}`,
      `# النموذج: ${this.model}`,
      `# ${"=".repeat(57)}`,
      "",
    ].join("\n");
    await fs.writeFile(outputFile, header + result, "utf-8");
    return outputFile;
  }
  async processFile(filePath, saveOutput = true) {
    console.log(`جاري تحميل الملف: ${filePath}`);
    // تحويل أو تحميل الملف
    const ext = path.extname(filePath).toLowerCase();
    let text;
    if (ext === ".doc") {
      text = await this.convertDocToText(filePath);
    } else {
      text = await this.loadTextFile(filePath);
    }
    text = this._preprocessText(text);
    console.log(`تم تحميل ${text.length} حرف`);
    console.log("جاري التصنيف...");
    // تصنيف النص
    const result = await this.classify(text);
    // حفظ النتيجة
    let outputFile = null;
    if (saveOutput) {
      outputFile = await this.saveResult(result, filePath);
      console.log(`تم حفظ النتيجة في: ${outputFile}`);
    } else {
      console.log("تم تعطيل حفظ النتيجة (--no-save)");
    }
    return { result, outputFile };
  }
}
const buildReviewUserPrompt = (request) => {
  const payload = {
    totalReviewed: request.totalReviewed,
    requiredItemIndexes: request.requiredItemIndexes,
    forcedItemIndexes: request.forcedItemIndexes,
    suspiciousLines: request.suspiciousLines,
  };
  return `راجع عناصر التصنيف المشتبه فيها فقط، وارجع JSON بالمخطط المطلوب حرفيًا.\n\n${JSON.stringify(payload, null, 2)}`;
};

const uniqueSortedIntegers = (values) =>
  [...new Set((values ?? []).filter((value) => isIntegerNumber(value)))].sort(
    (a, b) => a - b
  );

const normalizeDecisionsAgainstRequest = (request, rawDecisions) => {
  const allowedIndexes = new Set(
    request.suspiciousLines.map((line) => line.itemIndex)
  );
  const bestByIndex = new Map();

  for (const decision of rawDecisions) {
    if (!allowedIndexes.has(decision.itemIndex)) continue;
    const existing = bestByIndex.get(decision.itemIndex);
    if (!existing || decision.confidence >= existing.confidence) {
      bestByIndex.set(decision.itemIndex, decision);
    }
  }

  return Array.from(bestByIndex.values()).sort(
    (a, b) => a.itemIndex - b.itemIndex
  );
};

const buildReviewCoverageMeta = (request, decisions) => {
  const decisionByIndex = new Map(
    decisions.map((decision) => [decision.itemIndex, decision])
  );
  const suspiciousByIndex = new Map(
    request.suspiciousLines.map((line) => [line.itemIndex, line])
  );
  const requiredItemIndexes = uniqueSortedIntegers(request.requiredItemIndexes);
  const forcedItemIndexes = uniqueSortedIntegers(request.forcedItemIndexes);

  const missingItemIndexes = requiredItemIndexes.filter(
    (itemIndex) => !decisionByIndex.has(itemIndex)
  );
  const unresolvedForcedItemIndexes = forcedItemIndexes.filter((itemIndex) => {
    const source = suspiciousByIndex.get(itemIndex);
    const decision = decisionByIndex.get(itemIndex);
    if (!source || !decision) return true;
    return decision.finalType === source.assignedType;
  });

  return {
    requestedCount: requiredItemIndexes.length,
    decisionCount: decisions.length,
    missingItemIndexes,
    forcedItemIndexes,
    unresolvedForcedItemIndexes,
  };
};

const createReviewResponseWithCoverage = (
  request,
  decisions,
  startedAt,
  defaultAppliedMessage
) => {
  const normalizedDecisions = normalizeDecisionsAgainstRequest(request, decisions);
  const meta = buildReviewCoverageMeta(request, normalizedDecisions);
  const latencyMs = Date.now() - startedAt;

  if (meta.unresolvedForcedItemIndexes.length > 0) {
    return {
      status: "error",
      model: MODEL_ID,
      decisions: normalizedDecisions,
      message:
        "تعذر حسم عناصر forced المطلوبة: " +
        meta.unresolvedForcedItemIndexes.join(", "),
      latencyMs,
      meta,
    };
  }

  if (meta.missingItemIndexes.length > 0) {
    return {
      status: "warning",
      model: MODEL_ID,
      decisions: normalizedDecisions,
      message:
        "الوكيل لم يُرجع قرارات كاملة لكل requiredItemIndexes: " +
        meta.missingItemIndexes.join(", "),
      latencyMs,
      meta,
    };
  }

  if (normalizedDecisions.length === 0) {
    return {
      status: "skipped",
      model: MODEL_ID,
      decisions: [],
      message: "الوكيل لم يرجع قرارات قابلة للتطبيق.",
      latencyMs,
      meta,
    };
  }

  return {
    status: "applied",
    model: MODEL_ID,
    decisions: normalizedDecisions,
    message: defaultAppliedMessage,
    latencyMs,
    meta,
  };
};

export const reviewSuspiciousLinesWithClaude = async (request) => {
  const startedAt = Date.now();
  const emptyMeta = buildReviewCoverageMeta(request, []);

  if (!process.env.ANTHROPIC_API_KEY) {
    const hasUnresolvedForced = emptyMeta.unresolvedForcedItemIndexes.length > 0;
    return {
      status: hasUnresolvedForced ? "error" : "warning",
      model: MODEL_ID,
      decisions: [],
      message: "ANTHROPIC_API_KEY غير موجود؛ تم تخطي مرحلة الوكيل.",
      latencyMs: Date.now() - startedAt,
      meta: emptyMeta,
    };
  }
  if (
    !Array.isArray(request.suspiciousLines) ||
    request.suspiciousLines.length === 0
  ) {
    return {
      status: "skipped",
      model: MODEL_ID,
      decisions: [],
      message: "لا توجد سطور مشتبه فيها لإرسالها للوكيل.",
      latencyMs: Date.now() - startedAt,
      meta: emptyMeta,
    };
  }
  const maxTokens = Math.min(
    3000,
    Math.max(600, request.suspiciousLines.length * 180)
  );
  const params = {
    model: MODEL_ID,
    max_tokens: maxTokens,
    temperature: REVIEW_TEMPERATURE,
    system: REVIEW_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildReviewUserPrompt(request),
      },
    ],
  };
  try {
    const message = await tryCreateMessageWithSdk(params);
    const text = extractTextFromAnthropicBlocks(message.content);
    const decisions = parseReviewDecisions(text);
    return createReviewResponseWithCoverage(
      request,
      decisions,
      startedAt,
      `تم استلام ${decisions.length} قرار من الوكيل.`
    );
  } catch (sdkError) {
    console.warn(
      `تحذير: فشل SDK في المراجعة، تجربة REST fallback: ${sdkError}`
    );
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        // eslint-disable-next-line preserve-caught-error
        throw new Error("ANTHROPIC_API_KEY غير موجود");
      }
      const response = await axios.post(
        "https://api.anthropic.com/v1/messages",
        params,
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          timeout: DEFAULT_TIMEOUT_MS,
        }
      );
      const text = response.data.content[0]?.text ?? "";
      const decisions = parseReviewDecisions(text);
      return createReviewResponseWithCoverage(
        request,
        decisions,
        startedAt,
        `تم استلام ${decisions.length} قرار (REST fallback).`
      );
    } catch (restError) {
      return {
        status: "error",
        model: MODEL_ID,
        decisions: [],
        message: `فشل الوكيل: ${restError}`,
        latencyMs: Date.now() - startedAt,
        meta: emptyMeta,
      };
    }
  }
};
export const requestAnthropicReview = reviewSuspiciousLinesWithClaude;
export const getAnthropicReviewModel = () => MODEL_ID;
// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let file = path.join("D:", "aanalyze script", "WRONGS.txt");
  let model = MODEL_ID;
  let noSave = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model" && i + 1 < args.length) {
      model = args[i + 1];
      i++;
    } else if (args[i] === "--no-save") {
      noSave = true;
    } else if (!args[i].startsWith("--")) {
      file = args[i];
    }
  }
  return { file, model, noSave };
}
// Main function
export async function main() {
  console.log("=".repeat(60));
  console.log("وكيل تصنيف السيناريوهات العربية - الإصدار 3.0");
  console.log("Arabic Screenplay Classifier Agent v3.0");
  console.log("=".repeat(60));
  console.log();
  // التحقق من المتطلبات
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("خطأ: ANTHROPIC_API_KEY غير موجود");
    console.log("يرجى إضافته في ملف .env");
    process.exit(1);
  }
  const { file, model, noSave } = parseArgs();
  try {
    // إنشاء الوكيل
    const classifier = new ScreenplayClassifier(model);
    // معالجة الملف
    const { result, outputFile } = await classifier.processFile(file, !noSave);
    // عرض النتيجة
    console.log();
    console.log("=".repeat(60));
    console.log("النتيجة:");
    console.log("=".repeat(60));
    console.log();
    console.log(result);
    if (outputFile) {
      console.log();
      console.log(`تم تأكيد حفظ الملف في: ${outputFile}`);
    }
  } catch (error) {
    console.error(`خطأ: ${error}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}
const isDirectExecution = () => {
  try {
    const currentFile = fileURLToPath(import.meta.url);
    const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
    return entryFile.length > 0 && entryFile === path.resolve(currentFile);
  } catch {
    return false;
  }
};
if (isDirectExecution()) {
  main().catch((error) => {
    console.error("خطأ غير متوقع أثناء تشغيل الوكيل:", error);
    process.exit(1);
  });
}
