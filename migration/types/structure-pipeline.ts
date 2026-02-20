/**
 * @fileoverview structure-pipeline.ts - أنواع بيانات معالجة البنية (Structure Pipeline)
 * 
 * @description
 * بيحدد الـ types الخاصة بـ "Structure Pipeline" - النظام اللي بيعالج النص الخام
 * ويحوله لـ ScreenplayBlock منظمة. البipeline ده بيمر بالخطوات:
 * 1. Normalization (تطبيع النص)
 * 2. Classification (تصنيف الأسطر)
 * 3. Merging (دمج الأسطر المتشابهة)
 * 4. Projection Guard (حماية من التغييرات الجذرية)
 * 
 * @key_types
 * - StructurePipelineMergePolicy: سياسة الدمج (none, safe, aggressive)
 * - StructurePipelineClassifierRole: دور المصنف (label-only, limited-rewrite)
 * - StructurePipelineProfile: الملف العام (strict-structure, interactive-legacy)
 * - StructurePipelinePolicy: السياسة الكاملة
 * - StructurePipelineResult: نتيجة الـ pipeline
 * - ProjectionGuardReport: تقرير الحماية
 * 
 * @constants
 * - DEFAULT_STRUCTURE_PIPELINE_POLICY: السياسة الافتراضية
 * 
 * @usage
 * import { StructurePipelinePolicy, DEFAULT_STRUCTURE_PIPELINE_POLICY } from "@/types/structure-pipeline";
 * 
 * @author أفان تيتر
 * @version 1.0.0
 */

import type { ScreenplayBlock } from "@/utils/document-model";

export type StructurePipelineMergePolicy = "none" | "safe" | "aggressive";

export type StructurePipelineClassifierRole = "label-only" | "limited-rewrite";

export type StructurePipelineProfile = "strict-structure" | "interactive-legacy";

export interface StructurePipelinePolicy {
  mergePolicy: StructurePipelineMergePolicy;
  classifierRole: StructurePipelineClassifierRole;
}

export interface StructurePipelineResult {
  normalizedText: string;
  normalizedLines: string[];
  blocks: ScreenplayBlock[];
  policy: StructurePipelinePolicy;
}

export interface ProjectionGuardReport {
  accepted: boolean;
  reasons: string[];
  inputLineCount: number;
  outputBlockCount: number;
  currentBlockCount?: number;
  currentNonActionCount?: number;
  outputNonActionCount: number;
  fallbackApplied: boolean;
}

export const DEFAULT_STRUCTURE_PIPELINE_POLICY: StructurePipelinePolicy = {
  mergePolicy: "none",
  classifierRole: "label-only",
};
