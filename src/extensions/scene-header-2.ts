import { Node, mergeAttributes } from '@tiptap/core'
import { SCENE_LOCATION_RE, SCENE_NUMBER_EXACT_RE, SCENE_TIME_RE } from './arabic-patterns'
import { normalizeLine } from './text-utils'

/**
 * مطابقة سطر scene-header-2 (الزمن + داخلي/خارجي).
 */
export const isSceneHeader2Line = (text: string): boolean => {
  const normalized = normalizeLine(text)
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return false
  if (SCENE_NUMBER_EXACT_RE.test(normalized)) return false

  return SCENE_TIME_RE.test(normalized) && SCENE_LOCATION_RE.test(normalized)
}

/**
 * رأس المشهد - المستوى الثاني (Scene Header 2)
 * الزمان والنوع (داخلي/خارجي)
 * مثال: "ليل - خارجي"
 * يُعرض داخل sceneHeaderTopLine فقط
 */
export const SceneHeader2 = Node.create({
  name: 'sceneHeader2',
  // لا يوجد group لأنه يظهر فقط داخل sceneHeaderTopLine
  content: 'inline*',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="scene-header-2"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'scene-header-2',
        class: 'screenplay-scene-header-2',
      }),
      0,
    ]
  },
  // التنقل بالمفاتيح يُدار من SceneHeaderTopLine
})
