/**
 * @fileoverview fonts.ts - الخطوط وأحجام النص
 * 
 * @description
 * بيحدد الخطوط المتاحة وأحجام النص في محرر السيناريو. حالياً بيدعم خط "أزار مهر أحادي"
 * (AzarMehrMonospaced-San) اللي بيتناسب مع الكتابة الفنية للسيناريوهات العربية.
 * 
 * @exports
 * - fonts: Array of available fonts
 * - textSizes: Array of available text sizes
 * 
 * @usage
 * import { fonts, textSizes } from "@/constants/fonts";
 * const defaultFont = fonts[0].value; // "AzarMehrMonospaced-San"
 * const defaultSize = textSizes[0].value; // "12pt"
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

import type { FontOption, TextSizeOption } from "@/types/screenplay";

export const fonts: FontOption[] = [
  { value: "AzarMehrMonospaced-San", label: "أزار مهر أحادي" },
];

export const textSizes: TextSizeOption[] = [{ value: "12pt", label: "12" }];
