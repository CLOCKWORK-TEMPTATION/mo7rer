/**
 * @fileoverview use-mobile.tsx - Hook للكشف عن أجهزة الموبايل
 * 
 * @description
 * Custom React hook بيستخدم Media Queries عشان يكشف إذا كان المستخدم
 * على جهاز موبايل (شاشة أقل من 768px). بيستمع لتغييرات حجم الشاشة وبيحدث
 * الـ state تلقائياً.
 * 
 * @returns {boolean} - true إذا كانت الشاشة أقل من 768px (موبايل/تابلت)
 * 
 * @constant MOBILE_BREAKPOINT - 768px (نقطة التحول بين desktop وموبايل)
 * 
 * @usage
 * const isMobile = useIsMobile();
 * if (isMobile) {
 *   return <MobileLayout />;
 * }
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
