import {
  qualifyEventWindow,
  type QualifiedEventWindow,
} from "../domain/event-window";
import {
  buildMarketSnapshot,
  marketSnapshotBaselineKey,
  marketSnapshotObservationKey,
  type MarketSnapshot,
} from "../domain/market-snapshot";
import type { PricingBaseline } from "../domain/pricing-baseline";
import {
  compareMarketSnapshots,
  SNAPSHOT_COMPARISON_POLICY_V1,
} from "../domain/snapshot-comparison";
import type { Event, Observation } from "../domain/types";
import { InMemoryObservationRepository } from "../repositories/memory";
import { compareRepositoryBackedEventWindowSnapshots } from "./snapshot-comparison";

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

async function assertRejects(
  label: string,
  action: () => Promise<unknown>,
): Promise<void> {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error(label + ": expected action to reject");
}

function observation(
  id: string,
  metricId: string,
  value: string,
  observedAt: string,
  retrievedAt: string,
  overrides: Partial<Observation> = {},
): Observation {
  return {
    id,
    domain: "ASSET",
    subject: metricId,
    value,
    observedAt,
    retrievedAt,
    sourceId: metricId === "btc.spot.usd"
      ? "coingecko-market"
      : "yahoo-finance",
    quality: "FRESH",
    evidenceId: "evidence-" + id,
    metadata: {
      metricId,
      unit: metricId === "dxy.index.usd" ? "Index" : "USD",
    },
    ...overrides,
  };
}

function event(
  id: string,
  semanticKey = "cpi",
  scheduledAt = "2026-10-15T12:30:00.000Z",
): Event {
  return {
    id,
    subject: semanticKey.toUpperCase(),
    description: "US economic release",
    jurisdiction: "US",
    scheduledAt,
    retrievedAt: "2026-10-15T10:00:00.000Z",
    status: "UPCOMING",
    importance: "HIGH",
    sourceId: "biquote",
    evidenceId: "evidence-" + id,
    identity: {
      version: "v1",
      key: "event:v1:US:" + scheduledAt + ":" + semanticKey,
      semanticKey,
      scheduledAt,
      jurisdiction: "US",
    },
  };
}

function requireWindow(eventItem: Event): QualifiedEventWindow {
  const qualification = qualifyEventWindow(eventItem);
  if (!qualification.eligible) {
    throw new Error("Expected qualified event window: " + qualification.code);
  }
  return qualification.window;
}

function pricingBaseline(
  observationItem: Observation,
  asOf: string,
): PricingBaseline {
  return {
    kind: "PRICING",
    status: "VALID",
    seriesKey: "dxy.index.usd",
    legacyDomain: observationItem.domain,
    sourceId: observationItem.sourceId,
    asOf,
    maxObservationAgeMs: 15 * 60 * 1000,
    observationId: observationItem.id,
    value: Number(observationItem.value),
    unit: "Index",
    observedAt: observationItem.observedAt,
    retrievedAt: observationItem.retrievedAt,
    ageMs: Date.parse(asOf) - Date.parse(observationItem.observedAt),
    quality: observationItem.quality,
    evidenceId: observationItem.evidenceId,
    marketDomain: "FX",
    semantics: {
      ontologyVersion: "v0.1",
      marketDomain: "FX",
      informationClass: "PRICING",
      jurisdiction: "US",
      instrument: "FX_INDEX",
      asset: "USD",
    },
    selectionPolicy: "latest-qualified-pricing-as-of-v1",
  };
}

function snapshot(input: {
  capturedAt: string;
  observations: Observation[];
  primaryEvent: Event;
  baseline?: PricingBaseline;
  extraRequirements?: Array<{
    kind: "OBSERVATION";
    key: string;
  }>;
}): MarketSnapshot {
  const requirements = [
    ...input.observations.map((item) => ({
      kind: "OBSERVATION" as const,
      key: marketSnapshotObservationKey(item),
    })),
    {
      kind: "EVENT" as const,
      key: input.primaryEvent.identity!.key,
    },
    ...(input.baseline
      ? [{
          kind: "BASELINE" as const,
          key: marketSnapshotBaselineKey(input.baseline),
        }]
      : []),
    ...(input.extraRequirements ?? []),
  ];

  return buildMarketSnapshot({
    capturedAt: input.capturedAt,
    scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
    observations: input.observations,
    events: [input.primaryEvent],
    ...(input.baseline ? { baselines: [input.baseline] } : {}),
    requirements,
  });
}

const primaryEvent = event("cpi");
const window = requireWindow(primaryEvent);

const btcBefore = observation(
  "btc-before",
  "btc.spot.usd",
  "68000",
  "2026-10-15T12:24:50.000Z",
  "2026-10-15T12:24:55.000Z",
);
const dxyBefore = observation(
  "dxy-before",
  "dxy.index.usd",
  "103.5",
  "2026-10-15T12:24:45.000Z",
  "2026-10-15T12:24:50.000Z",
);
const btcAfter = observation(
  "btc-after",
  "btc.spot.usd",
  "68700",
  "2026-10-15T12:34:50.000Z",
  "2026-10-15T12:34:55.000Z",
);
const dxyAfter = observation(
  "dxy-after",
  "dxy.index.usd",
  "103.1",
  "2026-10-15T12:34:45.000Z",
  "2026-10-15T12:34:50.000Z",
);

const beforePricing = pricingBaseline(
  dxyBefore,
  "2026-10-15T12:25:00.000Z",
);
const afterPricing = pricingBaseline(
  dxyAfter,
  "2026-10-15T12:35:00.000Z",
);

const beforeSnapshot = snapshot({
  capturedAt: "2026-10-15T12:25:00.000Z",
  observations: [btcBefore, dxyBefore],
  primaryEvent,
  baseline: beforePricing,
});
const afterSnapshot = snapshot({
  capturedAt: "2026-10-15T12:35:00.000Z",
  observations: [btcAfter, dxyAfter],
  primaryEvent,
  baseline: afterPricing,
});

async function main(): Promise<void> {
  const comparison = compareMarketSnapshots({
    before: beforeSnapshot,
    after: afterSnapshot,
    observations: [btcAfter, dxyBefore, btcBefore, dxyAfter],
  });

  assertEqual(
    comparison.policy,
    SNAPSHOT_COMPARISON_POLICY_V1,
    "comparison policy is explicit",
  );
  assertEqual(comparison.quality, "COMPLETE", "complete pair stays complete");
  assertEqual(comparison.elapsedMs, 10 * 60 * 1000, "elapsed time is explicit");

  const btc = comparison.observationChanges.find(
    (change) => change.key === marketSnapshotObservationKey(btcBefore),
  );
  assertEqual(btc?.status, "CHANGED", "BTC slot changed");
  assertEqual(btc?.beforeValue, 68000, "BTC before value resolved canonically");
  assertEqual(btc?.afterValue, 68700, "BTC after value resolved canonically");
  assertEqual(btc?.absoluteDelta, 700, "BTC raw absolute delta");
  assert(
    Math.abs((btc?.percentDelta ?? 0) - 1.0294117647058822) < 1e-12,
    "BTC raw percent delta",
  );

  const dxy = comparison.observationChanges.find(
    (change) => change.key === marketSnapshotObservationKey(dxyBefore),
  );
  assertEqual(
    Math.round((dxy?.absoluteDelta ?? 0) * 10) / 10,
    -0.4,
    "DXY raw absolute delta",
  );
  assertEqual(dxy?.unit, "Index", "compatible unit is retained");

  assertEqual(
    comparison.baselineReferenceChanges[0]?.status,
    "CHANGED",
    "pricing baseline lineage change is structural",
  );
  assertEqual(
    comparison.eventReferenceChanges[0]?.status,
    "UNCHANGED",
    "same canonical Event reference remains unchanged",
  );

  const reordered = compareMarketSnapshots({
    before: beforeSnapshot,
    after: afterSnapshot,
    observations: [dxyAfter, btcBefore, dxyBefore, btcAfter],
  });
  assertEqual(
    reordered.id,
    comparison.id,
    "comparison identity is deterministic across resolver ordering",
  );

  const goldAfter = observation(
    "gold-after",
    "gold.futures.usd",
    "2650",
    "2026-10-15T12:34:45.000Z",
    "2026-10-15T12:34:50.000Z",
  );
  const afterWithGold = snapshot({
    capturedAt: "2026-10-15T12:35:00.000Z",
    observations: [btcAfter, dxyAfter, goldAfter],
    primaryEvent,
    baseline: afterPricing,
  });
  const added = compareMarketSnapshots({
    before: beforeSnapshot,
    after: afterWithGold,
    observations: [btcBefore, dxyBefore, btcAfter, dxyAfter, goldAfter],
  });
  const goldChange = added.observationChanges.find(
    (change) => change.key === marketSnapshotObservationKey(goldAfter),
  );
  assertEqual(goldChange?.status, "ADDED", "new observation slot is explicit");
  assertEqual(added.quality, "PARTIAL", "coverage drift degrades comparison");

  const unitMismatchAfter = observation(
    "btc-eur",
    "btc.spot.usd",
    "68700",
    "2026-10-15T12:34:50.000Z",
    "2026-10-15T12:34:55.000Z",
    {
      metadata: {
        metricId: "btc.spot.usd",
        unit: "EUR",
      },
    },
  );
  const unitMismatchSnapshot = snapshot({
    capturedAt: "2026-10-15T12:35:00.000Z",
    observations: [unitMismatchAfter, dxyAfter],
    primaryEvent,
    baseline: afterPricing,
  });
  const incompatible = compareMarketSnapshots({
    before: beforeSnapshot,
    after: unitMismatchSnapshot,
    observations: [
      btcBefore,
      dxyBefore,
      unitMismatchAfter,
      dxyAfter,
    ],
  });
  const incompatibleBtc = incompatible.observationChanges.find(
    (change) => change.key === marketSnapshotObservationKey(btcBefore),
  );
  assertEqual(
    incompatibleBtc?.status,
    "INCOMPATIBLE",
    "unit mismatch blocks numerical comparison",
  );
  assertEqual(incompatible.quality, "PARTIAL", "incompatibility is explicit");

  const missingResolved = compareMarketSnapshots({
    before: beforeSnapshot,
    after: afterSnapshot,
    observations: [btcBefore, dxyBefore, dxyAfter],
  });
  assertEqual(
    missingResolved.missingObservationIds,
    ["btc-after"],
    "missing canonical resolution stays explicit",
  );
  assertEqual(missingResolved.quality, "UNKNOWN", "missing resolution is unknown");

  const corruptedAfter: MarketSnapshot = {
    ...afterSnapshot,
    observationRefs: afterSnapshot.observationRefs.map((ref) =>
      ref.observationId === "btc-after"
        ? { ...ref, observationId: "btc-future" }
        : ref,
    ),
  };
  const futureObservation = {
    ...btcAfter,
    id: "btc-future",
    retrievedAt: "2026-10-15T12:36:00.000Z",
  };
  assertThrows(
    "resolved look-ahead is rejected even for corrupted historical Snapshot",
    () => compareMarketSnapshots({
      before: beforeSnapshot,
      after: corruptedAfter,
      observations: [btcBefore, dxyBefore, futureObservation, dxyAfter],
    }),
  );

  assertThrows(
    "scope mismatch is not comparable",
    () => compareMarketSnapshots({
      before: beforeSnapshot,
      after: { ...afterSnapshot, scope: "OTHER_SCOPE" },
      observations: [btcBefore, dxyBefore, btcAfter, dxyAfter],
    }),
  );

  assertThrows(
    "comparison time must move forward",
    () => compareMarketSnapshots({
      before: afterSnapshot,
      after: beforeSnapshot,
      observations: [btcBefore, dxyBefore, btcAfter, dxyAfter],
    }),
  );

  const repository = new InMemoryObservationRepository();
  await repository.saveMany([
    btcBefore,
    dxyBefore,
    btcAfter,
    dxyAfter,
  ]);

  const cleanWindowComparison =
    await compareRepositoryBackedEventWindowSnapshots({
      window,
      before: beforeSnapshot,
      after: afterSnapshot,
      events: [primaryEvent],
      observationRepository: repository,
    });

  assertEqual(
    cleanWindowComparison.beforeRole,
    "PRE",
    "event-window comparison requires PRE baseline",
  );
  assertEqual(
    cleanWindowComparison.afterRole,
    "T_PLUS_5",
    "after Snapshot keeps qualified post role",
  );
  assertEqual(
    cleanWindowComparison.contaminationStatus,
    "CLEAN",
    "no intervening event remains clean",
  );
  assertEqual(
    cleanWindowComparison.comparison.id,
    comparison.id,
    "repository-backed comparison resolves the same canonical facts",
  );

  const contaminant = event(
    "nfp",
    "nonfarm-payrolls",
    "2026-10-15T12:33:00.000Z",
  );
  const contaminated =
    await compareRepositoryBackedEventWindowSnapshots({
      window,
      before: beforeSnapshot,
      after: afterSnapshot,
      events: [primaryEvent, contaminant],
      observationRepository: repository,
    });
  assertEqual(
    contaminated.contaminationStatus,
    "CONTAMINATED",
    "intervening qualified HIGH event is carried forward",
  );
  assertEqual(
    contaminated.contaminants.map((item) => item.eventIdentityKey),
    [contaminant.identity?.key],
    "contaminant identity is explicit",
  );

  const postAsBefore = snapshot({
    capturedAt: "2026-10-15T12:35:00.000Z",
    observations: [btcAfter, dxyAfter],
    primaryEvent,
    baseline: afterPricing,
  });
  await assertRejects(
    "event-window comparison cannot use a post Snapshot as baseline",
    () => compareRepositoryBackedEventWindowSnapshots({
      window,
      before: postAsBefore,
      after: {
        ...afterSnapshot,
        capturedAt: "2026-10-15T12:45:00.000Z",
      },
      events: [primaryEvent],
      observationRepository: repository,
    }),
  );

  const degradedBefore = {
    ...beforeSnapshot,
    quality: "PARTIAL" as const,
  };
  const degraded =
    await compareRepositoryBackedEventWindowSnapshots({
      window,
      before: degradedBefore,
      after: afterSnapshot,
      events: [primaryEvent],
      observationRepository: repository,
    });
  assertEqual(
    degraded.beforeMatch.status,
    "DEGRADED",
    "degraded timing-qualified Snapshot is not promoted",
  );
  assertEqual(
    degraded.comparison.quality,
    "PARTIAL",
    "Snapshot quality propagates into comparison",
  );
}

void main();
