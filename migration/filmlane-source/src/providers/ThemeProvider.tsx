/**
 * @fileoverview ThemeProvider.tsx - Provider لإدارة الثيم (Light/Dark Mode)
 * 
 * @description
 * Wrapper component حوالين next-themes ThemeProvider. بيدير switching بين
 * light mode و dark mode للتطبيق. بيستخدم في root layout عشان يوفر theme context
 * لكل components في التطبيق.
 * 
 * @features
 * - 🌓 دعم Light/Dark mode
 * - 🔄 تبديل تلقائي حسب system preference
 * - 💾 حفظ preference في localStorage
 * - ⚡ No flash على الـ hydration
 * 
 * @wrapper
 * ده wrapper بسيط حوالين next-themes ThemeProvider عشان:
 * 1. يكون import من مكان central (@/providers)
 * 2. يضيف "use client" directive
 * 3. يوفر type safety
 * 
 * @dependencies
 * - next-themes: المكتبة الأساسية لإدارة الثيمات في Next.js
 * 
 * @usage
 * // في app/layout.tsx:
 * import { ThemeProvider } from "@/providers";
 * 
 * <ThemeProvider attribute="class" defaultTheme="dark">
 *   {children}
 * </ThemeProvider>
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
