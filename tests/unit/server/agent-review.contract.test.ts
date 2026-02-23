const createSuspiciousLine = (
  itemIndex: number,
  routingBand: "agent-candidate" | "agent-forced" = "agent-candidate",
  assignedType = "dialogue"
) => ({
  itemIndex,
  lineIndex: itemIndex,
  text: `line-${itemIndex}`,
  assignedType,
  totalSuspicion: 90,
  reasons: ["test reason"],
  contextLines: [],
  escalationScore: routingBand === "agent-forced" ? 92 : 84,
  routingBand,
  criticalMismatch: routingBand === "agent-forced",
  distinctDetectors: routingBand === "agent-forced" ? 2 : 1,
});

describe("agent-review contract", () => {
  it("fills required/forced indexes from suspicious lines when omitted", async () => {
    const { validateAgentReviewRequestBody } = await import(
      "../../../server/agent-review.mjs"
    );

    const payload = validateAgentReviewRequestBody({
      sessionId: "s-1",
      totalReviewed: 2,
      suspiciousLines: [
        createSuspiciousLine(0, "agent-candidate"),
        createSuspiciousLine(1, "agent-forced"),
      ],
    });

    expect(payload.requiredItemIndexes).toEqual([0, 1]);
    expect(payload.forcedItemIndexes).toEqual([1]);
  });

  it("rejects forced indexes outside required indexes", async () => {
    const { validateAgentReviewRequestBody } = await import(
      "../../../server/agent-review.mjs"
    );

    expect(() =>
      validateAgentReviewRequestBody({
        sessionId: "s-2",
        totalReviewed: 2,
        suspiciousLines: [
          createSuspiciousLine(0, "agent-candidate"),
          createSuspiciousLine(1, "agent-forced"),
        ],
        requiredItemIndexes: [0],
        forcedItemIndexes: [1],
      })
    ).toThrow(/forcedItemIndexes must be subset of requiredItemIndexes/i);
  });

  it("returns error with unresolved forced lines when ANTHROPIC_API_KEY is missing", async () => {
    const { reviewSuspiciousLinesWithClaude } = await import(
      "../../../server/agent-review.mjs"
    );

    const previousKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const response = await reviewSuspiciousLinesWithClaude({
        sessionId: "s-3",
        totalReviewed: 2,
        suspiciousLines: [
          createSuspiciousLine(0, "agent-candidate"),
          createSuspiciousLine(1, "agent-forced"),
        ],
        requiredItemIndexes: [0, 1],
        forcedItemIndexes: [1],
      });

      expect(response.status).toBe("error");
      expect(response.meta?.requestedCount).toBe(2);
      expect(response.meta?.missingItemIndexes).toEqual([0, 1]);
      expect(response.meta?.unresolvedForcedItemIndexes).toEqual([1]);
    } finally {
      if (previousKey) {
        process.env.ANTHROPIC_API_KEY = previousKey;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    }
  });

  it("returns warning (not error) when no forced lines exist and key is missing", async () => {
    const { reviewSuspiciousLinesWithClaude } = await import(
      "../../../server/agent-review.mjs"
    );

    const previousKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const response = await reviewSuspiciousLinesWithClaude({
        sessionId: "s-4",
        totalReviewed: 1,
        suspiciousLines: [createSuspiciousLine(0, "agent-candidate")],
        requiredItemIndexes: [0],
        forcedItemIndexes: [],
      });

      expect(response.status).toBe("warning");
      expect(response.meta?.requestedCount).toBe(1);
      expect(response.meta?.missingItemIndexes).toEqual([0]);
      expect(response.meta?.unresolvedForcedItemIndexes).toEqual([]);
    } finally {
      if (previousKey) {
        process.env.ANTHROPIC_API_KEY = previousKey;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    }
  });
});
