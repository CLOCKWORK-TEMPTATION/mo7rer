import { resolveTypingOnEnter, resolveTypingOnTab } from "./typing-workflow-rules";

/**
 * @deprecated استخدم resolveTypingOnTab من typing-workflow-rules.ts
 * الملف الحالي واجهة توافقية للحفاظ على الاستدعاءات القديمة فقط.
 */
export const getNextFormatOnTab = (
  currentFormat: string,
  isEmpty = false,
  shiftPressed = false
): string =>
  resolveTypingOnTab(currentFormat, {
    isEmpty,
    shiftPressed,
  }).nextFormat;

/**
 * @deprecated استخدم resolveTypingOnEnter من typing-workflow-rules.ts
 * الملف الحالي واجهة توافقية للحفاظ على الاستدعاءات القديمة فقط.
 */
export const getNextFormatOnEnter = (currentFormat: string): string =>
  resolveTypingOnEnter(currentFormat).nextFormat;
