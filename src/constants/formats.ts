export type ScreenplayFormatId =
  | 'basmala'
  | 'scene-header-top-line'
  | 'scene-header-1'
  | 'scene-header-2'
  | 'scene-header-3'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'

export interface ScreenplayFormat {
  id: ScreenplayFormatId
  label: string
  shortcut: string
  color: string
  icon: string
}

export const screenplayFormats: readonly ScreenplayFormat[] = [
  { id: 'basmala', label: 'بسملة', shortcut: '', color: 'bg-purple-200/50 dark:bg-purple-800/50', icon: 'book-heart' },
  { id: 'scene-header-top-line', label: 'عنوان المشهد (سطر علوي)', shortcut: '', color: 'bg-blue-200/50 dark:bg-blue-800/50', icon: 'separator-horizontal' },
  { id: 'scene-header-1', label: 'عنوان المشهد (1)', shortcut: 'Ctrl+1', color: 'bg-blue-200/50 dark:bg-blue-800/50', icon: 'film' },
  { id: 'scene-header-2', label: 'عنوان المشهد (2)', shortcut: 'Tab', color: 'bg-sky-200/50 dark:bg-sky-800/50', icon: 'map-pin' },
  { id: 'scene-header-3', label: 'عنوان المشهد (3)', shortcut: 'Tab', color: 'bg-cyan-200/50 dark:bg-cyan-800/50', icon: 'camera' },
  { id: 'action', label: 'الفعل/الحدث', shortcut: 'Ctrl+4', color: 'bg-gray-200/50 dark:bg-gray-700/50', icon: 'feather' },
  { id: 'character', label: 'شخصية', shortcut: 'Ctrl+2', color: 'bg-green-200/50 dark:bg-green-800/50', icon: 'user-square' },
  { id: 'parenthetical', label: 'بين قوسين', shortcut: 'Tab', color: 'bg-yellow-200/50 dark:bg-yellow-800/50', icon: 'parentheses' },
  { id: 'dialogue', label: 'حوار', shortcut: 'Ctrl+3', color: 'bg-orange-200/50 dark:bg-orange-800/50', icon: 'message-circle' },
  { id: 'transition', label: 'انتقال', shortcut: 'Ctrl+6', color: 'bg-red-200/50 dark:bg-red-800/50', icon: 'fast-forward' },
]

export const formatClassMap: Record<string, string> = screenplayFormats.reduce<Record<string, string>>((acc, format) => {
  acc[format.id] = `format-${format.id}`
  return acc
}, {})

export const formatShortcutMap: Record<string, string> = {
  '1': 'scene-header-1',
  '2': 'character',
  '3': 'dialogue',
  '4': 'action',
  '6': 'transition',
}

export const classificationTypeOptions = [
  { value: 'action', label: 'حركة (Action)' },
  { value: 'dialogue', label: 'حوار (Dialogue)' },
  { value: 'character', label: 'شخصية (Character)' },
  { value: 'scene-header-1', label: 'عنوان مشهد - مستوى 1' },
  { value: 'scene-header-2', label: 'عنوان مشهد - مستوى 2' },
  { value: 'scene-header-3', label: 'عنوان مشهد - مستوى 3' },
  { value: 'transition', label: 'انتقال (Transition)' },
  { value: 'parenthetical', label: 'توصيف (Parenthetical)' },
] as const
