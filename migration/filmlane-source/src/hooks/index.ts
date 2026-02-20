/**
 * @fileoverview hooks/index.ts - نقطة التصدير الرئيسية للـ Custom Hooks
 * 
 * @description
 * الـ entry point للمجلد hooks بيصدر كل الـ custom hooks المتاحة في التطبيق.
 * بيستورد كل hook من ملفه ويعيد تصديره عشان أي مكان في التطبيق يقدر يعمل import
 * من `@/hooks` مباشرة.
 * 
 * @exports
 * - useIsMobile: Hook للكشف عن أجهزة الموبايل
 * - useToast, toast: Hook وfunction لإظهار الإشعارات (toasts)
 * - useHistory: Hook لإدارة تاريخ الحالات (undo/redo)
 * - useAutoSave, loadFromStorage: Hook للحفظ التلقائي وutil للتحميل
 * 
 * @usage
 * import { useToast, useIsMobile, useHistory } from "@/hooks";
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

export { useIsMobile } from "./use-mobile";
export { useToast, toast } from "./use-toast";
export { useHistory } from "./use-history";
export { useAutoSave, loadFromStorage } from "./use-local-storage";
