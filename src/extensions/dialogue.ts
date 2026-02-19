import { Node, mergeAttributes } from '@tiptap/core'
import type { ClassificationContext, ElementType } from './classification-types'
import {
  CONVERSATIONAL_MARKERS_RE,
  CONVERSATIONAL_STARTS,
  QUOTE_MARKS_RE,
  VOCATIVE_RE,
  VOCATIVE_TITLES_RE,
} from './arabic-patterns'
import { collectActionEvidence } from './action'
import { hasDirectDialogueMarkers, normalizeLine } from './text-utils'

export const hasDirectDialogueCues = (text: string): boolean => {
  const normalized = normalizeLine(text)
  if (!normalized) return false

  if (hasDirectDialogueMarkers(normalized)) return true
  if (CONVERSATIONAL_MARKERS_RE.test(normalized)) return true
  if (VOCATIVE_RE.test(normalized)) return true
  if (VOCATIVE_TITLES_RE.test(normalized)) return true
  if (QUOTE_MARKS_RE.test(normalized)) return true

  const firstWord = normalized.split(/\s+/)[0] ?? ''
  if (CONVERSATIONAL_STARTS.includes(firstWord)) return true

  return false
}

export const isDialogueContinuationLine = (
  rawLine: string,
  previousType: ElementType | null
): boolean => {
  if (!rawLine) return false
  if (previousType !== 'dialogue' && previousType !== 'parenthetical') return false

  return /^[\t]/.test(rawLine) || /^[ ]{2,}\S+/.test(rawLine)
}

export const getDialogueProbability = (
  text: string,
  context?: Partial<ClassificationContext>
): number => {
  const normalized = normalizeLine(text)
  if (!normalized) return 0

  let score = 0

  if (hasDirectDialogueCues(normalized)) score += 4
  if (/[؟?!]/.test(normalized)) score += 2
  if (/(?:\.\.\.|…)/.test(normalized)) score += 1

  const wordCount = normalized.split(/\s+/).filter(Boolean).length
  if (wordCount >= 2 && wordCount <= 20) score += 1

  if (
    context?.previousType === 'character' ||
    context?.previousType === 'dialogue' ||
    context?.previousType === 'parenthetical'
  ) {
    score += 2
  }

  const actionEvidence = collectActionEvidence(normalized)
  if (actionEvidence.byDash) score -= 4
  if (actionEvidence.byPattern || actionEvidence.byVerb) score -= 2
  if (actionEvidence.byNarrativeSyntax || actionEvidence.byAudioNarrative) score -= 2

  return score
}

export const isDialogueLine = (
  text: string,
  context?: Partial<ClassificationContext>
): boolean => {
  const normalized = normalizeLine(text)
  if (!normalized) return false

  const actionEvidence = collectActionEvidence(normalized)
  const hasStrongAction =
    actionEvidence.byDash ||
    actionEvidence.byPattern ||
    actionEvidence.byVerb ||
    actionEvidence.byNarrativeSyntax ||
    actionEvidence.byPronounAction ||
    actionEvidence.byThenAction ||
    actionEvidence.byAudioNarrative

  if (hasStrongAction) return false
  if (hasDirectDialogueCues(normalized)) return true

  if (context?.previousType === 'character' || context?.previousType === 'parenthetical') {
    return true
  }

  return getDialogueProbability(normalized, context) >= 5
}

/**
 * الحوار (Dialogue)
 * كلام الشخصية
 */
export const Dialogue = Node.create({
  name: 'dialogue',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="dialogue"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'dialogue',
        class: 'screenplay-dialogue',
      }),
      0,
    ]
  },

  addKeyboardShortcuts() {
    return {
      // الانتقال إلى الوصف عند الضغط على Enter
      Enter: ({ editor }) => {
        if (!editor.isActive('dialogue')) return false
        return editor
          .chain()
          .focus()
          .splitBlock()
          .setAction()
          .run()
      },
    }
  },
})
