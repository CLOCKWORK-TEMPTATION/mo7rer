/**
 * @fileoverview index.ts - نقطة التصدير الرئيسية لـ constants
 * 
 * @description
 * الـ entry point للمجلد constants بيصدر كل الـ constants والـ types الرئيسية
 * عشان أي مكان في التطبيق يقدر يعمل import من `@/constants` مباشرة.
 * 
 * @exports
 * - screenplayFormats, formatClassMap, formatShortcutMap, classificationTypeOptions (من formats)
 * - fonts, textSizes (من fonts)
 * - colors (من colors)
 * - جميع page constants (من page)
 * - insertMenuDefinitions, InsertBehavior, InsertMenuItemDefinition (من insert-menu)
 * 
 * @usage
 * import { 
 *   screenplayFormats, 
 *   colors, 
 *   fonts,
 *   PAGE_HEIGHT_PX 
 * } from "@/constants";
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

export {
  screenplayFormats,
  formatClassMap,
  formatShortcutMap,
  classificationTypeOptions,
} from "./formats";
export { fonts, textSizes } from "./fonts";
export { colors } from "./colors";
export * from "./page";
export { insertMenuDefinitions } from "./insert-menu";
export type { InsertBehavior, InsertMenuItemDefinition } from "./insert-menu";
