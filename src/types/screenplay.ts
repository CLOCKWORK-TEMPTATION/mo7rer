export interface DocumentStats {
  words: number
  characters: number
  pages: number
  scenes: number
}

export type LineType =
  | 'basmala'
  | 'scene-header-top-line'
  | 'scene-header-1'
  | 'scene-header-2'
  | 'scene-header-3'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
