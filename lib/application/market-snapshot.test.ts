import type { FactualBaseline } from "../domain/baseline";
import {
  buildMarketSnapshot,
  marketSnapshotBaselineKey,
  marketSnapshotEventKey,
  marketSnapshotObservationKey,
  type MarketSnapshotRequest,
} from "../domain/market-snapshot";
import type { PricingBaseline } from "../domain/pricing-baseline";
import type { Event, Observation } from "../domain/types";
import {
  marketMemoryDedupeKey,
  marketMemoryEffectiveAt,
} from "../data/market-memory-record";
import { InMemoryMarketSnapshotRepository } from "../repositories/memory";
import { captureMarketSnapshot } from "./market-snapshot";

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      label
      + ": expected "
      + JSON.stringify(expected)
      + ", got "
      + JSON.stringify(actual),
    );
  }
}

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label);
}

function assertThrows(label: string, action: () => unknown): void {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(label + ": expected action to throw");
}

function observation(
  id: string,
  metricId: string,
  observedAt: string,
  retrievedAt: string,
  value: string,
  overrides: Partial<Observation> = {},
): Observation {
  return {
    id,
    domain: "ASSET",
    subject: metricId,
    value,
    observedAt,
    retrievedAt,
    sourceId: metricId === "btc.spot.usd" ? "coingecko-market" : "yahoo-finance",
    quality: "FRESH",
    evidenceId: "evidence-" + id,
    metadata: {
      metricId,
      unit: metricId.endsWith(".usd") ? "USD" : "Index",
    },
    ...overrides,
  };
}

function pricingBaseline(
  observationItem: Observation,
  seriesKey: string,
  asOf: string,
  overrides: Partial<PricingBaseline> = {},
): PricingBaseline {
  return {
    kind: "PRICING",
    status: "VALID",
    seriesKey,
    legacyDomain: observationItem.domain,
    sourceId: observationItem.sourceId,
    asOf,
    maxObservationAgeMs: 15 * 60 * 1000,
    observationId: observationItem.id,
    value: Number(observationItem.value),
    unit: typeof observationItem.metadata?.unit === "string"
      ? observationItem.metadata.unit
      : null,
    observedAt: observationItem.observedAt,
    retrievedAt: observationItem.retrievedAt,
    ageMs: Date.parse(asOf) - Date.parse(observationItem.observedAt),
    quality: observationItem.quality,
    evidenceId: observationItem.evidenceId,
    marketDomain: seriesKey === "dxy.index.usd" ? "FX" : "CRYPTO",
    semantics: seriesKey === "dxy.index.usd"
      ? {
          ontologyVersion: "v0.1",
          marketDomain: "FX",
          informationClass: "PRICING",
          jurisdiction: "US",
          instrument: "FX_INDEX",
          asset: "USD",
        }
      : {
          ontologyVersion: "v0.1",
          marketDomain: "CRYPTO",
          informationClass: "PRICING",
          jurisdiction: "GLOBAL",
          instrument: "CRYPTO_SPOT",
          asset: "BTC",
        },
    selectionPolicy: "latest-qualified-pricing-as-of-v1",
    ...overrides,
  };
}

const capturedAt = "2026-10-15T12:29:59.999Z";
const btc = observation(
  "btc-1",
  "btc.spot.usd",
  "2026-10-15T12:25:00.000Z",
  "2026-10-15T12:25:05.000Z",
  "68000",
);
const dxy = observation(
  "dxy-1",
  "dxy.index.usd",
  "2026-10-15T12:25:00.000Z",
  "2026-10-15T12:25:05.000Z",
  "103.1",
);
const dxyPricing = pricingBaseline(dxy, "dxy.index.usd", capturedAt);

function request(
  overrides: Partial<MarketSnapshotRequest> = {},
): MarketSnapshotRequest {
  return {
    capturedAt,
    scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
    observations: [btc, dxy],
    baselines: [dxyPricing],
    requirements: [
      { kind: "OBSERVATION", key: marketSnapshotObservationKey(btc) },
      { kind: "OBSERVATION", key: marketSnapshotObservationKey(dxy) },
      { kind: "BASELINE", key: marketSnapshotBaselineKey(dxyPricing) },
    ],
    metadata: {
      captureRole: "PRE_EVENT",
      windowPolicy: "caller-owned",
    },
    ...overrides,
  };
}

async function main(): Promise<void> {
  const snapshot = buildMarketSnapshot(request());
  assertEqual(snapshot.quality, "COMPLETE", "complete explicit scope");
  assertEqual(snapshot.missingRequirements, [], "no missing requirements");
  assertEqual(snapshot.stateRefs, [], "deferred State is not activated");
  assertEqual(snapshot.sourceHealthRefs, [], "unverified health refs remain empty");
  assertEqual(
    snapshot.observationRefs.map((ref) => ref.observationId).sort(),
    ["btc-1", "dxy-1"],
    "snapshot stores canonical observation references",
  );
  assert(
    !("value" in snapshot.observationRefs[0]),
    "snapshot must not duplicate canonical observation values",
  );
  assertEqual(
    snapshot.baselineRefs[0]?.observationIds,
    ["dxy-1"],
    "pricing baseline reference retains canonical lineage",
  );

  const reordered = buildMarketSnapshot(request({
    observations: [dxy, btc],
    requirements: [...request().requirements].reverse(),
    metadata: {
      windowPolicy: "caller-owned",
      captureRole: "PRE_EVENT",
    },
  }));
  assertEqual(
    reordered.id,
    snapshot.id,
    "snapshot id is deterministic independent of input ordering",
  );

  const missingGold = buildMarketSnapshot(request({
    requirements: [
      ...request().requirements,
      {
        kind: "OBSERVATION",
        key: "ASSET:gold.futures.usd:yahoo-finance",
      },
    ],
  }));
  assertEqual(missingGold.quality, "PARTIAL", "missing required scope is partial");
  assertEqual(
    missingGold.missingRequirements,
    [{
      kind: "OBSERVATION",
      key: "ASSET:gold.futures.usd:yahoo-finance",
    }],
    "missing requirement stays explicit",
  );

  const staleBtc = { ...btc, id: "btc-stale", quality: "STALE" as const };
  const stale = buildMarketSnapshot(request({
    observations: [staleBtc, dxy],
    requirements: [
      { kind: "OBSERVATION", key: marketSnapshotObservationKey(staleBtc) },
      { kind: "OBSERVATION", key: marketSnapshotObservationKey(dxy) },
      { kind: "BASELINE", key: marketSnapshotBaselineKey(dxyPricing) },
    ],
  }));
  assertEqual(stale.quality, "STALE", "included stale reference is preserved");

  const unknownPricing = pricingBaseline(
    dxy,
    "dxy.index.usd",
    capturedAt,
    { status: "UNKNOWN" },
  );
  const unknown = buildMarketSnapshot(request({
    baselines: [unknownPricing],
    requirements: [
      { kind: "OBSERVATION", key: marketSnapshotObservationKey(btc) },
      { kind: "OBSERVATION", key: marketSnapshotObservationKey(dxy) },
      { kind: "BASELINE", key: marketSnapshotBaselineKey(unknownPricing) },
    ],
  }));
  assertEqual(unknown.quality, "UNKNOWN", "unknown baseline quality propagates");

  const partialAndStale = buildMarketSnapshot(request({
    observations: [staleBtc, dxy],
    requirements: [
      { kind: "OBSERVATION", key: marketSnapshotObservationKey(staleBtc) },
      { kind: "OBSERVATION", key: marketSnapshotObservationKey(dxy) },
      { kind: "BASELINE", key: marketSnapshotBaselineKey(dxyPricing) },
      { kind: "OBSERVATION", key: "ASSET:gold.futures.usd:yahoo-finance" },
    ],
  }));
  assertEqual(
    partialAndStale.quality,
    "PARTIAL",
    "missing scope is not hidden by stale included data",
  );

  assertThrows(
    "future retrieval cannot leak into snapshot",
    () => buildMarketSnapshot(request({
      observations: [
        {
          ...btc,
          id: "btc-future",
          retrievedAt: "2026-10-15T12:30:00.000Z",
        },
        dxy,
      ],
    })),
  );

  assertThrows(
    "duplicate semantic/provider observation slots are ambiguous",
    () => buildMarketSnapshot(request({
      observations: [
        btc,
        { ...btc, id: "btc-duplicate", value: "68001" },
        dxy,
      ],
    })),
  );

  const eventIdentity = {
    version: "v1" as const,
    key: "event:v1:US:2026-10-15T12:30:00.000Z:cpi",
    semanticKey: "cpi",
    scheduledAt: "2026-10-15T12:30:00.000Z",
    jurisdiction: "US" as const,
  };
  const eventA: Event = {
    id: "event-a",
    subject: "CPI",
    description: "US CPI",
    jurisdiction: "US",
    scheduledAt: eventIdentity.scheduledAt,
    retrievedAt: "2026-10-15T12:00:00.000Z",
    status: "UPCOMING",
    importance: "HIGH",
    sourceId: "biquote",
    evidenceId: "evidence-event-a",
    identity: eventIdentity,
  };
  const eventB: Event = {
    ...eventA,
    id: "event-b",
    sourceId: "forex-factory",
    evidenceId: "evidence-event-b",
  };
  assertEqual(
    marketSnapshotEventKey(eventA),
    eventIdentity.key,
    "event snapshot key uses provider-independent identity",
  );
  assertThrows(
    "provider duplicate Events must be reconciled before snapshot",
    () => buildMarketSnapshot(request({
      events: [eventA, eventB],
    })),
  );

  assertThrows(
    "future releasedAt cannot appear in earlier snapshot",
    () => buildMarketSnapshot(request({
      events: [{
        ...eventA,
        releasedAt: "2026-10-15T12:30:00.000Z",
      }],
    })),
  );

  const factual: FactualBaseline = {
    kind: "FACTUAL",
    status: "VALID",
    currentObservationId: "macro-current",
    baselineObservationId: "macro-previous",
    currentValue: "2.8",
    baselineValue: "3.0",
    currentObservedAt: "2026-09-01T00:00:00.000Z",
    baselineObservedAt: "2026-08-01T00:00:00.000Z",
    sourceId: "fred",
    quality: "FRESH",
    currentObservationQuality: "FRESH",
    baselineObservationQuality: "STALE",
    qualityPolicy: "current-freshness-historical-fitness-v1",
  };
  assertThrows(
    "factual baseline must reference observations captured in snapshot",
    () => buildMarketSnapshot(request({
      baselines: [dxyPricing, factual],
    })),
  );

  assertEqual(
    marketMemoryEffectiveAt("SNAPSHOT", snapshot),
    capturedAt,
    "snapshot Market Memory effective time is capturedAt",
  );
  assertEqual(
    marketMemoryDedupeKey("SNAPSHOT", snapshot),
    "SNAPSHOT:" + snapshot.id + ":" + capturedAt,
    "snapshot Market Memory dedupe key is immutable",
  );

  const repository = new InMemoryMarketSnapshotRepository();
  const captured = await captureMarketSnapshot(request(), repository);
  await captureMarketSnapshot(request(), repository);
  assertEqual(
    (await repository.findById(captured.id))?.id,
    captured.id,
    "captured snapshot is durable through repository contract",
  );

  const later = buildMarketSnapshot(request({
    capturedAt: "2026-10-15T12:31:00.000Z",
  }));
  await repository.save(later);
  assertEqual(
    (await repository.findHistory({
      scope: snapshot.scope,
      order: "ASC",
      limit: 10,
    })).map((item) => item.id),
    [snapshot.id, later.id],
    "snapshot history is ordered by capturedAt",
  );
  assertEqual(
    (await repository.findHistory({
      scope: snapshot.scope,
      capturedAtOnOrBefore: capturedAt,
      order: "DESC",
      limit: 10,
    })).map((item) => item.id),
    [snapshot.id],
    "snapshot history cutoff isolates pre-event reference",
  );
}

void main();
