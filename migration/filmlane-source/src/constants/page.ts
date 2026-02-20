/**
 * @fileoverview page.ts - مقاسات الصفحة والهوامش
 * 
 * @description
 * بيحدد كل المقاسات الخاصة بصفحة السيناريو بالـ pixels (بافتراض 96 DPI).
 * بيشمل أبعاد الصفحة، الهوامش (مع مراعاة اتجاه RTL للعربية)، والمساحة المتاحة للمحتوى.
 * 
 * @constants
 * - PPI: 96 (pixels per inch)
 * - PAGE_HEIGHT_PX: 1123px (~297mm A4)
 * - PAGE_WIDTH_PX: 794px (~210mm A4)
 * - HEADER_HEIGHT_PX: 96px (1 inch)
 * - FOOTER_HEIGHT_PX: 96px (1 inch)
 * - PAGE_MARGIN_TOP_PX: 77px (0.8in)
 * - PAGE_MARGIN_BOTTOM_PX: 77px (0.8in)
 * - PAGE_MARGIN_LEFT_PX: 96px (1in)
 * - PAGE_MARGIN_RIGHT_PX: 120px (1.25in - للتجليد في RTL)
 * - CONTENT_HEIGHT_PX: المساحة المتاحة للمحتوى
 * 
 * @note
 * الهوامش مصممة للتخطيط العربي (RTL) مع هوامش مختلفة لليمين (التجليد) واليسار.
 * 
 * @usage
 * import { CONTENT_HEIGHT_PX, PAGE_MARGIN_RIGHT_PX } from "@/constants/page";
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

// Page metrics (in pixels) - assuming 96 DPI
export const PPI = 96;
export const PAGE_HEIGHT_PX = 1123; // ~297mm
export const PAGE_WIDTH_PX = 794; // ~210mm
export const HEADER_HEIGHT_PX = 96; // 1in
export const FOOTER_HEIGHT_PX = 96; // 1in
// Arabic Layout Margins
// 1in = 96px
// 0.8in = 76.8px (approx 77px)
// 1.25in = 120px
export const PAGE_MARGIN_TOP_PX = 77; // 0.8in
export const PAGE_MARGIN_BOTTOM_PX = 77; // 0.8in
export const PAGE_MARGIN_LEFT_PX = 96; // 1in
export const PAGE_MARGIN_RIGHT_PX = 120; // 1.25in (Binding edge for Arabic)
export const CONTENT_HEIGHT_PX =
  PAGE_HEIGHT_PX - PAGE_MARGIN_TOP_PX - PAGE_MARGIN_BOTTOM_PX;
