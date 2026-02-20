/**
 * @fileoverview use-local-storage.ts - Hooks للحفظ التلقائي في localStorage
 * 
 * @description
 * Custom React hooks و utilities للتعامل مع localStorage. بيشمل useAutoSave
 * اللي بيحفظ data تلقائياً بعد فترة من عدم التغيير (debounced save).
 * 
 * @exports
 * - useAutoSave<T>: Hook للحفظ التلقائي بعد delay معين
 * - loadFromStorage<T>: Function لتحميل data من localStorage (deprecated)
 * 
 * @usage
 * useAutoSave("my-key", data, 3000); // يحفظ بعد 3 ثواني من التوقف
 * 
 * @deprecated
 * loadFromStorage - استخدم loadJSON من @/utils/storage بدلاً منه
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

import { useEffect, useRef } from "react";
import { loadJSON, saveJSON } from "@/utils/storage";

export function useAutoSave<T>(key: string, value: T, delay: number = 3000) {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveJSON(key, value);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [key, value, delay]);
}

/**
 * @deprecated Use loadJSON from @/utils/storage instead
 */
export function loadFromStorage<T>(key: string, defaultValue: T): T {
  return loadJSON<T>(key, defaultValue);
}
