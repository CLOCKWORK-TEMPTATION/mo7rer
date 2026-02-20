import type { StructurePipelinePolicy } from "@/types/structure-pipeline";
import type { ScreenplayBlock } from "./document-model";
import { buildStructuredBlocksFromText } from "./structure-pipeline";

export const plainTextToScreenplayBlocks = (
  text: string,
  policy?: Partial<StructurePipelinePolicy>
): ScreenplayBlock[] => buildStructuredBlocksFromText(text, policy).blocks;
