import { Node, mergeAttributes } from '@tiptap/core'
import type { ClassificationContext } from './classification-types'
import {
  PRONOUN_ACTION_RE,
  SCENE_NUMBER_EXACT_RE,
  THEN_ACTION_RE,
  TRANSITION_RE,
} from './arabic-patterns'
import {
  hasActionVerbStructure,
  isActionCueLine,
  isActionVerbStart,
  isActionWithDash,
  looksLikeNarrativeActionSyntax,
  matchesActionStartPattern,
  normalizeLine,
} from './text-utils'

export interface ActionEvidence {
  byDash: boolean
  byCue: boolean
  byPattern: boolean
  byVerb: boolean
  byStructure: boolean
  byNarrativeSyntax: boolean
  byPronounAction: boolean
  byThenAction: boolean
  byAudioNarrative: boolean
}

const NARRATIVE_AUDIO_CUE_RE =
  /^(?:نسمع|يسمع|تسمع|يُسمع|صوت|أصوات|دوي|ضجيج|طرق(?:ات)?|طلقات|انفجار|رنين|صفير|صراخ|صرخة|همس|أنين|بكاء|ضحك)(?:\s+\S|$)/

export const collectActionEvidence = (text: string): ActionEvidence => {
  const normalized = normalizeLine(text)

  return {
    byDash: isActionWithDash(normalized),
    byCue: isActionCueLine(normalized),
    byPattern: matchesActionStartPattern(normalized),
    byVerb: isActionVerbStart(normalized),
    byStructure: hasActionVerbStructure(normalized),
    byNarrativeSyntax: looksLikeNarrativeActionSyntax(normalized),
    byPronounAction: PRONOUN_ACTION_RE.test(normalized),
    byThenAction: THEN_ACTION_RE.test(normalized),
    byAudioNarrative: NARRATIVE_AUDIO_CUE_RE.test(normalized),
  }
}

export const isActionLine = (
  text: string,
  context?: Partial<ClassificationContext>
): boolean => {
  const normalized = normalizeLine(text)
  if (!normalized) return false

  if (TRANSITION_RE.test(normalized)) return false
  if (SCENE_NUMBER_EXACT_RE.test(normalized)) return false

  // سطر قصير منتهي بنقطتين غالبًا اسم شخصية.
  if (/[:：]\s*$/.test(normalized) && normalized.split(/\s+/).filter(Boolean).length <= 3) {
    return false
  }

  const evidence = collectActionEvidence(normalized)
  if (evidence.byDash) return true

  let score = 0
  if (evidence.byCue) score += 2
  if (evidence.byPattern) score += 2
  if (evidence.byVerb) score += 2
  if (evidence.byStructure) score += 1
  if (evidence.byNarrativeSyntax) score += 1
  if (evidence.byPronounAction) score += 1
  if (evidence.byThenAction) score += 1
  if (evidence.byAudioNarrative) score += 2

  if (context?.isInDialogueBlock && score < 3) return false
  if (context?.previousType === 'action' && score >= 1) return true

  return score >= 2
}

/**
 * الوصف / الحدث (Action)
 * يصف ما يحدث في المشهد
 */
export const Action = Node.create({
  name: 'action',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="action"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'action',
        class: 'screenplay-action',
      }),
      0,
    ]
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (!editor.isActive('action')) return false
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
