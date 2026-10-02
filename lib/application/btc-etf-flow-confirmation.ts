import { createHash } from "node:crypto";
import {
  BTC_ETF_NET_FLOW_SERIES_KEY,
} from "../domain/observation-semantics";
import type {
  ConfirmationEvidenceContribution,
  ConfirmationTarget,
} from "../domain/confirmation-evidence";
import type {
  BtcEtfFlowPoint,
  BtcEtfFlowReadModel,
} from "./btc-etf-flow";

export const BTC_ETF_FLOW_CONFIRMATION_METHODOLOGY_V1 = {
  methodologyId: "btc-etf-matured-flow-directional-alignment-v1",
  methodologyVersion: "v1",
} as const;

export type BtcEtfFlowConfirmationAdapterResult =
  | {
      status: "QUALIFIED";
      point: BtcEtfFlowPoint;
      contribution: ConfirmationEvidenceContribution;
    }
  | {
      status: "UNRESOLVED";
      reason: string;
    };

function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function latestKnowablePoint(
  model: BtcEtfFlowReadModel,
  knowledgeAt: string,
): BtcEtfFlowPoint | null {
  const cutoff = Date.parse(knowledgeAt);
  if (!Number.isFinite(cutoff)) {
    throw new Error("CONF-001B target knowledgeAt must be a valid timestamp.");
  }

  return model.recent
    .filter((point) => {
      const retrievedAt = Date.parse(point.retrievedAt);
      return Number.isFinite(retrievedAt) && retrievedAt <= cutoff;
    })
    .sort((a, b) =>
      Date.parse(b.observedAt) - Date.parse(a.observedAt)
      || Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt)
      || a.observationId.localeCompare(b.observationId)
    )[0] ?? null;
}

function judgementFor(
  flowValue: number,
  direction: ConfirmationTarget["direction"],
): ConfirmationEvidenceContribution["judgement"] {
  if (flowValue === 0) return "NEUTRAL";

  const flowDirection = flowValue > 0 ? "UP" : "DOWN";
  return flowDirection === direction ? "SUPPORTING" : "CONTRADICTING";
}

/**
 * CONF-001B maps one matured, point-in-time-compatible US spot BTC ETF daily
 * net-flow fact into the FLOW evidence class used by CONF-001A.
 *
 * This is directional alignment only:
 * - positive net flow = inflow;
 * - negative net flow = outflow;
 * - zero = neutral;
 * - inflow aligned with an observed BTC UP response is SUPPORTING;
 * - outflow aligned with an observed BTC DOWN response is SUPPORTING;
 * - the opposite combinations are CONTRADICTING.
 *
 * The adapter does not claim contemporaneous intraday timing, causality,
 * predictive power, or future return direction. If the read model cannot prove
 * which matured fact was knowable by the target cutoff, it fails closed.
 */
export function buildBtcEtfFlowConfirmationContribution(input: {
  target: ConfirmationTarget;
  flow: BtcEtfFlowReadModel;
}): BtcEtfFlowConfirmationAdapterResult {
  if (input.target.asset !== "BTC") {
    return {
      status: "UNRESOLVED",
      reason:
        "CONF-001B BTC ETF flow evidence applies only to BTC confirmation targets.",
    };
  }

  if (input.flow.seriesKey !== BTC_ETF_NET_FLOW_SERIES_KEY) {
    return {
      status: "UNRESOLVED",
      reason:
        "CONF-001B received a read model with incompatible canonical series identity.",
    };
  }

  const point = latestKnowablePoint(input.flow, input.target.knowledgeAt);
  if (!point) {
    return {
      status: "UNRESOLVED",
      reason:
        "No matured BTC ETF flow fact in the bounded read model is provably knowable by the target cutoff.",
    };
  }

  if (!Number.isFinite(point.value)) {
    return {
      status: "UNRESOLVED",
      reason: "BTC ETF flow value is not a finite canonical number.",
    };
  }

  const judgement = judgementFor(point.value, input.target.direction);
  const contributionWithoutId: Omit<ConfirmationEvidenceContribution, "id"> = {
    evidenceClass: "FLOW",
    judgement,
    observedAt: point.observedAt,
    knownAt: point.retrievedAt,
    methodologyId:
      BTC_ETF_FLOW_CONFIRMATION_METHODOLOGY_V1.methodologyId,
    methodologyVersion:
      BTC_ETF_FLOW_CONFIRMATION_METHODOLOGY_V1.methodologyVersion,
    sourceSeriesKeys: [BTC_ETF_NET_FLOW_SERIES_KEY],
    reason: point.value === 0
      ? "Provider-reported matured BTC ETF daily net flow is zero, so the FLOW class is non-directional."
      : judgement === "SUPPORTING"
        ? "Matured BTC ETF daily net-flow direction aligns with the already-observed BTC response direction."
        : "Matured BTC ETF daily net-flow direction opposes the already-observed BTC response direction.",
  };

  return {
    status: "QUALIFIED",
    point,
    contribution: {
      id: "btc-etf-flow-confirmation-v1-" + stableHash({
        targetId: input.target.targetId,
        targetDirection: input.target.direction,
        targetKnowledgeAt: input.target.knowledgeAt,
        observationId: point.observationId,
        value: point.value,
        ...contributionWithoutId,
      }),
      ...contributionWithoutId,
    },
  };
}
