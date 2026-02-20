export type ElementType =
  | 'basmala'
  | 'sceneHeaderTopLine'
  | 'sceneHeader3'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'

export type LegacyElementType =
  | 'basmala'
  | 'scene-header-top-line'
  | 'scene-header-3'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'

export type ClassificationMethod = 'regex' | 'context' | 'fallback' | 'ml'

export interface ClassifiedLine {
  readonly lineIndex: number
  readonly text: string
  readonly assignedType: ElementType
  readonly originalConfidence: number
  readonly classificationMethod: ClassificationMethod
}

export interface DetectorFinding {
  readonly detectorId: string
  readonly suspicionScore: number
  readonly reason: string
  readonly suggestedType: ElementType | null
}

export interface SuspiciousLine {
  readonly line: ClassifiedLine
  readonly totalSuspicion: number
  readonly findings: readonly DetectorFinding[]
  readonly contextLines: readonly ClassifiedLine[]
}

export interface LLMReviewPacket {
  readonly totalSuspicious: number
  readonly totalReviewed: number
  readonly suspicionRate: number
  readonly suspiciousLines: readonly SuspiciousLine[]
}

export interface ClassificationContext {
  readonly previousTypes: readonly ElementType[]
  readonly previousType: ElementType | null
  readonly isInDialogueBlock: boolean
  readonly isAfterSceneHeaderTopLine: boolean
}

export interface ClassifiedDraft {
  readonly type: ElementType
  readonly text: string
  readonly header1?: string
  readonly header2?: string
  readonly confidence: number
  readonly classificationMethod: ClassificationMethod
}

const LEGACY_TO_ELEMENT: Record<LegacyElementType, ElementType> = {
  basmala: 'basmala',
  'scene-header-top-line': 'sceneHeaderTopLine',
  'scene-header-3': 'sceneHeader3',
  action: 'action',
  character: 'character',
  dialogue: 'dialogue',
  parenthetical: 'parenthetical',
  transition: 'transition',
}

const ELEMENT_TO_LEGACY: Record<ElementType, LegacyElementType> = {
  basmala: 'basmala',
  sceneHeaderTopLine: 'scene-header-top-line',
  sceneHeader3: 'scene-header-3',
  action: 'action',
  character: 'character',
  dialogue: 'dialogue',
  parenthetical: 'parenthetical',
  transition: 'transition',
}

export function isElementType(value: string): value is ElementType {
  return value in ELEMENT_TO_LEGACY
}

export function fromLegacyElementType(value: string): ElementType | null {
  if (value in LEGACY_TO_ELEMENT) {
    return LEGACY_TO_ELEMENT[value as LegacyElementType]
  }
  if (isElementType(value)) return value
  return null
}

export function toLegacyElementType(value: ElementType): LegacyElementType {
  return ELEMENT_TO_LEGACY[value]
}
