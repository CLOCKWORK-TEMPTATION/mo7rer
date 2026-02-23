import { describe, expect, it } from "vitest";
import { PostClassificationReviewer } from "../../../src/extensions/classification-core";
import type { ClassifiedLine } from "../../../src/extensions/classification-types";

const line = (
  lineIndex: number,
  text: string,
  assignedType: ClassifiedLine["assignedType"],
  classificationMethod: ClassifiedLine["classificationMethod"],
  originalConfidence: number
): ClassifiedLine => ({
  lineIndex,
  text,
  assignedType,
  classificationMethod,
  originalConfidence,
});

describe("classification-core scoring", () => {
  it("routes mixed dialogue/action to agent candidate or forced", () => {
    const reviewer = new PostClassificationReviewer();
    const packet = reviewer.review([
      line(
        0,
        "- ثم يخرج ورقة مكتوب عليها عنوان",
        "dialogue",
        "context",
        78
      ),
    ]);

    expect(packet.totalSuspicious).toBeGreaterThan(0);
    const suspicious = packet.suspiciousLines[0];

    expect(["agent-candidate", "agent-forced"]).toContain(
      suspicious.routingBand
    );
    expect(suspicious.criticalMismatch).toBe(true);
    expect(suspicious.escalationScore).toBeGreaterThanOrEqual(80);
    expect(suspicious.breakdown.detectorBase).toBeGreaterThan(0);
  });

  it("keeps clean dialogue out of suspicious packet", () => {
    const reviewer = new PostClassificationReviewer();
    const packet = reviewer.review([
      line(0, "مرحبا يا صاحبي", "dialogue", "regex", 96),
    ]);

    expect(packet.totalSuspicious).toBe(0);
    expect(packet.suspiciousLines).toHaveLength(0);
  });

  it("routes medium-risk mismatch to local-review", () => {
    const reviewer = new PostClassificationReviewer();
    const packet = reviewer.review([
      line(0, "أنا هنا", "parenthetical", "context", 82),
    ]);

    expect(packet.totalSuspicious).toBe(1);
    expect(packet.suspiciousLines[0].routingBand).toBe("local-review");
    expect(packet.suspiciousLines[0].escalationScore).toBeGreaterThanOrEqual(65);
    expect(packet.suspiciousLines[0].escalationScore).toBeLessThan(80);
  });
});
