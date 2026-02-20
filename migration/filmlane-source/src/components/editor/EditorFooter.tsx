/**
 * @fileoverview EditorFooter.tsx - شريط حالة المحرر
 * 
 * @description
 * شريط في أسفل الشاشة بيعرض إحصائيات المستند الحالية (صفحات، كلمات، حروف، مشاهد)
 * ونوع التنسيق الحالي للسطر. بيستخدم responsive design عشان يخفي بعض البيانات على الشاشات الصغيرة.
 * 
 * @features
 * - 📊 إحصائيات المستند (Pages, Words, Characters, Scenes)
 * - 📝 عرض نوع التنسيق الحالي
 * - 📱 Responsive (إخفاء بعض البيانات على mobile)
 * - 🔄 اتجاه RTL للعربية
 * 
 * @usage
 * <EditorFooter
 *   stats={{ words: 150, characters: 800, pages: 2, scenes: 3 }}
 *   currentFormatLabel="حدث/وصف"
 * />
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

"use client";

import type { DocumentStats } from "@/types/screenplay";

interface EditorFooterProps {
  stats: DocumentStats;
  currentFormatLabel: string;
}

export function EditorFooter({ stats, currentFormatLabel }: EditorFooterProps) {
  return (
    <footer
      className="flex-shrink-0 border-t bg-card px-4 py-1.5 text-xs"
      style={{ direction: "rtl" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-muted-foreground">
          <span>{stats.pages} صفحة</span>
          <span className="hidden sm:inline">{stats.words} كلمة</span>
          <span className="hidden md:inline">{stats.characters} حرف</span>
          <span className="hidden sm:inline">{stats.scenes} مشهد</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>{currentFormatLabel || "..."}</span>
        </div>
      </div>
    </footer>
  );
}
