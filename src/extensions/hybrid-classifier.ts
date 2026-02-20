import { isBasmalaLine } from './basmala'
import type { ClassificationContext, ClassificationMethod, ElementType } from './classification-types'
import type { ContextMemorySnapshot } from './context-memory-manager'
import { isCompleteSceneHeaderLine } from './scene-header-top-line'
import { isTransitionLine } from './transition'
import { normalizeCharacterName } from './text-utils'

export interface HybridResult {
  readonly type: ElementType
  readonly confidence: number
  readonly classificationMethod: ClassificationMethod
}

/**
 * مصنف هجين خفيف: regex قوي + سياق + ذاكرة قصيرة.
 * الهدف تحسين الحالات الرمادية بدون تبعيات خارجية.
 */
export class HybridClassifier {
  classifyLine(
    line: string,
    fallbackType: ElementType,
    context: ClassificationContext,
    memory: ContextMemorySnapshot
  ): HybridResult {
    if (isBasmalaLine(line)) {
      return { type: 'basmala', confidence: 99, classificationMethod: 'regex' }
    }

    if (isCompleteSceneHeaderLine(line)) {
      return { type: 'sceneHeaderTopLine', confidence: 96, classificationMethod: 'regex' }
    }

    if (isTransitionLine(line)) {
      return { type: 'transition', confidence: 95, classificationMethod: 'regex' }
    }

    if (fallbackType === 'character') {
      const characterName = normalizeCharacterName(line)
      const seenCount = memory.characterFrequency.get(characterName) ?? 0
      if (seenCount >= 1) {
        return { type: 'character', confidence: 92, classificationMethod: 'context' }
      }
    }

    const recentPattern = memory.recentTypes.slice(-3).join('-')
    if (
      recentPattern === 'dialogue-dialogue-dialogue' &&
      context.previousType === 'dialogue' &&
      fallbackType !== 'action'
    ) {
      return { type: 'dialogue', confidence: 86, classificationMethod: 'context' }
    }

    if (
      recentPattern === 'action-action-action' &&
      context.previousType === 'action' &&
      fallbackType !== 'dialogue'
    ) {
      return { type: 'action', confidence: 85, classificationMethod: 'context' }
    }

    return { type: fallbackType, confidence: 80, classificationMethod: 'context' }
  }
}

