import { Node, mergeAttributes } from '@tiptap/core'
import type { ClassificationContext } from './classification-types'
import {
  SCENE_HEADER3_MULTI_LOCATION_EXACT_RE,
  SCENE_HEADER3_PREFIX_RE,
  SCENE_HEADER3_RANGE_RE,
  SCENE_NUMBER_EXACT_RE,
  TRANSITION_RE,
} from './arabic-patterns'
import {
  hasSentencePunctuation,
  isActionVerbStart,
  matchesActionStartPattern,
  normalizeLine,
} from './text-utils'

/**
 * مطابقة سطر scene-header-3 (الموقع التفصيلي).
 */
export const isSceneHeader3Line = (
  text: string,
  context?: Partial<ClassificationContext>
): boolean => {
  const normalized = normalizeLine(text).replace(/:+\s*$/, '')
  if (!normalized) return false

  const wordCount = normalized.split(/\s+/).filter(Boolean).length
  if (wordCount > 14) return false
  if (SCENE_NUMBER_EXACT_RE.test(normalized)) return false
  if (TRANSITION_RE.test(normalized)) return false
  if (hasSentencePunctuation(normalized)) return false
  if (isActionVerbStart(normalized)) return false
  if (matchesActionStartPattern(normalized)) return false

  if (SCENE_HEADER3_PREFIX_RE.test(normalized)) return true
  if (SCENE_HEADER3_RANGE_RE.test(normalized)) return true
  if (SCENE_HEADER3_MULTI_LOCATION_EXACT_RE.test(normalized)) return true

  if (context?.isAfterSceneHeaderTopLine) return true
  if (context?.previousType === 'sceneHeaderTopLine') return true

  return false
}

/**
 * رأس المشهد - المستوى الثالث (Scene Header 3)
 * الموقع التفصيلي
 * مثال: "شقة سيد - غرفة النوم"
 */
export const SceneHeader3 = Node.create({
  name: 'sceneHeader3',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="scene-header-3"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'scene-header-3',
        class: 'screenplay-scene-header-3',
      }),
      0,
    ]
  },

  addKeyboardShortcuts() {
    return {
      // الانتقال إلى الوصف/الحركة
      Enter: ({ editor }) => {
        if (!editor.isActive('sceneHeader3')) return false
        return editor.chain().focus().splitBlock().setAction().run()
      },
    }
  },
})
