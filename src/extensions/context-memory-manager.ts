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
import type { ClassifiedDraft, ElementType } from "./classification-types";
import { normalizeCharacterName } from "./text-utils";
import { loadFromStorage, saveToStorage } from "../hooks/use-local-storage";
import { logger } from "../utils/logger";

export interface DialogueBlock {
  character: string;
  startLine: number;
  endLine: number;
  lineCount: number;
}

export interface LineRelation {
  previousLine: string;
  currentLine: string;
  relationType: "follows" | "precedes" | "interrupts";
}

export interface ClassificationRecord {
  line: string;
  classification: ElementType;
}

export interface ContextMemory {
  sessionId: string;
  lastModified?: number;
  data: {
    commonCharacters: string[];
    commonLocations: string[];
    lastClassifications: ElementType[];
    characterDialogueMap: Record<string, number>;
  };
}

export interface Correction {
  line: string;
  originalClassification: string;
  newClassification: string;
  timestamp: number;
}

export interface EnhancedContextMemory extends ContextMemory {
  data: ContextMemory["data"] & {
    dialogueBlocks: DialogueBlock[];
    lineRelationships: LineRelation[];
    userCorrections: Correction[];
    confidenceMap: Record<string, number>;
  };
}

export interface ContextMemorySnapshot {
  readonly recentTypes: readonly ElementType[];
  readonly characterFrequency: ReadonlyMap<string, number>;
}

const RUNTIME_SESSION_ID = "__runtime-paste-session__";
const MAX_RECENT_TYPES = 20;
const MAX_RUNTIME_RECORDS = 120;

const MEMORY_INVALID_SINGLE_TOKENS = new Set([
  "انا",
  "أنا",
  "انت",
  "إنت",
  "أنت",
  "هي",
  "هو",
  "هم",
  "هن",
]);

const isValidMemoryCharacterName = (rawName: string): boolean => {
  const normalized = normalizeCharacterName(rawName);
  if (!normalized) return false;
  if (normalized.length < 2 || normalized.length > 40) return false;
  if (/[؟!؟,،"«»]/.test(normalized)) return false;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 5) return false;
  if (tokens.length === 1 && MEMORY_INVALID_SINGLE_TOKENS.has(tokens[0]))
    return false;
  return true;
};

const detectLocalRepeatedPattern = (
  classifications: readonly string[]
): string | null => {
  if (!Array.isArray(classifications) || classifications.length < 4)
    return null;

  const detectInOrder = (ordered: readonly string[]): string | null => {
    const pairCounts = new Map<string, number>();
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const first = (ordered[i] || "").trim();
      const second = (ordered[i + 1] || "").trim();
      if (!first || !second) continue;
      const key = `${first}-${second}`;
      pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
    }

    let bestPattern: string | null = null;
    let bestCount = 0;
    pairCounts.forEach((count, pattern) => {
      if (count > bestCount) {
        bestCount = count;
        bestPattern = pattern;
      }
    });

    return bestCount >= 2 ? bestPattern : null;
  };

  return (
    detectInOrder(classifications) ||
    detectInOrder([...classifications].reverse())
  );
};

export class ContextMemoryManager {
  private storage: Map<string, EnhancedContextMemory> = new Map();
  private runtimeRecords: ClassifiedDraft[] = [];

  constructor() {
    logger.info("ContextMemoryManager initialized (enhanced).", {
      scope: "MemoryManager",
    });
  }

  async loadContext(sessionId: string): Promise<EnhancedContextMemory | null> {
    if (this.storage.has(sessionId)) {
      logger.info(`Loading context for session: ${sessionId}`, {
        scope: "MemoryManager",
      });
      return JSON.parse(JSON.stringify(this.storage.get(sessionId)!));
    }

    const loaded = this.loadFromLocalStorage(sessionId);
    if (loaded) {
      this.storage.set(sessionId, loaded);
      return loaded;
    }

    logger.debug(
      `No context found for session: ${sessionId} (سيتم إنشاء سياق جديد)`,
      {
        scope: "MemoryManager",
      }
    );
    return null;
  }

  async saveContext(
    sessionId: string,
    memory: EnhancedContextMemory | ContextMemory
  ): Promise<void> {
    logger.info(`Saving context for session: ${sessionId}`, {
      scope: "MemoryManager",
    });

    const enhanced = this.ensureEnhanced(memory);
    this.storage.set(sessionId, JSON.parse(JSON.stringify(enhanced)));
    this.saveToLocalStorage(sessionId);
  }

  async updateMemory(
    sessionId: string,
    classifications: ClassificationRecord[]
  ): Promise<void> {
    logger.info(
      `Updating memory for session ${sessionId} with ${classifications.length} records.`,
      { scope: "MemoryManager" }
    );

    const existing = await this.loadContext(sessionId);
    const memory: EnhancedContextMemory =
      existing || this.createDefaultMemory(sessionId);

    memory.lastModified = Date.now();
    memory.data.lastClassifications = classifications
      .map((record) => record.classification)
      .concat(memory.data.lastClassifications)
      .slice(0, MAX_RECENT_TYPES);

    classifications.forEach((record) => {
      if (record.classification !== "character") return;
      const characterName = normalizeCharacterName(record.line);
      if (!isValidMemoryCharacterName(characterName)) return;

      if (!memory.data.commonCharacters.includes(characterName)) {
        memory.data.commonCharacters.push(characterName);
      }

      memory.data.characterDialogueMap[characterName] =
        (memory.data.characterDialogueMap[characterName] || 0) + 1;
    });

    await this.saveContext(sessionId, memory);
  }

  saveToLocalStorage(sessionId: string): void {
    const memory = this.storage.get(sessionId);
    if (!memory) return;
    const key = `screenplay-memory-${sessionId}`;
    saveToStorage(key, memory);
  }

  loadFromLocalStorage(sessionId: string): EnhancedContextMemory | null {
    const key = `screenplay-memory-${sessionId}`;
    const parsed = loadFromStorage<EnhancedContextMemory | null>(key, null);
    if (!parsed) return null;
    return this.ensureEnhanced(parsed);
  }

  trackDialogueBlock(
    sessionId: string,
    character: string,
    startLine: number,
    endLine: number
  ): void {
    const memory = this.storage.get(sessionId);
    if (!memory) return;

    memory.data.dialogueBlocks.push({
      character,
      startLine,
      endLine,
      lineCount: endLine - startLine + 1,
    });

    if (memory.data.dialogueBlocks.length > 50) {
      memory.data.dialogueBlocks = memory.data.dialogueBlocks.slice(-50);
    }

    this.saveToLocalStorage(sessionId);
  }

  addLineRelation(sessionId: string, relation: LineRelation): void {
    const memory = this.storage.get(sessionId);
    if (!memory) return;

    memory.data.lineRelationships.push(relation);
    if (memory.data.lineRelationships.length > 200) {
      memory.data.lineRelationships = memory.data.lineRelationships.slice(-200);
    }

    this.saveToLocalStorage(sessionId);
  }

  detectPattern(sessionId: string): string | null {
    let memory = this.storage.get(sessionId);
    if (!memory) {
      const loaded = this.loadFromLocalStorage(sessionId);
      if (loaded) {
        this.storage.set(sessionId, loaded);
        memory = loaded;
      }
    }
    if (!memory) return null;

    return detectLocalRepeatedPattern(memory.data.lastClassifications);
  }

  addUserCorrection(sessionId: string, correction: Correction): void {
    const memory = this.storage.get(sessionId);
    if (!memory) return;

    memory.data.userCorrections.push(correction);
    if (memory.data.userCorrections.length > 200) {
      memory.data.userCorrections = memory.data.userCorrections.slice(-200);
    }

    this.saveToLocalStorage(sessionId);
  }

  getUserCorrections(sessionId: string): Correction[] {
    const memory = this.storage.get(sessionId);
    return memory?.data.userCorrections || [];
  }

  updateConfidence(sessionId: string, line: string, confidence: number): void {
    const memory = this.storage.get(sessionId);
    if (!memory) return;

    memory.data.confidenceMap[line] = confidence;
    this.saveToLocalStorage(sessionId);
  }

  record(entry: ClassifiedDraft): void {
    this.runtimeRecords.push(entry);
    if (this.runtimeRecords.length > MAX_RUNTIME_RECORDS) {
      this.runtimeRecords = this.runtimeRecords.slice(-MAX_RUNTIME_RECORDS);
    }

    const memory = this.getOrCreateRuntimeMemory();
    memory.lastModified = Date.now();
    this.applyRuntimeRecord(entry, memory);
  }

  replaceLast(entry: ClassifiedDraft): void {
    if (this.runtimeRecords.length === 0) {
      this.record(entry);
      return;
    }

    this.runtimeRecords[this.runtimeRecords.length - 1] = entry;
    this.rebuildRuntimeAggregates();
  }

  getSnapshot(): ContextMemorySnapshot {
    const memory = this.getOrCreateRuntimeMemory();
    const frequency = new Map<string, number>();

    Object.entries(memory.data.characterDialogueMap).forEach(
      ([name, count]) => {
        if (!Number.isFinite(count) || count <= 0) return;
        frequency.set(name, count);
      }
    );

    return {
      recentTypes: [...memory.data.lastClassifications],
      characterFrequency: frequency,
    };
  }

  private applyRuntimeRecord(
    entry: ClassifiedDraft,
    memory: EnhancedContextMemory
  ): void {
    memory.data.lastClassifications = [
      ...memory.data.lastClassifications,
      entry.type,
    ].slice(-MAX_RECENT_TYPES);

    if (entry.type !== "character") return;
    const characterName = normalizeCharacterName(entry.text);
    if (!isValidMemoryCharacterName(characterName)) return;

    if (!memory.data.commonCharacters.includes(characterName)) {
      memory.data.commonCharacters.push(characterName);
    }

    memory.data.characterDialogueMap[characterName] =
      (memory.data.characterDialogueMap[characterName] || 0) + 1;
  }

  private rebuildRuntimeAggregates(): void {
    const memory = this.getOrCreateRuntimeMemory();
    memory.lastModified = Date.now();
    memory.data.lastClassifications = this.runtimeRecords
      .slice(-MAX_RECENT_TYPES)
      .map((record) => record.type);
    memory.data.characterDialogueMap = {};
    memory.data.commonCharacters = [];

    this.runtimeRecords.forEach((record) => {
      if (record.type !== "character") return;
      const characterName = normalizeCharacterName(record.text);
      if (!isValidMemoryCharacterName(characterName)) return;

      if (!memory.data.commonCharacters.includes(characterName)) {
        memory.data.commonCharacters.push(characterName);
      }

      memory.data.characterDialogueMap[characterName] =
        (memory.data.characterDialogueMap[characterName] || 0) + 1;
    });
  }

  private getOrCreateRuntimeMemory(): EnhancedContextMemory {
    const existing = this.storage.get(RUNTIME_SESSION_ID);
    if (existing) return existing;

    const created = this.createDefaultMemory(RUNTIME_SESSION_ID);
    this.storage.set(RUNTIME_SESSION_ID, created);
    return created;
  }

  private createDefaultMemory(sessionId: string): EnhancedContextMemory {
    return {
      sessionId,
      lastModified: Date.now(),
      data: {
        commonCharacters: [],
        commonLocations: [],
        lastClassifications: [],
        characterDialogueMap: {},
        dialogueBlocks: [],
        lineRelationships: [],
        userCorrections: [],
        confidenceMap: {},
      },
    };
  }

  private ensureEnhanced(
    memory: ContextMemory | EnhancedContextMemory
  ): EnhancedContextMemory {
    const data = memory.data as EnhancedContextMemory["data"];
    return {
      ...memory,
      data: {
        ...memory.data,
        dialogueBlocks: data.dialogueBlocks || [],
        lineRelationships: data.lineRelationships || [],
        userCorrections: data.userCorrections || [],
        confidenceMap: data.confidenceMap || {},
      },
    };
  }
}
