/**
 * @fileoverview index.ts - نقطة التصدير الرئيسية لمجلد editor
 * 
 * @description
 * الـ entry point للمجلد بيصدر كل المكونات الرئيسية عشان أي مكان في التطبيق
 * يقدر يعمل import من `@/components/editor` مباشرة.
 * 
 * @exports
 * - ScreenplayEditor: المكون الأم للمحرر
 * - EditorHeader: رأس المحرر (قديم)
 * - EditorToolbar: شريط الأدوات (قديم)
 * - EditorArea: منطقة التحرير الفعلية
 * - EditorFooter: شريط الحالة
 * - EditorSidebar: الشريط الجانبي
 * 
 * @usage
 * import { ScreenplayEditor, EditorFooter } from "@/components/editor";
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

export { ScreenplayEditor } from "./ScreenplayEditor";
export { EditorHeader } from "./EditorHeader";
export { EditorToolbar } from "./EditorToolbar";
export { EditorArea } from "./EditorArea";
export { EditorFooter } from "./EditorFooter";
export { EditorSidebar } from "./EditorSidebar";
