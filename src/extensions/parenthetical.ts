import { Node, mergeAttributes } from '@tiptap/core'
import { PARENTHETICAL_RE } from './arabic-patterns'
import { normalizeLine } from './text-utils'

/**
 * مطابقة سطر parenthetical بين أقواس.
 */
export const isParentheticalLine = (text: string): boolean => {
  const normalized = normalizeLine(text)
  return PARENTHETICAL_RE.test(normalized)
}

/**
 * الإرشاد التمثيلي (Parenthetical)
 * توجيهات أداء داخل الحوار
 */
export const Parenthetical = Node.create({
  name: 'parenthetical',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="parenthetical"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'parenthetical',
        class: 'screenplay-parenthetical',
      }),
      0,
    ]
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (!editor.isActive('parenthetical')) return false
        return editor
          .chain()
          .focus()
          .splitBlock()
          .setDialogue()
          .run()
      },
    }
  },
})
