import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import {
  buildMacroEvidenceBundle,
  type CapturedMacroObservation,
  type MacroEvidenceHistoryPort,
  type StoredMacroObservation,
} from "./macro-evidence-bundle";

const EARLY = new Date("2026-09-21T00:00:00.000Z");
const LATE = new Date("2026-10-01T00:00:00.000Z");
const MONTHLY = "MONTHLY";
const units: Record<string, string> = {
  PCEPI: "Index 2017=100",
  PAYEMS: "Thousands of Persons",
  FEDFUNDS: "Percent",
  GDPC1: "Billions of Chained 2017 Dollars",
  SOFR: "Percent",
  SAHMREALTIME: "Percentage Points",
};
function fact(
  id: string, seriesId: string, period: string, value: string,
  retrievedAt: string | null, capturedAt: string, vintageDate = "2026-09-20",
  overrides: Partial<Observation> = {},
): CapturedMacroObservation {
  const observation: StoredMacroObservation = {
    id, domain: "MACRO", sourceId: "fred", subject: seriesId, value,
    observedAt: period, retrievedAt, quality: "FRESH", evidenceId: "evidence-" + id,
    metadata: {
      seriesId, unit: units[seriesId], frequency: seriesId === "GDPC1" ? "QUARTERLY"
        : seriesId === "SOFR" ? "DAILY" : MONTHLY,
      observationDate: period.slice(0, 10), vintageDate, releasedAt: null,
    },
    ...overrides,
  };
  return { observation, capturedAt };
}
function history(rows: CapturedMacroObservation[], failure?: string): {
  repo: MacroEvidenceHistoryPort; calls: Array<{ seriesId: string; asOf: string; limit: number }>;
} {
  const calls: Array<{ seriesId: string; asOf: string; limit: number }> = [];
  return {
    calls,
    repo: {
      async findAsOf(input) {
        calls.push(input);
        if (input.seriesId === failure) throw new Error("simulated durable failure");
        return rows.filter((r) => r.observation.metadata?.seriesId === input.seriesId);
      },
    },
  };
}
function pce(rows: CapturedMacroObservation[]) {
  return history(rows);
}

test("#370: four macro facts assemble in fixed order without asset or event inputs", async () => {
  const rows = [
    fact("gdp", "GDPC1", "2026-04-01", "24408.011", EARLY.toISOString(), EARLY.toISOString()),
    fact("pce", "PCEPI", "2026-07-01", "131.659", EARLY.toISOString(), EARLY.toISOString()),
    fact("pay", "PAYEMS", "2026-08-01", "159015", EARLY.toISOString(), EARLY.toISOString()),
    fact("sofr", "SOFR", "2026-09-18", "4.00", EARLY.toISOString(), EARLY.toISOString()),
  ];
  const { repo, calls } = history(rows);
  const first = await buildMacroEvidenceBundle(repo, EARLY);
  const replay = await buildMacroEvidenceBundle(repo, EARLY);
  assert.deepEqual(first, replay);
  assert.deepEqual(first.slots.map((s) => s.seriesId),
    ["GDPC1", "PCEPI", "PAYEMS", "FEDFUNDS", "SOFR", "SAHMREALTIME"]);
  assert.deepEqual(first.slots.map((s) => s.status),
    ["AVAILABLE", "AVAILABLE", "AVAILABLE", "MISSING", "AVAILABLE", "MISSING"]);
  assert.equal(first.slots[1].latest?.evidenceId, "evidence-pce");
  assert.equal(first.slots[1].latest?.value, "131.659");
  assert.equal(first.slots[1].latest?.releasedAt, null);
  assert.deepEqual(first.expectations, { status: "MISSING", gap: "EXPECTATION_NOT_QUALIFIED" });
  assert.equal(calls.length, 12);
  assert.ok(calls.every((c) => c.asOf === EARLY.toISOString() && c.limit === 500
    && !["BTC", "GOLD", "SP500", "VIXCLS"].includes(c.seriesId)));
});

test("#370: arbitrary as-of replay selects both period revisions without future leakage", async () => {
  const rows = [
    fact("jun-old", "PCEPI", "2026-06-01", "131.454", "2026-09-20T23:03:39.484Z",
      "2026-09-20T23:03:41.189Z", "2026-08-26"),
    fact("jul-old", "PCEPI", "2026-07-01", "131.659", "2026-09-20T23:03:39.484Z",
      "2026-09-20T23:03:41.189Z", "2026-08-26"),
    fact("jun-revised", "PCEPI", "2026-06-01", "131.106", "2026-09-30T14:31:09.472Z",
      "2026-09-30T14:31:12.224Z", "2026-09-30"),
    fact("jul-revised", "PCEPI", "2026-07-01", "131.172", "2026-09-30T14:31:09.472Z",
      "2026-09-30T14:31:12.224Z", "2026-09-30"),
    fact("aug-new", "PCEPI", "2026-08-01", "131.579", "2026-09-30T14:31:09.472Z",
      "2026-09-30T14:31:12.224Z", "2026-09-30"),
  ];
  const { repo } = pce(rows);
  const early = (await buildMacroEvidenceBundle(repo, EARLY)).slots[1];
  const late = (await buildMacroEvidenceBundle(repo, LATE)).slots[1];
  assert.equal(early.latest?.observationId, "jul-old");
  assert.equal(early.predecessor?.observationId, "jun-old");
  assert.equal(late.latest?.observationId, "aug-new");
  assert.equal(late.predecessor?.observationId, "jul-revised");
  assert.equal(late.latest?.vintageDate, "2026-09-30");
  assert.equal(late.latest?.retrievedAt, "2026-09-30T14:31:09.472Z");
});

test("#370: persisted after cutoff, retrieved after cutoff and future vintage cannot enter T", async () => {
  const { repo } = pce([
    fact("past", "PCEPI", "2026-07-01", "131.659",
      "2026-09-19T00:00:00Z", "2026-09-20T00:00:00Z"),
    fact("future-capture", "PCEPI", "2026-08-01", "999",
      "2026-09-19T00:00:00Z", "2026-09-30T00:00:00Z"),
    fact("future-retrieval", "PCEPI", "2026-08-01", "999",
      "2026-09-30T00:00:00Z", "2026-09-20T00:00:00Z"),
    fact("future-vintage", "PCEPI", "2026-08-01", "999",
      "2026-09-19T00:00:00Z", "2026-09-20T00:00:00Z", "2026-09-30"),
    fact("future-observation", "PCEPI", "2026-10-01", "999",
      "2026-09-19T00:00:00Z", "2026-09-20T00:00:00Z"),
  ]);
  const slot = (await buildMacroEvidenceBundle(repo, EARLY)).slots[1];
  assert.equal(slot.latest?.observationId, "past");
  assert.equal(slot.predecessor, null);
  assert.equal(slot.gap, "NO_ADJACENT_HISTORY");
});

test("#370: legacy without retrievedAt is only eligible by proven physical capture", async () => {
  const { repo } = pce([
    fact("legacy", "PCEPI", "2026-07-01", "131.659", null,
      "2026-09-20T00:00:00Z"),
    fact("unavailable-old", "PCEPI", "2026-08-01", "999", null,
      "2026-09-23T00:00:00Z"),
  ]);
  const slot = (await buildMacroEvidenceBundle(repo, EARLY)).slots[1];
  assert.equal(slot.latest?.observationId, "legacy");
  assert.equal(slot.latest?.retrievedAt, null);
  assert.equal(slot.latest?.knownBy, "CAPTURED_ONLY");
  assert.equal(slot.latest?.releasedAt, null);
});

test("#370: source, cadence, unit and series mismatch never promote a fact", async () => {
  for (const override of [
    { sourceId: "unknown" },
    { metadata: { seriesId: "PCEPI", unit: "Percent", frequency: MONTHLY,
      observationDate: "2026-07-01", vintageDate: "2026-09-20" } },
    { metadata: { seriesId: "PCEPI", unit: units.PCEPI, frequency: "DAILY",
      observationDate: "2026-07-01", vintageDate: "2026-09-20" } },
    { identity: { version: "v1" as const, seriesKey: "WRONG",
      measurementId: "measurement", revisionFingerprint: "fingerprint" } },
  ]) {
    const { repo } = pce([fact("bad", "PCEPI", "2026-07-01", "131",
      EARLY.toISOString(), EARLY.toISOString(), "2026-09-20", override)]);
    const slot = (await buildMacroEvidenceBundle(repo, EARLY)).slots[1];
    assert.equal(slot.status, "INCOMPATIBLE");
    assert.equal(slot.gap, "SOURCE_OR_METADATA_MISMATCH");
    assert.equal(slot.latest, null);
  }
});

test("#370: partial, stale, empty and repository errors retain explicit gaps", async () => {
  for (const [quality, status, gap] of [
    ["STALE", "STALE", "STALE_QUALITY"],
    ["PARTIAL", "PARTIAL", "PARTIAL_QUALITY"],
  ] as const) {
    const { repo } = pce([fact(quality, "PCEPI", "2026-07-01", "131",
      EARLY.toISOString(), EARLY.toISOString(), "2026-09-20", { quality })]);
    const slot = (await buildMacroEvidenceBundle(repo, EARLY)).slots[1];
    assert.equal(slot.status, status);
    assert.equal(slot.gap, gap);
    assert.equal(slot.latest, null);
  }
  const blank = await buildMacroEvidenceBundle(history([]).repo, EARLY);
  assert.ok(blank.slots.every((x) => x.status === "MISSING" && x.latest === null));
  const broken = await buildMacroEvidenceBundle(history([], "PCEPI").repo, EARLY);
  assert.equal(broken.slots[1].status, "UNAVAILABLE");
  assert.equal(broken.slots[1].gap, "DURABLE_READ_FAILED");
});

test("#370: published model indicator stays published, not a reconstructed economic probability", async () => {
  const { repo } = history([fact("sahm", "SAHMREALTIME", "2026-09-01", "0.15",
    "2026-09-20T00:00:00Z", "2026-09-20T00:00:00Z")]);
  const sahm = (await buildMacroEvidenceBundle(repo, EARLY)).slots[5];
  assert.equal(sahm.status, "AVAILABLE");
  assert.equal(sahm.kind, "PUBLISHED_INDICATOR");
  assert.equal(sahm.latest?.nativeUnit, "Percentage Points");
});

test("#370: malformed cutoff, unqualified publication and truncated reads fail closed", async () => {
  await assert.rejects(buildMacroEvidenceBundle(history([]).repo, new Date("invalid")));
  const badRelease = fact("future-release", "PCEPI", "2026-07-01", "131",
    EARLY.toISOString(), EARLY.toISOString());
  badRelease.observation.metadata!.releasedAt = "2026-09-30T10:00:00Z";
  const slot = (await buildMacroEvidenceBundle(history([badRelease]).repo, EARLY)).slots[1];
  assert.equal(slot.status, "MISSING");
  const repeated = Array.from({ length: 500 }, (_, i) =>
    fact("long-" + i, "PCEPI", "2026-07-01", "131",
      EARLY.toISOString(), EARLY.toISOString()));
  const truncated = (await buildMacroEvidenceBundle(history(repeated).repo, EARLY)).slots[1];
  assert.equal(truncated.status, "UNAVAILABLE");
});


test("#370: date-only publisher marker is never promoted to an exact release instant", async () => {
  const row = fact("date-only", "PCEPI", "2026-07-01", "131.659",
    "2026-09-20T00:00:00Z", "2026-09-20T00:00:00Z");
  row.observation.metadata!.releasedAt = "2026-09-20";
  const slot = (await buildMacroEvidenceBundle(history([row]).repo, EARLY)).slots[1];
  assert.equal(slot.status, "AVAILABLE");
  assert.equal(slot.latest?.releasedAt, null);
});
