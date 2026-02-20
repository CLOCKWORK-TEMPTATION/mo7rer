/**
 * @fileoverview declarations.d.ts - تعريفات TypeScript للمكتبات الخارجية
 * 
 * @description
 * ملف declarations (`.d.ts`) بيحدد types للمكتبات الخارجية اللي مالهاش types رسمية
 * أو اللي بنستخدمها بطريقة custom. TypeScript بيستخدم الملفات دي عشان يفهم
 * الـ APIs دي بدون ما يكون في actual implementation.
 * 
 * @declarations
 * - pdfjs-dist/legacy/build/pdf.mjs: PDF.js للقراءة من ملفات PDF
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

declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export const getDocument: (options: unknown) => {
    promise: Promise<{
      numPages: number;
      getPage: (
        pageNumber: number
      ) => Promise<{ getTextContent: () => Promise<{ items: Array<{ str?: string }> }> }>;
    }>;
    destroy: () => Promise<void>;
  };
}
