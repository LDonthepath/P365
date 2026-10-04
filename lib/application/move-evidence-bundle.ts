import { createHash } from "node:crypto";
import { historicalObservationFitnessEligible } from "../domain/historical-observation-fitness";
import type { DataQuality, Event, Observation, ObservationDomain } from "../domain/types";
import { observationSemanticSeriesKey } from "../repositories/observation-history";
import type {
  HistoricalEventRepository,
  HistoricalEvidenceRepository,
  HistoricalObservationRepository,
} from "../repositories/types";
import {
  buildBtcEtfFlowReadModel,
  type BtcEtfFlowReadModel,
} from "./btc-etf-flow";
import type {
  ContinuousMoveAssessment,
} from "./continuous-move-detector";
import {
  buildGoldPositioningReadModel,
  type GoldPositioningReadModel,
} from "./gold-positioning";
import {
  buildStablecoinLiquidityReadModel,
  type StablecoinLiquidityReadModel,
} from "./stablecoin-liquidity";
import {
  BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY,
  btcSpotFlowWindowFromEvidence,
} from "./btc-spot-flow-history";

const MINUTE_MS = 60 * 1000;
const CROSS_SERIES_ALIGNMENT_TOLERANCE_MS = 2 * MINUTE_MS;
const SYNCHRONOUS_QUERY_LIMIT = 50;
const SCHEDULED_EVENT_QUERY_LIMIT = 500;
const SPOT_FLOW_QUERY_LIMIT = 100;
const SPOT_FLOW_WINDOW_MS = 5 * MINUTE_MS;

export const MOVE_EVIDENCE_BUNDLE_POLICY = "move-evidence-bundle-v1" as const;

export type MoveEvidenceAvailability =
  | "AVAILABLE_SYNCHRONOUS"
  | "AVAILABLE_BACKGROUND"
  | "AVAILABLE_CATALYST"
  | "MISSING_HIGH_VALUE_EVIDENCE"
  | "INSUFFICIENT_DATA"
  | "UNKNOWN";

export type MoveEvidenceAsset = "BTC" | "GOLD";

export type MoveEvidencePoint = {
  observationId: string;
  value: number;
  observedAt: string;
  retrievedAt: string;
  quality: DataQuality;
};

export type MoveSynchronousSeriesEvidence = {
  seriesKey: string;
  domain: ObservationDomain;
  sourceId: string;
  state: Extract<
    MoveEvidenceAvailability,
    "AVAILABLE_SYNCHRONOUS" | "INSUFFICIENT_DATA" | "UNKNOWN"
  >;
  startTargetAt: string;
  endTargetAt: string;
  start?: MoveEvidencePoint;
  end?: MoveEvidencePoint;
  startAlignmentErrorMs?: number;
  endAlignmentErrorMs?: number;
  signedPercentChange?: number;
  reason?: string;
};

export type MoveSynchronousHorizonEvidence = {
  horizonMs: number;
  startAt: string;
  endAt: string;
  state: Extract<
    MoveEvidenceAvailability,
    "AVAILABLE_SYNCHRONOUS" | "INSUFFICIENT_DATA" | "UNKNOWN"
  >;
  coverage: "COMPLETE" | "PARTIAL" | "EMPTY";
  series: MoveSynchronousSeriesEvidence[];
};

export type MoveScheduledCatalyst = {
  eventId: string;
  eventIdentityKey: string | null;
  subject: string;
  jurisdiction: Event["jurisdiction"] | null;
  importance: Event["importance"];
  scheduledAt: string;
  retrievedAt: string;
  sourceId: string;
};

export type MoveBackgroundItem =
  | {
      kind: "USD_STABLECOIN_LIQUIDITY";
      state: Extract<MoveEvidenceAvailability, "AVAILABLE_BACKGROUND" | "INSUFFICIENT_DATA" | "UNKNOWN">;
      data: StablecoinLiquidityReadModel | null;
      reason?: string;
    }
  | {
      kind: "BTC_ETF_NET_FLOW";
      state: Extract<MoveEvidenceAvailability, "AVAILABLE_BACKGROUND" | "INSUFFICIENT_DATA" | "UNKNOWN">;
      data: BtcEtfFlowReadModel | null;
      reason?: string;
    }
  | {
      kind: "GOLD_CFTC_POSITIONING";
      state: Extract<MoveEvidenceAvailability, "AVAILABLE_BACKGROUND" | "INSUFFICIENT_DATA" | "UNKNOWN">;
      data: GoldPositioningReadModel | null;
      reason?: string;
    };

export type MoveBtcSpotFlowWindowEvidence = {
  evidenceId: string;
  windowKey: string;
  observedAt: string;
  retrievedAt: string;
  totalBaseVolumeBtc: number;
  takerBuyBaseVolumeBtc: number;
  takerSellBaseVolumeBtc: number;
  netTakerBaseVolumeBtc: number;
  takerBuyShare: number | null;
  tradeCount: number;
};

export type MoveBtcSpotFlowEvidence = {
  state: Extract<
    MoveEvidenceAvailability,
    "AVAILABLE_SYNCHRONOUS" | "INSUFFICIENT_DATA" | "UNKNOWN"
  >;
  coverage: "COMPLETE" | "PARTIAL" | "EMPTY" | "BOUNDED_QUERY_LIMIT_REACHED";
  methodology: typeof BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY;
  venue: "BINANCE";
  pair: "BTCUSDT";
  windowSeconds: 300;
  startAt: string;
  endAt: string;
  expectedCompletedWindows: number;
  windows: MoveBtcSpotFlowWindowEvidence[];
  reason?: string;
};

export type MoveEvidenceGapComponent = {
  component:
    | "BTC_DERIVATIVES"
    | "BTC_SPOT_FLOW"
    | "BTC_SPOT_ORDER_BOOK"
    | "BTC_PERP_ORDER_BOOK";
  state: Extract<
    MoveEvidenceAvailability,
    "AVAILABLE_SYNCHRONOUS" | "MISSING_HIGH_VALUE_EVIDENCE" | "INSUFFICIENT_DATA" | "UNKNOWN"
  >;
  reason: string;
  spotFlow?: MoveBtcSpotFlowEvidence;
};

export type MoveEvidenceBundle = {
  id: string;
  version: "v1";
  policy: typeof MOVE_EVIDENCE_BUNDLE_POLICY;
  moveAssessmentId: string;
  targetAsset: MoveEvidenceAsset;
  targetSeriesKey: ContinuousMoveAssessment["seriesKey"];
  asOf: string;
  investigationWindow: {
    startAt: string;
    endAt: string;
    materialHorizonsMs: number[];
  };
  synchronousMarket: {
    state: Extract<
      MoveEvidenceAvailability,
      "AVAILABLE_SYNCHRONOUS" | "INSUFFICIENT_DATA" | "UNKNOWN"
    >;
    coverage: "COMPLETE" | "PARTIAL" | "EMPTY";
    alignmentToleranceMs: typeof CROSS_SERIES_ALIGNMENT_TOLERANCE_MS;
    horizons: MoveSynchronousHorizonEvidence[];
  };
  scheduledCatalysts: {
    state: Extract<MoveEvidenceAvailability, "AVAILABLE_CATALYST" | "UNKNOWN">;
    coverage: "COMPLETE" | "BOUNDED_QUERY_LIMIT_REACHED" | "UNAVAILABLE";
    events: MoveScheduledCatalyst[];
    reason?: string;
  };
  slowBackground: {
    state: Extract<
      MoveEvidenceAvailability,
      "AVAILABLE_BACKGROUND" | "INSUFFICIENT_DATA" | "UNKNOWN"
    >;
    items: MoveBackgroundItem[];
  };
  unscheduledCatalysts: {
    state: Extract<
      MoveEvidenceAvailability,
      "INSUFFICIENT_DATA" | "UNKNOWN"
    >;
    reason: string;
    currentSourceCapability:
      | "GDELT_GAL_ROLLING_15M_CURRENT_ONLY"
      | "UNAVAILABLE";
  };
  cryptoMarketStructure?: {
    state: Extract<
      MoveEvidenceAvailability,
      "MISSING_HIGH_VALUE_EVIDENCE" | "INSUFFICIENT_DATA" | "UNKNOWN"
    >;
    components: MoveEvidenceGapComponent[];
    reason: string;
  };
  intradayRatesPricing: {
    state: "MISSING_HIGH_VALUE_EVIDENCE";
    reason: string;
    policy: "FREE_ONLY_NO_APPROVED_RUNTIME";
  };
  evidenceCompleteness: "EVIDENCE_COMPLETE" | "EVIDENCE_INCOMPLETE";
  causalAttribution: "NOT_EVALUATED";
  writesPerformed: false;
};

export type MoveEvidenceBundleBuildResult =
  | {
      status: "READY";
      bundle: MoveEvidenceBundle;
    }
  | {
      status: "NOT_TRIGGERED";
      reason: string;
    }
  | {
      status: "UNKNOWN";
      reason: string;
    };

type SeriesDefinition = {
  domain: ObservationDomain;
  seriesKey: string;
  sourceId: string;
};

const SYNCHRONOUS_SERIES: readonly SeriesDefinition[] = [
  { domain: "ASSET", seriesKey: "btc.spot.usd", sourceId: "coingecko-market" },
  { domain: "ASSET", seriesKey: "eth.spot.usd", sourceId: "coingecko-market" },
  { domain: "ASSET", seriesKey: "dxy.index.usd", sourceId: "yahoo-finance" },
  { domain: "ASSET", seriesKey: "gold.futures.usd", sourceId: "yahoo-finance" },
  { domain: "ASSET", seriesKey: "fx.usdjpy.jpy_per_usd", sourceId: "yahoo-finance" },
  { domain: "ASSET", seriesKey: "fx.usdcnh.cnh_per_usd", sourceId: "yahoo-finance" },
];

function timestamp(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function numeric(observation: Observation): number | undefined {
  const parsed = Number(observation.value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function point(observation: Observation): MoveEvidencePoint | undefined {
  const value = numeric(observation);
  if (value === undefined) return undefined;
  return {
    observationId: observation.id,
    value,
    observedAt: observation.observedAt,
    retrievedAt: observation.retrievedAt,
    quality: observation.quality,
  };
}

function targetAsset(seriesKey: ContinuousMoveAssessment["seriesKey"]): MoveEvidenceAsset {
  return seriesKey === "btc.spot.usd" ? "BTC" : "GOLD";
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function latestByObservedAt(observations: Observation[]): Observation[] {
  const latest = new Map<number, Observation>();
  for (const observation of observations) {
    const observedAt = timestamp(observation.observedAt);
    if (observedAt === undefined) continue;
    const existing = latest.get(observedAt);
    if (
      !existing
      || observation.retrievedAt > existing.retrievedAt
      || (
        observation.retrievedAt === existing.retrievedAt
        && observation.id > existing.id
      )
    ) {
      latest.set(observedAt, observation);
    }
  }
  return [...latest.values()];
}

function nearest(
  observations: Observation[],
  desiredAt: number,
): { observation: Observation; errorMs: number } | undefined {
  let selected: { observation: Observation; observedAt: number; errorMs: number } | undefined;
  for (const observation of latestByObservedAt(observations)) {
    const observedAt = timestamp(observation.observedAt);
    if (observedAt === undefined) continue;
    const errorMs = Math.abs(observedAt - desiredAt);
    if (errorMs > CROSS_SERIES_ALIGNMENT_TOLERANCE_MS) continue;
    if (
      !selected
      || errorMs < selected.errorMs
      || (errorMs === selected.errorMs && observedAt > selected.observedAt)
      || (
        errorMs === selected.errorMs
        && observedAt === selected.observedAt
        && observation.id > selected.observation.id
      )
    ) {
      selected = { observation, observedAt, errorMs };
    }
  }
  return selected
    ? { observation: selected.observation, errorMs: selected.errorMs }
    : undefined;
}

async function nearestPoint(input: {
  repository: HistoricalObservationRepository;
  definition: SeriesDefinition;
  desiredAt: string;
  asOf: string;
}): Promise<
  | { status: "AVAILABLE"; point: MoveEvidencePoint; alignmentErrorMs: number }
  | { status: "MISSING"; reason: string }
  | { status: "UNKNOWN"; reason: string }
> {
  const desiredAt = timestamp(input.desiredAt);
  if (desiredAt === undefined) {
    return { status: "UNKNOWN", reason: "Synchronous target timestamp is invalid." };
  }

  const from = new Date(desiredAt - CROSS_SERIES_ALIGNMENT_TOLERANCE_MS).toISOString();
  const through = new Date(desiredAt + CROSS_SERIES_ALIGNMENT_TOLERANCE_MS).toISOString();

  try {
    const history = await input.repository.findHistory({
      identity: {
        domain: input.definition.domain,
        seriesKey: input.definition.seriesKey,
      },
      sourceId: input.definition.sourceId,
      observedAtOnOrAfter: from,
      observedAtOnOrBefore: through,
      retrievedAtOnOrBefore: input.asOf,
      order: "ASC",
      limit: SYNCHRONOUS_QUERY_LIMIT,
    });

    if (history.length >= SYNCHRONOUS_QUERY_LIMIT) {
      return {
        status: "UNKNOWN",
        reason: "Bounded synchronous query reached its 50-row limit.",
      };
    }

    const eligible = history.filter((observation) =>
      observation.domain === input.definition.domain
      && observation.sourceId === input.definition.sourceId
      && observationSemanticSeriesKey(observation) === input.definition.seriesKey
      && historicalObservationFitnessEligible(observation)
      && numeric(observation) !== undefined);

    const selected = nearest(eligible, desiredAt);
    if (!selected) {
      return {
        status: "MISSING",
        reason: "No point-in-time eligible Observation exists inside the ±120s alignment window.",
      };
    }

    const selectedPoint = point(selected.observation);
    if (!selectedPoint) {
      return {
        status: "UNKNOWN",
        reason: "Selected synchronous Observation is non-numeric.",
      };
    }

    return {
      status: "AVAILABLE",
      point: selectedPoint,
      alignmentErrorMs: selected.errorMs,
    };
  } catch {
    return {
      status: "UNKNOWN",
      reason: "Historical Observation repository read failed.",
    };
  }
}

async function buildSynchronousSeries(input: {
  repository: HistoricalObservationRepository;
  definition: SeriesDefinition;
  startAt: string;
  endAt: string;
  asOf: string;
}): Promise<MoveSynchronousSeriesEvidence> {
  const [start, end] = await Promise.all([
    nearestPoint({
      repository: input.repository,
      definition: input.definition,
      desiredAt: input.startAt,
      asOf: input.asOf,
    }),
    nearestPoint({
      repository: input.repository,
      definition: input.definition,
      desiredAt: input.endAt,
      asOf: input.asOf,
    }),
  ]);

  if (start.status === "UNKNOWN" || end.status === "UNKNOWN") {
    return {
      ...input.definition,
      state: "UNKNOWN",
      startTargetAt: input.startAt,
      endTargetAt: input.endAt,
      reason: [start, end]
        .filter((item) => item.status === "UNKNOWN")
        .map((item) => item.reason)
        .join(" "),
    };
  }

  if (start.status !== "AVAILABLE" || end.status !== "AVAILABLE") {
    return {
      ...input.definition,
      state: "INSUFFICIENT_DATA",
      startTargetAt: input.startAt,
      endTargetAt: input.endAt,
      ...(start.status === "AVAILABLE"
        ? { start: start.point, startAlignmentErrorMs: start.alignmentErrorMs }
        : {}),
      ...(end.status === "AVAILABLE"
        ? { end: end.point, endAlignmentErrorMs: end.alignmentErrorMs }
        : {}),
      reason: [start, end]
        .filter((item) => item.status === "MISSING")
        .map((item) => item.reason)
        .join(" "),
    };
  }

  const signedPercentChange = start.point.value === 0
    ? undefined
    : ((end.point.value - start.point.value) / start.point.value) * 100;

  if (signedPercentChange === undefined || !Number.isFinite(signedPercentChange)) {
    return {
      ...input.definition,
      state: "UNKNOWN",
      startTargetAt: input.startAt,
      endTargetAt: input.endAt,
      start: start.point,
      end: end.point,
      startAlignmentErrorMs: start.alignmentErrorMs,
      endAlignmentErrorMs: end.alignmentErrorMs,
      reason: "Synchronous percentage change is undefined for the selected points.",
    };
  }

  return {
    ...input.definition,
    state: "AVAILABLE_SYNCHRONOUS",
    startTargetAt: input.startAt,
    endTargetAt: input.endAt,
    start: start.point,
    end: end.point,
    startAlignmentErrorMs: start.alignmentErrorMs,
    endAlignmentErrorMs: end.alignmentErrorMs,
    signedPercentChange,
  };
}

async function buildScheduledCatalysts(input: {
  repository: HistoricalEventRepository;
  startAt: string;
  endAt: string;
  asOf: string;
}): Promise<MoveEvidenceBundle["scheduledCatalysts"]> {
  try {
    const events = await input.repository.findHistory({
      scheduledAtOnOrAfter: input.startAt,
      scheduledAtOnOrBefore: input.endAt,
      retrievedAtOnOrBefore: input.asOf,
      order: "ASC",
      limit: SCHEDULED_EVENT_QUERY_LIMIT,
    });

    if (events.length >= SCHEDULED_EVENT_QUERY_LIMIT) {
      return {
        state: "UNKNOWN",
        coverage: "BOUNDED_QUERY_LIMIT_REACHED",
        events: [],
        reason: "Scheduled Event query reached the bounded 500-row limit.",
      };
    }

    return {
      state: "AVAILABLE_CATALYST",
      coverage: "COMPLETE",
      events: events.flatMap((event) => {
        const scheduledAt = event.identity?.scheduledAt ?? event.scheduledAt;
        if (!scheduledAt) return [];
        return [{
          eventId: event.id,
          eventIdentityKey: event.identity?.key ?? null,
          subject: event.subject,
          jurisdiction: event.jurisdiction ?? null,
          importance: event.importance,
          scheduledAt,
          retrievedAt: event.retrievedAt,
          sourceId: event.sourceId,
        }];
      }),
    };
  } catch {
    return {
      state: "UNKNOWN",
      coverage: "UNAVAILABLE",
      events: [],
      reason: "Historical Event repository read failed.",
    };
  }
}

async function buildBackground(input: {
  repository: HistoricalObservationRepository;
  asset: MoveEvidenceAsset;
  asOf: string;
}): Promise<MoveEvidenceBundle["slowBackground"]> {
  const asOf = new Date(input.asOf);
  if (!Number.isFinite(asOf.getTime())) {
    return {
      state: "UNKNOWN",
      items: [],
    };
  }

  if (input.asset === "BTC") {
    const [stablecoin, etf] = await Promise.all([
      (async (): Promise<MoveBackgroundItem> => {
        try {
          const data = await buildStablecoinLiquidityReadModel(input.repository, asOf);
          return data.latest
            ? {
                kind: "USD_STABLECOIN_LIQUIDITY",
                state: "AVAILABLE_BACKGROUND",
                data,
              }
            : {
                kind: "USD_STABLECOIN_LIQUIDITY",
                state: "INSUFFICIENT_DATA",
                data,
                reason: "No point-in-time stablecoin liquidity observation is available.",
              };
        } catch {
          return {
            kind: "USD_STABLECOIN_LIQUIDITY",
            state: "UNKNOWN",
            data: null,
            reason: "Stablecoin liquidity history read failed.",
          };
        }
      })(),
      (async (): Promise<MoveBackgroundItem> => {
        try {
          const data = await buildBtcEtfFlowReadModel(input.repository, asOf);
          return data.latest
            ? {
                kind: "BTC_ETF_NET_FLOW",
                state: "AVAILABLE_BACKGROUND",
                data,
              }
            : {
                kind: "BTC_ETF_NET_FLOW",
                state: "INSUFFICIENT_DATA",
                data,
                reason: "No matured point-in-time BTC ETF flow observation is available.",
              };
        } catch {
          return {
            kind: "BTC_ETF_NET_FLOW",
            state: "UNKNOWN",
            data: null,
            reason: "BTC ETF flow history read failed.",
          };
        }
      })(),
    ]);

    const items = [stablecoin, etf];
    const available = items.filter((item) => item.state === "AVAILABLE_BACKGROUND").length;
    return {
      state: available > 0
        ? "AVAILABLE_BACKGROUND"
        : items.some((item) => item.state === "UNKNOWN")
          ? "UNKNOWN"
          : "INSUFFICIENT_DATA",
      items,
    };
  }

  try {
    const data = await buildGoldPositioningReadModel(input.repository, asOf);
    const item: MoveBackgroundItem = data.status === "AVAILABLE"
      ? {
          kind: "GOLD_CFTC_POSITIONING",
          state: "AVAILABLE_BACKGROUND",
          data,
        }
      : {
          kind: "GOLD_CFTC_POSITIONING",
          state: "INSUFFICIENT_DATA",
          data,
          reason: data.reason,
        };
    return {
      state: item.state,
      items: [item],
    };
  } catch {
    return {
      state: "UNKNOWN",
      items: [{
        kind: "GOLD_CFTC_POSITIONING",
        state: "UNKNOWN",
        data: null,
        reason: "Gold positioning history read failed.",
      }],
    };
  }
}

function completedSpotFlowBoundaries(
  startAt: string,
  endAt: string,
): number[] | undefined {
  const start = timestamp(startAt);
  const end = timestamp(endAt);
  if (start === undefined || end === undefined || end <= start) return undefined;

  const first = Math.floor(start / SPOT_FLOW_WINDOW_MS) * SPOT_FLOW_WINDOW_MS
    + SPOT_FLOW_WINDOW_MS;
  const last = Math.floor(end / SPOT_FLOW_WINDOW_MS) * SPOT_FLOW_WINDOW_MS;
  if (first > last) return [];

  const boundaries: number[] = [];
  for (let current = first; current <= last; current += SPOT_FLOW_WINDOW_MS) {
    boundaries.push(current);
  }
  return boundaries;
}

async function buildBtcSpotFlowEvidence(input: {
  repository: HistoricalEvidenceRepository;
  startAt: string;
  endAt: string;
  asOf: string;
}): Promise<MoveBtcSpotFlowEvidence> {
  const boundaries = completedSpotFlowBoundaries(input.startAt, input.endAt);
  const start = timestamp(input.startAt);
  if (!boundaries || start === undefined) {
    return {
      state: "UNKNOWN",
      coverage: "EMPTY",
      methodology: BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY,
      venue: "BINANCE",
      pair: "BTCUSDT",
      windowSeconds: 300,
      startAt: input.startAt,
      endAt: input.endAt,
      expectedCompletedWindows: 0,
      windows: [],
      reason: "MOVE spot-flow investigation window is invalid.",
    };
  }

  if (boundaries.length === 0) {
    return {
      state: "INSUFFICIENT_DATA",
      coverage: "EMPTY",
      methodology: BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY,
      venue: "BINANCE",
      pair: "BTCUSDT",
      windowSeconds: 300,
      startAt: input.startAt,
      endAt: input.endAt,
      expectedCompletedWindows: 0,
      windows: [],
      reason: "The MOVE window contains no completed Binance 5m boundary.",
    };
  }

  try {
    const history = await input.repository.findHistory({
      sourceId: "binance-spot",
      kind: "OBSERVATION",
      effectiveAtOnOrAfter: new Date(start + 1).toISOString(),
      effectiveAtOnOrBefore: input.endAt,
      retrievedAtOnOrBefore: input.asOf,
      metadataEquals: {
        methodology: BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY,
        venue: "BINANCE",
        pair: "BTCUSDT",
      },
      order: "ASC",
      limit: SPOT_FLOW_QUERY_LIMIT,
    });

    if (history.length >= SPOT_FLOW_QUERY_LIMIT) {
      return {
        state: "UNKNOWN",
        coverage: "BOUNDED_QUERY_LIMIT_REACHED",
        methodology: BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY,
        venue: "BINANCE",
        pair: "BTCUSDT",
        windowSeconds: 300,
        startAt: input.startAt,
        endAt: input.endAt,
        expectedCompletedWindows: boundaries.length,
        windows: [],
        reason: "Bounded Binance spot-flow query reached its 100-row limit.",
      };
    }

    const parsed = history.map((evidence) => ({
      evidence,
      window: btcSpotFlowWindowFromEvidence(evidence),
    }));
    if (parsed.some((item) => item.window === null)) {
      return {
        state: "UNKNOWN",
        coverage: "EMPTY",
        methodology: BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY,
        venue: "BINANCE",
        pair: "BTCUSDT",
        windowSeconds: 300,
        startAt: input.startAt,
        endAt: input.endAt,
        expectedCompletedWindows: boundaries.length,
        windows: [],
        reason: "Qualified Binance spot-flow history contains an invalid durable payload.",
      };
    }

    const latestByWindow = new Map<string, MoveBtcSpotFlowWindowEvidence>();
    for (const item of parsed) {
      const window = item.window!;
      const key = String(item.evidence.metadata?.windowKey ?? "");
      const candidate: MoveBtcSpotFlowWindowEvidence = {
        evidenceId: item.evidence.id,
        windowKey: key,
        observedAt: window.observedAt,
        retrievedAt: item.evidence.retrievedAt,
        totalBaseVolumeBtc: window.totalBaseVolumeBtc,
        takerBuyBaseVolumeBtc: window.takerBuyBaseVolumeBtc,
        takerSellBaseVolumeBtc: window.takerSellBaseVolumeBtc,
        netTakerBaseVolumeBtc: window.netTakerBaseVolumeBtc,
        takerBuyShare: window.takerBuyShare,
        tradeCount: window.tradeCount,
      };
      const existing = latestByWindow.get(key);
      if (
        !existing
        || candidate.retrievedAt > existing.retrievedAt
        || (
          candidate.retrievedAt === existing.retrievedAt
          && candidate.evidenceId > existing.evidenceId
        )
      ) {
        latestByWindow.set(key, candidate);
      }
    }

    const expected = new Set(boundaries);
    const windows = [...latestByWindow.values()]
      .filter((item) => {
        const observedAt = timestamp(item.observedAt);
        return observedAt !== undefined && expected.has(observedAt);
      })
      .sort((left, right) =>
        left.observedAt.localeCompare(right.observedAt)
        || left.evidenceId.localeCompare(right.evidenceId));

    const coverage: MoveBtcSpotFlowEvidence["coverage"] =
      windows.length === boundaries.length
        ? "COMPLETE"
        : windows.length > 0
          ? "PARTIAL"
          : "EMPTY";

    return {
      state: windows.length > 0 ? "AVAILABLE_SYNCHRONOUS" : "INSUFFICIENT_DATA",
      coverage,
      methodology: BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY,
      venue: "BINANCE",
      pair: "BTCUSDT",
      windowSeconds: 300,
      startAt: input.startAt,
      endAt: input.endAt,
      expectedCompletedWindows: boundaries.length,
      windows,
      ...(coverage === "COMPLETE"
        ? {}
        : {
            reason:
              `Point-in-time durable Binance spot-flow covers ${windows.length}/${boundaries.length} completed 5m windows inside the MOVE investigation window.`,
          }),
    };
  } catch {
    return {
      state: "UNKNOWN",
      coverage: "EMPTY",
      methodology: BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY,
      venue: "BINANCE",
      pair: "BTCUSDT",
      windowSeconds: 300,
      startAt: input.startAt,
      endAt: input.endAt,
      expectedCompletedWindows: boundaries.length,
      windows: [],
      reason: "Historical Evidence repository read failed for Binance spot-flow.",
    };
  }
}

async function btcMarketStructure(input: {
  evidence: HistoricalEvidenceRepository;
  startAt: string;
  endAt: string;
  asOf: string;
}): Promise<MoveEvidenceBundle["cryptoMarketStructure"]> {
  const spotFlow = await buildBtcSpotFlowEvidence({
    repository: input.evidence,
    startAt: input.startAt,
    endAt: input.endAt,
    asOf: input.asOf,
  });

  const components: MoveEvidenceGapComponent[] = [
    {
      component: "BTC_DERIVATIVES",
      state: "INSUFFICIENT_DATA",
      reason:
        "Coinalyze derivatives are technically live-qualified read-only, but durable point-in-time history is not approved; current data cannot replay the MOVE asOf cutoff.",
    },
    {
      component: "BTC_SPOT_FLOW",
      state: spotFlow.state,
      reason: spotFlow.reason
        ?? "Durable Binance BTCUSDT completed 5m taker-flow windows are replayable under the MOVE asOf cutoff.",
      spotFlow,
    },
    {
      component: "BTC_SPOT_ORDER_BOOK",
      state: "INSUFFICIENT_DATA",
      reason:
        "Binance Spot order-book evidence is a current retrieval-time snapshot without historical MOVE-window snapshots.",
    },
    {
      component: "BTC_PERP_ORDER_BOOK",
      state: "INSUFFICIENT_DATA",
      reason:
        "Hyperliquid/Binance-perp order-book evidence is current-only and cannot establish past MOVE-window liquidity geometry.",
    },
  ];

  return {
    state: "INSUFFICIENT_DATA",
    components,
    reason: spotFlow.state === "AVAILABLE_SYNCHRONOUS"
      ? "Durable Binance spot-flow is replayable, but BTC derivatives and spot/perpetual order-book history remain incomplete."
      : "BTC market-structure evidence remains incomplete under the MOVE point-in-time cutoff.",
  };
}

type MaterialHorizonWindow = {
  horizonMs: number;
  startAt: string;
  endAt: string;
};

function materialHorizonWindows(
  assessment: ContinuousMoveAssessment,
): MaterialHorizonWindow[] | undefined {
  if (assessment.status !== "MATERIAL_MOVE" || !assessment.hasMaterialMove) return undefined;

  const material = assessment.horizons
    .filter((item) => item.status === "MATERIAL_MOVE")
    .sort((left, right) => left.horizonMs - right.horizonMs);
  if (material.length === 0) return undefined;

  const end = timestamp(assessment.targetEndObservedAt);
  if (end === undefined) return undefined;

  const windows = material.flatMap((item) => {
    const start = item.targetStartObservedAt ? timestamp(item.targetStartObservedAt) : undefined;
    const itemEnd = item.targetEndObservedAt ? timestamp(item.targetEndObservedAt) : undefined;
    if (start === undefined || itemEnd === undefined || itemEnd !== end) return [];
    return [{
      horizonMs: item.horizonMs,
      startAt: new Date(start).toISOString(),
      endAt: new Date(end).toISOString(),
    }];
  });

  return windows.length === material.length ? windows : undefined;
}

function investigationWindow(
  horizons: MaterialHorizonWindow[],
): {
  startAt: string;
  endAt: string;
  materialHorizonsMs: number[];
} | undefined {
  if (horizons.length === 0) return undefined;
  const starts = horizons.map((item) => timestamp(item.startAt));
  const end = timestamp(horizons[0].endAt);
  if (starts.some((value) => value === undefined) || end === undefined) return undefined;

  return {
    startAt: new Date(Math.min(...starts as number[])).toISOString(),
    endAt: new Date(end).toISOString(),
    materialHorizonsMs: horizons.map((item) => item.horizonMs),
  };
}

async function buildSynchronousHorizon(input: {
  repository: HistoricalObservationRepository;
  horizon: MaterialHorizonWindow;
  asOf: string;
}): Promise<MoveSynchronousHorizonEvidence> {
  const series = await Promise.all(SYNCHRONOUS_SERIES.map((definition) =>
    buildSynchronousSeries({
      repository: input.repository,
      definition,
      startAt: input.horizon.startAt,
      endAt: input.horizon.endAt,
      asOf: input.asOf,
    })));

  const available = series.filter((item) => item.state === "AVAILABLE_SYNCHRONOUS").length;
  const state: MoveSynchronousHorizonEvidence["state"] =
    available > 0
      ? "AVAILABLE_SYNCHRONOUS"
      : series.some((item) => item.state === "UNKNOWN")
        ? "UNKNOWN"
        : "INSUFFICIENT_DATA";
  const coverage: MoveSynchronousHorizonEvidence["coverage"] =
    available === series.length
      ? "COMPLETE"
      : available > 0
        ? "PARTIAL"
        : "EMPTY";

  return {
    ...input.horizon,
    state,
    coverage,
    series,
  };
}

export async function buildMoveEvidenceBundle(input: {
  assessment: ContinuousMoveAssessment;
  observations: HistoricalObservationRepository;
  events: HistoricalEventRepository;
  evidence: HistoricalEvidenceRepository;
}): Promise<MoveEvidenceBundleBuildResult> {
  const materialHorizons = materialHorizonWindows(input.assessment);
  const window = materialHorizons ? investigationWindow(materialHorizons) : undefined;
  if (!materialHorizons || !window) {
    return {
      status: "NOT_TRIGGERED",
      reason: "MOVE-002B requires a MOVE-001C MATERIAL_MOVE assessment with complete material-horizon lineage.",
    };
  }

  const asOfMs = timestamp(input.assessment.asOf);
  const endMs = timestamp(window.endAt);
  if (asOfMs === undefined || endMs === undefined || endMs > asOfMs) {
    return {
      status: "UNKNOWN",
      reason: "MOVE assessment has an invalid point-in-time cutoff.",
    };
  }

  const asset = targetAsset(input.assessment.seriesKey);
  const [synchronousHorizons, scheduledCatalysts, slowBackground, marketStructure] = await Promise.all([
    Promise.all(materialHorizons.map((horizon) => buildSynchronousHorizon({
      repository: input.observations,
      horizon,
      asOf: input.assessment.asOf,
    }))),
    buildScheduledCatalysts({
      repository: input.events,
      startAt: window.startAt,
      endAt: window.endAt,
      asOf: input.assessment.asOf,
    }),
    buildBackground({
      repository: input.observations,
      asset,
      asOf: input.assessment.asOf,
    }),
    asset === "BTC"
      ? btcMarketStructure({
          evidence: input.evidence,
          startAt: window.startAt,
          endAt: window.endAt,
          asOf: input.assessment.asOf,
        })
      : Promise.resolve(undefined),
  ]);

  const completeHorizons = synchronousHorizons.filter((item) => item.coverage === "COMPLETE").length;
  const anySynchronous = synchronousHorizons.some(
    (item) => item.state === "AVAILABLE_SYNCHRONOUS",
  );
  const synchronousState: MoveEvidenceBundle["synchronousMarket"]["state"] =
    anySynchronous
      ? "AVAILABLE_SYNCHRONOUS"
      : synchronousHorizons.some((item) => item.state === "UNKNOWN")
        ? "UNKNOWN"
        : "INSUFFICIENT_DATA";
  const synchronousCoverage: MoveEvidenceBundle["synchronousMarket"]["coverage"] =
    completeHorizons === synchronousHorizons.length
      ? "COMPLETE"
      : synchronousHorizons.some((item) => item.coverage !== "EMPTY")
        ? "PARTIAL"
        : "EMPTY";

  const withoutId: Omit<MoveEvidenceBundle, "id"> = {
    version: "v1",
    policy: MOVE_EVIDENCE_BUNDLE_POLICY,
    moveAssessmentId: input.assessment.id,
    targetAsset: asset,
    targetSeriesKey: input.assessment.seriesKey,
    asOf: input.assessment.asOf,
    investigationWindow: window,
    synchronousMarket: {
      state: synchronousState,
      coverage: synchronousCoverage,
      alignmentToleranceMs: CROSS_SERIES_ALIGNMENT_TOLERANCE_MS,
      horizons: synchronousHorizons,
    },
    scheduledCatalysts,
    slowBackground,
    unscheduledCatalysts: {
      state: "INSUFFICIENT_DATA",
      reason:
        "GDELT GAL is qualified for the current rolling 15-minute feed only; no durable acquisition exists to replay candidate catalysts at the MOVE asOf cutoff.",
      currentSourceCapability: "GDELT_GAL_ROLLING_15M_CURRENT_ONLY",
    },
    ...(asset === "BTC" ? { cryptoMarketStructure: marketStructure } : {}),
    intradayRatesPricing: {
      state: "MISSING_HIGH_VALUE_EVIDENCE",
      reason:
        "Owner policy is FREE_ONLY. No free, rights-compatible intraday cash-rates or risk-bounded Treasury-futures proxy runtime is approved; MOVE-002B must keep rates evidence explicitly missing.",
      policy: "FREE_ONLY_NO_APPROVED_RUNTIME",
    },
    evidenceCompleteness: "EVIDENCE_INCOMPLETE",
    causalAttribution: "NOT_EVALUATED",
    writesPerformed: false,
  };

  return {
    status: "READY",
    bundle: {
      id: "move-evidence-bundle-v1-" + hash(withoutId),
      ...withoutId,
    },
  };
}
