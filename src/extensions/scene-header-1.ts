import { Node, mergeAttributes } from '@tiptap/core'
import { SCENE_NUMBER_EXACT_RE } from './arabic-patterns'
import { normalizeLine } from './text-utils'

/**
 * استخراج رقم/عنوان المشهد من سطر scene-header-1.
 */
export const extractSceneHeader1Number = (text: string): string | null => {
  const normalized = normalizeLine(text)
  const match = normalized.match(/^((?:مشهد|scene)\s*[0-9٠-٩]+)$/i)
  return match ? match[1].trim() : null
}

/**
 * مطابقة سطر scene-header-1 (رقم المشهد فقط).
 */
export const isSceneHeader1Line = (text: string): boolean => {
  const normalized = normalizeLine(text)
  if (!normalized) return false
  if (!SCENE_NUMBER_EXACT_RE.test(normalized)) return false
  return extractSceneHeader1Number(normalized) !== null
}

/**
 * رأس المشهد - المستوى الأول (Scene Header 1)
 * رقم المشهد ونوعه
 * مثال: "مشهد 1"
 * يُعرض داخل sceneHeaderTopLine فقط
 */
export const SceneHeader1 = Node.create({
  name: 'sceneHeader1',
  // لا يوجد group لأنه يظهر فقط داخل sceneHeaderTopLine
  content: 'inline*',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="scene-header-1"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'scene-header-1',
        class: 'screenplay-scene-header-1',
      }),
      0,
    ]
  },
  // التنقل بالمفاتيح يُدار من SceneHeaderTopLine
})
