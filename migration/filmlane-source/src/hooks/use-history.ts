/**
 * @fileoverview use-history.ts - Hook لإدارة تاريخ الحالات (Undo/Redo)
 * 
 * @description
 * Custom React hook بيدير history من الحالات عشان يسمح بـ undo/redo.
 * بيحافظ على array من الحالات وindex للحالة الحالية. كل ما تضيف حالة جديدة،
 * بيتم حذف أي حالات "future" ( redo ) اللي كانت موجودة.
 * 
 * @template T - نوع الحالة (state type)
 * 
 * @returns
 * - state: الحالة الحالية
 * - set: function لتحديث الحالة (ب accepts T أو (prev: T) => T)
 * - undo: function للتراجع خطوة للوراء
 * - redo: function للتقدم خطوة للأمام
 * - canUndo: boolean - هل فيه حالات للتراجع؟
 * - canRedo: boolean - هل فيه حالات للتقدم؟
 * 
 * @usage
 * const { state, set, undo, redo, canUndo, canRedo } = useHistory<string>("");
 * set("new text"); // إضافة حالة جديدة
 * undo(); // تراجع
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

import { useState, useCallback } from "react";

export function useHistory<T>(initialState: T) {
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<T[]>([initialState]);

  const setState = useCallback(
    (action: T | ((prev: T) => T)) => {
      setHistory((currentHistory) => {
        const newState =
          typeof action === "function"
            ? (action as (prev: T) => T)(currentHistory[index])
            : action;

        const newHistory = currentHistory.slice(0, index + 1);
        newHistory.push(newState);

        setIndex(newHistory.length - 1);
        return newHistory;
      });
    },
    [index]
  );

  const undo = useCallback(() => {
    if (index > 0) {
      setIndex(index - 1);
    }
  }, [index]);

  const redo = useCallback(() => {
    if (index < history.length - 1) {
      setIndex(index + 1);
    }
  }, [index, history.length]);

  const canUndo = index > 0;
  const canRedo = index < history.length - 1;

  return {
    state: history[index],
    set: setState,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
