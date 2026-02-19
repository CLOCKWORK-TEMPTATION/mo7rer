import type {
  ClassifiedLine,
  DetectorFinding,
  ElementType,
  LLMReviewPacket,
  SuspiciousLine,
} from './classification-types'
import {
  hasActionVerbStructure,
  isActionCueLine,
  isActionVerbStart,
  matchesActionStartPattern,
} from './text-utils'
import { PRONOUN_ACTION_RE } from './arabic-patterns'
import {
  CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY,
  CLASSIFICATION_VALID_SEQUENCES,
  suggestTypeFromClassificationSequence,
} from './classification-sequence-rules'

export interface ReviewerConfig {
  readonly contextRadius: number
  readonly suspicionThreshold: number
  readonly maxSuspicionRatio: number
  readonly minSignalsForSuspicion: number
  readonly highSeveritySingleSignal: number
  readonly enabledDetectors: ReadonlySet<string>
}

const DEFAULT_CONFIG: ReviewerConfig = {
  contextRadius: 5,
  suspicionThreshold: 74,
  maxSuspicionRatio: 0.08,
  minSignalsForSuspicion: 2,
  highSeveritySingleSignal: 90,
  enabledDetectors: new Set([
    'sequence-violation',
    'content-type-mismatch',
    'split-character-fragment',
    'statistical-anomaly',
    'confidence-drop',
  ]),
}

interface TextFeatures {
  readonly wordCount: number
  readonly startsWithDash: boolean
  readonly isParenthetical: boolean
  readonly hasActionIndicators: boolean
  readonly endsWithColon: boolean
  readonly isEmpty: boolean
  readonly normalized: string
}

const extractTextFeatures = (text: string): TextFeatures => {
  const normalized = text.replace(/[\u200f\u200e\ufeff]/g, '').trim()
  const words = normalized.split(/\s+/).filter(Boolean)

  return {
    wordCount: words.length,
    startsWithDash: /^[-–—]/.test(normalized),
    isParenthetical: /^\s*[\(（].*[\)）]\s*$/.test(normalized),
    hasActionIndicators: detectActionIndicators(normalized),
    endsWithColon: /[:：]\s*$/.test(normalized),
    isEmpty: normalized.length === 0,
    normalized,
  }
}

const detectActionIndicators = (text: string): boolean => {
  if (!text) return false
  if (/^[-–—]/.test(text)) return true
  if (/^[•●○]/.test(text)) return true

  return (
    isActionCueLine(text) ||
    matchesActionStartPattern(text) ||
    isActionVerbStart(text) ||
    hasActionVerbStructure(text) ||
    PRONOUN_ACTION_RE.test(text)
  )
}

const normalizeNameFragment = (text: string): string =>
  (text ?? '')
    .replace(/[\u200f\u200e\ufeff]/g, '')
    .replace(/[:：]/g, '')
    .trim()

const isLikelyCharacterFragment = (
  text: string,
  limits: { minChars: number; maxChars: number; maxWords: number }
): boolean => {
  const normalized = normalizeNameFragment(text)
  if (!normalized) return false
  if (normalized.length < limits.minChars || normalized.length > limits.maxChars) return false
  if (/[.!?؟،,؛;"'«»()\[\]{}]/.test(normalized)) return false

  const tokens = normalized.split(/\s+/).filter(Boolean)
  if (tokens.length === 0 || tokens.length > limits.maxWords) return false

  return tokens.every((token) => /^[\u0600-\u06FF0-9٠-٩]+$/.test(token))
}

const hasStrongNarrativeActionSignal = (text: string): boolean => {
  const normalized = (text ?? '').trim()
  if (!normalized) return false
  if (/^[-–—•●○]/.test(normalized)) return true

  return (
    isActionCueLine(normalized) ||
    matchesActionStartPattern(normalized) ||
    isActionVerbStart(normalized) ||
    hasActionVerbStructure(normalized) ||
    PRONOUN_ACTION_RE.test(normalized)
  )
}

interface SuspicionDetector {
  readonly id: string
  detect(
    line: ClassifiedLine,
    features: TextFeatures,
    context: readonly ClassifiedLine[],
    linePosition: number
  ): DetectorFinding | null
}

const createSequenceViolationDetector = (): SuspicionDetector => ({
  id: 'sequence-violation',

  detect(
    line: ClassifiedLine,
    features: TextFeatures,
    context: readonly ClassifiedLine[],
    linePosition: number
  ): DetectorFinding | null {
    if (linePosition === 0) return null

    const prevLine = context[linePosition - 1]
    if (!prevLine) return null

    const prevType = prevLine.assignedType
    const currentType = line.assignedType

    const allowedNext = CLASSIFICATION_VALID_SEQUENCES.get(prevType)
    if (!allowedNext) return null
    if (allowedNext.has(currentType)) return null

    const violationKey = `${prevType}→${currentType}`
    const severity = CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get(violationKey) ?? 65

    const suggestedType = suggestTypeFromClassificationSequence(prevType, {
      wordCount: features.wordCount,
      startsWithDash: features.startsWithDash,
      isParenthetical: features.isParenthetical,
      hasActionIndicators: features.hasActionIndicators,
      endsWithColon: features.endsWithColon,
    })

    return {
      detectorId: 'sequence-violation',
      suspicionScore: severity,
      reason: `انتهاك تسلسل: "${currentType}" بعد "${prevType}" غير متوقع`,
      suggestedType,
    }
  },
})

const createContentTypeMismatchDetector = (): SuspicionDetector => ({
  id: 'content-type-mismatch',

  detect(line: ClassifiedLine, features: TextFeatures): DetectorFinding | null {
    if (features.isEmpty) return null

    const type = line.assignedType

    if (type === 'character') {
      if (features.wordCount > 5) {
        return {
          detectorId: 'content-type-mismatch',
          suspicionScore: 80,
          reason: `مصنّف "character" لكنه ${features.wordCount} كلمات - طويل جداً لاسم شخصية`,
          suggestedType: features.hasActionIndicators ? 'action' : 'dialogue',
        }
      }

      if (/[.!?؟]$/.test(features.normalized)) {
        return {
          detectorId: 'content-type-mismatch',
          suspicionScore: 75,
          reason: 'مصنّف "character" لكنه ينتهي بعلامة ترقيم جملة',
          suggestedType: 'dialogue',
        }
      }
    }

    if (type === 'dialogue') {
      if (features.startsWithDash && features.hasActionIndicators) {
        return {
          detectorId: 'content-type-mismatch',
          suspicionScore: 82,
          reason: 'مصنّف "dialogue" لكنه يبدأ بشرطة ويحتوي مؤشرات وصف مشهد',
          suggestedType: 'action',
        }
      }

      if (features.isParenthetical) {
        return {
          detectorId: 'content-type-mismatch',
          suspicionScore: 88,
          reason: 'مصنّف "dialogue" لكنه محاط بأقواس بالكامل → إرشاد مسرحي',
          suggestedType: 'parenthetical',
        }
      }
    }

    if (type === 'action' && features.endsWithColon && features.wordCount <= 3) {
      return {
        detectorId: 'content-type-mismatch',
        suspicionScore: 78,
        reason: 'مصنّف "action" لكنه ينتهي بنقطتين وقصير → أرجح اسم شخصية',
        suggestedType: 'character',
      }
    }

    if (type === 'parenthetical') {
      if (!features.isParenthetical && !features.normalized.includes('(') && !features.normalized.includes('（')) {
        return {
          detectorId: 'content-type-mismatch',
          suspicionScore: 72,
          reason: 'مصنّف "parenthetical" لكن لا يحتوي أقواس',
          suggestedType: 'dialogue',
        }
      }
    }

    if (type === 'transition' && features.wordCount > 6) {
      return {
        detectorId: 'content-type-mismatch',
        suspicionScore: 70,
        reason: `مصنّف "transition" لكنه ${features.wordCount} كلمات - طويل جداً للانتقال`,
        suggestedType: 'action',
      }
    }

    return null
  },
})

const createSplitCharacterFragmentDetector = (): SuspicionDetector => ({
  id: 'split-character-fragment',

  detect(
    line: ClassifiedLine,
    features: TextFeatures,
    context: readonly ClassifiedLine[],
    linePosition: number
  ): DetectorFinding | null {
    if (features.isEmpty) return null
    if (line.assignedType !== 'action') return null
    if (features.wordCount > 2) return null

    const currentText = normalizeNameFragment(line.text)
    if (!isLikelyCharacterFragment(currentText, { minChars: 2, maxChars: 14, maxWords: 2 })) {
      return null
    }

    if (hasStrongNarrativeActionSignal(features.normalized)) return null

    const nextLine = context[linePosition + 1]
    if (!nextLine || nextLine.assignedType !== 'character') return null

    const nextFeatures = extractTextFeatures(nextLine.text)
    if (!nextFeatures.endsWithColon) return null

    const nextText = normalizeNameFragment(nextLine.text)
    if (!isLikelyCharacterFragment(nextText, { minChars: 1, maxChars: 4, maxWords: 1 })) {
      return null
    }

    const mergedDirect = `${currentText}${nextText}`
    const mergedWithSpace = `${currentText} ${nextText}`

    const mergedLooksLikeName =
      isLikelyCharacterFragment(mergedDirect, { minChars: 3, maxChars: 32, maxWords: 3 }) ||
      isLikelyCharacterFragment(mergedWithSpace, { minChars: 3, maxChars: 32, maxWords: 3 })

    if (!mergedLooksLikeName) return null

    return {
      detectorId: 'split-character-fragment',
      suspicionScore: 92,
      reason: `اشتباه تجزئة اسم شخصية بين سطرين: "${currentText}" + "${nextText}"`,
      suggestedType: null,
    }
  },
})

const TYPE_STATISTICS: ReadonlyMap<ElementType, { minWords: number; maxWords: number }> = new Map([
  ['character', { minWords: 1, maxWords: 4 }],
  ['parenthetical', { minWords: 1, maxWords: 12 }],
  ['transition', { minWords: 1, maxWords: 5 }],
  ['dialogue', { minWords: 1, maxWords: 140 }],
  ['action', { minWords: 2, maxWords: 240 }],
  ['sceneHeaderTopLine', { minWords: 1, maxWords: 10 }],
  ['sceneHeader3', { minWords: 2, maxWords: 15 }],
  ['basmala', { minWords: 1, maxWords: 6 }],
])

const createStatisticalAnomalyDetector = (): SuspicionDetector => ({
  id: 'statistical-anomaly',

  detect(line: ClassifiedLine, features: TextFeatures): DetectorFinding | null {
    if (features.isEmpty) return null

    const stats = TYPE_STATISTICS.get(line.assignedType)
    if (!stats) return null

    if (features.wordCount > stats.maxWords) {
      const excess = features.wordCount - stats.maxWords
      const score = Math.min(60 + excess * 3, 90)
      return {
        detectorId: 'statistical-anomaly',
        suspicionScore: score,
        reason: `"${line.assignedType}" بطول ${features.wordCount} كلمة يتجاوز الحد الأقصى الطبيعي (${stats.maxWords})`,
        suggestedType: null,
      }
    }

    if (line.assignedType === 'action' && features.wordCount < stats.minWords) {
      return {
        detectorId: 'statistical-anomaly',
        suspicionScore: 55,
        reason: '"action" بكلمة واحدة فقط - قصير جداً لوصف مشهد',
        suggestedType: 'character',
      }
    }

    return null
  },
})

const createConfidenceDropDetector = (): SuspicionDetector => ({
  id: 'confidence-drop',

  detect(line: ClassifiedLine): DetectorFinding | null {
    if (line.classificationMethod === 'regex' && line.originalConfidence >= 90) {
      return null
    }

    if (line.classificationMethod === 'fallback' && line.originalConfidence < 60) {
      return {
        detectorId: 'confidence-drop',
        suspicionScore: 50,
        reason: `تصنيف بطريقة fallback بثقة ${line.originalConfidence}% فقط`,
        suggestedType: null,
      }
    }

    if (line.originalConfidence < 45) {
      return {
        detectorId: 'confidence-drop',
        suspicionScore: 55,
        reason: `ثقة التصنيف الأصلي منخفضة جداً: ${line.originalConfidence}%`,
        suggestedType: null,
      }
    }

    return null
  },
})

const calculateTotalSuspicion = (findings: readonly DetectorFinding[]): number => {
  if (findings.length === 0) return 0
  if (findings.length === 1) return findings[0].suspicionScore

  const sorted = [...findings].sort((a, b) => b.suspicionScore - a.suspicionScore)
  const primary = sorted[0].suspicionScore
  const secondary = sorted.slice(1).reduce((sum, finding) => sum + finding.suspicionScore, 0)

  return Math.min(Math.round(primary + secondary * 0.3), 99)
}

const extractContextWindow = (
  lines: readonly ClassifiedLine[],
  centerIndex: number,
  radius: number
): readonly ClassifiedLine[] => {
  const start = Math.max(0, centerIndex - radius)
  const end = Math.min(lines.length, centerIndex + radius + 1)
  return lines.slice(start, end)
}

export class PostClassificationReviewer {
  private readonly config: ReviewerConfig
  private readonly detectors: readonly SuspicionDetector[]

  constructor(config?: Partial<ReviewerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.detectors = this.initializeDetectors()
  }

  private shouldEscalate(totalSuspicion: number, findings: readonly DetectorFinding[]): boolean {
    if (totalSuspicion < this.config.suspicionThreshold) return false
    if (findings.length >= this.config.minSignalsForSuspicion) return true
    return totalSuspicion >= this.config.highSeveritySingleSignal
  }

  private initializeDetectors(): readonly SuspicionDetector[] {
    const allDetectors: readonly SuspicionDetector[] = [
      createSequenceViolationDetector(),
      createContentTypeMismatchDetector(),
      createSplitCharacterFragmentDetector(),
      createStatisticalAnomalyDetector(),
      createConfidenceDropDetector(),
    ]

    return allDetectors.filter((detector) => this.config.enabledDetectors.has(detector.id))
  }

  review(classifiedLines: readonly ClassifiedLine[]): LLMReviewPacket {
    if (classifiedLines.length === 0) {
      return {
        totalSuspicious: 0,
        totalReviewed: 0,
        suspicionRate: 0,
        suspiciousLines: [],
      }
    }

    const rawSuspicious: SuspiciousLine[] = []

    for (let i = 0; i < classifiedLines.length; i++) {
      const line = classifiedLines[i]
      const features = extractTextFeatures(line.text)
      const context = extractContextWindow(classifiedLines, i, this.config.contextRadius)
      const linePositionInContext = i - Math.max(0, i - this.config.contextRadius)

      const findings: DetectorFinding[] = []
      for (const detector of this.detectors) {
        const finding = detector.detect(line, features, context, linePositionInContext)
        if (finding) findings.push(finding)
      }

      const totalSuspicion = calculateTotalSuspicion(findings)
      if (this.shouldEscalate(totalSuspicion, findings)) {
        rawSuspicious.push({
          line,
          totalSuspicion,
          findings,
          contextLines: context,
        })
      }
    }

    const maxAllowed = Math.ceil(classifiedLines.length * this.config.maxSuspicionRatio)
    const trimmed = rawSuspicious
      .sort((a, b) => b.totalSuspicion - a.totalSuspicion)
      .slice(0, Math.max(1, maxAllowed))

    return {
      totalSuspicious: trimmed.length,
      totalReviewed: classifiedLines.length,
      suspicionRate: trimmed.length / classifiedLines.length,
      suspiciousLines: trimmed,
    }
  }

  reviewSingleLine(
    line: ClassifiedLine,
    surroundingLines: readonly ClassifiedLine[]
  ): SuspiciousLine | null {
    const features = extractTextFeatures(line.text)
    const linePosition = surroundingLines.findIndex((item) => item.lineIndex === line.lineIndex)
    if (linePosition === -1) return null

    const findings: DetectorFinding[] = []
    for (const detector of this.detectors) {
      const finding = detector.detect(line, features, surroundingLines, linePosition)
      if (finding) findings.push(finding)
    }

    const totalSuspicion = calculateTotalSuspicion(findings)
    if (totalSuspicion < this.config.suspicionThreshold) return null

    return {
      line,
      totalSuspicion,
      findings,
      contextLines: surroundingLines,
    }
  }

  formatForLLM(packet: LLMReviewPacket): string {
    if (packet.suspiciousLines.length === 0) return ''

    const sections: string[] = [
      `<review_request count="${packet.totalSuspicious}" total_lines="${packet.totalReviewed}">`,
    ]

    for (const suspicious of packet.suspiciousLines) {
      const { line, totalSuspicion, findings, contextLines } = suspicious

      const contextStr = contextLines
        .map((contextLine) => {
          const marker = contextLine.lineIndex === line.lineIndex ? '>>>' : '   '
          return `${marker} L${contextLine.lineIndex}|${contextLine.assignedType}|${contextLine.text}`
        })
        .join('\n')

      const reasons = findings.map((finding) => finding.reason).join('؛ ')
      const suggested = findings.find((finding) => finding.suggestedType !== null)?.suggestedType ?? ''

      sections.push(
        `<suspect line="${line.lineIndex}" current="${line.assignedType}" suspicion="${totalSuspicion}" suggested="${suggested}">`,
        `<reasons>${reasons}</reasons>`,
        `<context>\n${contextStr}\n</context>`,
        '</suspect>'
      )
    }

    sections.push('</review_request>')
    return sections.join('\n')
  }
}

export default PostClassificationReviewer
