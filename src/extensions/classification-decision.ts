import { collectActionEvidence, type ActionEvidence, isActionLine } from './action'
import { isCharacterLine } from './character'
import type { ClassificationContext } from './classification-types'
import { getDialogueProbability, hasDirectDialogueCues, isDialogueLine } from './dialogue'
import { normalizeLine } from './text-utils'

export type ResolvedNarrativeType = 'action' | 'dialogue' | 'character'

export interface NarrativeDecision {
  readonly type: ResolvedNarrativeType
  readonly reason: string
  readonly scoreGap: number
}

export const getContextTypeScore = (
  context: ClassificationContext,
  candidateTypes: readonly ResolvedNarrativeType[]
): number => {
  const recent = context.previousTypes.slice(-6)
  let score = 0

  for (let i = 0; i < recent.length; i++) {
    const weight = recent.length - i
    const type = recent[i]

    if (type === 'action' && candidateTypes.includes('action')) score += weight
    if (type === 'dialogue' && candidateTypes.includes('dialogue')) score += weight
    if (type === 'character' && candidateTypes.includes('character')) score += weight
    if (type === 'parenthetical' && candidateTypes.includes('dialogue')) score += Math.max(1, weight - 1)
  }

  return score
}

export const scoreActionEvidence = (evidence: ActionEvidence): number => {
  let score = 0
  if (evidence.byDash) score += 5
  if (evidence.byCue) score += 3
  if (evidence.byPattern) score += 3
  if (evidence.byVerb) score += 2
  if (evidence.byStructure) score += 1
  if (evidence.byNarrativeSyntax) score += 2
  if (evidence.byPronounAction) score += 2
  if (evidence.byThenAction) score += 1
  if (evidence.byAudioNarrative) score += 2
  return score
}

export const passesActionDefinitionGate = (
  line: string,
  context: ClassificationContext,
  evidence: ActionEvidence
): boolean => {
  if (evidence.byDash) return true
  if (evidence.byPattern || evidence.byVerb || evidence.byNarrativeSyntax) return true
  if (context.previousType === 'action' && scoreActionEvidence(evidence) >= 1) return true

  return isActionLine(line, context)
}

export const isDialogueHardBreaker = (
  line: string,
  _context: ClassificationContext,
  evidence: ActionEvidence
): boolean => {
  if (hasDirectDialogueCues(line)) return false
  const actionScore = scoreActionEvidence(evidence)
  return actionScore >= 5
}

export const passesDialogueDefinitionGate = (
  line: string,
  context: ClassificationContext,
  dialogueScore: number,
  evidence: ActionEvidence
): boolean => {
  if (isDialogueHardBreaker(line, context, evidence)) return false
  if (isDialogueLine(line, context)) return true

  const inDialogueFlow =
    context.previousType === 'character' ||
    context.previousType === 'dialogue' ||
    context.previousType === 'parenthetical'

  if (inDialogueFlow && dialogueScore >= 2) return true
  return dialogueScore >= 5
}

export const passesCharacterDefinitionGate = (
  line: string,
  context: ClassificationContext
): boolean => {
  return isCharacterLine(line, context)
}

export const resolveNarrativeDecision = (
  line: string,
  context: ClassificationContext
): NarrativeDecision => {
  const normalized = normalizeLine(line)
  if (!normalized) {
    return { type: 'action', reason: 'empty-default', scoreGap: 0 }
  }

  const evidence = collectActionEvidence(normalized)
  const dialogueScore = getDialogueProbability(normalized, context)

  const actionCandidate = passesActionDefinitionGate(normalized, context, evidence)
  const dialogueCandidate = passesDialogueDefinitionGate(normalized, context, dialogueScore, evidence)
  const characterCandidate = passesCharacterDefinitionGate(normalized, context)

  const scores = {
    action: Number.NEGATIVE_INFINITY,
    dialogue: Number.NEGATIVE_INFINITY,
    character: Number.NEGATIVE_INFINITY,
  }

  if (actionCandidate) {
    scores.action = scoreActionEvidence(evidence) + getContextTypeScore(context, ['action'])
  }

  if (dialogueCandidate) {
    scores.dialogue = dialogueScore + getContextTypeScore(context, ['dialogue'])
  }

  if (characterCandidate) {
    scores.character = 8 + getContextTypeScore(context, ['character'])
  }

  const sorted = (Object.keys(scores) as ResolvedNarrativeType[]).sort(
    (a, b) => scores[b] - scores[a]
  )
  const winner = sorted[0]
  const runnerUp = sorted[1]

  return {
    type: winner,
    reason: `score:${winner}`,
    scoreGap: scores[winner] - scores[runnerUp],
  }
}

