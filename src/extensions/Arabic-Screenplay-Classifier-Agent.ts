import type {
  AgentReviewDecision,
  AgentReviewRequestPayload,
  AgentReviewResponsePayload,
} from "../types/agent-review";
import type { LineType } from "../types/screenplay";

export const MODEL_ID = "claude-opus-4-6";

const ALLOWED_LINE_TYPES = new Set<LineType>([
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

export interface ProcessFileResult {
  result: string;
  outputFile: string | null;
}

const clampConfidence = (value: number): number => {
  if (!Number.isFinite(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

export const parseReviewDecisions = (
  rawText: string
): AgentReviewDecision[] => {
  const source = rawText.trim();
  if (!source) return [];

  const parseCandidate = (candidate: string): AgentReviewDecision[] => {
    const parsed = JSON.parse(candidate) as { decisions?: unknown };
    const decisions = Array.isArray(parsed.decisions) ? parsed.decisions : [];
    const normalized: AgentReviewDecision[] = [];

    for (const decision of decisions) {
      if (!decision || typeof decision !== "object") continue;
      const record = decision as Record<string, unknown>;
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
      if (!ALLOWED_LINE_TYPES.has(finalType as LineType)) continue;

      normalized.push({
        itemIndex,
        finalType: finalType as LineType,
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
 * نسخة واجهة متوافقة من وكيل Filmlane داخل بيئة الواجهة.
 * التنفيذ الفعلي للمراجعة يتم في backend endpoint `/api/agent/review`.
 */
export class ScreenplayClassifier {
  private model: string;

  constructor(model: string = MODEL_ID) {
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  async classify(text: string): Promise<string> {
    return text;
  }

  async processFile(_filePath: string): Promise<ProcessFileResult> {
    throw new Error(
      "ScreenplayClassifier.processFile غير مدعوم داخل واجهة المتصفح."
    );
  }
}

export const reviewSuspiciousLinesWithClaude = async (
  request: AgentReviewRequestPayload
): Promise<AgentReviewResponsePayload> => {
  if (
    !Array.isArray(request.suspiciousLines) ||
    request.suspiciousLines.length === 0
  ) {
    return {
      status: "skipped",
      model: MODEL_ID,
      decisions: [],
      message: "لا توجد سطور مشتبه فيها لإرسالها للوكيل.",
      latencyMs: 0,
    };
  }

  return {
    status: "warning",
    model: MODEL_ID,
    decisions: [],
    message: "استخدم backend route /api/agent/review لتنفيذ مراجعة Claude.",
    latencyMs: 0,
  };
};
