/**
 * @fileoverview external-modules.d.ts - تعريفات TypeScript للمكتبات الخارجية (Modules)
 * 
 * @description
 * ملف declarations (`.d.ts`) بيحدد types للمكتبات الخارجية اللي مالهاش types رسمية
 * أو اللي بنستخدمها بطريقة custom. الفرق عن declarations.d.ts إنه بيستخدم declare module
 * للمكتبات اللي مش بتصدر types أو اللي types بتاعتها غير كافية.
 * 
 * @modules
 * - mammoth: مكتبة لاستخراج النص من ملفات Word (.docx)
 * - @anthropic-ai/sdk: SDK للـ Anthropic Claude API
 * 
 * @note
 * الملفات `.d.ts` (declaration files) مش بتحتوي على implementation،
 * هي بس بتوصف shapes للـ APIs عشان TypeScript يقدر يعمل type checking.
 * 
 * @usage
 * لا يحتاج import - TypeScript بيكتشفها تلقائياً
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

declare module "mammoth" {
  export interface ExtractRawTextResult {
    value: string;
  }

  export function extractRawText(input: {
    path: string;
  }): Promise<ExtractRawTextResult>;
}

declare module "@anthropic-ai/sdk" {
  export namespace Messages {
    export type MessageCreateParamsNonStreaming = Record<string, unknown>;
  }

  export default class Anthropic {
    constructor(options: {
      apiKey: string;
      maxRetries?: number;
      timeout?: number;
    });

    messages: {
      create: (params: Messages.MessageCreateParamsNonStreaming) => Promise<{
        content: Array<{ type: string; text?: string }>;
      }>;
    };
  }
}
