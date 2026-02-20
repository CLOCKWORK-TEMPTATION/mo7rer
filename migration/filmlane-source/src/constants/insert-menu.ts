/**
 * @fileoverview insert-menu.ts - تعريفات عناصر قائمة الإدراج
 * 
 * @description
 * بيحدد كل العناصر المتاحة في قائمة "إدراج" (بسملة، رأس مشهد، حوار، إلخ)
 * مع نوع السلوك (insert-template أو photo-montage) والـ default template لكل عنصر.
 * 
 * @exports
 * - insertMenuDefinitions: Array of insert menu items
 * - InsertBehavior: Type for insert behavior
 * - InsertMenuItemDefinition: Interface for menu item definition
 * 
 * @behaviors
 * - insert-template: إدراج نص template مسبق التعريف
 * - photo-montage: سلوك خاص لفوتو مونتاج (يحتاج مكان محدد في رأس المشهد)
 * 
 * @items
 * - بسملة، رأس المشهد (1,2,3)، الوصف/الحركة، اسم الشخصية، الحوار،
 *   تعليمات الحوار، الانتقال، فوتو مونتاج
 * 
 * @usage
 * import { insertMenuDefinitions, InsertMenuItemDefinition } from "@/constants/insert-menu";
 * const basmalaItem = insertMenuDefinitions.find(item => item.id === "basmala");
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

import type React from "react";
import {
  IconList,
  IconMessage,
  IconMovie,
  IconSeparator,
  IconSparkles,
  IconTextCaption,
  IconUser,
} from "@tabler/icons-react";
import type { EditorStyleFormatId } from "@/utils";

export type InsertBehavior = "insert-template" | "photo-montage";

export interface InsertMenuItemDefinition {
  id: EditorStyleFormatId;
  label: string;
  icon: React.ElementType;
  insertBehavior: InsertBehavior;
  defaultTemplate: string | null;
}

export const insertMenuDefinitions: InsertMenuItemDefinition[] = [
  {
    id: "basmala",
    label: "بسملة",
    icon: IconSparkles,
    insertBehavior: "insert-template",
    defaultTemplate: "بسم الله الرحمن الرحيم",
  },
  {
    id: "scene-header-1",
    label: "رأس المشهد (1)",
    icon: IconMovie,
    insertBehavior: "insert-template",
    defaultTemplate: "مشهد 1:",
  },
  {
    id: "scene-header-2",
    label: "رأس المشهد 2",
    icon: IconTextCaption,
    insertBehavior: "insert-template",
    defaultTemplate: "داخلي - المكان - الوقت",
  },
  {
    id: "scene-header-3",
    label: "رأس المشهد 3",
    icon: IconList,
    insertBehavior: "insert-template",
    defaultTemplate: "الموقع",
  },
  {
    id: "action",
    label: "الوصف/الحركة",
    icon: IconTextCaption,
    insertBehavior: "insert-template",
    defaultTemplate: "وصف الحدث...",
  },
  {
    id: "character",
    label: "اسم الشخصية",
    icon: IconUser,
    insertBehavior: "insert-template",
    defaultTemplate: "اسم الشخصية:",
  },
  {
    id: "dialogue",
    label: "الحوار",
    icon: IconMessage,
    insertBehavior: "insert-template",
    defaultTemplate: "الحوار هنا...",
  },
  {
    id: "parenthetical",
    label: "تعليمات الحوار",
    icon: IconList,
    insertBehavior: "insert-template",
    defaultTemplate: "(تعليمات الحوار)",
  },
  {
    id: "transition",
    label: "الانتقال",
    icon: IconSeparator,
    insertBehavior: "insert-template",
    defaultTemplate: "انتقال إلى:",
  },
  {
    id: "scene-header-top-line",
    label: "فوتو مونتاج",
    icon: IconMovie,
    insertBehavior: "photo-montage",
    defaultTemplate: null,
  },
];
