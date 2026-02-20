import type { ClassifiedDraft, ElementType } from './classification-types'
import { normalizeCharacterName } from './text-utils'

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

  getSnapshot(): ContextMemorySnapshot {
    return {
      recentTypes: [...this.recentTypes],
      characterFrequency: new Map(this.characterFrequency),
    }
  }
}

