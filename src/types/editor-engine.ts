import type { ClipboardOrigin } from './editor-clipboard'
import type { ScreenplayBlock } from '../utils/file-import/document-model'

export interface RunEditorCommandOptions {
  command: 'undo' | 'redo' | 'select-all' | 'focus-end'
}

export interface EditorEngineAdapter {
  insertBlocks: (blocks: ScreenplayBlock[]) => Promise<void>
  replaceBlocks: (blocks: ScreenplayBlock[]) => Promise<void>
  getBlocks: () => ScreenplayBlock[]
  runCommand: (options: RunEditorCommandOptions) => boolean
  hasSelection: () => boolean
  copySelectionToClipboard: () => Promise<boolean>
  cutSelectionToClipboard: () => Promise<boolean>
  pasteFromClipboard: (origin: ClipboardOrigin) => Promise<boolean>
}
