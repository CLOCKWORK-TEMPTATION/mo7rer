import type {
  ClassificationMethod,
  ClassifiedLine,
  DetectorFinding,
  ElementType,
  LLMReviewPacket,
  SuspicionRoutingBand,
  SuspicionScoreBreakdown,
  SuspiciousLine,
} from "./classification-types";
import {
  hasActionVerbStructure,
  isActionCueLine,
  isActionVerbStart,
  matchesActionStartPattern,
  startsWithBullet,
} from "./text-utils";
import {
  CONVERSATIONAL_MARKERS_RE,
  FULL_ACTION_VERB_SET,
  PRONOUN_ACTION_RE,
  VOCATIVE_RE,
} from "./arabic-patterns";
import {
  CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY,
  CLASSIFICATION_VALID_SEQUENCES,
  suggestTypeFromClassificationSequence,
} from "./classification-sequence-rules";

export interface ReviewerConfig {
  readonly contextRadius: number;
  readonly passBandUpperBound: number;
  readonly localReviewUpperBound: number;
  readonly agentForcedLowerBound: number;
  readonly enabledDetectors: ReadonlySet<string>;
}

const DEFAULT_CONFIG: ReviewerConfig = {
  contextRadius: 5,
  passBandUpperBound: 65,
  localReviewUpperBound: 80,
  agentForcedLowerBound: 90,
  enabledDetectors: new Set([
    "sequence-violation",
    "content-type-mismatch",
    "split-character-fragment",
    "statistical-anomaly",
    "confidence-drop",
  ]),
};

interface TextFeatures {
  readonly wordCount: number;
  readonly startsWithDash: boolean;
  readonly startsWithBullet: boolean;
  readonly isParenthetical: boolean;
  readonly hasActionIndicators: boolean;
  readonly hasPunctuation: boolean;
  readonly endsWithColon: boolean;
  readonly isEmpty: boolean;
  readonly normalized: string;
}

const extractTextFeatures = (text: string): TextFeatures => {
  const normalized = text.replace(/[\u200f\u200e\ufeff]/g, "").trim();
  const words = normalized.split(/\s+/).filter(Boolean);

  return {
    wordCount: words.length,
    startsWithDash: /^[-–—]/.test(normalized),
    startsWithBullet: startsWithBullet(normalized),
    isParenthetical: /^\s*[\(（].*[\)）]\s*$/.test(normalized),
    hasActionIndicators: detectActionIndicators(normalized),
    hasPunctuation: /[.!?؟،,؛:;"'«»]/.test(normalized),
    endsWithColon: /[:：]\s*$/.test(normalized),
    isEmpty: normalized.length === 0,
    normalized,
  };
};

const detectActionIndicators = (text: string): boolean => {
  if (!text) return false;
  if (/^[-–—]/.test(text)) return true;
  if (startsWithBullet(text)) return true;

  return (
    isActionCueLine(text) ||
    matchesActionStartPattern(text) ||
    isActionVerbStart(text) ||
    hasActionVerbStructure(text) ||
    PRONOUN_ACTION_RE.test(text)
  );
};

const hasHighConfidenceActionSignal = (text: string): boolean => {
  if (!text) return false;
  if (/^[-–—]/.test(text)) return true;
  if (startsWithBullet(text)) return true;

  return (
    isActionCueLine(text) ||
    matchesActionStartPattern(text) ||
    isActionVerbStart(text) ||
    hasActionVerbStructure(text)
  );
};

const CONNECTOR_THEN_ACTION_RE =
  /(?:^|[\s،,؛:.!?؟…])ثم\s+([يتنأ][\u0600-\u06FF]{2,})(?=$|[\s،,؛:.!?؟…])/;
const ARABIC_EDGE_CLEAN_RE = /(^[^\u0600-\u06FF]+)|([^\u0600-\u06FF]+$)/g;
const ACTION_VERB_LIKE_RE = /^(?:[وف]?)[يتنأ][\u0600-\u06FF]{2,}$/;
const DIALOGUE_ACTION_CONNECTORS = new Set([
  "ثم",
  "وبعدين",
  "بعدها",
  "عندها",
  "فجأة",
]);

const cleanArabicToken = (token: string): string =>
  (token ?? "").replace(ARABIC_EDGE_CLEAN_RE, "").trim();

const hasEmbeddedNarrativeActionInDialogue = (text: string): boolean => {
  const normalized = (text ?? "").replace(/[\u200f\u200e\ufeff]/g, "").trim();
  if (!normalized) return false;

  const thenMatch = normalized.match(CONNECTOR_THEN_ACTION_RE);
  if (thenMatch?.[1]) {
    const verbToken = cleanArabicToken(thenMatch[1]);
    if (verbToken && (FULL_ACTION_VERB_SET.has(verbToken) || ACTION_VERB_LIKE_RE.test(verbToken))) {
      return true;
    }
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length < 4) return false;

  for (let index = 1; index < tokens.length - 1; index += 1) {
    const connector = cleanArabicToken(tokens[index]);
    if (!DIALOGUE_ACTION_CONNECTORS.has(connector)) {
      continue;
    }

    const nextToken = cleanArabicToken(tokens[index + 1]);
    if (!nextToken) continue;
    if (FULL_ACTION_VERB_SET.has(nextToken) || ACTION_VERB_LIKE_RE.test(nextToken)) {
      return true;
    }
  }

  return false;
};

const normalizeNameFragment = (text: string): string =>
  (text ?? "")
    .replace(/[\u200f\u200e\ufeff]/g, "")
    .replace(/[:：]/g, "")
    .trim();

const isLikelyCharacterFragment = (
  text: string,
  limits: { minChars: number; maxChars: number; maxWords: number }
): boolean => {
  const normalized = normalizeNameFragment(text);
  if (!normalized) return false;
  if (
    normalized.length < limits.minChars ||
    normalized.length > limits.maxChars
  )
    return false;
  if (/[.!?؟،,؛;"'«»()\[\]{}]/.test(normalized)) return false;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > limits.maxWords) return false;

  return tokens.every((token) => /^[\u0600-\u06FF0-9٠-٩]+$/.test(token));
};

const hasStrongNarrativeActionSignal = (text: string): boolean => {
  const normalized = (text ?? "").trim();
  if (!normalized) return false;
  if (/^[-–—]/.test(normalized) || startsWithBullet(normalized)) return true;

  return (
    isActionCueLine(normalized) ||
    matchesActionStartPattern(normalized) ||
    isActionVerbStart(normalized) ||
    hasActionVerbStructure(normalized) ||
    PRONOUN_ACTION_RE.test(normalized)
  );
};

interface SuspicionDetector {
  readonly id: string;
  detect(
    line: ClassifiedLine,
    features: TextFeatures,
    context: readonly ClassifiedLine[],
    linePosition: number
  ): DetectorFinding | null;
}

const createSequenceViolationDetector = (): SuspicionDetector => ({
  id: "sequence-violation",

  detect(
    line: ClassifiedLine,
    features: TextFeatures,
    context: readonly ClassifiedLine[],
    linePosition: number
  ): DetectorFinding | null {
    if (linePosition === 0) return null;

    const prevLine = context[linePosition - 1];
    if (!prevLine) return null;

    const prevType = prevLine.assignedType;
    const currentType = line.assignedType;

    const allowedNext = CLASSIFICATION_VALID_SEQUENCES.get(prevType);
    if (!allowedNext) return null;
    if (allowedNext.has(currentType)) return null;

    const violationKey = `${prevType}→${currentType}`;
    const severity =
      CLASSIFICATION_SEQUENCE_VIOLATION_SEVERITY.get(violationKey) ?? 65;

    const suggestedType = suggestTypeFromClassificationSequence(prevType, {
      wordCount: features.wordCount,
      startsWithDash: features.startsWithDash,
      isParenthetical: features.isParenthetical,
      hasActionIndicators: features.hasActionIndicators,
      hasPunctuation: features.hasPunctuation,
      endsWithColon: features.endsWithColon,
    });

    return {
      detectorId: "sequence-violation",
      suspicionScore: severity,
      reason: `انتهاك تسلسل: "${currentType}" بعد "${prevType}" غير متوقع`,
      suggestedType,
    };
  },
});

const createContentTypeMismatchDetector = (): SuspicionDetector => ({
  id: "content-type-mismatch",

  detect(line: ClassifiedLine, features: TextFeatures): DetectorFinding | null {
    if (features.isEmpty) return null;

    const type = line.assignedType;

    if (type === "character") {
      if (features.wordCount > 5) {
        return {
          detectorId: "content-type-mismatch",
          suspicionScore: 80,
          reason: `مصنّف "character" لكنه ${features.wordCount} كلمات - طويل جداً لاسم شخصية`,
          suggestedType: features.hasActionIndicators ? "action" : "dialogue",
        };
      }

      if (/[.!?؟]$/.test(features.normalized)) {
        return {
          detectorId: "content-type-mismatch",
          suspicionScore: 75,
          reason: 'مصنّف "character" لكنه ينتهي بعلامة ترقيم جملة',
          suggestedType: "dialogue",
        };
      }
    }

    if (type === "dialogue") {
      if (hasEmbeddedNarrativeActionInDialogue(features.normalized)) {
        return {
          detectorId: "content-type-mismatch",
          suspicionScore: 96,
          reason:
            'مصنّف "dialogue" لكن السطر حوار مختلط بوصف/حدث سردي داخل نفس الجملة',
          suggestedType: "action",
        };
      }

      if (hasHighConfidenceActionSignal(features.normalized)) {
        return {
          detectorId: "content-type-mismatch",
          suspicionScore: 82,
          reason: 'مصنّف "dialogue" لكنه يحتوي مؤشرات وصف مشهد',
          suggestedType: "action",
        };
      }

      if (features.isParenthetical) {
        return {
          detectorId: "content-type-mismatch",
          suspicionScore: 88,
          reason: 'مصنّف "dialogue" لكنه محاط بأقواس بالكامل → إرشاد مسرحي',
          suggestedType: "parenthetical",
        };
      }
    }

    if (type === "action" && features.wordCount >= 8) {
      const hasDialogueSignals =
        VOCATIVE_RE.test(features.normalized) ||
        CONVERSATIONAL_MARKERS_RE.test(features.normalized);
      if (
        hasDialogueSignals &&
        hasEmbeddedNarrativeActionInDialogue(features.normalized)
      ) {
        return {
          detectorId: "content-type-mismatch",
          suspicionScore: 96,
          reason:
            'مصنّف "action" لكن يحتوي مؤشرات حوار مع وصف سردي مدمج → حوار مختلط بوصف',
          suggestedType: "dialogue",
        };
      }
    }

    if (
      type === "action" &&
      features.endsWithColon &&
      features.wordCount <= 3
    ) {
      return {
        detectorId: "content-type-mismatch",
        suspicionScore: 78,
        reason: 'مصنّف "action" لكنه ينتهي بنقطتين وقصير → أرجح اسم شخصية',
        suggestedType: "character",
      };
    }

    if (type === "parenthetical") {
      if (
        !features.isParenthetical &&
        !features.normalized.includes("(") &&
        !features.normalized.includes("（")
      ) {
        return {
          detectorId: "content-type-mismatch",
          suspicionScore: 72,
          reason: 'مصنّف "parenthetical" لكن لا يحتوي أقواس',
          suggestedType: "dialogue",
        };
      }
    }

    if (type === "transition" && features.wordCount > 6) {
      return {
        detectorId: "content-type-mismatch",
        suspicionScore: 70,
        reason: `مصنّف "transition" لكنه ${features.wordCount} كلمات - طويل جداً للانتقال`,
        suggestedType: "action",
      };
    }

    return null;
  },
});

const createSplitCharacterFragmentDetector = (): SuspicionDetector => ({
  id: "split-character-fragment",

  detect(
    line: ClassifiedLine,
    features: TextFeatures,
    context: readonly ClassifiedLine[],
    linePosition: number
  ): DetectorFinding | null {
    if (features.isEmpty) return null;
    if (line.assignedType !== "action") return null;
    if (features.wordCount > 2) return null;

    const currentText = normalizeNameFragment(line.text);
    if (
      !isLikelyCharacterFragment(currentText, {
        minChars: 2,
        maxChars: 14,
        maxWords: 2,
      })
    ) {
      return null;
    }

    if (hasStrongNarrativeActionSignal(features.normalized)) return null;

    const nextLine = context[linePosition + 1];
    if (!nextLine || nextLine.assignedType !== "character") return null;

    const nextFeatures = extractTextFeatures(nextLine.text);
    if (!nextFeatures.endsWithColon) return null;

    const nextText = normalizeNameFragment(nextLine.text);
    if (
      !isLikelyCharacterFragment(nextText, {
        minChars: 1,
        maxChars: 4,
        maxWords: 1,
      })
    ) {
      return null;
    }

    const mergedDirect = `${currentText}${nextText}`;
    const mergedWithSpace = `${currentText} ${nextText}`;

    const mergedLooksLikeName =
      isLikelyCharacterFragment(mergedDirect, {
        minChars: 3,
        maxChars: 32,
        maxWords: 3,
      }) ||
      isLikelyCharacterFragment(mergedWithSpace, {
        minChars: 3,
        maxChars: 32,
        maxWords: 3,
      });

    if (!mergedLooksLikeName) return null;

    return {
      detectorId: "split-character-fragment",
      suspicionScore: 92,
      reason: `اشتباه تجزئة اسم شخصية بين سطرين: "${currentText}" + "${nextText}"`,
      suggestedType: null,
    };
  },
});

const TYPE_STATISTICS: ReadonlyMap<
  ElementType,
  { minWords: number; maxWords: number }
> = new Map([
  ["character", { minWords: 1, maxWords: 4 }],
  ["parenthetical", { minWords: 1, maxWords: 12 }],
  ["transition", { minWords: 1, maxWords: 5 }],
  ["dialogue", { minWords: 1, maxWords: 140 }],
  ["action", { minWords: 2, maxWords: 240 }],
  ["sceneHeaderTopLine", { minWords: 1, maxWords: 10 }],
  ["sceneHeader3", { minWords: 2, maxWords: 15 }],
  ["basmala", { minWords: 1, maxWords: 6 }],
]);

const createStatisticalAnomalyDetector = (): SuspicionDetector => ({
  id: "statistical-anomaly",

  detect(line: ClassifiedLine, features: TextFeatures): DetectorFinding | null {
    if (features.isEmpty) return null;

    const stats = TYPE_STATISTICS.get(line.assignedType);
    if (!stats) return null;

    if (features.wordCount > stats.maxWords) {
      const excess = features.wordCount - stats.maxWords;
      const score = Math.min(60 + excess * 3, 90);
      return {
        detectorId: "statistical-anomaly",
        suspicionScore: score,
        reason: `"${line.assignedType}" بطول ${features.wordCount} كلمة يتجاوز الحد الأقصى الطبيعي (${stats.maxWords})`,
        suggestedType: null,
      };
    }

    if (line.assignedType === "action" && features.wordCount < stats.minWords) {
      return {
        detectorId: "statistical-anomaly",
        suspicionScore: 55,
        reason: '"action" بكلمة واحدة فقط - قصير جداً لوصف مشهد',
        suggestedType: "character",
      };
    }

    return null;
  },
});

const createConfidenceDropDetector = (): SuspicionDetector => ({
  id: "confidence-drop",

  detect(line: ClassifiedLine): DetectorFinding | null {
    if (
      line.classificationMethod === "regex" &&
      line.originalConfidence >= 90
    ) {
      return null;
    }

    if (
      line.classificationMethod === "fallback" &&
      line.originalConfidence < 60
    ) {
      return {
        detectorId: "confidence-drop",
        suspicionScore: 50,
        reason: `تصنيف بطريقة fallback بثقة ${line.originalConfidence}% فقط`,
        suggestedType: null,
      };
    }

    if (line.originalConfidence < 45) {
      return {
        detectorId: "confidence-drop",
        suspicionScore: 55,
        reason: `ثقة التصنيف الأصلي منخفضة جداً: ${line.originalConfidence}%`,
        suggestedType: null,
      };
    }

    return null;
  },
});

const calculateTotalSuspicion = (
  findings: readonly DetectorFinding[]
): number => {
  if (findings.length === 0) return 0;
  if (findings.length === 1) return findings[0].suspicionScore;

  const sorted = [...findings].sort(
    (a, b) => b.suspicionScore - a.suspicionScore
  );
  const primary = sorted[0].suspicionScore;
  const secondary = sorted
    .slice(1)
    .reduce((sum, finding) => sum + finding.suspicionScore, 0);

  return Math.min(Math.round(primary + secondary * 0.3), 99);
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const computeMethodPenalty = (
  method: ClassificationMethod,
  confidence: number
): number => {
  if (method === "regex") {
    return confidence >= 92 ? 0 : 4;
  }
  if (method === "context") return 8;
  if (method === "fallback") return 14;
  return 6;
};

const computeConfidencePenalty = (originalConfidence: number): number =>
  clamp((82 - originalConfidence) * 0.5, 0, 12);

const computeDiversityBoost = (distinctDetectors: number): number =>
  clamp((distinctDetectors - 1) * 5, 0, 10);

const hasSuggestedType = (findings: readonly DetectorFinding[]): boolean =>
  findings.some((finding) => finding.suggestedType !== null);

const isCriticalMismatchFromFindings = (
  findings: readonly DetectorFinding[]
): boolean =>
  findings.some(
    (finding) =>
      (finding.detectorId === "content-type-mismatch" &&
        finding.suggestedType !== null) ||
      finding.detectorId === "split-character-fragment"
  );

const computeEscalationScore = (
  line: ClassifiedLine,
  findings: readonly DetectorFinding[],
  totalSuspicion: number
): { score: number; breakdown: SuspicionScoreBreakdown } => {
  const distinctDetectors = new Set(findings.map((finding) => finding.detectorId))
    .size;
  const criticalMismatch = isCriticalMismatchFromFindings(findings);
  const breakdown: SuspicionScoreBreakdown = {
    detectorBase: totalSuspicion,
    methodPenalty: computeMethodPenalty(
      line.classificationMethod,
      line.originalConfidence
    ),
    confidencePenalty: computeConfidencePenalty(line.originalConfidence),
    evidenceDiversityBoost: computeDiversityBoost(distinctDetectors),
    suggestionBoost: hasSuggestedType(findings) ? 6 : 0,
    criticalMismatchBoost: criticalMismatch ? 10 : 0,
  };
  const weightedScore =
    breakdown.detectorBase * 0.72 +
    breakdown.methodPenalty +
    breakdown.confidencePenalty +
    breakdown.evidenceDiversityBoost +
    breakdown.suggestionBoost +
    breakdown.criticalMismatchBoost;

  return {
    score: clamp(Math.round(weightedScore), 0, 99),
    breakdown,
  };
};

const extractContextWindow = (
  lines: readonly ClassifiedLine[],
  centerIndex: number,
  radius: number
): readonly ClassifiedLine[] => {
  const start = Math.max(0, centerIndex - radius);
  const end = Math.min(lines.length, centerIndex + radius + 1);
  return lines.slice(start, end);
};

export class PostClassificationReviewer {
  private readonly config: ReviewerConfig;
  private readonly detectors: readonly SuspicionDetector[];

  constructor(config?: Partial<ReviewerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.detectors = this.initializeDetectors();
  }

  private routeSuspicionBand(score: number): SuspicionRoutingBand {
    if (score < this.config.passBandUpperBound) return "pass";
    if (score < this.config.localReviewUpperBound) return "local-review";
    if (score < this.config.agentForcedLowerBound) return "agent-candidate";
    return "agent-forced";
  }

  private buildSuspicionRecord(
    line: ClassifiedLine,
    findings: readonly DetectorFinding[],
    context: readonly ClassifiedLine[]
  ): SuspiciousLine | null {
    const totalSuspicion = calculateTotalSuspicion(findings);
    const { score, breakdown } = computeEscalationScore(
      line,
      findings,
      totalSuspicion
    );
    const routingBand = this.routeSuspicionBand(score);
    if (routingBand === "pass") return null;

    const distinctDetectors = new Set(findings.map((finding) => finding.detectorId))
      .size;
    const criticalMismatch = isCriticalMismatchFromFindings(findings);

    return {
      line,
      totalSuspicion,
      findings,
      contextLines: context,
      routingBand,
      escalationScore: score,
      distinctDetectors,
      criticalMismatch,
      breakdown,
    };
  }

  private initializeDetectors(): readonly SuspicionDetector[] {
    const allDetectors: readonly SuspicionDetector[] = [
      createSequenceViolationDetector(),
      createContentTypeMismatchDetector(),
      createSplitCharacterFragmentDetector(),
      createStatisticalAnomalyDetector(),
      createConfidenceDropDetector(),
    ];

    return allDetectors.filter((detector) =>
      this.config.enabledDetectors.has(detector.id)
    );
  }

  review(classifiedLines: readonly ClassifiedLine[]): LLMReviewPacket {
    if (classifiedLines.length === 0) {
      return {
        totalSuspicious: 0,
        totalReviewed: 0,
        suspicionRate: 0,
        suspiciousLines: [],
      };
    }

    const rawSuspicious: SuspiciousLine[] = [];

    for (let i = 0; i < classifiedLines.length; i++) {
      const line = classifiedLines[i];
      const features = extractTextFeatures(line.text);
      const context = extractContextWindow(
        classifiedLines,
        i,
        this.config.contextRadius
      );
      const linePositionInContext =
        i - Math.max(0, i - this.config.contextRadius);

      const findings: DetectorFinding[] = [];
      for (const detector of this.detectors) {
        const finding = detector.detect(
          line,
          features,
          context,
          linePositionInContext
        );
        if (finding) findings.push(finding);
      }

      const suspicious = this.buildSuspicionRecord(line, findings, context);
      if (suspicious) rawSuspicious.push(suspicious);
    }

    const sorted = rawSuspicious.sort(
      (a, b) => b.escalationScore - a.escalationScore
    );

    return {
      totalSuspicious: sorted.length,
      totalReviewed: classifiedLines.length,
      suspicionRate: sorted.length / classifiedLines.length,
      suspiciousLines: sorted,
    };
  }

  reviewSingleLine(
    line: ClassifiedLine,
    surroundingLines: readonly ClassifiedLine[]
  ): SuspiciousLine | null {
    const features = extractTextFeatures(line.text);
    const linePosition = surroundingLines.findIndex(
      (item) => item.lineIndex === line.lineIndex
    );
    if (linePosition === -1) return null;

    const findings: DetectorFinding[] = [];
    for (const detector of this.detectors) {
      const finding = detector.detect(
        line,
        features,
        surroundingLines,
        linePosition
      );
      if (finding) findings.push(finding);
    }
    return this.buildSuspicionRecord(line, findings, surroundingLines);
  }

  formatForLLM(packet: LLMReviewPacket): string {
    if (packet.suspiciousLines.length === 0) return "";

    const sections: string[] = [
      `<review_request count="${packet.totalSuspicious}" total_lines="${packet.totalReviewed}">`,
    ];

    for (const suspicious of packet.suspiciousLines) {
      const {
        line,
        totalSuspicion,
        escalationScore,
        routingBand,
        findings,
        contextLines,
      } = suspicious;

      const contextStr = contextLines
        .map((contextLine) => {
          const marker =
            contextLine.lineIndex === line.lineIndex ? ">>>" : "   ";
          return `${marker} L${contextLine.lineIndex}|${contextLine.assignedType}|${contextLine.text}`;
        })
        .join("\n");

      const reasons = findings.map((finding) => finding.reason).join("؛ ");
      const suggested =
        findings.find((finding) => finding.suggestedType !== null)
          ?.suggestedType ?? "";

      sections.push(
        `<suspect line="${line.lineIndex}" current="${line.assignedType}" suspicion="${totalSuspicion}" escalation="${escalationScore}" band="${routingBand}" suggested="${suggested}">`,
        `<reasons>${reasons}</reasons>`,
        `<context>\n${contextStr}\n</context>`,
        "</suspect>"
      );
    }

    sections.push("</review_request>");
    return sections.join("\n");
  }
}

export default PostClassificationReviewer;
