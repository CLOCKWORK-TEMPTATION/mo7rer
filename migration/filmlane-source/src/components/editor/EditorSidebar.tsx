/**
 * @fileoverview EditorSidebar.tsx - الشريط الجانبي للمحرر
 * 
 * @description
 * Container بسيط للشريط الجانبي الأيسر. بيستخدم glassmorphism design مع خلفية متدرجة
 * وتأثير blur. المحتوى الفعلي (المستندات الأخيرة، المشاريع، المكتبة) بيتمرر كـ children.
 * 
 * @features
 * - 📐 عرض ثابت (w-64)
 * - 🎨 خلفية متدرجة (gradient)
 * - 💎 تأثير blur (glassmorphism)
 * - 🚫 مفيش print (مش بيظهر في الطباعة)
 * - 🔄 اتجاه RTL (border-l)
 * 
 * @usage
 * <EditorSidebar>
 *   <SidebarItem icon={IconFileText} label="المستندات الأخيرة" />
 *   <SidebarItem icon={IconList} label="المشاريع" />
 * </EditorSidebar>
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

"use client";

import React from "react";

interface EditorSidebarProps {
  children?: React.ReactNode;
}

export function EditorSidebar({ children }: EditorSidebarProps) {
  return (
    <div className="no-print sidebar w-64 border-l border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-900/60 backdrop-blur-xl">
      {children}
    </div>
  );
}
