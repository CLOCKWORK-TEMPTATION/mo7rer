import { Extension } from "@tiptap/core";
import { Fragment, Node as PmNode, Schema, Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { isActionLine } from "./action";
import {
  MODEL_ID as AGENT_MODEL_ID,
  parseReviewDecisions,
} from "./Arabic-Screenplay-Classifier-Agent";
import {
  DATE_PATTERNS,
  TIME_PATTERNS,
  convertHindiToArabic,
  detectDialect,
} from "./arabic-patterns";
import { isBasmalaLine } from "./basmala";
import {
  ensureCharacterTrailingColon,
  isCharacterLine,
  parseImplicitCharacterDialogueWithoutColon,
  parseInlineCharacterDialogue,
} from "./character";
import { resolveNarrativeDecision } from "./classification-decision";
import { PostClassificationReviewer } from "./classification-core";
import type {
  ClassifiedDraft,
  ClassificationContext,
  ClassifiedLine,
  ElementType,
  LLMReviewPacket,
  SuspiciousLine,
} from "./classification-types";
import { isElementType } from "./classification-types";
import { ContextMemoryManager } from "./context-memory-manager";
import {
  getDialogueProbability,
  isDialogueContinuationLine,
  isDialogueLine,
} from "./dialogue";
import { HybridClassifier } from "./hybrid-classifier";
import {
  mergeBrokenCharacterName,
  parseBulletLine,
  shouldMergeWrappedLines,
} from "./line-repair";
import { isParentheticalLine } from "./parenthetical";
import { isSceneHeader3Line } from "./scene-header-3";
import {
  isCompleteSceneHeaderLine,
  splitSceneHeaderLine,
} from "./scene-header-top-line";
import { isTransitionLine } from "./transition";
import { logger } from "../utils/logger";
import type {
  AgentReviewRequestPayload,
  AgentReviewResponsePayload,
  LineType,
} from "../types";

const AGENT_REVIEW_MODEL = AGENT_MODEL_ID;
const AGENT_REVIEW_DEADLINE_MS = 25_000;
const AGENT_REVIEW_MAX_ATTEMPTS = 2;
const AGENT_REVIEW_MAX_RATIO = 0.18;
const AGENT_REVIEW_MIN_TIMEOUT_MS = 1_500;
const AGENT_REVIEW_MAX_TIMEOUT_MS = 12_000;
const AGENT_REVIEW_RETRY_DELAY_MS = 450;

export const PASTE_CLASSIFIER_ERROR_EVENT = "paste-classifier:error";

const agentReviewLogger = logger.createScope("paste.agent-review");

const normalizeEndpoint = (endpoint: string): string =>
  endpoint.replace(/\/$/, "");

const resolveAgentReviewEndpoint = (): string => {
  const explicit = (
    import.meta.env.VITE_AGENT_REVIEW_BACKEND_URL as string | undefined
  )?.trim();
  if (explicit) return normalizeEndpoint(explicit);

  const fileImportEndpoint =
    (
      import.meta.env.VITE_FILE_IMPORT_BACKEND_URL as string | undefined
    )?.trim() ||
    (import.meta.env.DEV ? "http://127.0.0.1:8787/api/file-extract" : "");
  if (!fileImportEndpoint) return "";

  const normalized = normalizeEndpoint(fileImportEndpoint);
  if (normalized.endsWith("/api/file-extract")) {
    return `${normalized.slice(0, -"/api/file-extract".length)}/api/agent/review`;
  }

  return `${normalized}/api/agent/review`;
};

const AGENT_REVIEW_ENDPOINT = resolveAgentReviewEndpoint();
const REVIEWABLE_AGENT_TYPES = new Set<LineType>([
  "action",
  "dialogue",
  "character",
  "scene-header-top-line",
  "scene-header-3",
  "transition",
  "parenthetical",
  "basmala",
]);
const VALID_AGENT_DECISION_TYPES = new Set<LineType>([
  ...REVIEWABLE_AGENT_TYPES,
  "scene-header-1",
  "scene-header-2",
]);

let pendingAgentAbortController: AbortController | null = null;

export interface PasteClassifierOptions {
  agentReview?: (classified: readonly ClassifiedDraft[]) => ClassifiedDraft[];
}

export interface ApplyPasteClassifierFlowOptions {
  agentReview?: (classified: readonly ClassifiedDraft[]) => ClassifiedDraft[];
  from?: number;
  to?: number;
}

const buildContext = (
  previousTypes: readonly ElementType[]
): ClassificationContext => {
  const previousType =
    previousTypes.length > 0 ? previousTypes[previousTypes.length - 1] : null;
  const isInDialogueBlock =
    previousType === "character" ||
    previousType === "dialogue" ||
    previousType === "parenthetical";

  return {
    previousTypes,
    previousType,
    isInDialogueBlock,
    isAfterSceneHeaderTopLine: previousType === "sceneHeaderTopLine",
  };
};

const hasTemporalSceneSignal = (text: string): boolean =>
  DATE_PATTERNS.test(text) || TIME_PATTERNS.test(text);

const classifyLines = (text: string): ClassifiedDraft[] => {
  const lines = text.split(/\r?\n/);
  const classified: ClassifiedDraft[] = [];

  const memoryManager = new ContextMemoryManager();
  const hybridClassifier = new HybridClassifier();

  const push = (entry: ClassifiedDraft): void => {
    classified.push(entry);
    memoryManager.record(entry);
  };

  for (const rawLine of lines) {
    const trimmed = parseBulletLine(rawLine);
    if (!trimmed) continue;
    const normalizedForClassification = convertHindiToArabic(trimmed);
    const detectedDialect = detectDialect(normalizedForClassification);

    const previous = classified[classified.length - 1];
    if (previous) {
      const mergedCharacter = mergeBrokenCharacterName(previous.text, trimmed);
      if (mergedCharacter && previous.type === "action") {
        const corrected: ClassifiedDraft = {
          ...previous,
          type: "character",
          text: ensureCharacterTrailingColon(mergedCharacter),
          confidence: 92,
          classificationMethod: "context",
        };
        classified[classified.length - 1] = corrected;
        memoryManager.replaceLast(corrected);
        continue;
      }

      if (shouldMergeWrappedLines(previous.text, trimmed, previous.type)) {
        const merged: ClassifiedDraft = {
          ...previous,
          text: `${previous.text} ${trimmed}`.replace(/\s+/g, " ").trim(),
          confidence: Math.max(previous.confidence, 86),
          classificationMethod: "context",
        };
        classified[classified.length - 1] = merged;
        memoryManager.replaceLast(merged);
        continue;
      }
    }

    const context = buildContext(classified.map((item) => item.type));

    if (isBasmalaLine(normalizedForClassification)) {
      push({
        type: "basmala",
        text: trimmed,
        confidence: 99,
        classificationMethod: "regex",
      });
      continue;
    }

    if (isCompleteSceneHeaderLine(normalizedForClassification)) {
      const parts = splitSceneHeaderLine(normalizedForClassification);
      if (parts) {
        push({
          type: "sceneHeaderTopLine",
          text: trimmed,
          header1: parts.header1,
          header2: parts.header2,
          confidence: 96,
          classificationMethod: "regex",
        });
        continue;
      }
    }

    if (isTransitionLine(normalizedForClassification)) {
      push({
        type: "transition",
        text: trimmed,
        confidence: 95,
        classificationMethod: "regex",
      });
      continue;
    }

    const temporalSceneSignal = hasTemporalSceneSignal(
      normalizedForClassification
    );
    if (
      context.isAfterSceneHeaderTopLine &&
      (isSceneHeader3Line(normalizedForClassification, context) ||
        temporalSceneSignal)
    ) {
      push({
        type: "sceneHeader3",
        text: trimmed,
        confidence: temporalSceneSignal ? 88 : 90,
        classificationMethod: "context",
      });
      continue;
    }

    const inlineParsed = parseInlineCharacterDialogue(trimmed);
    if (inlineParsed) {
      if (inlineParsed.cue) {
        push({
          type: "action",
          text: inlineParsed.cue,
          confidence: 92,
          classificationMethod: "regex",
        });
      }

      push({
        type: "character",
        text: ensureCharacterTrailingColon(inlineParsed.characterName),
        confidence: 98,
        classificationMethod: "regex",
      });

      push({
        type: "dialogue",
        text: inlineParsed.dialogueText,
        confidence: 98,
        classificationMethod: "regex",
      });
      continue;
    }

    if (
      isParentheticalLine(normalizedForClassification) &&
      context.isInDialogueBlock
    ) {
      push({
        type: "parenthetical",
        text: trimmed,
        confidence: 90,
        classificationMethod: "regex",
      });
      continue;
    }

    if (isDialogueContinuationLine(rawLine, context.previousType)) {
      push({
        type: "dialogue",
        text: trimmed,
        confidence: 82,
        classificationMethod: "context",
      });
      continue;
    }

    const implicit = parseImplicitCharacterDialogueWithoutColon(
      trimmed,
      context
    );
    if (implicit) {
      if (implicit.cue) {
        push({
          type: "action",
          text: implicit.cue,
          confidence: 85,
          classificationMethod: "context",
        });
      }

      push({
        type: "character",
        text: ensureCharacterTrailingColon(implicit.characterName),
        confidence: 78,
        classificationMethod: "context",
      });

      push({
        type: "dialogue",
        text: implicit.dialogueText,
        confidence: 78,
        classificationMethod: "context",
      });
      continue;
    }

    if (isCharacterLine(normalizedForClassification, context)) {
      push({
        type: "character",
        text: ensureCharacterTrailingColon(trimmed),
        confidence: 88,
        classificationMethod: "regex",
      });
      continue;
    }

    const dialogueProbability = getDialogueProbability(
      normalizedForClassification,
      context
    );
    const dialogueThreshold = detectedDialect ? 5 : 6;
    if (
      isDialogueLine(normalizedForClassification, context) ||
      dialogueProbability >= dialogueThreshold
    ) {
      const dialectBoost = detectedDialect ? 3 : 0;
      push({
        type: "dialogue",
        text: trimmed,
        confidence: Math.max(
          72,
          Math.min(94, 64 + dialogueProbability * 4 + dialectBoost)
        ),
        classificationMethod: "context",
      });
      continue;
    }

    if (isSceneHeader3Line(normalizedForClassification, context)) {
      push({
        type: "sceneHeader3",
        text: trimmed,
        confidence: 80,
        classificationMethod: "context",
      });
      continue;
    }

    const decision = resolveNarrativeDecision(
      normalizedForClassification,
      context
    );
    const hybridResult = hybridClassifier.classifyLine(
      normalizedForClassification,
      decision.type,
      context,
      memoryManager.getSnapshot()
    );

    if (hybridResult.type === "sceneHeaderTopLine") {
      const parts = splitSceneHeaderLine(normalizedForClassification);
      if (parts && parts.header2) {
        push({
          type: "sceneHeaderTopLine",
          text: trimmed,
          header1: parts.header1,
          header2: parts.header2,
          confidence: Math.max(85, hybridResult.confidence),
          classificationMethod: hybridResult.classificationMethod,
        });
        continue;
      }
    }

    if (hybridResult.type === "character") {
      push({
        type: "character",
        text: ensureCharacterTrailingColon(trimmed),
        confidence: Math.max(78, hybridResult.confidence),
        classificationMethod: hybridResult.classificationMethod,
      });
      continue;
    }

    if (
      hybridResult.type === "action" ||
      isActionLine(normalizedForClassification, context)
    ) {
      push({
        type: "action",
        text: trimmed.replace(/^[-–—]\s*/, ""),
        confidence: Math.max(74, hybridResult.confidence),
        classificationMethod: hybridResult.classificationMethod,
      });
      continue;
    }

    push({
      type: hybridResult.type,
      text: trimmed,
      confidence: Math.max(68, hybridResult.confidence),
      classificationMethod: hybridResult.classificationMethod,
    });
  }

  return classified;
};

const elementTypeToLineType = (type: ElementType): LineType => {
  switch (type) {
    case "sceneHeaderTopLine":
      return "scene-header-top-line";
    case "sceneHeader3":
      return "scene-header-3";
    default:
      return type;
  }
};

const lineTypeToElementType = (type: LineType): ElementType | null => {
  switch (type) {
    case "scene-header-top-line":
      return "sceneHeaderTopLine";
    case "scene-header-3":
      return "sceneHeader3";
    case "action":
    case "dialogue":
    case "character":
    case "transition":
    case "parenthetical":
    case "basmala":
      return type;
    default:
      return null;
  }
};

const toClassifiedLineRecords = (
  classified: ClassifiedDraft[]
): ClassifiedLine[] =>
  classified.map((item, index) => ({
    lineIndex: index,
    text: item.text,
    assignedType: item.type,
    originalConfidence: item.confidence,
    classificationMethod: item.classificationMethod,
  }));

interface ReviewRoutingStats {
  countPass: number;
  countLocalReview: number;
  countAgentCandidate: number;
  countAgentForced: number;
}

const EMBEDDED_NARRATIVE_SUSPICION_FLOOR = 96;

const promoteHighSeverityMismatches = (
  suspiciousLines: readonly SuspiciousLine[]
): SuspiciousLine[] =>
  suspiciousLines.map((suspicious) => {
    if (
      suspicious.routingBand === "agent-candidate" &&
      suspicious.findings.some(
        (f) =>
          f.detectorId === "content-type-mismatch" &&
          f.suspicionScore >= EMBEDDED_NARRATIVE_SUSPICION_FLOOR
      )
    ) {
      return {
        ...suspicious,
        routingBand: "agent-forced" as const,
        escalationScore: Math.max(suspicious.escalationScore, 90),
      };
    }
    return suspicious;
  });

const summarizeRoutingStats = (
  totalReviewed: number,
  suspiciousLines: readonly SuspiciousLine[]
): ReviewRoutingStats => {
  const stats: ReviewRoutingStats = {
    countPass: Math.max(0, totalReviewed - suspiciousLines.length),
    countLocalReview: 0,
    countAgentCandidate: 0,
    countAgentForced: 0,
  };

  for (const line of suspiciousLines) {
    if (line.routingBand === "local-review") {
      stats.countLocalReview += 1;
      continue;
    }
    if (line.routingBand === "agent-candidate") {
      stats.countAgentCandidate += 1;
      continue;
    }
    if (line.routingBand === "agent-forced") {
      stats.countAgentForced += 1;
    }
  }

  return stats;
};

const shouldEscalateToAgent = (suspicious: SuspiciousLine): boolean => {
  if (suspicious.routingBand === "agent-forced") return true;
  if (suspicious.routingBand !== "agent-candidate") return false;
  return suspicious.criticalMismatch || suspicious.distinctDetectors >= 2;
};

export const selectSuspiciousLinesForAgent = (
  packet: LLMReviewPacket
): SuspiciousLine[] => {
  const forced = packet.suspiciousLines
    .filter((line) => line.routingBand === "agent-forced")
    .sort((a, b) => b.escalationScore - a.escalationScore);

  const candidates = packet.suspiciousLines
    .filter(
      (line) =>
        line.routingBand === "agent-candidate" && shouldEscalateToAgent(line)
    )
    .sort((a, b) => b.escalationScore - a.escalationScore);

  if (forced.length === 0 && candidates.length === 0) return [];

  const maxToAgent = Math.max(
    1,
    Math.ceil(packet.totalReviewed * AGENT_REVIEW_MAX_RATIO)
  );
  if (forced.length >= maxToAgent) {
    return forced;
  }

  const remainingSlots = Math.max(0, maxToAgent - forced.length);
  return [...forced, ...candidates.slice(0, remainingSlots)];
};

const shouldSkipAgentReviewInRuntime = (): boolean => {
  if (typeof window === "undefined") return true;
  if (import.meta.env.MODE === "test") {
    return true;
  }
  return false;
};

const waitBeforeRetry = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const isRetryableHttpStatus = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500;

const toUniqueSortedIndexes = (values: readonly number[]): number[] =>
  [...new Set(values.filter((value) => Number.isInteger(value) && value >= 0))]
    .sort((a, b) => a - b);

const toNormalizedMetaIndexes = (value: unknown): number[] =>
  Array.isArray(value)
    ? toUniqueSortedIndexes(
        value.filter(
          (item): item is number =>
            typeof item === "number" && Number.isInteger(item) && item >= 0
        )
      )
    : [];

const toValidAgentReviewMeta = (
  raw: unknown
): AgentReviewResponsePayload["meta"] => {
  if (!raw || typeof raw !== "object") return undefined;

  const record = raw as {
    requestedCount?: unknown;
    decisionCount?: unknown;
    missingItemIndexes?: unknown;
    forcedItemIndexes?: unknown;
    unresolvedForcedItemIndexes?: unknown;
  };

  const requestedCount =
    typeof record.requestedCount === "number" &&
    Number.isFinite(record.requestedCount)
      ? Math.max(0, Math.trunc(record.requestedCount))
      : 0;
  const decisionCount =
    typeof record.decisionCount === "number" && Number.isFinite(record.decisionCount)
      ? Math.max(0, Math.trunc(record.decisionCount))
      : 0;

  return {
    requestedCount,
    decisionCount,
    missingItemIndexes: toNormalizedMetaIndexes(record.missingItemIndexes),
    forcedItemIndexes: toNormalizedMetaIndexes(record.forcedItemIndexes),
    unresolvedForcedItemIndexes: toNormalizedMetaIndexes(
      record.unresolvedForcedItemIndexes
    ),
  };
};

const toValidAgentDecisions = (
  raw: unknown
): AgentReviewResponsePayload["decisions"] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const itemIndexRaw = (entry as { itemIndex?: unknown }).itemIndex;
      const finalTypeRaw = (entry as { finalType?: unknown }).finalType;
      const reasonRaw = (entry as { reason?: unknown }).reason;
      const confidenceRaw = (entry as { confidence?: unknown }).confidence;

      if (
        typeof itemIndexRaw !== "number" ||
        !Number.isInteger(itemIndexRaw) ||
        itemIndexRaw < 0
      )
        return null;
      if (typeof finalTypeRaw !== "string") return null;
      if (!VALID_AGENT_DECISION_TYPES.has(finalTypeRaw as LineType))
        return null;
      const itemIndex = Number(itemIndexRaw);

      return {
        itemIndex,
        finalType: finalTypeRaw as LineType,
        reason:
          typeof reasonRaw === "string" && reasonRaw.trim()
            ? reasonRaw.trim()
            : "قرار بدون سبب مفصل",
        confidence:
          typeof confidenceRaw === "number" && Number.isFinite(confidenceRaw)
            ? confidenceRaw
            : 0.5,
      };
    })
    .filter(
      (entry): entry is AgentReviewResponsePayload["decisions"][number] =>
        entry !== null
    );
};

const normalizeAgentReviewPayload = (
  payload: unknown,
  fallbackText?: string
): AgentReviewResponsePayload => {
  if (!payload || typeof payload !== "object") {
    const parsedFallback = fallbackText
      ? parseReviewDecisions(fallbackText)
      : [];
    return {
      status: parsedFallback.length > 0 ? "applied" : "skipped",
      model: AGENT_REVIEW_MODEL,
      decisions: parsedFallback,
      message:
        parsedFallback.length > 0
          ? "Applied from fallback text parsing."
          : "Empty/invalid agent payload.",
      latencyMs: 0,
      meta: undefined,
    };
  }

  const record = payload as Partial<AgentReviewResponsePayload> & {
    message?: unknown;
    status?: unknown;
    model?: unknown;
    decisions?: unknown;
    latencyMs?: unknown;
    meta?: unknown;
  };

  const status =
    record.status === "applied" ||
    record.status === "skipped" ||
    record.status === "warning" ||
    record.status === "error"
      ? record.status
      : "error";

  const directDecisions = toValidAgentDecisions(record.decisions);
  const textCandidates = [
    typeof record.message === "string" ? record.message : "",
    fallbackText ?? "",
  ].filter(Boolean);

  let parsedDecisions = directDecisions;
  if (parsedDecisions.length === 0) {
    for (const candidate of textCandidates) {
      const parsed = parseReviewDecisions(candidate);
      if (parsed.length > 0) {
        parsedDecisions = parsed;
        break;
      }
    }
  }

  const normalizedStatus: AgentReviewResponsePayload["status"] =
    parsedDecisions.length > 0 && status === "error" ? "applied" : status;

  return {
    status: normalizedStatus,
    model:
      typeof record.model === "string" && record.model.trim()
        ? record.model.trim()
        : AGENT_REVIEW_MODEL,
    decisions: parsedDecisions,
    message:
      typeof record.message === "string" && record.message.trim()
        ? record.message.trim()
        : normalizedStatus === "applied"
          ? "تم تطبيق قرارات الوكيل."
          : "No actionable decisions returned from agent.",
    latencyMs:
      typeof record.latencyMs === "number" && Number.isFinite(record.latencyMs)
        ? record.latencyMs
        : 0,
    meta: toValidAgentReviewMeta(record.meta),
  };
};

const requestAgentReview = async (
  request: AgentReviewRequestPayload
): Promise<AgentReviewResponsePayload> => {
  if (shouldSkipAgentReviewInRuntime()) {
    agentReviewLogger.telemetry("request-skipped-runtime", {
      sessionId: request.sessionId,
    });
    return {
      status: "skipped",
      model: AGENT_REVIEW_MODEL,
      decisions: [],
      message: "Agent review mocked as applied in current runtime.",
      latencyMs: 0,
      meta: {
        requestedCount: request.requiredItemIndexes.length,
        decisionCount: 0,
        missingItemIndexes: [...request.requiredItemIndexes],
        forcedItemIndexes: [...request.forcedItemIndexes],
        unresolvedForcedItemIndexes: [...request.forcedItemIndexes],
      },
    };
  }

  if (!AGENT_REVIEW_ENDPOINT) {
    agentReviewLogger.error("request-missing-endpoint", {
      sessionId: request.sessionId,
    });
    throw new Error(
      "VITE_FILE_IMPORT_BACKEND_URL غير مضبوط؛ لا يمكن تشغيل Agent Review."
    );
  }

  let lastError: unknown = null;
  const startedAt = Date.now();
  const deadlineAt = startedAt + AGENT_REVIEW_DEADLINE_MS;

  for (let attempt = 1; attempt <= AGENT_REVIEW_MAX_ATTEMPTS; attempt += 1) {
    const remainingBeforeAttempt = deadlineAt - Date.now();
    if (remainingBeforeAttempt <= 0) {
      throw new Error(
        `Agent review exceeded deadline (${AGENT_REVIEW_DEADLINE_MS}ms).`
      );
    }

    if (pendingAgentAbortController) {
      pendingAgentAbortController.abort();
    }
    const controller = new AbortController();
    pendingAgentAbortController = controller;
    const timeoutForAttempt = Math.min(
      AGENT_REVIEW_MAX_TIMEOUT_MS,
      Math.max(AGENT_REVIEW_MIN_TIMEOUT_MS, remainingBeforeAttempt - 200)
    );
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      timeoutForAttempt
    );

    try {
      const response = await fetch(AGENT_REVIEW_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        const isRetryable = isRetryableHttpStatus(response.status);
        agentReviewLogger.error("request-http-error", {
          sessionId: request.sessionId,
          status: response.status,
          body,
          attempt,
          isRetryable,
        });
        if (isRetryable && attempt < AGENT_REVIEW_MAX_ATTEMPTS) {
          await waitBeforeRetry(AGENT_REVIEW_RETRY_DELAY_MS * attempt);
          continue;
        }
        throw new Error(
          `Agent review route failed (${response.status}): ${body}`
        );
      }

      const responseText = await response.text();
      let parsedPayload: unknown;
      try {
        parsedPayload = JSON.parse(responseText);
      } catch {
        parsedPayload = responseText;
      }
      const payload = normalizeAgentReviewPayload(parsedPayload, responseText);
      agentReviewLogger.telemetry("request-response", {
        sessionId: request.sessionId,
        status: payload.status,
        decisions: payload.decisions?.length ?? 0,
        model: payload.model,
        latencyMs: payload.latencyMs,
        requestedCount: payload.meta?.requestedCount ?? 0,
        decisionCount: payload.meta?.decisionCount ?? 0,
        unresolvedForced:
          payload.meta?.unresolvedForcedItemIndexes?.length ?? 0,
        attempt,
      });
      if (payload.status === "error") {
        throw new Error(
          `Agent review status is ${payload.status}: ${payload.message}`
        );
      }
      return payload;
    } catch (error) {
      lastError = error;
      const aborted = (error as DOMException)?.name === "AbortError";
      const network = error instanceof TypeError;
      const retryable = aborted || network;
      const remainingAfterAttempt = deadlineAt - Date.now();

      if (aborted) {
        agentReviewLogger.warn("request-aborted", {
          sessionId: request.sessionId,
          attempt,
          timeoutForAttempt,
          remainingAfterAttempt,
        });
      } else if (network) {
        agentReviewLogger.warn("request-network-error", {
          sessionId: request.sessionId,
          attempt,
          error: error.message,
          remainingAfterAttempt,
        });
      } else {
        agentReviewLogger.error("request-unhandled-error", {
          sessionId: request.sessionId,
          attempt,
          error,
          remainingAfterAttempt,
        });
      }

      if (
        retryable &&
        attempt < AGENT_REVIEW_MAX_ATTEMPTS &&
        remainingAfterAttempt > AGENT_REVIEW_MIN_TIMEOUT_MS
      ) {
        await waitBeforeRetry(AGENT_REVIEW_RETRY_DELAY_MS * attempt);
        continue;
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);
      if (pendingAgentAbortController === controller) {
        pendingAgentAbortController = null;
      }
    }
  }

  throw new Error(
    `Agent review request failed after ${AGENT_REVIEW_MAX_ATTEMPTS} attempts and ${Date.now() - startedAt}ms: ${String(lastError)}`
  );
};

const buildAgentReviewMetaFallback = (
  requestPayload: AgentReviewRequestPayload,
  decisions: readonly AgentReviewResponsePayload["decisions"][number][],
  classified: readonly ClassifiedDraft[]
): NonNullable<AgentReviewResponsePayload["meta"]> => {
  const decisionByIndex = new Map<
    number,
    AgentReviewResponsePayload["decisions"][number]
  >();
  for (const decision of decisions) {
    decisionByIndex.set(decision.itemIndex, decision);
  }

  const missingItemIndexes = requestPayload.requiredItemIndexes.filter(
    (itemIndex) => !decisionByIndex.has(itemIndex)
  );
  const unresolvedForcedItemIndexes = requestPayload.forcedItemIndexes.filter(
    (itemIndex) => {
      const decision = decisionByIndex.get(itemIndex);
      if (!decision) return true;
      const mapped = lineTypeToElementType(decision.finalType);
      if (!mapped || !isElementType(mapped)) return true;
      const original = classified[itemIndex];
      if (!original) return true;
      return original.type === mapped;
    }
  );

  return {
    requestedCount: requestPayload.requiredItemIndexes.length,
    decisionCount: decisionByIndex.size,
    missingItemIndexes: toUniqueSortedIndexes(missingItemIndexes),
    forcedItemIndexes: [...requestPayload.forcedItemIndexes],
    unresolvedForcedItemIndexes: toUniqueSortedIndexes(unresolvedForcedItemIndexes),
  };
};

const applyRemoteAgentReview = async (
  classified: ClassifiedDraft[]
): Promise<ClassifiedDraft[]> => {
  if (classified.length === 0) return classified;

  const reviewInput = toClassifiedLineRecords(classified);
  const reviewer = new PostClassificationReviewer();
  const basePacket = reviewer.review(reviewInput);
  const reviewPacket: LLMReviewPacket = {
    ...basePacket,
    suspiciousLines: promoteHighSeverityMismatches(basePacket.suspiciousLines),
  };
  const routingStats = summarizeRoutingStats(
    reviewPacket.totalReviewed,
    reviewPacket.suspiciousLines
  );
  const selectedForAgent = selectSuspiciousLinesForAgent(reviewPacket);
  const selectedItemIndexesPreview = toUniqueSortedIndexes(
    selectedForAgent.map((line) => line.line.lineIndex)
  );
  const forcedItemIndexesPreview = toUniqueSortedIndexes(
    selectedForAgent
      .filter((line) => line.routingBand === "agent-forced")
      .map((line) => line.line.lineIndex)
  );

  const suspectSnapshots = selectedForAgent.map((suspicious) => ({
    itemIndex: suspicious.line.lineIndex,
    assignedType: suspicious.line.assignedType,
    routingBand: suspicious.routingBand,
    escalationScore: suspicious.escalationScore,
    reason: suspicious.findings[0]?.reason ?? "",
  }));

  agentReviewLogger.telemetry("packet-built", {
    totalReviewed: reviewPacket.totalReviewed,
    totalSuspicious: reviewPacket.totalSuspicious,
    suspicionRate: reviewPacket.suspicionRate,
    ...routingStats,
    countSentToAgent: selectedForAgent.length,
    sentItemIndexes: selectedItemIndexesPreview,
    forcedItemIndexes: forcedItemIndexesPreview,
  });
  if (suspectSnapshots.length > 0) {
    agentReviewLogger.debug("packet-suspects-snapshot", {
      lines: suspectSnapshots,
    });
  }
  if (selectedForAgent.length === 0) {
    agentReviewLogger.info("packet-skipped-after-routing", {
      ...routingStats,
      countSentToAgent: 0,
    });
    return classified;
  }

  if (shouldSkipAgentReviewInRuntime()) {
    agentReviewLogger.info("agent-review-bypassed-runtime", {
      reason: "test-or-non-browser-runtime",
      countSentToAgent: selectedForAgent.length,
    });
    return classified;
  }

  const reviewPacketText = reviewer.formatForLLM(reviewPacket);

  const suspiciousPayload = selectedForAgent
    .map((rawSuspect) => {
      const itemIndex = rawSuspect.line.lineIndex;
      const item = classified[itemIndex];
      if (!item) return null;

      const assignedType = elementTypeToLineType(item.type);
      if (!REVIEWABLE_AGENT_TYPES.has(assignedType)) return null;

      const contextLines = rawSuspect.contextLines
        .map((line) => {
          const mapped = elementTypeToLineType(line.assignedType);
          if (!REVIEWABLE_AGENT_TYPES.has(mapped)) return null;
          return {
            lineIndex: line.lineIndex,
            assignedType: mapped,
            text: line.text,
          };
        })
        .filter(
          (
            value
          ): value is {
            lineIndex: number;
            assignedType: LineType;
            text: string;
          } => value !== null
        );
      const routingBand: AgentReviewRequestPayload["suspiciousLines"][number]["routingBand"] =
        rawSuspect.routingBand === "agent-forced"
          ? "agent-forced"
          : "agent-candidate";

      return {
        itemIndex,
        lineIndex: rawSuspect.line.lineIndex,
        text: item.text,
        assignedType,
        totalSuspicion: rawSuspect.totalSuspicion,
        reasons: rawSuspect.findings.map((finding) => finding.reason),
        contextLines,
        escalationScore: rawSuspect.escalationScore,
        routingBand,
        criticalMismatch: rawSuspect.criticalMismatch,
        distinctDetectors: rawSuspect.distinctDetectors,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (suspiciousPayload.length === 0) {
    agentReviewLogger.info("packet-skipped-filtered-out", {
      totalSuspicious: reviewPacket.totalSuspicious,
      ...routingStats,
      countSentToAgent: 0,
    });
    return classified;
  }

  const sentItemIndexes = toUniqueSortedIndexes(
    suspiciousPayload.map((entry) => entry.itemIndex)
  );
  const forcedItemIndexes = toUniqueSortedIndexes(
    suspiciousPayload
      .filter((entry) => entry.routingBand === "agent-forced")
      .map((entry) => entry.itemIndex)
  );

  const requestPayload: AgentReviewRequestPayload = {
    sessionId: `paste-${Date.now()}`,
    totalReviewed: reviewPacket.totalReviewed,
    reviewPacketText: reviewPacketText || undefined,
    suspiciousLines: suspiciousPayload,
    requiredItemIndexes: sentItemIndexes,
    forcedItemIndexes,
  };

  const response = await requestAgentReview(requestPayload);
  const fallbackMeta = buildAgentReviewMetaFallback(
    requestPayload,
    response.decisions,
    classified
  );
  const responseMeta = response.meta ?? fallbackMeta;
  const missingRequiredItemIndexes = toUniqueSortedIndexes(
    responseMeta.missingItemIndexes
  );
  const unresolvedForcedItemIndexesFromMeta = toUniqueSortedIndexes(
    responseMeta.unresolvedForcedItemIndexes
  );

  if (response.status === "error") {
    throw new Error(
      `Agent review failed: status=${response.status} | message=${response.message}`
    );
  }

  const corrected = [...classified];
  const decisionItemIndexes: number[] = [];
  const effectiveAppliedItemIndexes: number[] = [];
  const unchangedDecisionItemIndexes: number[] = [];

  for (const decision of response.decisions) {
    const idx = decision.itemIndex;
    if (idx >= 0) decisionItemIndexes.push(idx);
    if (idx < 0 || idx >= corrected.length) continue;

    const mapped = lineTypeToElementType(decision.finalType);
    if (!mapped || !isElementType(mapped)) {
      unchangedDecisionItemIndexes.push(idx);
      continue;
    }

    const original = corrected[idx];
    if (!original || original.type === mapped) {
      unchangedDecisionItemIndexes.push(idx);
      continue;
    }

    if (mapped === "sceneHeaderTopLine") {
      const parts = splitSceneHeaderLine(original.text);
      if (!parts || !parts.header2) {
        unchangedDecisionItemIndexes.push(idx);
        continue;
      }
      corrected[idx] = {
        ...original,
        type: mapped,
        header1: parts.header1,
        header2: parts.header2,
        confidence: Math.max(
          original.confidence,
          Math.round((decision.confidence ?? 0.9) * 100),
          85
        ),
        classificationMethod: "context",
      };
      effectiveAppliedItemIndexes.push(idx);
      continue;
    }

    corrected[idx] = {
      ...original,
      type: mapped,
      header1: undefined,
      header2: undefined,
      confidence: Math.max(
        original.confidence,
        Math.round((decision.confidence ?? 0.9) * 100),
        85
      ),
      classificationMethod: "context",
    };
    effectiveAppliedItemIndexes.push(idx);
  }

  const uniqueDecisionItemIndexes = toUniqueSortedIndexes(decisionItemIndexes);
  const uniqueEffectiveAppliedItemIndexes = toUniqueSortedIndexes(
    effectiveAppliedItemIndexes
  );
  const uniqueUnchangedDecisionItemIndexes = toUniqueSortedIndexes(
    unchangedDecisionItemIndexes
  );
  const unresolvedForcedItemIndexesFromEffect = forcedItemIndexes.filter(
    (itemIndex) => !uniqueEffectiveAppliedItemIndexes.includes(itemIndex)
  );
  const unresolvedForcedItemIndexes = toUniqueSortedIndexes([
    ...unresolvedForcedItemIndexesFromMeta,
    ...unresolvedForcedItemIndexesFromEffect,
  ]);

  if (unresolvedForcedItemIndexes.length > 0) {
    agentReviewLogger.error("response-unresolved-forced-lines", {
      status: response.status,
      message: response.message,
      forcedItemIndexes,
      unresolvedForcedItemIndexesFromMeta,
      unresolvedForcedItemIndexesFromEffect,
      unresolvedForcedItemIndexes,
      decisionItemIndexes: uniqueDecisionItemIndexes,
      effectiveAppliedItemIndexes: uniqueEffectiveAppliedItemIndexes,
      unchangedDecisionItemIndexes: uniqueUnchangedDecisionItemIndexes,
      missingRequiredItemIndexes,
    });
    throw new Error(
      `Agent review unresolved for forced lines: ${unresolvedForcedItemIndexes.join(", ")} | status=${response.status} | message=${response.message}`
    );
  }

  if (response.status === "warning") {
    agentReviewLogger.warn("response-warning-partial-coverage", {
      message: response.message,
      missingRequiredItemIndexes,
      unresolvedForcedItemIndexes,
    });
  }

  agentReviewLogger.telemetry("response-applied", {
    status: response.status,
    decisions: response.decisions.length,
    sentItemIndexes,
    forcedItemIndexes,
    decisionItemIndexes: uniqueDecisionItemIndexes,
    effectiveAppliedItemIndexes: uniqueEffectiveAppliedItemIndexes,
    unchangedDecisionItemIndexes: uniqueUnchangedDecisionItemIndexes,
    missingRequiredItemIndexes,
    unresolvedForcedItemIndexes,
  });
  return corrected;
};

const applyAgentReview = (
  classified: ClassifiedDraft[],
  agentReview?: (classified: readonly ClassifiedDraft[]) => ClassifiedDraft[]
): ClassifiedDraft[] => {
  if (!agentReview) return classified;

  try {
    const reviewed = agentReview(classified);
    return reviewed.length > 0 ? reviewed : classified;
  } catch {
    return classified;
  }
};

const createNodeForType = (
  item: ClassifiedDraft,
  schema: Schema
): PmNode | null => {
  const { type, text, header1, header2 } = item;

  switch (type) {
    case "sceneHeaderTopLine": {
      const h1Node = schema.nodes.sceneHeader1.create(
        null,
        header1 ? schema.text(header1) : undefined
      );
      const h2Node = schema.nodes.sceneHeader2.create(
        null,
        header2 ? schema.text(header2) : undefined
      );
      return schema.nodes.sceneHeaderTopLine.create(null, [h1Node, h2Node]);
    }

    case "basmala":
      return schema.nodes.basmala.create(
        null,
        text ? schema.text(text) : undefined
      );

    case "sceneHeader3":
      return schema.nodes.sceneHeader3.create(
        null,
        text ? schema.text(text) : undefined
      );

    case "action":
      return schema.nodes.action.create(
        null,
        text ? schema.text(text) : undefined
      );

    case "character":
      return schema.nodes.character.create(
        null,
        text ? schema.text(ensureCharacterTrailingColon(text)) : undefined
      );

    case "dialogue":
      return schema.nodes.dialogue.create(
        null,
        text ? schema.text(text) : undefined
      );

    case "parenthetical":
      return schema.nodes.parenthetical.create(
        null,
        text ? schema.text(text) : undefined
      );

    case "transition":
      return schema.nodes.transition.create(
        null,
        text ? schema.text(text) : undefined
      );

    default:
      return schema.nodes.action.create(
        null,
        text ? schema.text(text) : undefined
      );
  }
};

const classifiedToNodes = (
  classified: readonly ClassifiedDraft[],
  schema: Schema
): PmNode[] => {
  const nodes: PmNode[] = [];

  for (const item of classified) {
    const node = createNodeForType(item, schema);
    if (node) nodes.push(node);
  }

  return nodes;
};

export const classifyText = (
  text: string,
  agentReview?: (classified: readonly ClassifiedDraft[]) => ClassifiedDraft[]
): ClassifiedDraft[] => {
  const initiallyClassified = classifyLines(text);
  return applyAgentReview(initiallyClassified, agentReview);
};

export const classifyTextWithAgentReview = async (
  text: string,
  agentReview?: (classified: readonly ClassifiedDraft[]) => ClassifiedDraft[]
): Promise<ClassifiedDraft[]> => {
  const initiallyClassified = classifyLines(text);
  const remotelyReviewed = await applyRemoteAgentReview(initiallyClassified);
  return applyAgentReview(remotelyReviewed, agentReview);
};

export const applyPasteClassifierFlowToView = async (
  view: EditorView,
  text: string,
  options: ApplyPasteClassifierFlowOptions = {}
): Promise<boolean> => {
  const classified = await classifyTextWithAgentReview(
    text,
    options.agentReview
  );
  if (classified.length === 0 || view.isDestroyed) return false;

  const nodes = classifiedToNodes(classified, view.state.schema);
  if (nodes.length === 0) return false;

  const fragment = Fragment.from(nodes);
  const slice = new Slice(fragment, 0, 0);
  const from = options.from ?? view.state.selection.from;
  const to = options.to ?? view.state.selection.to;
  const tr = view.state.tr;
  tr.replaceRange(from, to, slice);
  view.dispatch(tr);
  return true;
};

/**
 * مصنّف اللصق التلقائي داخل Tiptap.
 */
export const PasteClassifier = Extension.create<PasteClassifierOptions>({
  name: "pasteClassifier",

  addOptions() {
    return {
      agentReview: undefined,
    };
  },

  addProseMirrorPlugins() {
    const agentReview = this.options.agentReview;

    return [
      new Plugin({
        key: new PluginKey("pasteClassifier"),

        props: {
          handlePaste(view, event) {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;

            const text = clipboardData.getData("text/plain");
            if (!text || !text.trim()) return false;

            event.preventDefault();
            void applyPasteClassifierFlowToView(view, text, {
              agentReview,
            }).catch((error) => {
              const message =
                error instanceof Error ? error.message : String(error);
              agentReviewLogger.error("paste-failed-fatal", {
                error,
                message,
              });

              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent(PASTE_CLASSIFIER_ERROR_EVENT, {
                    detail: { message },
                  })
                );
              }
            });
            return true;
          },
        },
      }),
    ];
  },
});
