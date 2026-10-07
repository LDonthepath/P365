import { createHash } from "node:crypto";
import type {
  ConfirmationEvidenceContribution,
  ConfirmationTarget,
} from "../domain/confirmation-evidence";
import type { MoveBtcSpotFlowEvidence } from "./move-evidence-bundle";

export const BTC_SPOT_FLOW_CONFIRMATION_METHODOLOGY_V1 = {
  methodologyId: "binance-btcusdt-move-window-taker-flow-alignment-v1",
  methodologyVersion: "v1",
  sourceSeriesKey: "binance.btcusdt.spot.net_taker_base_volume.5m",
} as const;

export type BtcSpotFlowConfirmationAdapterResult =
  | {
      status: "QUALIFIED";
      netTakerBaseVolumeBtc: number;
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

function completedBoundaries(startAt: string, endAt: string): string[] | null {
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  const windowMs = 5 * 60 * 1000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

  const first = Math.floor(start / windowMs) * windowMs + windowMs;
  const last = Math.floor(end / windowMs) * windowMs;
  if (first > last) return [];

  const boundaries: string[] = [];
  for (let current = first; current <= last; current += windowMs) {
    boundaries.push(new Date(current).toISOString());
  }
  return boundaries;
}

function judgementFor(
  netTakerBaseVolumeBtc: number,
  direction: ConfirmationTarget["direction"],
): ConfirmationEvidenceContribution["judgement"] {
  if (netTakerBaseVolumeBtc === 0) return "NEUTRAL";
  const flowDirection = netTakerBaseVolumeBtc > 0 ? "UP" : "DOWN";
  return flowDirection === direction ? "SUPPORTING" : "CONTRADICTING";
}

/**
 * CONF-001D maps complete, point-in-time Binance BTCUSDT 5m taker-flow
 * coverage over the exact material-MOVE investigation window into the
 * MARKET_STRUCTURE evidence class.
 *
 * The adapter uses only the sign of aggregate net taker base volume. It makes
 * no materiality, causality, persistence, prediction, or execution claim.
 */
export function buildBtcSpotFlowConfirmationContribution(input: {
  target: ConfirmationTarget;
  spotFlow: MoveBtcSpotFlowEvidence;
}): BtcSpotFlowConfirmationAdapterResult {
  if (input.target.asset !== "BTC") {
    return {
      status: "UNRESOLVED",
      reason: "BTC spot-flow confirmation applies only to BTC targets.",
    };
  }

  if (
    input.spotFlow.venue !== "BINANCE"
    || input.spotFlow.pair !== "BTCUSDT"
    || input.spotFlow.windowSeconds !== 300
  ) {
    return {
      status: "UNRESOLVED",
      reason: "BTC spot-flow confirmation received incompatible venue/pair/window identity.",
    };
  }

  const expectedBoundaries = completedBoundaries(input.spotFlow.startAt, input.spotFlow.endAt);
  const observedBoundaries = new Set(input.spotFlow.windows.map((window) => window.observedAt));
  if (
    input.spotFlow.state !== "AVAILABLE_SYNCHRONOUS"
    || input.spotFlow.coverage !== "COMPLETE"
    || !expectedBoundaries
    || expectedBoundaries.length < 1
    || input.spotFlow.expectedCompletedWindows !== expectedBoundaries.length
    || input.spotFlow.windows.length !== expectedBoundaries.length
    || observedBoundaries.size !== expectedBoundaries.length
    || expectedBoundaries.some((boundary) => !observedBoundaries.has(boundary))
  ) {
    return {
      status: "UNRESOLVED",
      reason: "Complete replayable Binance 5m spot-flow coverage is required for directional alignment.",
    };
  }

  const cutoff = Date.parse(input.target.knowledgeAt);
  if (!Number.isFinite(cutoff)) {
    throw new Error("CONF-001D target knowledgeAt must be a valid timestamp.");
  }

  const windows = [...input.spotFlow.windows].sort((left, right) =>
    left.observedAt.localeCompare(right.observedAt)
    || left.evidenceId.localeCompare(right.evidenceId));

  let netTakerBaseVolumeBtc = 0;
  let knownAt = "";
  let observedAt = "";

  for (const window of windows) {
    const observed = Date.parse(window.observedAt);
    const retrieved = Date.parse(window.retrievedAt);
    if (
      !Number.isFinite(observed)
      || !Number.isFinite(retrieved)
      || observed > cutoff
      || retrieved < observed
      || retrieved > cutoff
      || !Number.isFinite(window.netTakerBaseVolumeBtc)
    ) {
      return {
        status: "UNRESOLVED",
        reason: "Binance spot-flow window is invalid or became knowable after the target cutoff.",
      };
    }

    netTakerBaseVolumeBtc += window.netTakerBaseVolumeBtc;
    if (!knownAt || retrieved > Date.parse(knownAt)) knownAt = window.retrievedAt;
    if (!observedAt || observed > Date.parse(observedAt)) observedAt = window.observedAt;
  }

  if (!Number.isFinite(netTakerBaseVolumeBtc) || !knownAt || !observedAt) {
    return {
      status: "UNRESOLVED",
      reason: "Binance spot-flow aggregate is not a valid point-in-time factual value.",
    };
  }

  const judgement = judgementFor(netTakerBaseVolumeBtc, input.target.direction);
  const contributionWithoutId: Omit<ConfirmationEvidenceContribution, "id"> = {
    evidenceClass: "MARKET_STRUCTURE",
    judgement,
    observedAt,
    knownAt,
    methodologyId: BTC_SPOT_FLOW_CONFIRMATION_METHODOLOGY_V1.methodologyId,
    methodologyVersion: BTC_SPOT_FLOW_CONFIRMATION_METHODOLOGY_V1.methodologyVersion,
    sourceSeriesKeys: [BTC_SPOT_FLOW_CONFIRMATION_METHODOLOGY_V1.sourceSeriesKey],
    reason: netTakerBaseVolumeBtc === 0
      ? "Aggregate Binance BTCUSDT taker flow is exactly balanced across the material-MOVE window."
      : judgement === "SUPPORTING"
        ? "Aggregate Binance BTCUSDT taker-flow direction aligns with the already-observed BTC material move."
        : "Aggregate Binance BTCUSDT taker-flow direction opposes the already-observed BTC material move.",
  };

  return {
    status: "QUALIFIED",
    netTakerBaseVolumeBtc,
    contribution: {
      id: "btc-spot-flow-confirmation-v1-" + stableHash({
        targetId: input.target.targetId,
        targetDirection: input.target.direction,
        targetKnowledgeAt: input.target.knowledgeAt,
        evidenceIds: windows.map((window) => window.evidenceId),
        netTakerBaseVolumeBtc,
        ...contributionWithoutId,
      }),
      ...contributionWithoutId,
    },
  };
}
