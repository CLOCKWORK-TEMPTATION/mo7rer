import { Extension } from '@tiptap/core'
import { Fragment, Node as PmNode, Schema, Slice } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { isActionLine } from './action'
import { DATE_PATTERNS, TIME_PATTERNS, convertHindiToArabic, detectDialect } from './arabic-patterns'
import { isBasmalaLine } from './basmala'
import {
  ensureCharacterTrailingColon,
  isCharacterLine,
  parseImplicitCharacterDialogueWithoutColon,
  parseInlineCharacterDialogue,
} from './character'
import { resolveNarrativeDecision } from './classification-decision'
import { PostClassificationReviewer } from './classification-core'
import type { ClassifiedDraft, ClassificationContext, ClassifiedLine, ElementType } from './classification-types'
import { isElementType } from './classification-types'
import { ContextMemoryManager } from './context-memory-manager'
import { getDialogueProbability, isDialogueContinuationLine, isDialogueLine } from './dialogue'
import { HybridClassifier } from './hybrid-classifier'
import { mergeBrokenCharacterName, parseBulletLine, shouldMergeWrappedLines } from './line-repair'
import { isParentheticalLine } from './parenthetical'
import { isSceneHeader3Line } from './scene-header-3'
import { isCompleteSceneHeaderLine, splitSceneHeaderLine } from './scene-header-top-line'
import { isTransitionLine } from './transition'
import { logger } from '../utils/logger'
import type { AgentReviewRequestPayload, AgentReviewResponsePayload, LineType } from '../types'

const REVIEW_APPLY_THRESHOLD = 74
const REVIEW_MIN_FINDINGS = 2
const AGENT_REVIEW_MODEL = 'claude-opus-4-6'
const AGENT_REVIEW_TIMEOUT_MS = 8_000
const AGENT_REVIEW_MAX_ATTEMPTS = 3
const AGENT_REVIEW_RETRY_DELAY_MS = 1_200

const agentReviewLogger = logger.createScope('paste.agent-review')

const normalizeEndpoint = (endpoint: string): string => endpoint.replace(/\/$/, '')

const resolveAgentReviewEndpoint = (): string => {
  const explicit = (import.meta.env.VITE_AGENT_REVIEW_BACKEND_URL as string | undefined)?.trim()
  if (explicit) return normalizeEndpoint(explicit)

  const fileImportEndpoint =
    (import.meta.env.VITE_FILE_IMPORT_BACKEND_URL as string | undefined)?.trim() ||
    (import.meta.env.DEV ? 'http://127.0.0.1:8787/api/file-extract' : '')
  if (!fileImportEndpoint) return ''

  const normalized = normalizeEndpoint(fileImportEndpoint)
  if (normalized.endsWith('/api/file-extract')) {
    return `${normalized.slice(0, -'/api/file-extract'.length)}/api/agent/review`
  }

  return `${normalized}/api/agent/review`
}

const AGENT_REVIEW_ENDPOINT = resolveAgentReviewEndpoint()
const REVIEWABLE_AGENT_TYPES = new Set<LineType>([
  'action',
  'dialogue',
  'character',
  'scene-header-top-line',
  'scene-header-3',
  'transition',
  'parenthetical',
  'basmala',
])

let pendingAgentAbortController: AbortController | null = null

export interface PasteClassifierOptions {
  agentReview?: (classified: readonly ClassifiedDraft[]) => ClassifiedDraft[]
}

export interface ApplyPasteClassifierFlowOptions {
  agentReview?: (classified: readonly ClassifiedDraft[]) => ClassifiedDraft[]
  from?: number
  to?: number
}

const buildContext = (previousTypes: readonly ElementType[]): ClassificationContext => {
  const previousType = previousTypes.length > 0 ? previousTypes[previousTypes.length - 1] : null
  const isInDialogueBlock =
    previousType === 'character' || previousType === 'dialogue' || previousType === 'parenthetical'

  return {
    previousTypes,
    previousType,
    isInDialogueBlock,
    isAfterSceneHeaderTopLine: previousType === 'sceneHeaderTopLine',
  }
}

const hasTemporalSceneSignal = (text: string): boolean =>
  DATE_PATTERNS.test(text) || TIME_PATTERNS.test(text)

const classifyLines = (text: string): ClassifiedDraft[] => {
  const lines = text.split(/\r?\n/)
  const classified: ClassifiedDraft[] = []

  const memoryManager = new ContextMemoryManager()
  const hybridClassifier = new HybridClassifier()

  const push = (entry: ClassifiedDraft): void => {
    classified.push(entry)
    memoryManager.record(entry)
  }

  for (const rawLine of lines) {
    const trimmed = parseBulletLine(rawLine)
    if (!trimmed) continue
    const normalizedForClassification = convertHindiToArabic(trimmed)
    const detectedDialect = detectDialect(normalizedForClassification)

    const previous = classified[classified.length - 1]
    if (previous) {
      const mergedCharacter = mergeBrokenCharacterName(previous.text, trimmed)
      if (mergedCharacter && previous.type === 'action') {
        const corrected: ClassifiedDraft = {
          ...previous,
          type: 'character',
          text: ensureCharacterTrailingColon(mergedCharacter),
          confidence: 92,
          classificationMethod: 'context',
        }
        classified[classified.length - 1] = corrected
        memoryManager.replaceLast(corrected)
        continue
      }

      if (shouldMergeWrappedLines(previous.text, trimmed, previous.type)) {
        const merged: ClassifiedDraft = {
          ...previous,
          text: `${previous.text} ${trimmed}`.replace(/\s+/g, ' ').trim(),
          confidence: Math.max(previous.confidence, 86),
          classificationMethod: 'context',
        }
        classified[classified.length - 1] = merged
        memoryManager.replaceLast(merged)
        continue
      }
    }

    const context = buildContext(classified.map((item) => item.type))

    if (isBasmalaLine(normalizedForClassification)) {
      push({
        type: 'basmala',
        text: trimmed,
        confidence: 99,
        classificationMethod: 'regex',
      })
      continue
    }

    if (isCompleteSceneHeaderLine(normalizedForClassification)) {
      const parts = splitSceneHeaderLine(normalizedForClassification)
      if (parts) {
        push({
          type: 'sceneHeaderTopLine',
          text: trimmed,
          header1: parts.header1,
          header2: parts.header2,
          confidence: 96,
          classificationMethod: 'regex',
        })
        continue
      }
    }

    if (isTransitionLine(normalizedForClassification)) {
      push({
        type: 'transition',
        text: trimmed,
        confidence: 95,
        classificationMethod: 'regex',
      })
      continue
    }

    const temporalSceneSignal = hasTemporalSceneSignal(normalizedForClassification)
    if (
      context.isAfterSceneHeaderTopLine &&
      (isSceneHeader3Line(normalizedForClassification, context) || temporalSceneSignal)
    ) {
      push({
        type: 'sceneHeader3',
        text: trimmed,
        confidence: temporalSceneSignal ? 88 : 90,
        classificationMethod: 'context',
      })
      continue
    }

    const inlineParsed = parseInlineCharacterDialogue(trimmed)
    if (inlineParsed) {
      if (inlineParsed.cue) {
        push({
          type: 'action',
          text: inlineParsed.cue,
          confidence: 92,
          classificationMethod: 'regex',
        })
      }

      push({
        type: 'character',
        text: ensureCharacterTrailingColon(inlineParsed.characterName),
        confidence: 98,
        classificationMethod: 'regex',
      })

      push({
        type: 'dialogue',
        text: inlineParsed.dialogueText,
        confidence: 98,
        classificationMethod: 'regex',
      })
      continue
    }

    if (isParentheticalLine(normalizedForClassification) && context.isInDialogueBlock) {
      push({
        type: 'parenthetical',
        text: trimmed,
        confidence: 90,
        classificationMethod: 'regex',
      })
      continue
    }

    if (isDialogueContinuationLine(rawLine, context.previousType)) {
      push({
        type: 'dialogue',
        text: trimmed,
        confidence: 82,
        classificationMethod: 'context',
      })
      continue
    }

    const implicit = parseImplicitCharacterDialogueWithoutColon(trimmed, context)
    if (implicit) {
      if (implicit.cue) {
        push({
          type: 'action',
          text: implicit.cue,
          confidence: 85,
          classificationMethod: 'context',
        })
      }

      push({
        type: 'character',
        text: ensureCharacterTrailingColon(implicit.characterName),
        confidence: 78,
        classificationMethod: 'context',
      })

      push({
        type: 'dialogue',
        text: implicit.dialogueText,
        confidence: 78,
        classificationMethod: 'context',
      })
      continue
    }

    if (isCharacterLine(normalizedForClassification, context)) {
      push({
        type: 'character',
        text: ensureCharacterTrailingColon(trimmed),
        confidence: 88,
        classificationMethod: 'regex',
      })
      continue
    }

    const dialogueProbability = getDialogueProbability(normalizedForClassification, context)
    const dialogueThreshold = detectedDialect ? 5 : 6
    if (isDialogueLine(normalizedForClassification, context) || dialogueProbability >= dialogueThreshold) {
      const dialectBoost = detectedDialect ? 3 : 0
      push({
        type: 'dialogue',
        text: trimmed,
        confidence: Math.max(72, Math.min(94, 64 + dialogueProbability * 4 + dialectBoost)),
        classificationMethod: 'context',
      })
      continue
    }

    if (isSceneHeader3Line(normalizedForClassification, context)) {
      push({
        type: 'sceneHeader3',
        text: trimmed,
        confidence: 80,
        classificationMethod: 'context',
      })
      continue
    }

    const decision = resolveNarrativeDecision(normalizedForClassification, context)
    const hybridResult = hybridClassifier.classifyLine(
      normalizedForClassification,
      decision.type,
      context,
      memoryManager.getSnapshot()
    )

    if (hybridResult.type === 'sceneHeaderTopLine') {
      const parts = splitSceneHeaderLine(normalizedForClassification)
      if (parts && parts.header2) {
        push({
          type: 'sceneHeaderTopLine',
          text: trimmed,
          header1: parts.header1,
          header2: parts.header2,
          confidence: Math.max(85, hybridResult.confidence),
          classificationMethod: hybridResult.classificationMethod,
        })
        continue
      }
    }

    if (hybridResult.type === 'character') {
      push({
        type: 'character',
        text: ensureCharacterTrailingColon(trimmed),
        confidence: Math.max(78, hybridResult.confidence),
        classificationMethod: hybridResult.classificationMethod,
      })
      continue
    }

    if (hybridResult.type === 'action' || isActionLine(normalizedForClassification, context)) {
      push({
        type: 'action',
        text: trimmed.replace(/^[-–—]\s*/, ''),
        confidence: Math.max(74, hybridResult.confidence),
        classificationMethod: hybridResult.classificationMethod,
      })
      continue
    }

    push({
      type: hybridResult.type,
      text: trimmed,
      confidence: Math.max(68, hybridResult.confidence),
      classificationMethod: hybridResult.classificationMethod,
    })
  }

  return classified
}

const elementTypeToLineType = (type: ElementType): LineType => {
  switch (type) {
    case 'sceneHeaderTopLine':
      return 'scene-header-top-line'
    case 'sceneHeader3':
      return 'scene-header-3'
    default:
      return type
  }
}

const lineTypeToElementType = (type: LineType): ElementType | null => {
  switch (type) {
    case 'scene-header-top-line':
      return 'sceneHeaderTopLine'
    case 'scene-header-3':
      return 'sceneHeader3'
    case 'action':
    case 'dialogue':
    case 'character':
    case 'transition':
    case 'parenthetical':
    case 'basmala':
      return type
    default:
      return null
  }
}

const toClassifiedLineRecords = (classified: ClassifiedDraft[]): ClassifiedLine[] =>
  classified.map((item, index) => ({
    lineIndex: index,
    text: item.text,
    assignedType: item.type,
    originalConfidence: item.confidence,
    classificationMethod: item.classificationMethod,
  }))

const shouldSkipAgentReviewInRuntime = (): boolean => {
  if (typeof window === 'undefined') return true
  if (import.meta.env.MODE === 'test') {
    return true
  }
  return false
}

const waitBeforeRetry = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })

const isRetryableHttpStatus = (status: number): boolean => status === 408 || status === 429 || status >= 500

const requestAgentReview = async (
  request: AgentReviewRequestPayload
): Promise<AgentReviewResponsePayload> => {
  if (shouldSkipAgentReviewInRuntime()) {
    agentReviewLogger.telemetry('request-skipped-runtime', {
      sessionId: request.sessionId,
    })
    return {
      status: 'applied',
      model: AGENT_REVIEW_MODEL,
      decisions: [],
      message: 'Agent review mocked as applied in current runtime.',
      latencyMs: 0,
    }
  }

  if (!AGENT_REVIEW_ENDPOINT) {
    agentReviewLogger.error('request-missing-endpoint', {
      sessionId: request.sessionId,
    })
    throw new Error('VITE_FILE_IMPORT_BACKEND_URL غير مضبوط؛ لا يمكن تشغيل Agent Review.')
  }

  let lastError: unknown = null
  for (let attempt = 1; attempt <= AGENT_REVIEW_MAX_ATTEMPTS; attempt += 1) {
    if (pendingAgentAbortController) {
      pendingAgentAbortController.abort()
    }
    const controller = new AbortController()
    pendingAgentAbortController = controller
    const timeoutId = window.setTimeout(() => controller.abort(), AGENT_REVIEW_TIMEOUT_MS)

    try {
      const response = await fetch(AGENT_REVIEW_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      if (!response.ok) {
        const body = await response.text()
        const isRetryable = isRetryableHttpStatus(response.status)
        agentReviewLogger.error('request-http-error', {
          sessionId: request.sessionId,
          status: response.status,
          body,
          attempt,
          isRetryable,
        })
        if (isRetryable && attempt < AGENT_REVIEW_MAX_ATTEMPTS) {
          await waitBeforeRetry(AGENT_REVIEW_RETRY_DELAY_MS * attempt)
          continue
        }
        throw new Error(`Agent review route failed (${response.status}): ${body}`)
      }

      const payload = (await response.json()) as AgentReviewResponsePayload
      agentReviewLogger.telemetry('request-response', {
        sessionId: request.sessionId,
        status: payload.status,
        decisions: payload.decisions?.length ?? 0,
        model: payload.model,
        latencyMs: payload.latencyMs,
        attempt,
      })
      if (payload.status !== 'applied') {
        throw new Error(`Agent review status is ${payload.status}: ${payload.message}`)
      }
      return payload
    } catch (error) {
      lastError = error
      const aborted = (error as DOMException)?.name === 'AbortError'
      const network = error instanceof TypeError
      const retryable = aborted || network

      if (aborted) {
        agentReviewLogger.warn('request-aborted', {
          sessionId: request.sessionId,
          attempt,
        })
      } else if (network) {
        agentReviewLogger.warn('request-network-error', {
          sessionId: request.sessionId,
          attempt,
          error: error.message,
        })
      } else {
        agentReviewLogger.error('request-unhandled-error', {
          sessionId: request.sessionId,
          attempt,
          error,
        })
      }

      if (retryable && attempt < AGENT_REVIEW_MAX_ATTEMPTS) {
        await waitBeforeRetry(AGENT_REVIEW_RETRY_DELAY_MS * attempt)
        continue
      }

      throw error
    } finally {
      window.clearTimeout(timeoutId)
      if (pendingAgentAbortController === controller) {
        pendingAgentAbortController = null
      }
    }
  }

  throw new Error(`Agent review request failed after ${AGENT_REVIEW_MAX_ATTEMPTS} attempts: ${String(lastError)}`)
}

const applyReviewerCorrections = (classified: ClassifiedDraft[]): ClassifiedDraft[] => {
  if (classified.length === 0) return classified

  const reviewInput = toClassifiedLineRecords(classified)

  const reviewer = new PostClassificationReviewer()
  const packet = reviewer.review(reviewInput)
  if (packet.suspiciousLines.length === 0) return classified

  const corrected = [...classified]

  for (const suspicious of packet.suspiciousLines) {
    const validatedSuspicious = reviewer.reviewSingleLine(suspicious.line, suspicious.contextLines)
    if (!validatedSuspicious) continue
    if (validatedSuspicious.totalSuspicion < REVIEW_APPLY_THRESHOLD) continue
    if (validatedSuspicious.findings.length < REVIEW_MIN_FINDINGS) continue

    const suggested = validatedSuspicious.findings.find((finding) => finding.suggestedType !== null)?.suggestedType
    if (!suggested || !isElementType(suggested)) continue

    const idx = validatedSuspicious.line.lineIndex
    const original = corrected[idx]
    if (!original || original.type === suggested) continue

    if (suggested === 'sceneHeaderTopLine') {
      const parts = splitSceneHeaderLine(original.text)
      if (!parts || !parts.header2) continue

      corrected[idx] = {
        ...original,
        type: suggested,
        header1: parts.header1,
        header2: parts.header2,
        confidence: Math.max(original.confidence, 85),
        classificationMethod: 'context',
      }
      continue
    }

    corrected[idx] = {
      ...original,
      type: suggested,
      header1: undefined,
      header2: undefined,
      confidence: Math.max(original.confidence, 85),
      classificationMethod: 'context',
    }
  }

  return corrected
}

const applyRemoteAgentReview = async (classified: ClassifiedDraft[]): Promise<ClassifiedDraft[]> => {
  if (classified.length === 0) return classified

  const reviewInput = toClassifiedLineRecords(classified)
  const reviewer = new PostClassificationReviewer()
  const reviewPacket = reviewer.review(reviewInput)
  agentReviewLogger.telemetry('packet-built', {
    totalReviewed: reviewPacket.totalReviewed,
    totalSuspicious: reviewPacket.totalSuspicious,
    suspicionRate: reviewPacket.suspicionRate,
  })
  if (reviewPacket.suspiciousLines.length === 0) {
    agentReviewLogger.info('packet-skipped-no-suspicious-lines')
    return classified
  }
  const reviewPacketText = reviewer.formatForLLM(reviewPacket)

  const suspiciousPayload = reviewPacket.suspiciousLines
    .map((rawSuspect) => {
      const suspect = reviewer.reviewSingleLine(rawSuspect.line, rawSuspect.contextLines)
      if (!suspect) return null

      const itemIndex = suspect.line.lineIndex
      const item = classified[itemIndex]
      if (!item) return null

      const assignedType = elementTypeToLineType(item.type)
      if (!REVIEWABLE_AGENT_TYPES.has(assignedType)) return null

      const contextLines = suspect.contextLines
        .map((line) => {
          const mapped = elementTypeToLineType(line.assignedType)
          if (!REVIEWABLE_AGENT_TYPES.has(mapped)) return null
          return {
            lineIndex: line.lineIndex,
            assignedType: mapped,
            text: line.text,
          }
        })
        .filter((value): value is { lineIndex: number; assignedType: LineType; text: string } => value !== null)

      return {
        itemIndex,
        lineIndex: suspect.line.lineIndex,
        text: item.text,
        assignedType,
        totalSuspicion: suspect.totalSuspicion,
        reasons: suspect.findings.map((finding) => finding.reason),
        contextLines,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  if (suspiciousPayload.length === 0) {
    agentReviewLogger.info('packet-skipped-filtered-out', {
      totalSuspicious: reviewPacket.totalSuspicious,
    })
    return classified
  }

  const requestPayload: AgentReviewRequestPayload = {
    sessionId: `paste-${Date.now()}`,
    totalReviewed: reviewPacket.totalReviewed,
    reviewPacketText: reviewPacketText || undefined,
    suspiciousLines: suspiciousPayload,
  }

  const response = await requestAgentReview(requestPayload)
  if (response.status !== 'applied') {
    throw new Error(`Agent review status is ${response.status}: ${response.message}`)
  }

  const corrected = [...classified]
  for (const decision of response.decisions) {
    const idx = decision.itemIndex
    if (idx < 0 || idx >= corrected.length) continue

    const mapped = lineTypeToElementType(decision.finalType)
    if (!mapped || !isElementType(mapped)) continue

    const original = corrected[idx]
    if (!original || original.type === mapped) continue

    if (mapped === 'sceneHeaderTopLine') {
      const parts = splitSceneHeaderLine(original.text)
      if (!parts || !parts.header2) continue
      corrected[idx] = {
        ...original,
        type: mapped,
        header1: parts.header1,
        header2: parts.header2,
        confidence: Math.max(original.confidence, Math.round((decision.confidence ?? 0.9) * 100), 85),
        classificationMethod: 'context',
      }
      continue
    }

    corrected[idx] = {
      ...original,
      type: mapped,
      header1: undefined,
      header2: undefined,
      confidence: Math.max(original.confidence, Math.round((decision.confidence ?? 0.9) * 100), 85),
      classificationMethod: 'context',
    }
  }

  agentReviewLogger.telemetry('response-applied', {
    decisions: response.decisions.length,
  })
  return corrected
}

const applyAgentReview = (
  classified: ClassifiedDraft[],
  agentReview?: (classified: readonly ClassifiedDraft[]) => ClassifiedDraft[]
): ClassifiedDraft[] => {
  if (!agentReview) return classified

  try {
    const reviewed = agentReview(classified)
    return reviewed.length > 0 ? reviewed : classified
  } catch {
    return classified
  }
}

const createNodeForType = (item: ClassifiedDraft, schema: Schema): PmNode | null => {
  const { type, text, header1, header2 } = item

  switch (type) {
    case 'sceneHeaderTopLine': {
      const h1Node = schema.nodes.sceneHeader1.create(null, header1 ? schema.text(header1) : undefined)
      const h2Node = schema.nodes.sceneHeader2.create(null, header2 ? schema.text(header2) : undefined)
      return schema.nodes.sceneHeaderTopLine.create(null, [h1Node, h2Node])
    }

    case 'basmala':
      return schema.nodes.basmala.create(null, text ? schema.text(text) : undefined)

    case 'sceneHeader3':
      return schema.nodes.sceneHeader3.create(null, text ? schema.text(text) : undefined)

    case 'action':
      return schema.nodes.action.create(null, text ? schema.text(text) : undefined)

    case 'character':
      return schema.nodes.character.create(
        null,
        text ? schema.text(ensureCharacterTrailingColon(text)) : undefined
      )

    case 'dialogue':
      return schema.nodes.dialogue.create(null, text ? schema.text(text) : undefined)

    case 'parenthetical':
      return schema.nodes.parenthetical.create(null, text ? schema.text(text) : undefined)

    case 'transition':
      return schema.nodes.transition.create(null, text ? schema.text(text) : undefined)

    default:
      return schema.nodes.action.create(null, text ? schema.text(text) : undefined)
  }
}

const classifiedToNodes = (classified: readonly ClassifiedDraft[], schema: Schema): PmNode[] => {
  const nodes: PmNode[] = []

  for (const item of classified) {
    const node = createNodeForType(item, schema)
    if (node) nodes.push(node)
  }

  return nodes
}

export const classifyText = (
  text: string,
  agentReview?: (classified: readonly ClassifiedDraft[]) => ClassifiedDraft[]
): ClassifiedDraft[] => {
  const initiallyClassified = classifyLines(text)
  const reviewerCorrected = applyReviewerCorrections(initiallyClassified)
  return applyAgentReview(reviewerCorrected, agentReview)
}

export const classifyTextWithAgentReview = async (
  text: string,
  agentReview?: (classified: readonly ClassifiedDraft[]) => ClassifiedDraft[]
): Promise<ClassifiedDraft[]> => {
  const initiallyClassified = classifyLines(text)
  const reviewerCorrected = applyReviewerCorrections(initiallyClassified)
  const remotelyReviewed = await applyRemoteAgentReview(reviewerCorrected)
  return applyAgentReview(remotelyReviewed, agentReview)
}

export const applyPasteClassifierFlowToView = async (
  view: EditorView,
  text: string,
  options: ApplyPasteClassifierFlowOptions = {}
): Promise<boolean> => {
  const classified = await classifyTextWithAgentReview(text, options.agentReview)
  if (classified.length === 0 || view.isDestroyed) return false

  const nodes = classifiedToNodes(classified, view.state.schema)
  if (nodes.length === 0) return false

  const fragment = Fragment.from(nodes)
  const slice = new Slice(fragment, 0, 0)
  const from = options.from ?? view.state.selection.from
  const to = options.to ?? view.state.selection.to
  const tr = view.state.tr
  tr.replaceRange(from, to, slice)
  view.dispatch(tr)
  return true
}

/**
 * مصنّف اللصق التلقائي داخل Tiptap.
 */
export const PasteClassifier = Extension.create<PasteClassifierOptions>({
  name: 'pasteClassifier',

  addOptions() {
    return {
      agentReview: undefined,
    }
  },

  addProseMirrorPlugins() {
    const agentReview = this.options.agentReview

    return [
      new Plugin({
        key: new PluginKey('pasteClassifier'),

        props: {
          handlePaste(view, event) {
            const clipboardData = event.clipboardData
            if (!clipboardData) return false

            const html = clipboardData.getData('text/html')
            if (html && html.includes('data-type=')) return false

            const text = clipboardData.getData('text/plain')
            if (!text || !text.trim()) return false

            event.preventDefault()
            void applyPasteClassifierFlowToView(view, text, { agentReview }).catch((error) => {
              agentReviewLogger.error('paste-failed-fatal', {
                error,
              })
              throw error
            })
            return true
          },
        },
      }),
    ]
  },
})
