import {
  assessConfirmationEvidence,
  type ConfirmationContributionJudgement,
  type ConfirmationEvidenceAssessment,
  type ConfirmationTargetDirection,
} from "../domain/confirmation-evidence";
import type { BtcEtfFlowReadModel } from "./btc-etf-flow";
import {
  buildBtcEtfFlowConfirmationContribution,
} from "./btc-etf-flow-confirmation";
import type {
  BriefingEventRepricingResult,
  BriefingEventRepricingWindow,
} from "./briefing-event-repricing";

const BTC_OBSERVATION_KEY = "ASSET:btc.spot.usd:coingecko-market" as const;

export type BriefingConfirmationEvidenceItem =
  | {
      status: "QUALIFIED";
      evidenceClass: "FLOW";
      source: "BTC_ETF_FLOW";
      judgement: ConfirmationContributionJudgement;
      observedAt: string;
      knownAt: string;
      reason: string;
    }
  | {
      status: "UNRESOLVED";
      evidenceClass: "FLOW";
      source: "BTC_ETF_FLOW";
      reason: string;
    };

export type BriefingConfirmationResult =
  | {
      status: "OK";
      eventIdentityKey: string;
      eventId: string;
      subject: string;
      jurisdiction: string;
      releaseAt: string;
      role: "T_PLUS_5" | "T_PLUS_15" | "T_PLUS_30" | "T_PLUS_60";
      capturedAt: string;
      targetDirection: ConfirmationTargetDirection;
      assessment: ConfirmationEvidenceAssessment;
      evidence: BriefingConfirmationEvidenceItem[];
    }
  | {
      status: "INSUFFICIENT";
      reason: string;
    };

type QualifiedTarget = {
  eventIdentityKey: string;
  eventId: string;
  subject: string;
  jurisdiction: string;
  releaseAt: string;
  window: Extract<BriefingEventRepricingWindow, { status: "ASSESSED" }>;
  direction: ConfirmationTargetDirection;
};

function qualifiedBtcTarget(
  repricing: BriefingEventRepricingResult,
): QualifiedTarget | null {
  if (repricing.status !== "OK") return null;

  const candidates: QualifiedTarget[] = [];

  for (const item of repricing.data) {
    for (const window of item.windows) {
      if (window.status !== "ASSESSED") continue;
      if (window.assessment.status !== "REPRICING_OBSERVED") continue;
      if (window.assessment.contaminationStatus !== "CLEAN") continue;

      const response = window.assessment.responses.find(
        (item) =>
          item.observationKey === BTC_OBSERVATION_KEY
          && item.status === "REPRICED"
          && (item.direction === "UP" || item.direction === "DOWN"),
      );
      if (!response || (response.direction !== "UP" && response.direction !== "DOWN")) {
        continue;
      }

      candidates.push({
        eventIdentityKey: item.eventIdentityKey,
        eventId: item.eventId,
        subject: item.subject,
        jurisdiction: item.jurisdiction,
        releaseAt: item.t0,
        window,
        direction: response.direction,
      });
    }
  }

  return candidates.sort((a, b) =>
    Date.parse(b.releaseAt) - Date.parse(a.releaseAt)
    || Date.parse(b.window.capturedAt) - Date.parse(a.window.capturedAt)
    || a.eventIdentityKey.localeCompare(b.eventIdentityKey)
  )[0] ?? null;
}

/**
 * CONF-001C Gate 6 pure composition boundary.
 *
 * Reuses the already-built RPR Gate 3b result and the already-built BTC ETF
 * read model. It performs no repository/provider/network I/O.
 *
 * Confirmation is allowed only for a clean, material BTC repricing response.
 * The evidence cutoff is the assessed response window capturedAt, so later ETF
 * flow revisions cannot leak into an earlier event interpretation.
 */
export function buildBriefingConfirmation(input: {
  eventRepricing: BriefingEventRepricingResult;
  btcEtfFlow: BtcEtfFlowReadModel;
}): BriefingConfirmationResult {
  const target = qualifiedBtcTarget(input.eventRepricing);
  if (!target) {
    return {
      status: "INSUFFICIENT",
      reason:
        "Belum ada clean BTC repricing response yang qualified untuk menjadi target confirmation.",
    };
  }

  const confirmationTarget = {
    targetId:
      "btc-repricing-confirmation:"
      + target.eventIdentityKey
      + ":"
      + target.window.role,
    asset: "BTC" as const,
    responseObservationKey: BTC_OBSERVATION_KEY,
    direction: target.direction,
    knowledgeAt: target.window.capturedAt,
    eventIdentityKey: target.eventIdentityKey,
  };

  const flow = buildBtcEtfFlowConfirmationContribution({
    target: confirmationTarget,
    flow: input.btcEtfFlow,
  });

  const contributions = flow.status === "QUALIFIED"
    ? [flow.contribution]
    : [];
  const assessment = assessConfirmationEvidence({
    target: confirmationTarget,
    contributions,
  });

  const evidence: BriefingConfirmationEvidenceItem[] = flow.status === "QUALIFIED"
    ? [{
        status: "QUALIFIED",
        evidenceClass: "FLOW",
        source: "BTC_ETF_FLOW",
        judgement: flow.contribution.judgement,
        observedAt: flow.contribution.observedAt,
        knownAt: flow.contribution.knownAt,
        reason: flow.contribution.reason
          ?? "Qualified BTC ETF FLOW contribution.",
      }]
    : [{
        status: "UNRESOLVED",
        evidenceClass: "FLOW",
        source: "BTC_ETF_FLOW",
        reason: flow.reason,
      }];

  return {
    status: "OK",
    eventIdentityKey: target.eventIdentityKey,
    eventId: target.eventId,
    subject: target.subject,
    jurisdiction: target.jurisdiction,
    releaseAt: target.releaseAt,
    role: target.window.role,
    capturedAt: target.window.capturedAt,
    targetDirection: target.direction,
    assessment,
    evidence,
  };
}
