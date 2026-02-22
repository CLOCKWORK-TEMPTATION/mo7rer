/**
 * @description نقطة التجميع (Barrel file) لمكونات محرر السيناريو.
 * تصدر المكونات الأساسية مثل منطقة التحرير، الترويسة، الشريط الجانبي، وشريط الأدوات.
 */
export { ClassificationConfirmationDialog } from './ConfirmationDialog'
export { EditorArea } from './EditorArea'
export type { EditorAreaProps, EditorHandle, DocumentStats, EditorCommand, FileImportMode } from './editor-area.types'
export { EditorFooter } from './EditorFooter'
export { EditorHeader } from './EditorHeader'
export type { HeaderActionId } from './EditorHeader'
export { EditorSidebar } from './EditorSidebar'
export type { SidebarSection } from './EditorSidebar'
export { EditorToolbar } from './EditorToolbar'
export type { ToolbarActionId } from './EditorToolbar'
export { ScreenplayEditor, mountScreenplayEditor } from './ScreenplayEditor'
