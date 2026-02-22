/**
 * @module types/screenplay
 * @description أنماط السيناريو الأساسية — تُستخدم في كامل التطبيق كأساس لتمثيل عناصر السيناريو
 *
 * يُصدّر هذا الملف نوعين جوهريين:
 * - `DocumentStats` — إحصائيات المستند المعروضة في تذييل المحرر
 * - `LineType` — الاتحاد المُميّز لأنواع عناصر السيناريو العشرة
 */

/**
 * إحصائيات المستند — تُحسب في الوقت الفعلي وتُعرض في تذييل المحرر
 *
 * @property words - عدد الكلمات الإجمالي في المستند
 * @property characters - عدد الحروف الإجمالي (بدون مسافات)
 * @property pages - عدد صفحات A4 المُحتسبة بناءً على ارتفاع المحتوى
 * @property scenes - عدد المشاهد (عدد عناصر scene-header-1)
 */
export interface DocumentStats {
  words: number
  characters: number
  pages: number
  scenes: number
}

/**
 * نوع عنصر السيناريو — الاتحاد المُميّز الذي يُعرّف العناصر العشرة المدعومة
 *
 * العناصر حسب الفئة:
 * - **دينية**: `basmala` — البسملة في بداية المستند
 * - **رؤوس المشاهد**: `scene-header-top-line` (سطر فوقي)،
 *   `scene-header-1` (رئيسي)، `scene-header-2` (فرعي)، `scene-header-3` (وصف زمني/مكاني)
 * - **سردية**: `action` — وصف الحدث والمشهد
 * - **حوارية**: `character` (اسم الشخصية)، `dialogue` (الحوار)،
 *   `parenthetical` (توجيه أدائي بين قوسين)
 * - **انتقالية**: `transition` — انتقال بين المشاهد (قطع، مزج، إلخ)
 *
 * @see extensions/ — كل نوع له عقدة Tiptap مخصصة في مجلد الامتدادات
 */
export type LineType =
  | 'basmala'
  | 'scene-header-top-line'
  | 'scene-header-1'
  | 'scene-header-2'
  | 'scene-header-3'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
