import type { EditorStyleFormatId } from './editor-format-styles'

export type InsertBehavior = 'insert-template' | 'photo-montage'
export type { EditorStyleFormatId } from './editor-format-styles'

export interface InsertMenuItemDefinition {
  id: EditorStyleFormatId
  label: string
  icon: string
  insertBehavior: InsertBehavior
  defaultTemplate: string | null
}

export const insertMenuDefinitions: readonly InsertMenuItemDefinition[] = [
  { id: 'basmala', label: 'بسملة', icon: 'sparkles', insertBehavior: 'insert-template', defaultTemplate: 'بسم الله الرحمن الرحيم' },
  { id: 'scene-header-1', label: 'رأس المشهد (1)', icon: 'movie', insertBehavior: 'insert-template', defaultTemplate: 'مشهد 1:' },
  { id: 'scene-header-2', label: 'رأس المشهد 2', icon: 'text-caption', insertBehavior: 'insert-template', defaultTemplate: 'داخلي - المكان - الوقت' },
  { id: 'scene-header-3', label: 'رأس المشهد 3', icon: 'list', insertBehavior: 'insert-template', defaultTemplate: 'الموقع' },
  { id: 'action', label: 'الوصف/الحركة', icon: 'text-caption', insertBehavior: 'insert-template', defaultTemplate: 'وصف الحدث...' },
  { id: 'character', label: 'اسم الشخصية', icon: 'user', insertBehavior: 'insert-template', defaultTemplate: 'اسم الشخصية:' },
  { id: 'dialogue', label: 'الحوار', icon: 'message', insertBehavior: 'insert-template', defaultTemplate: 'الحوار هنا...' },
  { id: 'parenthetical', label: 'تعليمات الحوار', icon: 'list', insertBehavior: 'insert-template', defaultTemplate: '(تعليمات الحوار)' },
  { id: 'transition', label: 'الانتقال', icon: 'separator', insertBehavior: 'insert-template', defaultTemplate: 'انتقال إلى:' },
  { id: 'scene-header-top-line', label: 'فوتو مونتاج', icon: 'movie', insertBehavior: 'photo-montage', defaultTemplate: null },
]
