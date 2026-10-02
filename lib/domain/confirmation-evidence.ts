import { createHash } from "node:crypto";

export const CONFIRMATION_EVIDENCE_POLICY_V1 =
  "independent-evidence-class-confirmation-v1" as const;

export const CONFIRMATION_MIN_DIRECTIONAL_CLASSES_V1 = 2 as const;

export type ConfirmationTargetAsset = "BTC" | "GOLD";
export type ConfirmationTargetDirection = "UP" | "DOWN";

export type ConfirmationEvidenceClass =
  | "FLOW"
  | "LIQUIDITY"
  | "POSITIONING"
  | "VOLATILITY"
  | "MARKET_STRUCTURE";

export type ConfirmationContributionJudgement =
  | "SUPPORTING"
  | "CONTRADICTING"
  | "NEUTRAL"
  | "UNRESOLVED";

export type ConfirmationClassResolution =
  | "SUPPORTING"
  | "CONTRADICTING"
  | "NON_DIRECTIONAL"
  | "CONFLICTED";

export type ConfirmationResolution =
  | "CONFIRMING"
  | "CONTRADICTING"
  | "MIXED"
  | "INSUFFICIENT_EVIDENCE";

export type ConfirmationTarget = {
  targetId: string;
  asset: ConfirmationTargetAsset;
  responseObservationKey: string;
  direction: ConfirmationTargetDirection;
  knowledgeAt: string;
  eventIdentityKey?: string;
};

export type ConfirmationEvidenceContribution = {
  id: string;
  evidenceClass: ConfirmationEvidenceClass;
  judgement: ConfirmationContributionJudgement;
  observedAt: string;
  knownAt: string;
  methodologyId: string;
  methodologyVersion: string;
  sourceSeriesKeys: string[];
  reason?: string;
};

export type ConfirmationEvidenceClassResult = {
  evidenceClass: ConfirmationEvidenceClass;
  resolution: ConfirmationClassResolution;
  contributionIds: string[];
  methodologyIds: string[];
};

export type ConfirmationEvidenceAssessment = {
  id: string;
  version: "v1";
  policy: typeof CONFIRMATION_EVIDENCE_POLICY_V1;
  target: ConfirmationTarget;
  resolution: ConfirmationResolution;
  minimumDirectionalClasses:
    typeof CONFIRMATION_MIN_DIRECTIONAL_CLASSES_V1;
  supportingClassCount: number;
  contradictingClassCount: number;
  directionalClassCount: number;
  classes: ConfirmationEvidenceClassResult[];
  contributions: ConfirmationEvidenceContribution[];
  causalAttribution: "NOT_EVALUATED";
  reason?: string;
};

const CLASS_ORDER: ConfirmationEvidenceClass[] = [
  "FLOW",
  "LIQUIDITY",
  "POSITIONING",
  "VOLATILITY",
  "MARKET_STRUCTURE",
];

function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function classIndex(value: ConfirmationEvidenceClass): number {
  return CLASS_ORDER.indexOf(value);
}

function validateTarget(target: ConfirmationTarget): ConfirmationTarget {
  const targetId = target.targetId.trim();
  const responseObservationKey = target.responseObservationKey.trim();
  const eventIdentityKey = target.eventIdentityKey?.trim();

  if (!targetId || !responseObservationKey) {
    throw new Error(
      "CONF-001A requires non-empty target and response Observation identity.",
    );
  }
  if (!Number.isFinite(Date.parse(target.knowledgeAt))) {
    throw new Error("CONF-001A target knowledgeAt must be a valid timestamp.");
  }

  return {
    targetId,
    asset: target.asset,
    responseObservationKey,
    direction: target.direction,
    knowledgeAt: target.knowledgeAt,
    ...(eventIdentityKey ? { eventIdentityKey } : {}),
  };
}

function validateContribution(
  contribution: ConfirmationEvidenceContribution,
  knowledgeAtMs: number,
): ConfirmationEvidenceContribution {
  const id = contribution.id.trim();
  const methodologyId = contribution.methodologyId.trim();
  const methodologyVersion = contribution.methodologyVersion.trim();
  const sourceSeriesKeys = sortedUnique(contribution.sourceSeriesKeys);

  if (!id || !methodologyId || !methodologyVersion) {
    throw new Error(
      "CONF-001A contributions require evidence and methodology identity.",
    );
  }
  if (!sourceSeriesKeys.length) {
    throw new Error(
      "CONF-001A contributions require at least one source series key.",
    );
  }

  const observedAtMs = Date.parse(contribution.observedAt);
  const knownAtMs = Date.parse(contribution.knownAt);
  if (!Number.isFinite(observedAtMs) || !Number.isFinite(knownAtMs)) {
    throw new Error(
      "CONF-001A contribution observedAt/knownAt must be valid timestamps.",
    );
  }
  if (knownAtMs > knowledgeAtMs) {
    throw new Error(
      "CONF-001A forbids evidence that became knowable after the target knowledge cutoff.",
    );
  }

  return {
    id,
    evidenceClass: contribution.evidenceClass,
    judgement: contribution.judgement,
    observedAt: contribution.observedAt,
    knownAt: contribution.knownAt,
    methodologyId,
    methodologyVersion,
    sourceSeriesKeys,
    ...(contribution.reason?.trim()
      ? { reason: contribution.reason.trim() }
      : {}),
  };
}

function resolveClass(
  evidenceClass: ConfirmationEvidenceClass,
  contributions: ConfirmationEvidenceContribution[],
): ConfirmationEvidenceClassResult {
  const classContributions = contributions.filter(
    (contribution) => contribution.evidenceClass === evidenceClass,
  );
  const hasSupporting = classContributions.some(
    (contribution) => contribution.judgement === "SUPPORTING",
  );
  const hasContradicting = classContributions.some(
    (contribution) => contribution.judgement === "CONTRADICTING",
  );

  let resolution: ConfirmationClassResolution;
  if (hasSupporting && hasContradicting) {
    resolution = "CONFLICTED";
  } else if (hasSupporting) {
    resolution = "SUPPORTING";
  } else if (hasContradicting) {
    resolution = "CONTRADICTING";
  } else {
    resolution = "NON_DIRECTIONAL";
  }

  return {
    evidenceClass,
    resolution,
    contributionIds: classContributions.map((item) => item.id).sort(),
    methodologyIds: sortedUnique(
      classContributions.map(
        (item) => item.methodologyId + "@" + item.methodologyVersion,
      ),
    ),
  };
}

/**
 * CONF-001A composes already-qualified evidence judgements across independent
 * evidence classes.
 *
 * It deliberately does not infer SUPPORTING/CONTRADICTING from raw market
 * values. Evidence-specific adapters must own that methodology in later
 * checkpoints. Each evidence class contributes at most one directional vote,
 * preventing multiple same-class series/providers from manufacturing
 * independence.
 */
export function assessConfirmationEvidence(input: {
  target: ConfirmationTarget;
  contributions: ConfirmationEvidenceContribution[];
}): ConfirmationEvidenceAssessment {
  const target = validateTarget(input.target);
  const knowledgeAtMs = Date.parse(target.knowledgeAt);

  const seenIds = new Set<string>();
  const contributions = input.contributions.map((item) => {
    const validated = validateContribution(item, knowledgeAtMs);
    if (seenIds.has(validated.id)) {
      throw new Error("CONF-001A contribution IDs must be unique.");
    }
    seenIds.add(validated.id);
    return validated;
  }).sort((a, b) =>
    classIndex(a.evidenceClass) - classIndex(b.evidenceClass)
    || a.id.localeCompare(b.id)
  );

  const classes = CLASS_ORDER
    .filter((evidenceClass) =>
      contributions.some((item) => item.evidenceClass === evidenceClass)
    )
    .map((evidenceClass) => resolveClass(evidenceClass, contributions));

  const supportingClassCount = classes.filter(
    (item) => item.resolution === "SUPPORTING",
  ).length;
  const contradictingClassCount = classes.filter(
    (item) => item.resolution === "CONTRADICTING",
  ).length;
  const directionalClassCount =
    supportingClassCount + contradictingClassCount;

  let resolution: ConfirmationResolution;
  let reason: string | undefined;

  if (supportingClassCount > 0 && contradictingClassCount > 0) {
    resolution = "MIXED";
  } else if (
    directionalClassCount < CONFIRMATION_MIN_DIRECTIONAL_CLASSES_V1
  ) {
    resolution = "INSUFFICIENT_EVIDENCE";
    reason =
      "CONF-001A requires at least two independent directional evidence classes.";
  } else if (
    supportingClassCount >= CONFIRMATION_MIN_DIRECTIONAL_CLASSES_V1
  ) {
    resolution = "CONFIRMING";
  } else if (
    contradictingClassCount >= CONFIRMATION_MIN_DIRECTIONAL_CLASSES_V1
  ) {
    resolution = "CONTRADICTING";
  } else {
    resolution = "INSUFFICIENT_EVIDENCE";
    reason =
      "CONF-001A could not establish two independent directional evidence classes.";
  }

  const withoutId: Omit<ConfirmationEvidenceAssessment, "id"> = {
    version: "v1",
    policy: CONFIRMATION_EVIDENCE_POLICY_V1,
    target,
    resolution,
    minimumDirectionalClasses: CONFIRMATION_MIN_DIRECTIONAL_CLASSES_V1,
    supportingClassCount,
    contradictingClassCount,
    directionalClassCount,
    classes,
    contributions,
    causalAttribution: "NOT_EVALUATED",
    ...(reason ? { reason } : {}),
  };

  return {
    id: "confirmation-evidence-v1-" + stableHash(withoutId),
    ...withoutId,
  };
}
