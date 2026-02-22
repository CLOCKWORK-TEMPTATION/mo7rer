/**
 * @module extensions/context-memory-manager
 * @description
 * مدير ذاكرة السياق — ذاكرة خفيفة تعمل داخل جلسة تصنيف واحدة (عملية لصق).
 *
 * يُصدّر:
 * - {@link ContextMemorySnapshot} — لقطة للقراءة فقط من حالة الذاكرة
 * - {@link ContextMemoryManager} — الفئة الرئيسية لتسجيل واسترجاع السياق
 *
 * لا يعتمد على React أو Backend — يعمل بالكامل في الذاكرة المحلية.
 * يُستهلك في {@link PasteClassifier} و {@link HybridClassifier}.
 */
import type { ClassifiedDraft, ElementType } from './classification-types'
import { normalizeCharacterName } from './text-utils'

/**
 * لقطة للقراءة فقط من ذاكرة السياق.
 *
 * - `recentTypes` — آخر 8 أنواع مُصنّفة (الأحدث في النهاية)
 * - `characterFrequency` — عدد مرات ظهور كل اسم شخصية
 */
export interface ContextMemorySnapshot {
  readonly recentTypes: readonly ElementType[]
  readonly characterFrequency: ReadonlyMap<string, number>
}

/**
 * ذاكرة خفيفة داخل جلسة التصنيف أثناء عملية لصق واحدة.
 * لا تعتمد على React أو Backend.
 */
export class ContextMemoryManager {
  private recentTypes: ElementType[] = []
  private characterFrequency = new Map<string, number>()
  private readonly maxRecent = 8

  /**
   * يسجّل مسودة تصنيف جديدة في الذاكرة.
   *
   * يُضيف النوع إلى `recentTypes` (بحد أقصى {@link maxRecent} = 8).
   * إذا كان النوع `character`، يزيد عدّاد تكرار الاسم.
   *
   * @param entry - المسودة المُصنّفة
   */
  record(entry: ClassifiedDraft): void {
    this.recentTypes.push(entry.type)
    if (this.recentTypes.length > this.maxRecent) {
      this.recentTypes.shift()
    }

    if (entry.type === 'character') {
      const name = normalizeCharacterName(entry.text)
      if (name) {
        this.characterFrequency.set(name, (this.characterFrequency.get(name) ?? 0) + 1)
      }
    }
  }

  /**
   * يستبدل آخر تسجيل في الذاكرة — يُستخدم عند تصحيح التصنيف.
   *
   * @param entry - المسودة المُصحّحة
   */
  replaceLast(entry: ClassifiedDraft): void {
    if (this.recentTypes.length > 0) {
      this.recentTypes[this.recentTypes.length - 1] = entry.type
    } else {
      this.recentTypes.push(entry.type)
    }

    if (entry.type === 'character') {
      const name = normalizeCharacterName(entry.text)
      if (name) {
        this.characterFrequency.set(name, (this.characterFrequency.get(name) ?? 0) + 1)
      }
    }
  }

  /**
   * يُنشئ لقطة للقراءة فقط من الحالة الحالية.
   *
   * اللقطة نسخة مستقلة — التعديل عليها لا يؤثر على الذاكرة الأصلية.
   *
   * @returns {@link ContextMemorySnapshot}
   */
  getSnapshot(): ContextMemorySnapshot {
    return {
      recentTypes: [...this.recentTypes],
      characterFrequency: new Map(this.characterFrequency),
    }
  }
}

