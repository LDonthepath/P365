import type { EconomicEventResult } from "../domain/event-result";
import { selectActiveMarketSnapshot } from "../domain/snapshot-supersession";
import type { Event, Observation } from "../domain/types";
import {
  InMemoryEventRepository,
  InMemoryHistoricalEventRepository,
  InMemoryMarketSnapshotRepository,
  InMemoryObservationRepository,
} from "../repositories/memory";
import type {
  EconomicEventResultHistoryQuery,
  HistoricalEconomicEventResultRepository,
} from "../repositories/types";
import {
  EVENT_WINDOW_CAPTURE_SERIES,
  runEventWindowSnapshotCapture,
  runEventWindowSnapshotRepair,
} from "./event-window-snapshot-capture";

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

class StaticEventResultHistory
implements HistoricalEconomicEventResultRepository {
  constructor(private readonly results: EconomicEventResult[] = []) {}

  async findHistory(
    query: EconomicEventResultHistoryQuery,
  ): Promise<EconomicEventResult[]> {
    return this.results
      .filter((result) =>
        result.eventIdentityKey === query.eventIdentityKey
        && (query.sourceId === undefined || result.sourceId === query.sourceId)
        && (
          query.expectedType === undefined
          || result.expectedType === query.expectedType
        )
        && (
          query.retrievedAtOnOrBefore === undefined
          || Date.parse(result.retrievedAt)
            <= Date.parse(query.retrievedAtOnOrBefore)
        )
      )
      .sort((a, b) => Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt))
      .slice(0, query.limit);
  }
}

function event(
  id: string,
  retrievedAt = "2026-10-15T12:00:00.000Z",
): Event {
  const scheduledAt = "2026-10-15T12:30:00.000Z";
  return {
    id,
    subject: "CPI",
    description: "US CPI",
    jurisdiction: "US",
    scheduledAt,
    retrievedAt,
    status: "UPCOMING",
    importance: "HIGH",
    sourceId: "biquote",
    evidenceId: "evidence-" + id,
    identity: {
      version: "v1",
      key: "event:v1:US:" + scheduledAt + ":cpi",
      semanticKey: "cpi",
      scheduledAt,
      jurisdiction: "US",
    },
  };
}

function observation(
  id: string,
  seriesKey: string,
  sourceId: string,
  value: string,
  observedAt: string,
  retrievedAt: string,
): Observation {
  return {
    id,
    domain: "ASSET",
    subject: seriesKey,
    value,
    observedAt,
    retrievedAt,
    sourceId,
    quality: "FRESH",
    evidenceId: "evidence-" + id,
    metadata: {
      metricId: seriesKey,
      unit: seriesKey === "dxy.index.usd" ? "Index" : "USD",
    },
  };
}

function seriesObservationPair(
  seriesKey: string,
  sourceId: string,
  beforeValue: string,
  afterValue: string,
): Observation[] {
  return [
    observation(
      seriesKey + "-pre",
      seriesKey,
      sourceId,
      beforeValue,
      "2026-10-15T12:22:00.000Z",
      "2026-10-15T12:23:00.000Z",
    ),
    observation(
      seriesKey + "-post",
      seriesKey,
      sourceId,
      afterValue,
      "2026-10-15T12:33:00.000Z",
      "2026-10-15T12:34:00.000Z",
    ),
  ];
}

async function fixture(eventRetrievedAt = "2026-10-15T12:00:00.000Z") {
  const canonicalEvents = new InMemoryEventRepository();
  await canonicalEvents.save(event("biquote-cpi", eventRetrievedAt));
  const historicalEvents = new InMemoryHistoricalEventRepository(canonicalEvents);

  const observations = new InMemoryObservationRepository();
  await observations.saveMany([
    ...seriesObservationPair(
      "btc.spot.usd",
      "coingecko-market",
      "68000",
      "68700",
    ),
    ...seriesObservationPair(
      "eth.spot.usd",
      "coingecko-market",
      "3500",
      "3540",
    ),
    ...seriesObservationPair(
      "dxy.index.usd",
      "yahoo-finance",
      "103.5",
      "103.1",
    ),
    ...seriesObservationPair(
      "gold.futures.usd",
      "yahoo-finance",
      "2630",
      "2648",
    ),
  ]);

  const snapshots = new InMemoryMarketSnapshotRepository();

  return {
    event: event("biquote-cpi", eventRetrievedAt),
    observations,
    snapshots,
    repositories: {
      events: historicalEvents,
      observations,
      canonicalObservations: observations,
      eventResults: new StaticEventResultHistory(),
      snapshots,
      snapshotHistory: snapshots,
    },
  };
}

async function main(): Promise<void> {
  assertEqual(
    EVENT_WINDOW_CAPTURE_SERIES.map((item) => item.seriesKey),
    [
      "btc.spot.usd",
      "eth.spot.usd",
      "dxy.index.usd",
      "gold.futures.usd",
    ],
    "CAP-001 capture set is explicit",
  );

  const first = await fixture();
  const report = await runEventWindowSnapshotCapture(
    { now: "2026-10-15T12:36:00.000Z" },
    { repositories: first.repositories },
  );

  assertEqual(report.status, "SUCCESS", "eligible slots capture successfully");
  assertEqual(report.qualifiedWindows, 1, "one qualified event window");
  assertEqual(report.dueSlots, 2, "PRE and T+5 are due by 12:36");
  assertEqual(report.captured, 2, "two snapshots captured");
  assertEqual(report.corrected, 0, "first run requires no correction");
  assertEqual(report.alreadyCaptured, 0, "first run has no existing slots");

  const stored = await first.snapshots.findHistory({
    scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
    order: "ASC",
    limit: 10,
  });
  assertEqual(
    stored.map((item) => item.capturedAt),
    [
      "2026-10-15T12:25:00.000Z",
      "2026-10-15T12:35:00.000Z",
    ],
    "Snapshot capturedAt uses deterministic semantic targets",
  );
  assertEqual(
    stored.map((item) => item.metadata?.eventWindowRole),
    ["PRE", "T_PLUS_5"],
    "captured snapshots retain event-window roles",
  );
  assert(
    stored.every(
      (item) => item.metadata?.captureMode === "AS_OF_RECONSTRUCTION",
    ),
    "runtime execution time is not substituted for semantic capture time",
  );
  assertEqual(
    stored[0]?.quality,
    "PARTIAL",
    "missing expectation baseline remains visible as partial",
  );
  assertEqual(
    stored[0]?.observationRefs.length,
    4,
    "all four qualified market slots are referenced at PRE",
  );
  assertEqual(
    stored[1]?.observationRefs.length,
    4,
    "all four qualified market slots are referenced at T+5",
  );

  const retry = await runEventWindowSnapshotCapture(
    { now: "2026-10-15T12:36:30.000Z" },
    { repositories: first.repositories },
  );
  assertEqual(retry.captured, 0, "retry does not create duplicate snapshots");
  assertEqual(retry.corrected, 0, "retry does not create correction snapshots");
  assertEqual(retry.alreadyCaptured, 2, "retry detects deterministic slots");
  assertEqual(
    (await first.snapshots.findHistory({
      scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
      order: "ASC",
      limit: 10,
    })).length,
    2,
    "idempotent retry preserves two rows",
  );

  const repair = await fixture();
  const emptyObservations = new InMemoryObservationRepository();
  const defectiveReport = await runEventWindowSnapshotCapture(
    { now: "2026-10-15T12:36:00.000Z" },
    {
      repositories: {
        ...repair.repositories,
        observations: emptyObservations,
        canonicalObservations: emptyObservations,
      },
    },
  );
  assertEqual(defectiveReport.captured, 2, "defective fixture first materializes immutable PARTIAL slots");
  const defectiveRows = await repair.snapshots.findHistory({
    scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
    order: "ASC",
    limit: 10,
  });
  assertEqual(
    defectiveRows.map((item) => item.observationRefs.length),
    [0, 0],
    "defective rows reproduce missing Observation lineage",
  );

  const correctedReport = await runEventWindowSnapshotCapture(
    { now: "2026-10-15T12:36:30.000Z" },
    { repositories: repair.repositories },
  );
  assertEqual(correctedReport.captured, 0, "repair does not rewrite the original logical slot");
  assertEqual(correctedReport.corrected, 2, "repair appends one superseding Snapshot per defective slot");
  assertEqual(correctedReport.alreadyCaptured, 0, "first repair is not reported as already captured");
  assert(
    correctedReport.slots.every((slot) => slot.status === "CORRECTED"),
    "repair reports explicit CORRECTED slot status",
  );

  const repairedRows = await repair.snapshots.findHistory({
    scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
    order: "ASC",
    limit: 10,
  });
  assertEqual(repairedRows.length, 4, "append-only repair retains two old rows and adds two corrected rows");
  for (const role of ["PRE", "T_PLUS_5"]) {
    const roleRows = repairedRows.filter((item) => item.metadata?.eventWindowRole === role);
    const active = selectActiveMarketSnapshot(roleRows);
    assert(active !== null, role + " has one active supersession tip");
    assertEqual(active?.observationRefs.length, 4, role + " active correction restores four Observation refs");
    assertEqual(active?.metadata?.captureOwner, "CAP-001C", role + " active correction records CAP-001C owner");
    assertEqual(
      active?.metadata?.supersedesSnapshotId,
      roleRows.find((item) => item.id !== active?.id)?.id,
      role + " correction explicitly links the immutable superseded row",
    );
  }

  const correctedRetry = await runEventWindowSnapshotCapture(
    { now: "2026-10-15T12:36:45.000Z" },
    { repositories: repair.repositories },
  );
  assertEqual(correctedRetry.corrected, 0, "corrected retry does not append another repair");
  assertEqual(correctedRetry.alreadyCaptured, 2, "corrected retry resolves supersession tips idempotently");
  assertEqual(
    (await repair.snapshots.findHistory({
      scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
      order: "ASC",
      limit: 10,
    })).length,
    4,
    "corrected retry preserves append-only row count",
  );

  const historicalRepair = await fixture();
  const repairEmptyObservations = new InMemoryObservationRepository();
  const historicalDefect = await runEventWindowSnapshotCapture(
    { now: "2026-10-15T12:36:00.000Z" },
    {
      repositories: {
        ...historicalRepair.repositories,
        observations: repairEmptyObservations,
        canonicalObservations: repairEmptyObservations,
      },
    },
  );
  assertEqual(historicalDefect.captured, 2, "historical repair fixture starts with two defective slots");

  const outsideLookback = await runEventWindowSnapshotCapture(
    { now: "2026-10-15T18:00:00.000Z" },
    { repositories: historicalRepair.repositories },
  );
  assertEqual(
    outsideLookback.dueSlots,
    0,
    "normal CAP cron ignores an event outside the 90-minute reconstruction lookback",
  );

  const targetedRepair = await runEventWindowSnapshotRepair(
    {
      eventIdentityKey: historicalRepair.event.identity?.key ?? "",
      evaluatedAt: "2026-10-15T18:00:00.000Z",
    },
    { repositories: historicalRepair.repositories },
  );
  assertEqual(targetedRepair.status, "SUCCESS", "targeted historical repair succeeds outside cron lookback");
  assertEqual(targetedRepair.dueSlots, 5, "targeted repair evaluates all five elapsed event-window slots");
  assertEqual(targetedRepair.corrected, 2, "targeted repair supersedes the two defective immutable slots");
  assertEqual(targetedRepair.captured, 3, "targeted repair first-materializes later slots that were never captured");
  assertEqual(targetedRepair.alreadyCaptured, 0, "first targeted repair has no active healthy slots");

  const targetedRetry = await runEventWindowSnapshotRepair(
    {
      eventIdentityKey: historicalRepair.event.identity?.key ?? "",
      evaluatedAt: "2026-10-15T18:00:00.000Z",
    },
    { repositories: historicalRepair.repositories },
  );
  assertEqual(targetedRetry.corrected, 0, "targeted repair retry appends no new correction");
  assertEqual(targetedRetry.captured, 0, "targeted repair retry first-materializes nothing");
  assertEqual(targetedRetry.alreadyCaptured, 5, "targeted repair retry resolves all five active tips idempotently");

  const lateEvent = await fixture("2026-10-15T12:26:00.000Z");
  const lateReport = await runEventWindowSnapshotCapture(
    { now: "2026-10-15T12:36:00.000Z" },
    { repositories: lateEvent.repositories },
  );
  assertEqual(
    lateReport.unavailableEventSlots,
    1,
    "PRE cannot fabricate an Event reference learned after PRE target",
  );
  assertEqual(
    lateReport.captured,
    1,
    "T+5 can still capture once Event identity was known",
  );
  assertEqual(lateReport.status, "PARTIAL", "mixed slot outcome is partial");

  const staleInputs = await fixture();
  const btcPost = await staleInputs.observations.findById("btc.spot.usd-post");
  if (!btcPost) throw new Error("BTC fixture missing");
  const replacement: Observation = {
    ...btcPost,
    id: "btc-too-old",
    observedAt: "2026-10-15T12:10:00.000Z",
    retrievedAt: "2026-10-15T12:11:00.000Z",
  };
  const staleRepo = new InMemoryObservationRepository();
  const allOther = [
    "btc.spot.usd-pre",
    "eth.spot.usd-pre",
    "eth.spot.usd-post",
    "dxy.index.usd-pre",
    "dxy.index.usd-post",
    "gold.futures.usd-pre",
    "gold.futures.usd-post",
  ];
  const resolved = await Promise.all(
    allOther.map((id) => staleInputs.observations.findById(id)),
  );
  await staleRepo.saveMany([
    ...resolved.filter((item): item is Observation => item !== null),
    replacement,
  ]);
  const staleSnapshots = new InMemoryMarketSnapshotRepository();
  const staleReport = await runEventWindowSnapshotCapture(
    { now: "2026-10-15T12:36:00.000Z" },
    {
      repositories: {
        ...staleInputs.repositories,
        observations: staleRepo,
        canonicalObservations: staleRepo,
        snapshots: staleSnapshots,
        snapshotHistory: staleSnapshots,
      },
    },
  );
  assertEqual(staleReport.captured, 2, "stale pricing does not block capture");
  const staleStored = await staleSnapshots.findHistory({
    scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
    order: "ASC",
    limit: 10,
  });
  assert(
    staleStored.some((item) =>
      item.baselineRefs.some((ref) =>
        ref.key.includes("PRICING:btc.spot.usd:coingecko-market")
        && ref.status === "STALE"
      )
    ),
    "caller age tolerance preserves stale BTC pricing baseline lineage",
  );

  const revisionEvents = new InMemoryEventRepository();
  const oldRevision = event("cpi-old", "2026-10-15T12:00:00.000Z");
  const releasedRevision: Event = {
    ...event("cpi-new", "2026-10-15T12:31:10.000Z"),
    occurredAt: "2026-10-15T12:31:00.000Z",
    releasedAt: "2026-10-15T12:31:00.000Z",
    status: "PAST",
  };
  await revisionEvents.saveMany([oldRevision, releasedRevision]);
  const revisionHistory = new InMemoryHistoricalEventRepository(revisionEvents);
  const revisionSnapshots = new InMemoryMarketSnapshotRepository();
  const revisionReport = await runEventWindowSnapshotCapture(
    { now: "2026-10-15T12:37:00.000Z" },
    {
      repositories: {
        ...first.repositories,
        events: revisionHistory,
        snapshots: revisionSnapshots,
        snapshotHistory: revisionSnapshots,
      },
    },
  );
  assertEqual(
    revisionReport.captured,
    2,
    "latest provider Event revision controls the qualified window",
  );
  assertEqual(
    (await revisionSnapshots.findHistory({
      scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
      order: "ASC",
      limit: 10,
    })).map((item) => item.capturedAt),
    [
      "2026-10-15T12:26:00.000Z",
      "2026-10-15T12:36:00.000Z",
    ],
    "releasedAt revision shifts deterministic PRE and T+5 targets",
  );

  const noEvents = new InMemoryEventRepository();
  const noEventHistory = new InMemoryHistoricalEventRepository(noEvents);
  const emptySnapshots = new InMemoryMarketSnapshotRepository();
  const emptyReport = await runEventWindowSnapshotCapture(
    { now: "2026-10-15T12:36:00.000Z" },
    {
      repositories: {
        events: noEventHistory,
        observations: first.observations,
        canonicalObservations: first.observations,
        eventResults: new StaticEventResultHistory(),
        snapshots: emptySnapshots,
        snapshotHistory: emptySnapshots,
      },
    },
  );
  assertEqual(emptyReport.status, "EMPTY", "no qualified event produces no snapshot");
  assertEqual(emptyReport.captured, 0, "empty run writes nothing");
}

void main();
