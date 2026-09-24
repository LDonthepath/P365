import {
  EVENT_WINDOW_POLICY_V1,
  findEventWindowContaminants,
  matchSnapshotToEventWindow,
  qualifyEventWindow,
  type QualifiedEventWindow,
} from "../domain/event-window";
import type { MarketSnapshot } from "../domain/market-snapshot";
import type { Event, EventIdentity } from "../domain/types";
import { buildQualifiedEventWindowSet } from "./event-window";

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

function identity(
  key: string,
  semanticKey: string,
  scheduledAt: string,
): EventIdentity {
  return {
    version: "v1",
    key,
    semanticKey,
    scheduledAt,
    jurisdiction: "US",
  };
}

function event(
  id: string,
  semanticKey = "cpi",
  scheduledAt = "2026-10-15T12:30:00.000Z",
  overrides: Partial<Event> = {},
): Event {
  const eventIdentity = identity(
    "event:v1:US:" + scheduledAt + ":" + semanticKey,
    semanticKey,
    scheduledAt,
  );
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
    identity: eventIdentity,
    ...overrides,
  };
}

function snapshot(
  capturedAt: string,
  quality: MarketSnapshot["quality"] = "COMPLETE",
  scope = EVENT_WINDOW_POLICY_V1.snapshotScope,
): MarketSnapshot {
  return {
    id: "snapshot-" + capturedAt,
    version: "v1",
    capturedAt,
    scope,
    observationRefs: [],
    eventRefs: [],
    baselineRefs: [],
    stateRefs: [],
    sourceHealthRefs: [],
    requirements: [
      {
        kind: "OBSERVATION",
        key: "ASSET:btc.spot.usd:coingecko-market",
      },
    ],
    missingRequirements: quality === "COMPLETE"
      ? []
      : [{
          kind: "OBSERVATION",
          key: "ASSET:gold.futures.usd:yahoo-finance",
        }],
    quality,
  };
}

function requireWindow(qualification: ReturnType<typeof qualifyEventWindow>): QualifiedEventWindow {
  if (!qualification.eligible) {
    throw new Error(
      "Expected eligible Event Window, got "
      + qualification.code
      + ": "
      + qualification.reason,
    );
  }
  return qualification.window;
}

async function main(): Promise<void> {
  const cpi = event("cpi");
  const window = requireWindow(qualifyEventWindow(cpi));

  assertEqual(window.version, "v1", "window contract version");
  assertEqual(window.t0, "2026-10-15T12:30:00.000Z", "scheduled time is T0 before release");
  assertEqual(window.t0Source, "SCHEDULED_AT", "pre-release T0 source");
  assertEqual(
    window.snapshotScope,
    "MVP_MACRO_CRYPTO_GOLD_EVENT",
    "window owns one explicit Snapshot scope",
  );
  assertEqual(
    window.slots.map((slot) => [
      slot.role,
      slot.targetAt,
      slot.opensAt,
      slot.closesAt,
    ]),
    [
      [
        "PRE",
        "2026-10-15T12:25:00.000Z",
        "2026-10-15T12:22:30.000Z",
        "2026-10-15T12:27:30.000Z",
      ],
      [
        "T_PLUS_5",
        "2026-10-15T12:35:00.000Z",
        "2026-10-15T12:32:30.000Z",
        "2026-10-15T12:37:30.000Z",
      ],
      [
        "T_PLUS_15",
        "2026-10-15T12:45:00.000Z",
        "2026-10-15T12:42:30.000Z",
        "2026-10-15T12:47:30.000Z",
      ],
      [
        "T_PLUS_30",
        "2026-10-15T13:00:00.000Z",
        "2026-10-15T12:57:30.000Z",
        "2026-10-15T13:02:30.000Z",
      ],
      [
        "T_PLUS_60",
        "2026-10-15T13:30:00.000Z",
        "2026-10-15T13:27:30.000Z",
        "2026-10-15T13:32:30.000Z",
      ],
    ],
    "EVW-001 uses PRE/-5 and +5/+15/+30/+60 with +/-2.5m tolerance",
  );

  const actualRelease = requireWindow(
    qualifyEventWindow(event(
      "cpi-actual",
      "cpi",
      "2026-10-15T12:30:00.000Z",
      {
        releasedAt: "2026-10-15T12:31:00.000Z",
        occurredAt: "2026-10-15T12:31:00.000Z",
        status: "PAST",
      },
    )),
  );
  assertEqual(
    actualRelease.t0,
    "2026-10-15T12:31:00.000Z",
    "qualified releasedAt overrides scheduled T0 when available",
  );
  assertEqual(
    actualRelease.t0Source,
    "RELEASED_AT",
    "actual release anchor is explicit",
  );

  const medium = qualifyEventWindow(event("medium", "cpi", undefined as never, {
    scheduledAt: "2026-10-15T12:30:00.000Z",
    importance: "MEDIUM",
  }));
  assertEqual(
    medium.eligible ? null : medium.code,
    "IMPORTANCE_NOT_HIGH",
    "non-HIGH events stay outside v1",
  );

  const dateAnchor = qualifyEventWindow(event(
    "fomc-date-anchor",
    "fomc-meeting",
    "2026-11-05T00:00:00.000Z",
    {
      sourceId: "federal-reserve",
      identity: undefined,
    },
  ));
  assertEqual(
    dateAnchor.eligible ? null : dateAnchor.code,
    "IDENTITY_UNQUALIFIED",
    "official FOMC date anchor cannot become exact event window",
  );

  const speech = qualifyEventWindow(event(
    "speech",
    "fed-official-barr-speech",
  ));
  assertEqual(
    speech.eligible ? null : speech.code,
    "DURATION_EVENT_UNSUPPORTED",
    "speech lifecycle is not treated as a point release",
  );

  const mismatchedIdentity = qualifyEventWindow(event(
    "mismatch",
    "cpi",
    "2026-10-15T12:30:00.000Z",
    {
      identity: identity(
        "event:v1:US:2026-10-15T12:31:00.000Z:cpi",
        "cpi",
        "2026-10-15T12:31:00.000Z",
      ),
    },
  ));
  assertEqual(
    mismatchedIdentity.eligible ? null : mismatchedIdentity.code,
    "IDENTITY_SCHEDULE_MISMATCH",
    "identity schedule must match canonical Event schedule",
  );

  const qualifiedPre = matchSnapshotToEventWindow(
    window,
    snapshot("2026-10-15T12:25:12.000Z"),
  );
  assertEqual(qualifiedPre.status, "QUALIFIED", "PRE snapshot timing qualifies");
  assertEqual(qualifiedPre.role, "PRE", "PRE role matched");
  assertEqual(qualifiedPre.timingErrorMs, 12_000, "PRE timing error is preserved");

  const lowerBoundary = matchSnapshotToEventWindow(
    window,
    snapshot("2026-10-15T12:32:30.000Z"),
  );
  assertEqual(
    lowerBoundary.role,
    "T_PLUS_5",
    "slot boundary is inclusive",
  );

  const degraded = matchSnapshotToEventWindow(
    window,
    snapshot("2026-10-15T12:45:00.000Z", "PARTIAL"),
  );
  assertEqual(
    degraded.status,
    "DEGRADED",
    "timely but incomplete Snapshot is retained as degraded",
  );
  assertEqual(degraded.role, "T_PLUS_15", "degraded slot still has timing role");

  const outside = matchSnapshotToEventWindow(
    window,
    snapshot("2026-10-15T12:40:00.000Z"),
  );
  assertEqual(outside.status, "OUTSIDE_WINDOW", "off-grid Snapshot is not relabeled");

  const incompatible = matchSnapshotToEventWindow(
    window,
    snapshot(
      "2026-10-15T12:35:00.000Z",
      "COMPLETE",
      "OTHER_SCOPE",
    ),
  );
  assertEqual(
    incompatible.status,
    "INCOMPATIBLE_SCOPE",
    "Snapshot scope must match event-window scope",
  );

  const sameTimeJobs = event(
    "jobs",
    "nonfarm-payrolls",
    "2026-10-15T12:30:00.000Z",
  );
  const laterHigh = event(
    "later-high",
    "retail-sales",
    "2026-10-15T12:50:00.000Z",
  );
  const laterMedium = event(
    "later-medium",
    "consumer-sentiment",
    "2026-10-15T12:40:00.000Z",
    { importance: "MEDIUM" },
  );
  const speechLater = event(
    "later-speech",
    "fed-official-barr-speech",
    "2026-10-15T12:55:00.000Z",
  );
  const duplicateCpi = event(
    "cpi-ff",
    "cpi",
    "2026-10-15T12:30:00.000Z",
    {
      sourceId: "forex-factory",
      evidenceId: "evidence-cpi-ff",
    },
  );

  assertEqual(
    findEventWindowContaminants({
      primary: window,
      baselineCapturedAt: "2026-10-15T12:25:00.000Z",
      evaluatedCapturedAt: "2026-10-15T12:35:00.000Z",
      events: [cpi, duplicateCpi, sameTimeJobs, laterHigh, laterMedium, speechLater],
    }).map((item) => item.eventIdentityKey),
    [sameTimeJobs.identity?.key],
    "same-time distinct HIGH release contaminates while duplicate identity does not",
  );

  assertEqual(
    findEventWindowContaminants({
      primary: window,
      baselineCapturedAt: "2026-10-15T12:25:00.000Z",
      evaluatedCapturedAt: "2026-10-15T13:00:00.000Z",
      events: [sameTimeJobs, laterHigh, laterMedium, speechLater],
    }).map((item) => item.subject),
    ["NONFARM-PAYROLLS", "RETAIL-SALES"],
    "later qualified HIGH point release contaminates later follow-through",
  );

  assertThrows(
    "contamination interval cannot run backward",
    () => findEventWindowContaminants({
      primary: window,
      baselineCapturedAt: "2026-10-15T13:00:00.000Z",
      evaluatedCapturedAt: "2026-10-15T12:35:00.000Z",
      events: [],
    }),
  );

  const reconciled = buildQualifiedEventWindowSet([
    duplicateCpi,
    cpi,
    sameTimeJobs,
    event(
      "tentative",
      "ppi",
      "2026-10-15T14:00:00.000Z",
      { identity: undefined },
    ),
  ]);

  assertEqual(
    reconciled.windows.length,
    2,
    "reconciliation creates one plan per provider-independent event identity",
  );
  assertEqual(
    reconciled.windows.find(
      (item) => item.eventIdentityKey === cpi.identity?.key,
    )?.sourceId,
    "biquote",
    "FND-019 representative preference is reused",
  );
  assertEqual(
    reconciled.rejected.map((item) => item.code),
    ["IDENTITY_UNQUALIFIED"],
    "unqualified timing stays explicit",
  );

  assert(
    window.slots.every(
      (slot, index, all) => index === 0
        || Date.parse(all[index - 1].closesAt) < Date.parse(slot.opensAt),
    ),
    "EVW-001 capture windows never overlap",
  );
}

void main();
