/**
 * @fileoverview editor-engine.ts - واجهة محرك التحرير (Editor Engine Adapter)
 * 
 * @description
 * بيحدد الـ interface اللي أي "محرك تحرير" لازم ي implementه عشان يشتغل مع المحرر.
 * ده بيسمح بـ abstraction layer بين الـ UI والـ actual editing engine (legacy أو tiptap).
 * 
 * @pattern Adapter Pattern
 * الـ EditorEngineAdapter بيشكل adapter بين محرر الـ UI ومحركات التحرير المختلفة.
 * 
 * @exports
 * - EditorEngineAdapter: Interface الرئيسي للـ adapter
 * - RunEditorCommandOptions: Options لتشغيل أوامر (undo, redo, select-all, focus-end)
 * 
 * @methods
 * - insertBlocks: إدراج blocks في المحرر
 * - replaceBlocks: استبدال المحتوى بـ blocks
 * - getBlocks: الحصول على كل الـ blocks الحالية
 * - runCommand: تشغيل أمر (undo/redo/select-all/focus-end)
 * - hasSelection: هل فيه نص محدد؟
 * - copySelectionToClipboard: نسخ التحديد
 * - cutSelectionToClipboard: قص التحديد
 * - pasteFromClipboard: لصق من الـ clipboard
 * 
 * @usage
 * import { EditorEngineAdapter } from "@/types/editor-engine";
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

import type { ClipboardOrigin } from "./editor-clipboard";
import type { ScreenplayBlock } from "@/utils/document-model";

export interface RunEditorCommandOptions {
  command: "undo" | "redo" | "select-all" | "focus-end";
}

export interface EditorEngineAdapter {
  insertBlocks: (blocks: ScreenplayBlock[]) => Promise<void>;
  replaceBlocks: (blocks: ScreenplayBlock[]) => Promise<void>;
  getBlocks: () => ScreenplayBlock[];
  runCommand: (options: RunEditorCommandOptions) => boolean;
  hasSelection: () => boolean;
  copySelectionToClipboard: () => Promise<boolean>;
  cutSelectionToClipboard: () => Promise<boolean>;
  pasteFromClipboard: (origin: ClipboardOrigin) => Promise<boolean>;
}
