import {
  assessConfirmationEvidence,
  type ConfirmationContributionJudgement,
  type ConfirmationEvidenceAssessment,
  type ConfirmationTargetDirection,
} from "../domain/confirmation-evidence";
import { buildBtcEtfFlowConfirmationContribution } from "./btc-etf-flow-confirmation";
import { buildBtcSpotFlowConfirmationContribution } from "./btc-spot-flow-confirmation";
import type { ContinuousMoveAssessment } from "./continuous-move-detector";
import type {
  MoveBackgroundItem,
  MoveEvidenceBundle,
} from "./move-evidence-bundle";

const BTC_OBSERVATION_KEY = "ASSET:btc.spot.usd:coingecko-market" as const;

export type MaterialMoveConfirmationEvidenceItem = {
  status: "QUALIFIED" | "UNRESOLVED";
  evidenceClass: "FLOW" | "MARKET_STRUCTURE";
  source: "BTC_ETF_FLOW" | "BINANCE_SPOT_TAKER_FLOW";
  judgement: ConfirmationContributionJudgement | null;
  observedAt: string | null;
  knownAt: string | null;
  reason: string;
};

export type MaterialMoveConfirmationResult =
  | {
      status: "OK";
      targetAsset: "BTC";
      targetDirection: ConfirmationTargetDirection;
      knowledgeAt: string;
      assessment: ConfirmationEvidenceAssessment;
      evidence: MaterialMoveConfirmationEvidenceItem[];
    }
  | {
      status: "INSUFFICIENT";
      reason: string;
    };

function targetDirection(
  assessment: ContinuousMoveAssessment,
): ConfirmationTargetDirection | null {
  const material = assessment.horizons.filter((item) => item.status === "MATERIAL_MOVE");
  if (!material.length) return null;

  const directions = material.map((item) => item.direction);
  if (directions.some((direction) => direction !== "UP" && direction !== "DOWN")) {
    return null;
  }

  const unique = new Set(directions as ConfirmationTargetDirection[]);
  return unique.size === 1 ? [...unique][0] : null;
}

function btcEtfBackground(
  bundle: MoveEvidenceBundle,
): Extract<MoveBackgroundItem, { kind: "BTC_ETF_NET_FLOW" }> | null {
  return bundle.slowBackground.items.find(
    (item): item is Extract<MoveBackgroundItem, { kind: "BTC_ETF_NET_FLOW" }> =>
      item.kind === "BTC_ETF_NET_FLOW",
  ) ?? null;
}

/**
 * CONF-001D extends the existing non-causal CONF-001A composition to a
 * continuous BTC material move.
 *
 * It reuses only evidence already present in MOVE-002B:
 * - matured BTC ETF daily net flow -> FLOW;
 * - complete Binance BTCUSDT 5m taker flow -> MARKET_STRUCTURE.
 *
 * No repository/provider/network read is added here.
 */
export function buildMaterialMoveConfirmation(input: {
  assessment: ContinuousMoveAssessment;
  bundle: MoveEvidenceBundle;
}): MaterialMoveConfirmationResult {
  if (
    input.assessment.status !== "MATERIAL_MOVE"
    || !input.assessment.hasMaterialMove
    || input.assessment.seriesKey !== "btc.spot.usd"
    || input.bundle.targetAsset !== "BTC"
    || input.bundle.targetSeriesKey !== "btc.spot.usd"
    || input.bundle.moveAssessmentId !== input.assessment.id
  ) {
    return {
      status: "INSUFFICIENT",
      reason: "CONF-001D requires the matching BTC material-MOVE assessment and evidence bundle.",
    };
  }

  const direction = targetDirection(input.assessment);
  if (!direction) {
    return {
      status: "INSUFFICIENT",
      reason: "BTC material horizons do not establish one consistent observed direction.",
    };
  }

  const target = {
    targetId: "btc-material-move-confirmation:" + input.assessment.id,
    asset: "BTC" as const,
    responseObservationKey: BTC_OBSERVATION_KEY,
    direction,
    knowledgeAt: input.assessment.asOf,
  };

  const etf = btcEtfBackground(input.bundle);
  const flow = etf?.data
    ? buildBtcEtfFlowConfirmationContribution({ target, flow: etf.data })
    : {
        status: "UNRESOLVED" as const,
        reason: etf?.reason ?? "No matured BTC ETF flow read model is available in the MOVE bundle.",
      };

  const spotFlow = input.bundle.cryptoMarketStructure?.components
    .find((item) => item.component === "BTC_SPOT_FLOW")
    ?.spotFlow;
  const marketStructure = spotFlow
    ? buildBtcSpotFlowConfirmationContribution({ target, spotFlow })
    : {
        status: "UNRESOLVED" as const,
        reason: "No replayable Binance BTCUSDT spot-flow evidence is available in the MOVE bundle.",
      };

  const contributions = [
    ...(flow.status === "QUALIFIED" ? [flow.contribution] : []),
    ...(marketStructure.status === "QUALIFIED" ? [marketStructure.contribution] : []),
  ];
  const assessment = assessConfirmationEvidence({ target, contributions });

  const evidence: MaterialMoveConfirmationEvidenceItem[] = [
    flow.status === "QUALIFIED"
      ? {
          status: "QUALIFIED",
          evidenceClass: "FLOW",
          source: "BTC_ETF_FLOW",
          judgement: flow.contribution.judgement,
          observedAt: flow.contribution.observedAt,
          knownAt: flow.contribution.knownAt,
          reason: flow.contribution.reason ?? "Qualified BTC ETF FLOW contribution.",
        }
      : {
          status: "UNRESOLVED",
          evidenceClass: "FLOW",
          source: "BTC_ETF_FLOW",
          judgement: null,
          observedAt: null,
          knownAt: null,
          reason: flow.reason,
        },
    marketStructure.status === "QUALIFIED"
      ? {
          status: "QUALIFIED",
          evidenceClass: "MARKET_STRUCTURE",
          source: "BINANCE_SPOT_TAKER_FLOW",
          judgement: marketStructure.contribution.judgement,
          observedAt: marketStructure.contribution.observedAt,
          knownAt: marketStructure.contribution.knownAt,
          reason: marketStructure.contribution.reason
            ?? "Qualified Binance spot-flow MARKET_STRUCTURE contribution.",
        }
      : {
          status: "UNRESOLVED",
          evidenceClass: "MARKET_STRUCTURE",
          source: "BINANCE_SPOT_TAKER_FLOW",
          judgement: null,
          observedAt: null,
          knownAt: null,
          reason: marketStructure.reason,
        },
  ];

  return {
    status: "OK",
    targetAsset: "BTC",
    targetDirection: direction,
    knowledgeAt: input.assessment.asOf,
    assessment,
    evidence,
  };
}
