import type { ScreenplayBlock } from "./document-model";
import {
  DEFAULT_STRUCTURE_PIPELINE_POLICY,
  type ProjectionGuardReport,
  type StructurePipelinePolicy,
  type StructurePipelineResult,
} from "@/types/structure-pipeline";
import {
  SCENE_HEADER3_KNOWN_PLACES_RE,
  SCENE_HEADER3_MULTI_LOCATION_EXACT_RE,
  SCENE_HEADER3_MULTI_LOCATION_RE,
  SCENE_HEADER3_PREFIX_RE,
  SCENE_HEADER3_RANGE_RE,
  SCENE_LOCATION_RE,
  SCENE_NUMBER_EXACT_RE,
  SCENE_TIME_RE,
} from "./arabic-patterns";
import {
  hasActionVerbStructure,
  hasSentencePunctuation,
  isActionVerbStart,
  matchesActionStartPattern,
  normalizeLine,
} from "./text-utils";

type ClassificationState = {
  expectedSceneHeader: "scene-header-2" | "scene-header-3" | null;
  expectingDialogueAfterCue: boolean;
  previousFormat: ScreenplayBlock["formatId"] | null;
};

const INLINE_SPEAKER_RE = /^([^:：]{1,30})\s*[:：]\s*(.+)$/u;
const SPEAKER_CUE_RE = /^([^:：]{1,30})\s*[:：]\s*$/u;
const TRANSITION_LINE_RE = /^(?:قطع|انتقال(?:\s+إلى)?|cut\s+to)\s*[:：]?$/iu;

const normalizeInlineSpaces = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const normalizeLineForStructure = (line: string): string =>
  normalizeInlineSpaces((line ?? "").replace(/\u00A0/g, " "));

const stripTrailingColon = (line: string): string =>
  line.replace(/[:：]\s*$/u, "").trim();

const isLikelySpeakerName = (value: string): boolean => {
  const name = normalizeInlineSpaces(value);
  if (!name || name.length > 28) return false;
  if (name.split(" ").length > 4) return false;
  if (!/^[\p{L}\p{N}\s]+$/u.test(name)) return false;
  if (/^(?:مشهد|scene|قطع|انتقال|داخلي|خارجي)$/iu.test(name)) return false;
  return true;
};

const isTransitionLine = (line: string): boolean =>
  TRANSITION_LINE_RE.test(normalizeLine(line));

const isSceneHeader1Only = (line: string): boolean => {
  const normalized = normalizeLine(stripTrailingColon(line));
  if (!SCENE_NUMBER_EXACT_RE.test(normalized)) return false;
  const numberPrefixMatch = normalized.match(/^(?:مشهد|scene)\s*[0-9٠-٩]+/iu);
  if (!numberPrefixMatch) return false;
  const remainder = normalized.slice(numberPrefixMatch[0].length).trim();
  return remainder.length === 0;
};

const isSceneHeader2Only = (line: string): boolean => {
  const normalized = normalizeLine(stripTrailingColon(line))
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;
  if (SCENE_NUMBER_EXACT_RE.test(normalized)) return false;
  const hasTime = SCENE_TIME_RE.test(normalized);
  const hasLocation = SCENE_LOCATION_RE.test(normalized);
  return hasTime && hasLocation;
};

const isSceneHeaderTopLine = (line: string): boolean => {
  const normalized = normalizeLine(stripTrailingColon(line));
  if (!SCENE_NUMBER_EXACT_RE.test(normalized)) return false;
  const numberPrefixMatch = normalized.match(/^(?:مشهد|scene)\s*[0-9٠-٩]+/iu);
  if (!numberPrefixMatch) return false;
  const remainder = normalized.slice(numberPrefixMatch[0].length).trim();
  if (!remainder) return false;
  const hasTime = SCENE_TIME_RE.test(remainder);
  const hasLocation = SCENE_LOCATION_RE.test(remainder);
  return hasTime && hasLocation;
};

const isSceneHeader3Standalone = (line: string): boolean => {
  const normalized = normalizeLine(stripTrailingColon(line));
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  if (!normalized) return false;
  if (wordCount > 14) return false;
  if (hasSentencePunctuation(normalized)) return false;
  if (isTransitionLine(normalized)) return false;
  if (SCENE_NUMBER_EXACT_RE.test(normalized)) return false;
  if (isSceneHeader2Only(normalized)) return false;
  if (isActionVerbStart(normalized)) return false;
  if (matchesActionStartPattern(normalized)) return false;
  if (hasActionVerbStructure(normalized)) return false;

  if (SCENE_HEADER3_PREFIX_RE.test(normalized)) return true;
  if (SCENE_HEADER3_RANGE_RE.test(normalized)) return true;
  if (SCENE_HEADER3_MULTI_LOCATION_EXACT_RE.test(normalized)) return true;
  if (SCENE_HEADER3_MULTI_LOCATION_RE.test(normalized)) return true;
  if (SCENE_HEADER3_KNOWN_PLACES_RE.test(normalized)) return true;

  return false;
};

const resolvePolicy = (
  policy?: Partial<StructurePipelinePolicy>
): StructurePipelinePolicy => ({
  mergePolicy: policy?.mergePolicy ?? DEFAULT_STRUCTURE_PIPELINE_POLICY.mergePolicy,
  classifierRole:
    policy?.classifierRole ?? DEFAULT_STRUCTURE_PIPELINE_POLICY.classifierRole,
});

const classifyLineLabelOnly = (
  line: string,
  state: ClassificationState
): ScreenplayBlock["formatId"] => {
  if (/^بسم\b/u.test(line) || /^بسم الله/u.test(line)) {
    state.expectedSceneHeader = null;
    state.expectingDialogueAfterCue = false;
    return "basmala";
  }

  if (state.expectedSceneHeader === "scene-header-2") {
    if (isSceneHeader2Only(line)) {
      state.expectedSceneHeader = "scene-header-3";
      state.expectingDialogueAfterCue = false;
      return "scene-header-2";
    }
    if (isSceneHeader3Standalone(line)) {
      state.expectedSceneHeader = null;
      state.expectingDialogueAfterCue = false;
      return "scene-header-3";
    }
    state.expectedSceneHeader = null;
  } else if (state.expectedSceneHeader === "scene-header-3") {
    if (isSceneHeader3Standalone(line)) {
      state.expectedSceneHeader = null;
      state.expectingDialogueAfterCue = false;
      return "scene-header-3";
    }
    if (isSceneHeader2Only(line)) {
      state.expectedSceneHeader = "scene-header-3";
      state.expectingDialogueAfterCue = false;
      return "scene-header-2";
    }
    state.expectedSceneHeader = null;
  }

  if (isSceneHeaderTopLine(line)) {
    state.expectedSceneHeader = "scene-header-3";
    state.expectingDialogueAfterCue = false;
    return "scene-header-top-line";
  }

  if (isSceneHeader1Only(line)) {
    state.expectedSceneHeader = "scene-header-2";
    state.expectingDialogueAfterCue = false;
    return "scene-header-1";
  }

  if (isSceneHeader2Only(line)) {
    state.expectedSceneHeader = "scene-header-3";
    state.expectingDialogueAfterCue = false;
    return "scene-header-2";
  }

  if (isSceneHeader3Standalone(line)) {
    state.expectedSceneHeader = null;
    state.expectingDialogueAfterCue = false;
    return "scene-header-3";
  }

  if (isTransitionLine(line)) {
    state.expectedSceneHeader = null;
    state.expectingDialogueAfterCue = false;
    return "transition";
  }

  const cueOnlyMatch = line.match(SPEAKER_CUE_RE);
  if (cueOnlyMatch && isLikelySpeakerName(cueOnlyMatch[1] ?? "")) {
    state.expectingDialogueAfterCue = true;
    return "character";
  }

  const inlineSpeakerMatch = line.match(INLINE_SPEAKER_RE);
  if (inlineSpeakerMatch && isLikelySpeakerName(inlineSpeakerMatch[1] ?? "")) {
    state.expectingDialogueAfterCue = false;
    return "dialogue";
  }

  if (state.expectingDialogueAfterCue) {
    state.expectedSceneHeader = null;
    state.expectingDialogueAfterCue = false;
    return "dialogue";
  }

  if (state.previousFormat === "character" || state.previousFormat === "dialogue") {
    state.expectedSceneHeader = null;
    return "dialogue";
  }

  state.expectedSceneHeader = null;
  return "action";
};

const countNonActionBlocks = (blocks: ScreenplayBlock[]): number =>
  blocks.filter((block) => block.formatId !== "action").length;

export const normalizeTextForStructure = (text: string): string =>
  (text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u2028|\u2029/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\u000B/g, "\n")
    .replace(/\f/g, "\n")
    .replace(/^\uFEFF/, "");

export const segmentLinesStrict = (text: string): string[] =>
  normalizeTextForStructure(text)
    .split("\n")
    .map(normalizeLineForStructure)
    .filter((line) => line.length > 0);

export const buildStructuredBlocksFromText = (
  text: string,
  policy?: Partial<StructurePipelinePolicy>
): StructurePipelineResult => {
  const resolvedPolicy = resolvePolicy(policy);
  const normalizedText = normalizeTextForStructure(text);
  const normalizedLines = segmentLinesStrict(normalizedText);

  const state: ClassificationState = {
    expectedSceneHeader: null,
    expectingDialogueAfterCue: false,
    previousFormat: null,
  };

  const blocks: ScreenplayBlock[] = normalizedLines.map((line) => {
    const formatId =
      resolvedPolicy.classifierRole === "label-only"
        ? classifyLineLabelOnly(line, state)
        : classifyLineLabelOnly(line, state);
    state.previousFormat = formatId;
    return {
      formatId,
      text: line,
    };
  });

  return {
    normalizedText,
    normalizedLines,
    blocks,
    policy: resolvedPolicy,
  };
};

export const buildProjectionGuardReport = ({
  inputLineCount,
  currentBlocks,
  nextBlocks,
  policy,
}: {
  inputLineCount: number;
  currentBlocks?: ScreenplayBlock[];
  nextBlocks: ScreenplayBlock[];
  policy?: Partial<StructurePipelinePolicy>;
}): ProjectionGuardReport => {
  const resolvedPolicy = resolvePolicy(policy);
  const reasons: string[] = [];
  const safeInputLineCount = Math.max(0, inputLineCount);
  const outputBlockCount = nextBlocks.length;

  if (safeInputLineCount > 1 && outputBlockCount <= 1) {
    reasons.push("single-block-output-for-multiline-input");
  }

  if (
    safeInputLineCount >= 8 &&
    outputBlockCount <= Math.max(1, Math.floor(safeInputLineCount * 0.25))
  ) {
    reasons.push("sharp-input-output-collapse");
  }

  const currentBlockCount = currentBlocks?.length;
  if (
    typeof currentBlockCount === "number" &&
    currentBlockCount >= 12 &&
    outputBlockCount <= Math.max(1, Math.floor(currentBlockCount * 0.2))
  ) {
    reasons.push("sharp-document-collapse");
  }

  const currentNonActionCount = currentBlocks
    ? countNonActionBlocks(currentBlocks)
    : undefined;
  const outputNonActionCount = countNonActionBlocks(nextBlocks);

  if (
    resolvedPolicy.classifierRole === "label-only" &&
    typeof currentNonActionCount === "number" &&
    currentNonActionCount >= 3 &&
    outputNonActionCount <= Math.max(0, Math.floor(currentNonActionCount * 0.15))
  ) {
    reasons.push("non-action-structure-loss");
  }

  return {
    accepted: reasons.length === 0,
    reasons,
    inputLineCount: safeInputLineCount,
    outputBlockCount,
    currentBlockCount,
    currentNonActionCount,
    outputNonActionCount,
    fallbackApplied: false,
  };
};
