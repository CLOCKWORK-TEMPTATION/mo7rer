import { describe, expect, it } from "vitest";
import { PostClassificationReviewer } from "../../../src/extensions/classification-core";
import { classifyText } from "../../../src/extensions/paste-classifier";
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
  it("routes embedded dialogue/action mix to agent candidate or forced", () => {
    const reviewer = new PostClassificationReviewer();
    const packet = reviewer.review([
      line(
        0,
        "شهلي يا ختي ... مش الوكالة اللي جابهالك ابوكي دي .. انتوا تتاخروا على مزاجكوا لكن انا لو اتأخرت ساعة ع الشهرية ... اطلع من البلد ثم يخرج ورقه مكتوب عليها عنوان",
        "dialogue",
        "regex",
        95
      ),
    ]);

    expect(packet.totalSuspicious).toBeGreaterThan(0);
    const suspicious = packet.suspiciousLines[0];

    expect(["agent-candidate", "agent-forced"]).toContain(
      suspicious.routingBand
    );
    expect(suspicious.criticalMismatch).toBe(true);
    expect(suspicious.escalationScore).toBeGreaterThanOrEqual(80);
    expect(suspicious.findings[0]?.detectorId).toBe("content-type-mismatch");
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

  it("detects 'وبعدين' connector with action verb in dialogue", () => {
    const reviewer = new PostClassificationReviewer();
    const packet = reviewer.review([
      line(
        0,
        "انا مش هسيبك تعمل كده وبعدين يمسك ايده ويشده لبره",
        "dialogue",
        "regex",
        93
      ),
    ]);

    expect(packet.totalSuspicious).toBeGreaterThan(0);
    const suspicious = packet.suspiciousLines[0];
    expect(suspicious.criticalMismatch).toBe(true);
    expect(suspicious.findings[0]?.detectorId).toBe("content-type-mismatch");
  });

  it("detects 'فجأة' connector with action verb in dialogue", () => {
    const reviewer = new PostClassificationReviewer();
    const packet = reviewer.review([
      line(
        0,
        "ما تقلقش كل حاجة هتبقى كويسة فجأة يقلب الترابيزة",
        "dialogue",
        "context",
        80
      ),
    ]);

    expect(packet.totalSuspicious).toBeGreaterThan(0);
    const suspicious = packet.suspiciousLines[0];
    expect(suspicious.criticalMismatch).toBe(true);
  });

  it("does not flag pure dialogue without action connectors", () => {
    const reviewer = new PostClassificationReviewer();
    const packet = reviewer.review([
      line(
        0,
        "انا رايح السوق عشان اشتري حاجات ثم ارجع البيت",
        "dialogue",
        "regex",
        95
      ),
    ]);

    // "ارجع" doesn't start with [يتنأ] and is not in FULL_ACTION_VERB_SET
    // so this should NOT be flagged as embedded narrative action
    const embeddedFindings = packet.suspiciousLines.filter((s) =>
      s.findings.some(
        (f) => f.detectorId === "content-type-mismatch" && f.suspicionScore >= 96
      )
    );
    expect(embeddedFindings).toHaveLength(0);
  });

  it("integration: classifyLines → review detects embedded narrative in real classification", () => {
    const text =
      "شهلي يا ختي ... مش الوكالة اللي جابهالك ابوكي دي .. انتوا تتاخروا على مزاجكوا لكن انا لو اتأخرت ساعة ع الشهرية ... اطلع من البلد ثم يخرج ورقه مكتوب عليها عنوان";

    const classified = classifyText(text);
    expect(classified.length).toBeGreaterThan(0);

    const reviewInput: ClassifiedLine[] = classified.map((item, index) => ({
      lineIndex: index,
      text: item.text,
      assignedType: item.type,
      originalConfidence: item.confidence,
      classificationMethod: item.classificationMethod,
    }));

    const reviewer = new PostClassificationReviewer();
    const packet = reviewer.review(reviewInput);

    const classifiedAsAction = classified.some((item) => item.type === "action");

    const embeddedFindings = packet.suspiciousLines.filter((s) =>
      s.findings.some(
        (f) =>
          f.detectorId === "content-type-mismatch" &&
          f.suspicionScore >= 96
      )
    );

    // Accept either path:
    // 1) classifier already corrected to action, or
    // 2) reviewer flags the line as embedded narrative mismatch.
    expect(classifiedAsAction || embeddedFindings.length > 0).toBe(true);
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
