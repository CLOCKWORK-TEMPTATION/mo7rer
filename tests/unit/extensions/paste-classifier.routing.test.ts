import { describe, expect, it } from "vitest";
import { selectSuspiciousLinesForAgent } from "../../../src/extensions/paste-classifier";
import type {
  ClassifiedLine,
  LLMReviewPacket,
  SuspiciousLine,
} from "../../../src/extensions/classification-types";

const makeClassified = (lineIndex: number): ClassifiedLine => ({
  lineIndex,
  text: `line-${lineIndex}`,
  assignedType: "dialogue",
  originalConfidence: 74,
  classificationMethod: "context",
});

const makeSuspicious = (
  lineIndex: number,
  routingBand: SuspiciousLine["routingBand"],
  escalationScore: number,
  criticalMismatch: boolean,
  distinctDetectors: number
): SuspiciousLine => ({
  line: makeClassified(lineIndex),
  totalSuspicion: 80,
  findings: [
    {
      detectorId: "content-type-mismatch",
      suspicionScore: 80,
      reason: "mismatch",
      suggestedType: "action",
    },
  ],
  contextLines: [makeClassified(lineIndex)],
  routingBand,
  escalationScore,
  distinctDetectors,
  criticalMismatch,
  breakdown: {
    detectorBase: 80,
    methodPenalty: 8,
    confidencePenalty: 4,
    evidenceDiversityBoost: 5,
    suggestionBoost: 6,
    criticalMismatchBoost: criticalMismatch ? 10 : 0,
  },
});

describe("paste-classifier agent routing", () => {
  it("applies routing rules then aggressive cap (18%)", () => {
    const packet: LLMReviewPacket = {
      totalReviewed: 10,
      totalSuspicious: 5,
      suspicionRate: 0.5,
      suspiciousLines: [
        makeSuspicious(0, "agent-forced", 95, false, 1),
        makeSuspicious(1, "agent-candidate", 94, true, 1),
        makeSuspicious(2, "agent-candidate", 92, false, 2),
        makeSuspicious(3, "agent-candidate", 91, false, 1),
        makeSuspicious(4, "local-review", 75, true, 1),
      ],
    };

    const selected = selectSuspiciousLinesForAgent(packet);

    expect(selected).toHaveLength(2); // ceil(10 * 0.18) = 2
    expect(selected.map((line) => line.line.lineIndex)).toEqual([0, 1]);
  });

  it("returns empty when no line is eligible for agent", () => {
    const packet: LLMReviewPacket = {
      totalReviewed: 12,
      totalSuspicious: 2,
      suspicionRate: 2 / 12,
      suspiciousLines: [
        makeSuspicious(0, "local-review", 70, true, 1),
        makeSuspicious(1, "agent-candidate", 84, false, 1),
      ],
    };

    expect(selectSuspiciousLinesForAgent(packet)).toEqual([]);
  });

  it("agent-forced lines always take priority over agent-candidate", () => {
    const packet: LLMReviewPacket = {
      totalReviewed: 10,
      totalSuspicious: 3,
      suspicionRate: 0.3,
      suspiciousLines: [
        makeSuspicious(0, "agent-candidate", 89, true, 2),
        makeSuspicious(1, "agent-forced", 90, true, 1),
        makeSuspicious(2, "agent-candidate", 88, true, 1),
      ],
    };

    const selected = selectSuspiciousLinesForAgent(packet);
    // ceil(10 * 0.18) = 2, forced first
    expect(selected[0].line.lineIndex).toBe(1);
    expect(selected[0].routingBand).toBe("agent-forced");
  });
});
