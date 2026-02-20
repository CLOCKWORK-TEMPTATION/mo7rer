/**
 * @fileoverview editor-clipboard.ts - أنواع بيانات الـ Clipboard
 * 
 * @description
 * بيحدد الـ types والـ constants الخاصة بـ clipboard operations في المحرر.
 * بيشمل MIME type مخصص لـ Filmlane عشان نحافظ على الـ blocks structure لما بننسخ/نلصق
 * داخل التطبيق نفسه.
 * 
 * @features
 * - FILMLANE_CLIPBOARD_MIME: نوع مخصص للـ clipboard (application/x-filmlane-blocks+json)
 * - ClipboardSourceKind: مصدر الـ clipboard (selection أو document)
 * - ClipboardOrigin: أصل العملية (menu, shortcut, context, native)
 * - EditorClipboardPayload: الـ payload الكامل للـ clipboard
 * 
 * @usage
 * import { FILMLANE_CLIPBOARD_MIME, EditorClipboardPayload } from "@/types/editor-clipboard";
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

import type { ScreenplayBlock } from "@/utils/document-model";

export const FILMLANE_CLIPBOARD_MIME =
  "application/x-filmlane-blocks+json" as const;

export type ClipboardSourceKind = "selection" | "document";

export type ClipboardOrigin = "menu" | "shortcut" | "context" | "native";

export interface EditorClipboardPayload {
  plainText: string;
  html?: string;
  blocks?: ScreenplayBlock[];
  sourceKind: ClipboardSourceKind;
  hash: string;
  createdAt: string;
}
