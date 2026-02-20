import {
  ACTION_CUE_RE,
  ACTION_START_PATTERNS,
  ACTION_VERB_FOLLOWED_BY_NAME_AND_VERB_RE,
  CONVERSATIONAL_MARKERS_RE,
  FULL_ACTION_VERB_SET,
  IMPERATIVE_VERB_SET,
  NEGATION_PLUS_VERB_RE,
  PRONOUN_ACTION_RE,
  THEN_ACTION_RE,
  VERB_WITH_PRONOUN_SUFFIX_RE,
} from './arabic-patterns'

export const INVISIBLE_CHARS_RE = /[\u200f\u200e\ufeff]/g
export const STARTS_WITH_BULLET_RE =
  /^[\s\u200E\u200F\u061C\uFEFF]*[•·∙⋅●○◦■□▪▫◆◇–—−‒―‣⁃*+]/
export const LEADING_BULLETS_RE =
  /^[\s\u200E\u200F\u061C\uFEFF]*[•·∙⋅●○◦■□▪▫◆◇–—−‒―‣⁃*+]+\s*/

export function cleanInvisibleChars(text: string): string {
  return (text ?? '').replace(INVISIBLE_CHARS_RE, '')
}

export function normalizeLine(text: string): string {
  return cleanInvisibleChars(text)
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripLeadingBullets(text: string): string {
  return (text ?? '').replace(LEADING_BULLETS_RE, '')
}

export function startsWithBullet(text: string): boolean {
  return STARTS_WITH_BULLET_RE.test(text ?? '')
}

export function normalizeCharacterName(text: string): string {
  return normalizeLine(text)
    .replace(/[:：]+\s*$/, '')
    .trim()
}

export function hasSentencePunctuation(text: string): boolean {
  return /[.!?؟،,؛;]/.test(normalizeLine(text))
}

export function isActionWithDash(line: string): boolean {
  const normalized = normalizeLine(line)
  if (!normalized) return false
  return /^[-–—]\s+.+/.test(normalized)
}

export function isActionCueLine(text: string): boolean {
  const normalized = normalizeLine(text)
  return ACTION_CUE_RE.test(normalized)
}

export function isImperativeStart(text: string): boolean {
  const normalized = normalizeLine(text)
  const firstWord = normalized.split(/\s+/)[0] ?? ''
  return IMPERATIVE_VERB_SET.has(firstWord)
}

export function matchesActionStartPattern(text: string): boolean {
  const normalized = normalizeLine(text)
  if (!normalized) return false
  return ACTION_START_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function isActionVerbStart(text: string): boolean {
  const normalized = normalizeLine(text)
  if (!normalized) return false

  const firstWord = normalized.split(/\s+/)[0] ?? ''
  const normalizedFirstWord = firstWord.replace(/[^\u0600-\u06FFA-Za-z]/g, '')

  if (FULL_ACTION_VERB_SET.has(normalizedFirstWord)) return true
  if (/^(?:[وف]?)[يتنأ][\u0600-\u06FF]{2,}$/.test(normalizedFirstWord)) return true
  if (NEGATION_PLUS_VERB_RE.test(normalized)) return true

  return false
}

export function hasActionVerbStructure(text: string): boolean {
  const normalized = normalizeLine(text)
  if (!normalized) return false

  if (PRONOUN_ACTION_RE.test(normalized)) return true
  if (THEN_ACTION_RE.test(normalized)) return true
  if (ACTION_VERB_FOLLOWED_BY_NAME_AND_VERB_RE.test(normalized)) return true
  if (VERB_WITH_PRONOUN_SUFFIX_RE.test(normalized)) return true

  return false
}

export function looksLikeNarrativeActionSyntax(text: string): boolean {
  const normalized = normalizeLine(text)
  if (!normalized) return false
  if (/[:：]\s*$/.test(normalized)) return false
  if (/[؟?!]/.test(normalized)) return false

  const tokens = normalized.split(/\s+/).filter(Boolean)
  if (tokens.length < 3) return false

  const isVerbLikeToken = (token: string): boolean => {
    const cleaned = token.replace(/[^\u0600-\u06FF]/g, '')
    return /^(?:[وف]?)[يتنأ][\u0600-\u06FF]{2,}$/.test(cleaned)
  }

  const first = tokens[0] ?? ''
  const second = tokens[1] ?? ''
  const startsWithVerbLike =
    isVerbLikeToken(first) ||
    ((first === 'ثم' || first === 'و' || first === 'ف') && isVerbLikeToken(second))

  if (!startsWithVerbLike) return false

  const hasNarrativeConnectors =
    /\s+(?:و|ثم|بينما|وقد|حتى|بجوار|أمام|خلف|داخل|خارج|الى|إلى|نحو)\b/.test(normalized)

  return hasNarrativeConnectors || tokens.length >= 5
}

export function hasDirectDialogueMarkers(text: string): boolean {
  const normalized = normalizeLine(text)
  if (!normalized) return false

  if (CONVERSATIONAL_MARKERS_RE.test(normalized)) return true
  if (/[؟?!…]/.test(normalized)) return true
  if (/^(?:"|«|').+/.test(normalized)) return true

  return false
}
