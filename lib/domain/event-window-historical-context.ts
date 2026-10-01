import { createHash } from "node:crypto";
import type { HistoricalBaselineEvidence } from "./historical-baseline";
import type { EventWindowRole } from "./event-window";

export const EVENT_WINDOW_HISTORICAL_CONTEXT_POLICY_V1 =
  "event-window-historical-move-context-v1" as const;

export type EventWindowHistoricalSeriesContext = {
  observationKey: string;
  seriesKey: string;
  sourceId: string;
  beforeObservationId: string;
  afterObservationId: string;
  comparisonHorizonMs: number;
  historicalBaseline: HistoricalBaselineEvidence;
};

export type EventWindowHistoricalContext = {
  id: string;
  version: "v1";
  policy: typeof EVENT_WINDOW_HISTORICAL_CONTEXT_POLICY_V1;
  eventIdentityKey: string;
  windowId: string;
  comparisonId: string;
  afterRole: Exclude<EventWindowRole, "PRE">;
  knowledgeAt: string;
  contaminationStatus: "CLEAN" | "CONTAMINATED";
  contaminantEventIdentityKeys: string[];
  requestedObservationKeys: string[];
  missingObservationKeys: string[];
  series: EventWindowHistoricalSeriesContext[];
  causalAttribution: "NOT_EVALUATED";
};

function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("HIST-001C requires valid " + field + ".");
  }
  return parsed;
}

export function buildEventWindowHistoricalContext(input: {
  eventIdentityKey: string;
  windowId: string;
  comparisonId: string;
  afterRole: Exclude<EventWindowRole, "PRE">;
  knowledgeAt: string;
  contaminationStatus: "CLEAN" | "CONTAMINATED";
  contaminantEventIdentityKeys: string[];
  requestedObservationKeys: string[];
  missingObservationKeys: string[];
  series: EventWindowHistoricalSeriesContext[];
}): EventWindowHistoricalContext {
  if (!input.eventIdentityKey.trim() || !input.windowId.trim() || !input.comparisonId.trim()) {
    throw new Error("HIST-001C requires Event/window/comparison lineage.");
  }
  timestamp(input.knowledgeAt, "knowledgeAt");

  const contaminantEventIdentityKeys = [...new Set(input.contaminantEventIdentityKeys)].sort();
  const requestedObservationKeys = [...new Set(input.requestedObservationKeys)].sort();
  const missingObservationKeys = [...new Set(input.missingObservationKeys)].sort();
  if (missingObservationKeys.some((key) => !requestedObservationKeys.includes(key))) {
    throw new Error("HIST-001C missing keys must belong to the requested observation set.");
  }
  const series = [...input.series].sort((a, b) =>
    a.observationKey.localeCompare(b.observationKey));
  const seriesKeys = series.map((item) => item.observationKey);
  if (seriesKeys.some((key) => !requestedObservationKeys.includes(key))) {
    throw new Error("HIST-001C series contexts must belong to the requested observation set.");
  }
  if (seriesKeys.some((key) => missingObservationKeys.includes(key))) {
    throw new Error("HIST-001C a requested observation cannot be both resolved and missing.");
  }
  if ([...seriesKeys, ...missingObservationKeys].sort().join("\\n") !== requestedObservationKeys.join("\\n")) {
    throw new Error("HIST-001C must account for every requested observation key.");
  }

  const keys = new Set<string>();
  for (const item of series) {
    if (!item.observationKey.trim() || !item.seriesKey.trim() || !item.sourceId.trim()) {
      throw new Error("HIST-001C series context requires observation/series/source identity.");
    }
    if (keys.has(item.observationKey)) {
      throw new Error("HIST-001C series contexts must use unique observation keys.");
    }
    keys.add(item.observationKey);

    if (!Number.isInteger(item.comparisonHorizonMs) || item.comparisonHorizonMs <= 0) {
      throw new Error("HIST-001C comparison horizon must be a positive integer.");
    }
    if (
      item.historicalBaseline.methodology.identity.seriesKey !== item.seriesKey
      || item.historicalBaseline.methodology.sourceId !== item.sourceId
    ) {
      throw new Error("HIST-001C historical baseline identity/source does not match the event move.");
    }
    if (item.historicalBaseline.methodology.transformation === "LEVEL") {
      throw new Error("HIST-001C requires a change-based historical baseline.");
    }
    if (item.historicalBaseline.methodology.asOf !== input.knowledgeAt) {
      throw new Error("HIST-001C historical baseline must share the post-event knowledge cutoff.");
    }
    if (item.historicalBaseline.methodology.comparisonHorizonMs !== item.comparisonHorizonMs) {
      throw new Error("HIST-001C historical baseline horizon does not match the event move.");
    }
    if (
      item.historicalBaseline.targetObservationIds.length !== 2
      || item.historicalBaseline.targetObservationIds[0] !== item.beforeObservationId
      || item.historicalBaseline.targetObservationIds[1] !== item.afterObservationId
    ) {
      throw new Error("HIST-001C historical baseline target lineage does not match the event move.");
    }
  }

  const withoutId: Omit<EventWindowHistoricalContext, "id"> = {
    version: "v1",
    policy: EVENT_WINDOW_HISTORICAL_CONTEXT_POLICY_V1,
    eventIdentityKey: input.eventIdentityKey,
    windowId: input.windowId,
    comparisonId: input.comparisonId,
    afterRole: input.afterRole,
    knowledgeAt: input.knowledgeAt,
    contaminationStatus: input.contaminationStatus,
    contaminantEventIdentityKeys,
    requestedObservationKeys,
    missingObservationKeys,
    series,
    causalAttribution: "NOT_EVALUATED",
  };

  return {
    id: "event-window-historical-context-v1-" + stableHash(withoutId),
    ...withoutId,
  };
}
