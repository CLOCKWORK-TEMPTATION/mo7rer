/**
 * @fileoverview typing-system.ts - أنواع بيانات نظام الكتابة (Typing System)
 * 
 * @description
 * بيحدد الـ types الخاصة بـ "Typing System" - النظام اللي بيدير التنسيق التلقائي
 * للنص أثناء الكتابة. بيدعم 3 أوضاع:
 * 1. plain: كتابة عادية بدون تصنيف تلقائي
 * 2. auto-deferred: التنسيق بيتم بعد تأكيد المستخدم (manual)
 * 3. auto-live: التنسيق التلقائي بعد فترة من عدم الكتابة
 * 
 * @key_types
 * - TypingSystemMode: وضع النظام (plain, auto-deferred, auto-live)
 * - TypingWorkflowScope: نطاق التطبيق (document)
 * - PasteWorkflowRunSource: مصدر التشغيل (manual-deferred, live-idle)
 * - PasteWorkflowReviewProfile: ملف المراجعة (interactive, silent-live)
 * - PasteWorkflowPolicyProfile: ملف السياسة (strict-structure, interactive-legacy)
 * - RunDocumentThroughPasteWorkflowOptions: options لتشغيل الـ workflow
 * - TypingSystemSettings: إعدادات النظام الكاملة
 * 
 * @constants
 * - DEFAULT_TYPING_SYSTEM_SETTINGS: الإعدادات الافتراضية
 * 
 * @functions
 * - sanitizeTypingSystemSettings: تطبيع الإعدادات
 * - minutesToMilliseconds: تحويل الدقائق لـ milliseconds
 * 
 * @usage
 * import { TypingSystemMode, DEFAULT_TYPING_SYSTEM_SETTINGS } from "@/types/typing-system";
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

export type TypingSystemMode = "plain" | "auto-deferred" | "auto-live";

export type TypingWorkflowScope = "document";

export type PasteWorkflowRunSource = "manual-deferred" | "live-idle";

export type PasteWorkflowReviewProfile = "interactive" | "silent-live";

export type PasteWorkflowPolicyProfile =
  | "strict-structure"
  | "interactive-legacy";

export interface RunDocumentThroughPasteWorkflowOptions {
  source: PasteWorkflowRunSource;
  reviewProfile: PasteWorkflowReviewProfile;
  policyProfile: PasteWorkflowPolicyProfile;
  suppressToasts?: boolean;
}

export interface TypingSystemSettings {
  typingSystemMode: TypingSystemMode;
  liveIdleMinutes: number;
  liveScope: TypingWorkflowScope;
  deferredScope: TypingWorkflowScope;
  keepNavigationMapInPlain: true;
}

export const DEFAULT_TYPING_SYSTEM_SETTINGS: TypingSystemSettings = {
  typingSystemMode: "plain",
  liveIdleMinutes: 3,
  liveScope: "document",
  deferredScope: "document",
  keepNavigationMapInPlain: true,
};

export const sanitizeTypingSystemSettings = (
  settings: Partial<TypingSystemSettings> | null | undefined
): TypingSystemSettings => {
  const incoming = settings ?? {};
  const rawMinutes =
    typeof incoming.liveIdleMinutes === "number"
      ? incoming.liveIdleMinutes
      : DEFAULT_TYPING_SYSTEM_SETTINGS.liveIdleMinutes;

  const normalizedMinutes = Number.isFinite(rawMinutes)
    ? Math.min(15, Math.max(1, Math.round(rawMinutes)))
    : DEFAULT_TYPING_SYSTEM_SETTINGS.liveIdleMinutes;

  const mode = incoming.typingSystemMode;
  const typingSystemMode: TypingSystemMode =
    mode === "plain" || mode === "auto-deferred" || mode === "auto-live"
      ? mode
      : DEFAULT_TYPING_SYSTEM_SETTINGS.typingSystemMode;

  return {
    typingSystemMode,
    liveIdleMinutes: normalizedMinutes,
    liveScope: "document",
    deferredScope: "document",
    keepNavigationMapInPlain: true,
  };
};

export const minutesToMilliseconds = (minutes: number): number =>
  Math.max(1, Math.round(minutes * 60_000));
