import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import type { CapturedMacroObservation, MacroEvidenceHistoryPort } from "./macro-evidence-bundle";
import { buildPcepiSaMoM, calculatePcepiSaMoM, PCEPI_SA_MOM_METHOD_VERSION } from "./pcepi-sa-mom";

const EARLY = new Date("2026-09-21T00:00:00.000Z");
const LATE = new Date("2026-10-01T00:00:00.000Z");
const capturedOld = "2026-09-20T23:03:41.189Z";
const retrievedOld = "2026-09-20T23:03:39.484Z";
const capturedNew = "2026-09-30T14:31:12.224Z";
const retrievedNew = "2026-09-30T14:31:09.472Z";
function row(id: string, period: string, value: string, retrievedAt: string | null,
  capturedAt: string, vintageDate = "2026-09-30",
  change: Partial<Observation> = {}): CapturedMacroObservation {
  return {
    capturedAt,
    observation: {
      id, domain: "MACRO", sourceId: "fred",
      subject: "Personal Consumption Expenditures: Chain-type Price Index",
      evidenceId: "evidence-" + id, value, observedAt: period,
      retrievedAt, quality: "FRESH",
      identity: { version: "v1", seriesKey: "PCEPI", measurementId: "measurement-" + period,
        revisionFingerprint: "revision-" + value },
      metadata: {
        seriesId: "PCEPI", unit: "Index 2017=100",
        frequency: "MONTHLY", observationDate: period,
        vintageDate, releasedAt: null,
      },
      ...change,
    },
  };
}
function source(rows: CapturedMacroObservation[], calls: Array<unknown> = []): MacroEvidenceHistoryPort {
  return {
    async findAsOf(query) {
      calls.push(query);
      // For hostile mocked transports deliberately include future rows; the
      // canonical #370 selector must enforce cutoff independently.
      return rows;
    },
  };
}
const revisions = [
  row("jun-old", "2026-06-01", "131.454", retrievedOld, capturedOld, "2026-08-26"),
  row("jul-old", "2026-07-01", "131.659", retrievedOld, capturedOld, "2026-08-26"),
  row("jun-new", "2026-06-01", "131.106", retrievedNew, capturedNew, "2026-09-30"),
  row("jul-new", "2026-07-01", "131.172", retrievedNew, capturedNew, "2026-09-30"),
  row("aug-new", "2026-08-01", "131.579", retrievedNew, capturedNew, "2026-09-30"),
];
test("#372: historical July PCEPI pre/post revision replays without lookahead", async () => {
  const calls: unknown[] = [];
  const repo = source(revisions, calls);
  const early = await buildPcepiSaMoM(repo, EARLY, "2026-07-01");
  const late = await buildPcepiSaMoM(repo, LATE, "2026-07-01");
  assert.equal(early.status, "AVAILABLE");
  assert.equal(early.roundedPercent, "0.155948");
  assert.equal(early.current?.observationId, "jul-old");
  assert.equal(early.predecessor?.observationId, "jun-old");
  assert.equal(early.current?.vintageDate, "2026-08-26");
  assert.equal(late.status, "AVAILABLE");
  assert.equal(late.roundedPercent, "0.050341");
  assert.equal(late.current?.observationId, "jul-new");
  assert.equal(late.predecessor?.observationId, "jun-new");
  assert.equal(late.current?.vintageDate, "2026-09-30");
  assert.equal(late.current?.evidenceId, "evidence-jul-new");
  assert.equal(early.sourceReleaseInstant, "UNVERIFIED");
  assert.equal(late.sourceRights, "REVIEW_REQUIRED_BEFORE_PUBLIC_REDISTRIBUTION");
  assert.equal(early.methodVersion, PCEPI_SA_MOM_METHOD_VERSION);
  assert.deepEqual(calls, [
    { seriesId: "PCEPI", asOf: EARLY.toISOString(), limit: 500 },
    { seriesId: "PCEPI", asOf: LATE.toISOString(), limit: 500 },
  ]);
});
test("#372: exact rational arithmetic Aug/Jul 2026 agrees with independent SQL", async () => {
  const value = await buildPcepiSaMoM(source(revisions), LATE);
  assert.equal(value.status, "AVAILABLE");
  assert.equal(value.reason, null);
  assert.equal(value.current?.period, "2026-08-01");
  assert.equal(value.current?.index, "131.579");
  assert.equal(value.predecessor?.period, "2026-07-01");
  assert.equal(value.predecessor?.index, "131.172");
  assert.equal(value.roundedPercent, "0.310280");
  assert.deepEqual(value.exactPercentFraction, { numerator: "10175", denominator: "32793" });
  assert.equal(value.outputUnit, "PERCENT_MONTH_OVER_MONTH");
  assert.equal(value.seasonality, "SEASONALLY_ADJUSTED");
  assert.equal(value.significance, "NOT_EVALUATED");
  assert.equal(value.causality, "NOT_EVALUATED");
});
test("#372: exact zero, negative change and positive change; no float rounding drift", async () => {
  for (const [now, last, want] of [
    ["100.000", "100", "0.000000"],
    ["99", "100", "-1.000000"],
    ["101", "100", "1.000000"],
    ["100.0000005", "100", "0.000001"],
  ] as const) {
    const testRows = [
      row("prior", "2026-06-01", last, retrievedNew, capturedNew),
      row("current", "2026-07-01", now, retrievedNew, capturedNew),
    ];
    const output = await buildPcepiSaMoM(source(testRows), LATE);
    assert.equal(output.roundedPercent, want, now);
  }
});
test("#372: a nonadjacent predecessor never becomes a monthly comparator", async () => {
  const output = await buildPcepiSaMoM(source([
    row("apr", "2026-04-01", "100", retrievedNew, capturedNew),
    row("aug", "2026-08-01", "102", retrievedNew, capturedNew),
  ]), LATE);
  assert.equal(output.status, "INSUFFICIENT");
  assert.equal(output.reason, "NO_ADJACENT_PREDECESSOR");
  assert.equal(output.roundedPercent, null);
});
test("#372: no prior period, future-only target and empty history report distinct insufficiency", async () => {
  const single = source([row("jul", "2026-07-01", "100", retrievedNew, capturedNew)]);
  assert.equal((await buildPcepiSaMoM(single, LATE)).reason, "NO_ADJACENT_PREDECESSOR");
  assert.equal((await buildPcepiSaMoM(single, LATE, "2026-08-01")).reason, "NO_ELIGIBLE_CURRENT");
  assert.equal((await buildPcepiSaMoM(source([]), LATE)).reason, "NO_ELIGIBLE_CURRENT");
});
test("#372: missing retrieval has conservative captured-only lineage and never backdates knowledge", async () => {
  const noRetrieved = [
    row("july", "2026-07-01", "101", null, "2026-09-20T00:00:00Z", "2026-08-26"),
    row("june", "2026-06-01", "100", null, "2026-09-20T00:00:00Z", "2026-08-26"),
  ];
  const eligible = await buildPcepiSaMoM(source(noRetrieved), EARLY);
  assert.equal(eligible.status, "AVAILABLE");
  assert.equal(eligible.current?.retrievedAt, null);
  assert.equal(eligible.current?.knownBy, "CAPTURED_ONLY");
  const tooEarly = await buildPcepiSaMoM(source(noRetrieved), new Date("2026-09-19T00:00:00Z"));
  assert.equal(tooEarly.status, "INSUFFICIENT");
});
test("#372: delayed retrieval, delayed capture, future vintage, or future release cannot leak into PIT", async () => {
  const valid = [
    row("june", "2026-06-01", "100", retrievedOld, capturedOld, "2026-08-26"),
    row("july", "2026-07-01", "101", retrievedOld, capturedOld, "2026-08-26"),
  ];
  for (const future of [
    row("capture-late", "2026-08-01", "999", retrievedOld, capturedNew, "2026-08-26"),
    row("retrieve-late", "2026-08-01", "999", retrievedNew, capturedOld, "2026-08-26"),
    row("vintage-late", "2026-08-01", "999", retrievedOld, capturedOld, "2026-09-30"),
    row("release-late", "2026-08-01", "999", retrievedOld, capturedOld, "2026-08-26", {
      metadata: {
        seriesId: "PCEPI", unit: "Index 2017=100", frequency: "MONTHLY",
        observationDate: "2026-08-01", vintageDate: "2026-08-26",
        releasedAt: "2026-09-30T10:00:00Z",
      },
    }),
  ]) {
    const result = await buildPcepiSaMoM(source([...valid, future]), EARLY);
    assert.equal(result.status, "AVAILABLE");
    assert.equal(result.current?.observationId, "july");
  }
});
test("#372: mismatched source/series/quality/native frequency and units fail closed", async () => {
  for (const change of [
    { sourceId: "unknown" },
    { domain: "ASSET" as const },
    { quality: "STALE" as const },
    { quality: "PARTIAL" as const },
    { metadata: { seriesId: "PCEPI", frequency: "WEEKLY", unit: "Index 2017=100",
      vintageDate: "2026-09-30", observationDate: "2026-07-01" } },
    { metadata: { seriesId: "PCEPI", frequency: "MONTHLY", unit: "Percent",
      vintageDate: "2026-09-30", observationDate: "2026-07-01" } },
  ]) {
    const result = await buildPcepiSaMoM(source([
      row("prior", "2026-06-01", "100", retrievedNew, capturedNew),
      row("target", "2026-07-01", "101", retrievedNew, capturedNew, "2026-09-30", change),
    ]), LATE);
    assert.equal(result.status, "INSUFFICIENT", JSON.stringify(change));
    assert.equal(result.roundedPercent, null);
  }
});
test("#372: stale predecessor and mismatched vintages are not valid arithmetic evidence", async () => {
  const stale = await buildPcepiSaMoM(source([
    row("prior", "2026-06-01", "100", retrievedNew, capturedNew, "2026-09-30",
      { quality: "STALE" }),
    row("target", "2026-07-01", "101", retrievedNew, capturedNew),
  ]), LATE);
  assert.equal(stale.reason, "UNQUALIFIED_SOURCE_OR_QUALITY");
  const different = await buildPcepiSaMoM(source([
    row("prior", "2026-06-01", "100", retrievedOld, capturedOld, "2026-08-26"),
    row("target", "2026-07-01", "101", retrievedNew, capturedNew, "2026-09-30"),
  ]), LATE);
  assert.equal(different.reason, "INCOMPATIBLE_VINTAGE");
});
test("#372: zero denominator, invalid numeric, overprecise values fail closed", async () => {
  for (const value of ["0", "-1", "NaN", "1e3", "100.0000000000001"]) {
    const result = await buildPcepiSaMoM(source([
      row("prior", "2026-06-01", value, retrievedNew, capturedNew),
      row("target", "2026-07-01", "101", retrievedNew, capturedNew),
    ]), LATE);
    assert.equal(result.status, "INSUFFICIENT");
    assert.equal(result.roundedPercent, null);
  }
  const badLatest = await buildPcepiSaMoM(source([
    row("prior", "2026-06-01", "100", retrievedNew, capturedNew),
    row("target", "2026-07-01", "NaN", retrievedNew, capturedNew),
  ]), LATE);
  assert.equal(badLatest.status, "INSUFFICIENT");
});
test("#372: history errors, truncated pages and wrong calculator input fail closed", async () => {
  const errorPort: MacroEvidenceHistoryPort = { findAsOf: async () => { throw new Error("unavailable"); } };
  assert.equal((await buildPcepiSaMoM(errorPort, LATE)).reason, "DURABLE_READ_FAILED");
  const many = Array.from({ length: 500 }, (_, n) =>
    row("item" + n, "2026-07-01", "101", retrievedNew, capturedNew));
  assert.equal((await buildPcepiSaMoM(source(many), LATE)).reason, "DURABLE_READ_FAILED");
  const wrong = calculatePcepiSaMoM({
    seriesId: "GDPC1", family: "GROWTH", kind: "OBSERVED_FACT",
    status: "MISSING", latest: null, predecessor: null, gap: "NO_ELIGIBLE_HISTORY",
  }, LATE.toISOString());
  assert.equal(wrong.status, "INSUFFICIENT");
});
test("#372: malformed read cutoffs and nonmonth target period are rejected", async () => {
  const repo = source([]);
  await assert.rejects(buildPcepiSaMoM(repo, new Date(NaN)));
  await assert.rejects(buildPcepiSaMoM(repo, LATE, "2026-07-02"));
  await assert.rejects(buildPcepiSaMoM(repo, LATE, "2026-13-01"));
  await assert.rejects(buildPcepiSaMoM(repo, LATE, "2026-11-01"));
});

test("#372: canonical rational is stable across equivalent decimal scales", async () => {
  const first = await buildPcepiSaMoM(source([
    row("prior", "2026-07-01", "131.172", retrievedNew, capturedNew),
    row("current", "2026-08-01", "131.579", retrievedNew, capturedNew),
  ]), LATE);
  const padded = await buildPcepiSaMoM(source([
    row("prior-padded", "2026-07-01", "131.17200", retrievedNew, capturedNew),
    row("current-padded", "2026-08-01", "131.5790", retrievedNew, capturedNew),
  ]), LATE);
  assert.deepEqual(first.exactPercentFraction, padded.exactPercentFraction);
  assert.equal(first.roundedPercent, padded.roundedPercent);
});
