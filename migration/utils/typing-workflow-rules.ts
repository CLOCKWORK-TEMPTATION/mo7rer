import { EDITOR_STYLE_FORMAT_IDS } from "./editor-styles";
import type { EditorStyleFormatId } from "./editor-styles";

export type TypingFormatId = EditorStyleFormatId;

export interface ResolveTypingTransitionOptions {
  isEmpty?: boolean;
  shiftPressed?: boolean;
}

export interface TypingTransitionResult {
  nextFormat: TypingFormatId;
  seedText?: string;
}

const TYPING_FORMAT_SET = new Set<string>(EDITOR_STYLE_FORMAT_IDS);

const ENTER_TRANSITIONS: Readonly<Record<TypingFormatId, TypingTransitionResult>> = {
  basmala: { nextFormat: "scene-header-1" },
  "scene-header-top-line": { nextFormat: "scene-header-3" },
  "scene-header-1": { nextFormat: "scene-header-1" },
  "scene-header-2": { nextFormat: "scene-header-2" },
  "scene-header-3": { nextFormat: "action" },
  action: { nextFormat: "action" },
  character: { nextFormat: "dialogue" },
  parenthetical: { nextFormat: "dialogue" },
  dialogue: { nextFormat: "character" },
  transition: { nextFormat: "transition", seedText: "النهاية" },
};

const TAB_TRANSITIONS: Readonly<Record<TypingFormatId, TypingTransitionResult>> = {
  basmala: { nextFormat: "scene-header-1" },
  "scene-header-top-line": { nextFormat: "scene-header-3" },
  "scene-header-1": { nextFormat: "scene-header-2" },
  "scene-header-2": { nextFormat: "scene-header-3" },
  "scene-header-3": { nextFormat: "action" },
  action: { nextFormat: "character" },
  character: { nextFormat: "dialogue" },
  parenthetical: { nextFormat: "dialogue" },
  dialogue: { nextFormat: "action" },
  transition: { nextFormat: "scene-header-1" },
};

const SHIFT_TAB_OVERRIDES: Readonly<Partial<Record<TypingFormatId, TypingTransitionResult>>> = {
  action: { nextFormat: "transition" },
  dialogue: { nextFormat: "transition" },
};

const normalizeTypingFormat = (format: string): TypingFormatId =>
  TYPING_FORMAT_SET.has(format) ? (format as TypingFormatId) : "action";

const cloneTransitionResult = (
  transition: TypingTransitionResult
): TypingTransitionResult => ({
  nextFormat: transition.nextFormat,
  ...(transition.seedText ? { seedText: transition.seedText } : {}),
});

export const resolveTypingOnEnter = (
  currentFormat: string,
  _options: ResolveTypingTransitionOptions = {}
): TypingTransitionResult => {
  const normalized = normalizeTypingFormat(currentFormat);
  return cloneTransitionResult(
    ENTER_TRANSITIONS[normalized] ?? { nextFormat: "action" }
  );
};

export const resolveTypingOnTab = (
  currentFormat: string,
  options: ResolveTypingTransitionOptions = {}
): TypingTransitionResult => {
  const normalized = normalizeTypingFormat(currentFormat);

  if (options.shiftPressed) {
    const shifted = SHIFT_TAB_OVERRIDES[normalized];
    if (shifted) {
      return cloneTransitionResult(shifted);
    }
  }

  return cloneTransitionResult(
    TAB_TRANSITIONS[normalized] ?? { nextFormat: normalized }
  );
};
