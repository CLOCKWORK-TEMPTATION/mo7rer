import { Extension } from '@tiptap/core'
import { Fragment, Node as PmNode, Schema, Slice } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { isActionLine } from './action'
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
import type { AgentReviewRequestPayload, AgentReviewResponsePayload, LineType } from '../types'

const REVIEW_APPLY_THRESHOLD = 74
const REVIEW_MIN_FINDINGS = 2
const AGENT_REVIEW_MODEL = 'claude-opus-4-6'
const AGENT_REVIEW_TIMEOUT_MS = 8_000

const normalizeEndpoint = (endpoint: string): string => endpoint.replace(/\/$/, '')

const resolveAgentReviewEndpoint = (): string => {
  const explicit = (import.meta.env.VITE_AGENT_REVIEW_BACKEND_URL as string | undefined)?.trim()
  if (explicit) return normalizeEndpoint(explicit)

  const fileImportEndpoint = (import.meta.env.VITE_FILE_IMPORT_BACKEND_URL as string | undefined)?.trim()
  if (!fileImportEndpoint) return '/api/agent/review'

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

    if (isBasmalaLine(trimmed)) {
      push({
        type: 'basmala',
        text: trimmed,
        confidence: 99,
        classificationMethod: 'regex',
      })
      continue
    }

    if (isCompleteSceneHeaderLine(trimmed)) {
      const parts = splitSceneHeaderLine(trimmed)
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

    if (isTransitionLine(trimmed)) {
      push({
        type: 'transition',
        text: trimmed,
        confidence: 95,
        classificationMethod: 'regex',
      })
      continue
    }

    if (context.isAfterSceneHeaderTopLine && isSceneHeader3Line(trimmed, context)) {
      push({
        type: 'sceneHeader3',
        text: trimmed,
        confidence: 90,
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

    if (isParentheticalLine(trimmed) && context.isInDialogueBlock) {
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

    if (isCharacterLine(trimmed, context)) {
      push({
        type: 'character',
        text: ensureCharacterTrailingColon(trimmed),
        confidence: 88,
        classificationMethod: 'regex',
      })
      continue
    }

    const dialogueProbability = getDialogueProbability(trimmed, context)
    if (isDialogueLine(trimmed, context) || dialogueProbability >= 6) {
      push({
        type: 'dialogue',
        text: trimmed,
        confidence: Math.max(72, Math.min(92, 64 + dialogueProbability * 4)),
        classificationMethod: 'context',
      })
      continue
    }

    if (isSceneHeader3Line(trimmed, context)) {
      push({
        type: 'sceneHeader3',
        text: trimmed,
        confidence: 80,
        classificationMethod: 'context',
      })
      continue
    }

    const decision = resolveNarrativeDecision(trimmed, context)
    const hybridResult = hybridClassifier.classifyLine(
      trimmed,
      decision.type,
      context,
      memoryManager.getSnapshot()
    )

    if (hybridResult.type === 'sceneHeaderTopLine') {
      const parts = splitSceneHeaderLine(trimmed)
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

    if (hybridResult.type === 'action' || isActionLine(trimmed, context)) {
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

const requestAgentReview = async (
  request: AgentReviewRequestPayload
): Promise<AgentReviewResponsePayload> => {
  if (shouldSkipAgentReviewInRuntime()) {
    return {
      status: 'skipped',
      model: AGENT_REVIEW_MODEL,
      decisions: [],
      message: 'Agent review skipped in current runtime.',
      latencyMs: 0,
    }
  }

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
      return {
        status: 'error',
        model: AGENT_REVIEW_MODEL,
        decisions: [],
        message: `Agent review route failed (${response.status}): ${body}`,
        latencyMs: 0,
      }
    }

    const payload = (await response.json()) as AgentReviewResponsePayload
    return payload
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') {
      return {
        status: 'skipped',
        model: AGENT_REVIEW_MODEL,
        decisions: [],
        message: 'Agent review timed out or was aborted.',
        latencyMs: 0,
      }
    }

    return {
      status: 'error',
      model: AGENT_REVIEW_MODEL,
      decisions: [],
      message: `Agent review request failed: ${error}`,
      latencyMs: 0,
    }
  } finally {
    window.clearTimeout(timeoutId)
    if (pendingAgentAbortController === controller) {
      pendingAgentAbortController = null
    }
  }
}

const applyReviewerCorrections = (classified: ClassifiedDraft[]): ClassifiedDraft[] => {
  if (classified.length === 0) return classified

  const reviewInput = toClassifiedLineRecords(classified)

  const reviewer = new PostClassificationReviewer()
  const packet = reviewer.review(reviewInput)
  if (packet.suspiciousLines.length === 0) return classified

  const corrected = [...classified]

  for (const suspicious of packet.suspiciousLines) {
    if (suspicious.totalSuspicion < REVIEW_APPLY_THRESHOLD) continue
    if (suspicious.findings.length < REVIEW_MIN_FINDINGS) continue

    const suggested = suspicious.findings.find((finding) => finding.suggestedType !== null)?.suggestedType
    if (!suggested || !isElementType(suggested)) continue

    const idx = suspicious.line.lineIndex
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
  if (reviewPacket.suspiciousLines.length === 0) return classified

  const suspiciousPayload = reviewPacket.suspiciousLines
    .map((suspect) => {
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

  if (suspiciousPayload.length === 0) return classified

  const requestPayload: AgentReviewRequestPayload = {
    sessionId: `paste-${Date.now()}`,
    totalReviewed: reviewPacket.totalReviewed,
    suspiciousLines: suspiciousPayload,
  }

  const response = await requestAgentReview(requestPayload)
  if (response.status !== 'applied') return classified

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
            void (async () => {
              const classified = await classifyTextWithAgentReview(text, agentReview)
              if (classified.length === 0 || view.isDestroyed) return

              const nodes = classifiedToNodes(classified, view.state.schema)
              if (nodes.length === 0) return

              const fragment = Fragment.from(nodes)
              const slice = new Slice(fragment, 0, 0)
              const { tr } = view.state
              const { from, to } = view.state.selection
              tr.replaceRange(from, to, slice)
              view.dispatch(tr)
            })().catch(() => {
              if (view.isDestroyed) return
              const fallback = classifyText(text, agentReview)
              if (fallback.length === 0) return
              const nodes = classifiedToNodes(fallback, view.state.schema)
              if (nodes.length === 0) return
              const fragment = Fragment.from(nodes)
              const slice = new Slice(fragment, 0, 0)
              const { tr } = view.state
              const { from, to } = view.state.selection
              tr.replaceRange(from, to, slice)
              view.dispatch(tr)
            })
            return true
          },
        },
      }),
    ]
  },
})
