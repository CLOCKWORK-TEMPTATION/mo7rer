/**
 * @fileoverview editor-area.types.ts - أنواع بيانات منطقة التحرير
 * 
 * @description
 * بيحدد كل الـ TypeScript interfaces والـ types اللي بتستخدمها مكونات المحرر.
 * بيشمل EditorHandle (الـ API اللي EditorArea بيعرضه) وEditorAreaProps (الـ props المتوقعة).
 * 
 * @usage
 * بيستورد في EditorArea.tsx و ScreenplayEditor.tsx عشان يضمن type safety
 * للتواصل بين المكونات.
 * 
 * @example
 * import type { EditorHandle, EditorAreaProps } from "./editor-area.types";
 * const editorRef = useRef<EditorHandle>(null);
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

"use client";

import type { FileImportMode } from "@/types/file-import";
import type { ClipboardOrigin } from "@/types/editor-clipboard";
import type { DocumentStats } from "@/types/screenplay";
import type { ScreenplayBlock } from "@/utils/document-model";
import type { RunDocumentThroughPasteWorkflowOptions } from "@/types/typing-system";

export interface EditorHandle {
  insertContent: (content: string, mode?: "insert" | "replace") => void;
  getElement: () => HTMLDivElement | null;
  getAllText: () => string;
  getAllHtml: () => string;
  hasSelection: () => boolean;
  copySelectionToClipboard: () => Promise<boolean>;
  cutSelectionToClipboard: () => Promise<boolean>;
  pasteFromClipboard: (origin: ClipboardOrigin) => Promise<boolean>;
  pasteFromDataTransfer: (
    clipboardData: DataTransfer,
    origin: ClipboardOrigin
  ) => Promise<boolean>;
  pastePlainTextWithClassifier: (text: string) => Promise<void>;
  undoCommandOperation: () => boolean;
  redoCommandOperation: () => boolean;
  selectAllContent: () => void;
  focusEditor: () => void;
  importClassifiedText: (
    text: string,
    mode: "replace" | "insert"
  ) => Promise<void>;
  runDocumentThroughPasteWorkflow: (
    options: RunDocumentThroughPasteWorkflowOptions
  ) => Promise<boolean>;
  importStructuredBlocks: (
    blocks: ScreenplayBlock[],
    mode: "replace" | "insert"
  ) => Promise<void>;
  exportStructuredBlocks: () => ScreenplayBlock[];
}

export interface EditorAreaProps {
  onContentChange: () => void;
  onStatsChange: (stats: DocumentStats) => void;
  onFormatChange: (format: string) => void;
  font: string;
  size: string;
  pageCount: number;
  onImporterReady?: (
    importer: (text: string, mode: FileImportMode) => Promise<void>
  ) => void;
  engineMode?: "legacy" | "tiptap";
}
