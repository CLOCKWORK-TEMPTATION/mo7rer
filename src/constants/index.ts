/**
 * @module constants
 * @description نقطة إعادة التصدير المركزية (barrel) لجميع ثوابت المحرر.
 *
 * يُعيد تصدير: التنسيقات، أنماط المحرر، الخطوط، الألوان، أبعاد الصفحة، وقائمة الإدراج.
 */
export {
  screenplayFormats,
  formatClassMap,
  formatShortcutMap,
  classificationTypeOptions,
} from './formats'
export {
  EDITOR_STYLE_FORMAT_IDS,
  LOCKED_EDITOR_FONT_FAMILY,
  LOCKED_EDITOR_FONT_SIZE,
  LOCKED_EDITOR_LINE_HEIGHT,
  getFormatStyles,
  applyEditorFormatStyleVariables,
} from './editor-format-styles'
export { fonts, textSizes } from './fonts'
export { colors, brandColors, semanticColors, highlightColors, gradients } from './colors'
export * from './page'
export { insertMenuDefinitions } from './insert-menu'
export type { InsertBehavior, InsertMenuItemDefinition, EditorStyleFormatId } from './insert-menu'
