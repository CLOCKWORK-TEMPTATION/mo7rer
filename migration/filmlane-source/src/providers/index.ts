/**
 * @fileoverview providers/index.ts - نقطة التصدير الرئيسية للـ Providers
 * 
 * @description
 * الـ entry point للمجلد providers بيصدر كل الـ React context providers
 * المتاحة في التطبيق. الـ Providers دي بتلف التطبيق وبتقدم context للأجزاء
 * التحتانية (مثل theme, auth, إلخ).
 * 
 * @exports
 * - ThemeProvider: Provider لإدارة الثيم (light/dark mode)
 * 
 * @usage
 * import { ThemeProvider } from "@/providers";
 * 
 * // في layout.tsx:
 * <ThemeProvider>
 *   {children}
 * </ThemeProvider>
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

export { ThemeProvider } from "./ThemeProvider";
