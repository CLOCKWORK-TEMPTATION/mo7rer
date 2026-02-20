import type { Editor } from '@tiptap/core'
import type { ElementType } from '../../extensions/classification-types'
import type { ScreenplayBlock } from '../../utils/file-import'

export interface DocumentStats {
  words: number
  characters: number
  pages: number
  scenes: number
}

export type EditorCommand = 'bold' | 'italic' | 'underline' | 'undo' | 'redo'
export type FileImportMode = 'replace' | 'insert'

export interface EditorHandle {
  readonly editor: Editor
  getAllText: () => string
  getAllHtml: () => string
  focusEditor: () => void
  clear: () => void
  runCommand: (command: EditorCommand) => boolean
  setFormat: (format: ElementType) => boolean
  getCurrentFormat: () => ElementType | null
  importClassifiedText: (text: string, mode?: FileImportMode) => Promise<void>
  importStructuredBlocks: (blocks: ScreenplayBlock[], mode?: FileImportMode) => void
}

export interface EditorAreaProps {
  mount: HTMLElement
  onContentChange?: (text: string) => void
  onStatsChange?: (stats: DocumentStats) => void
  onFormatChange?: (format: ElementType | null) => void
}
