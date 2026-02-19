import type { ElementType } from './classification-types'

export interface SequenceSuggestionFeatures {
  readonly wordCount: number
  readonly startsWithDash: boolean
  readonly isParenthetical: boolean
  readonly hasActionIndicators: boolean
  readonly endsWithColon: boolean
}

export const CLASSIFICATION_VALID_SEQUENCES: ReadonlyMap<ElementType, ReadonlySet<ElementType>> = new Map([
  ['basmala', new Set<ElementType>(['sceneHeaderTopLine'])],
  ['sceneHeaderTopLine', new Set<ElementType>(['sceneHeader3'])],
  ['sceneHeader3', new Set<ElementType>(['action'])],
  ['action', new Set<ElementType>(['action', 'character', 'transition', 'sceneHeaderTopLine'])],
  ['character', new Set<ElementType>(['dialogue', 'parenthetical'])],
  ['dialogue', new Set<ElementType>(['dialogue', 'character', 'action', 'transition', 'parenthetical'])],
  ['parenthetical', new Set<ElementType>(['dialogue', 'character', 'action', 'transition'])],
  ['transition', new Set<ElementType>(['sceneHeaderTopLine', 'sceneHeader3'])],
])

export const CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY: ReadonlyMap<string, number> = new Map([
  ['character→character', 90],
  ['character→action', 82],
  ['character→transition', 84],
  ['dialogue→dialogue', 72],
  ['sceneHeaderTopLine→action', 86],
  ['sceneHeaderTopLine→character', 88],
  ['sceneHeader3→character', 78],
  ['transition→dialogue', 85],
])

export function suggestTypeFromClassificationSequence(
  prevType: ElementType,
  features: SequenceSuggestionFeatures
): ElementType | null {
  if (prevType === 'sceneHeaderTopLine') return 'sceneHeader3'
  if (prevType === 'sceneHeader3') return 'action'
  if (prevType === 'transition') return 'sceneHeaderTopLine'
  if (prevType === 'character') {
    if (features.isParenthetical) return 'parenthetical'
    return 'dialogue'
  }
  if (prevType === 'dialogue' && features.endsWithColon && features.wordCount <= 5) {
    return 'character'
  }

  if (features.isParenthetical) return 'parenthetical'
  if (features.startsWithDash || features.hasActionIndicators) return 'action'
  if (features.endsWithColon && features.wordCount <= 5) return 'character'
  if (features.wordCount <= 4) return 'dialogue'

  return null
}
