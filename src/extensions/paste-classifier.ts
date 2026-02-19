import { Extension } from '@tiptap/core'
import { Slice, Fragment, Node as PmNode, Schema } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { isActionLine } from './action'
import { isBasmalaLine } from './basmala'
import { isCharacterLine, parseImplicitCharacterDialogueWithoutColon, parseInlineCharacterDialogue } from './character'
import { PostClassificationReviewer } from './classification-core'
import type { ClassificationContext, ClassificationMethod, ClassifiedLine, ElementType } from './classification-types'
import { isElementType } from './classification-types'
import { getDialogueProbability, isDialogueContinuationLine, isDialogueLine } from './dialogue'
import { isParentheticalLine } from './parenthetical'
import { isSceneHeader3Line } from './scene-header-3'
import { isCompleteSceneHeaderLine, splitSceneHeaderLine } from './scene-header-top-line'
import { isTransitionLine } from './transition'
import { normalizeLine } from './text-utils'

interface ClassifiedDraft {
  type: ElementType
  text: string
  header1?: string
  header2?: string
  confidence: number
  classificationMethod: ClassificationMethod
}

const REVIEW_APPLY_THRESHOLD = 74
const REVIEW_MIN_FINDINGS = 2

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

  const push = (entry: ClassifiedDraft): void => {
    classified.push(entry)
  }

  for (const rawLine of lines) {
    const trimmed = normalizeLine(rawLine)
    if (!trimmed) continue

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
        text: inlineParsed.characterName,
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
        text: implicit.characterName,
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
        text: trimmed.replace(/[:：]+\s*$/, ''),
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

    if (isActionLine(trimmed, context)) {
      push({
        type: 'action',
        text: trimmed.replace(/^[-–—]\s*/, ''),
        confidence: 84,
        classificationMethod: 'context',
      })
      continue
    }

    push({
      type: 'action',
      text: trimmed,
      confidence: 68,
      classificationMethod: 'fallback',
    })
  }

  return classified
}

const applyReviewerCorrections = (classified: ClassifiedDraft[]): ClassifiedDraft[] => {
  if (classified.length === 0) return classified

  const reviewInput: ClassifiedLine[] = classified.map((item, index) => ({
    lineIndex: index,
    text: item.text,
    assignedType: item.type,
    originalConfidence: item.confidence,
    classificationMethod: item.classificationMethod,
  }))

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
      return schema.nodes.character.create(null, text ? schema.text(text) : undefined)

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

const classifiedToNodes = (classified: ClassifiedDraft[], schema: Schema): PmNode[] => {
  const nodes: PmNode[] = []

  for (const item of classified) {
    const node = createNodeForType(item, schema)
    if (node) nodes.push(node)
  }

  return nodes
}

export const classifyText = (text: string): ClassifiedDraft[] => {
  const initiallyClassified = classifyLines(text)
  return applyReviewerCorrections(initiallyClassified)
}

/**
 * إضافة Tiptap: مصنّف اللصق التلقائي
 * عند لصق نص عادي، يقوم بتصنيف كل سطر إلى العنصر المناسب
 */
export const PasteClassifier = Extension.create({
  name: 'pasteClassifier',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('pasteClassifier'),

        props: {
          handlePaste(view, event) {
            const clipboardData = event.clipboardData
            if (!clipboardData) return false

            // إذا كان HTML ملصوق من نفس المحرر لا نعيد التصنيف
            const html = clipboardData.getData('text/html')
            if (html && html.includes('data-type=')) return false

            const text = clipboardData.getData('text/plain')
            if (!text || !text.trim()) return false

            const classified = classifyText(text)
            if (classified.length === 0) return false

            const nodes = classifiedToNodes(classified, view.state.schema)
            if (nodes.length === 0) return false

            const fragment = Fragment.from(nodes)
            const slice = new Slice(fragment, 0, 0)

            const { tr } = view.state
            const { from, to } = view.state.selection

            tr.replaceRange(from, to, slice)
            view.dispatch(tr)

            event.preventDefault()
            return true
          },
        },
      }),
    ]
  },
})
