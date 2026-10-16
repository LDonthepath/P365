import assert from "node:assert/strict";
import test from "node:test";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import type { MacroObservationInput } from "../data/fred";
import { providerResult } from "../data/types";
import { marketMemoryDedupeKey, marketMemoryEffectiveAt } from "../data/market-memory-record";
import { canonicalizeRetainedMacroResult } from "./historical-ingestion-macro-normalization";
import { parseHistoricalIngestionRequest } from "./historical-ingestion-request";
import { selectPcepiMacroEvidenceAt } from "./macro-evidence-bundle";
import { buildPrbData002DryRunManifest, PRB_DATA_002_SERIES } from "./prb-data-002-backfill-plan";

function input(value: string, retrievedAt: string, vintageDate: string, observationDate = "2025-08-01"): MacroObservationInput {
  const series = MACRO_SERIES_REGISTRY.find((item) => item.seriesId === "PCEPI");
  assert.ok(series);
  return {
    series, value, observationDate, previousValue: null, vintageDate,
    releasedAt: null, retrievedAt,
    provenance: {
      version: "v1", providerResource: "/fred/series/observations",
      nativeSeriesId: "PCEPI", observationDate, vintageDate,
    },
  };
}
function canonical(inputRow: MacroObservationInput) {
  const result = canonicalizeRetainedMacroResult(
    providerResult("fred", "SUCCESS", [inputRow]), "fred");
  assert.equal(result.observations.length, 1);
  assert.equal(result.evidence.length, 1);
  return result;
}

test("#364: frozen four sources, six 120-day-safe windows and 96 monthly series-periods", () => {
  const manifest = buildPrbData002DryRunManifest();
  assert.deepEqual(PRB_DATA_002_SERIES, ["CPIAUCSL", "CPILFESL", "PCEPI", "PCEPILFE"]);
  assert.equal(manifest.length, 6);
  assert.equal(manifest.reduce((n, x) => n + x.expectedMonthlySeriesPeriods, 0), 96);
  assert.equal(manifest.reduce((n, x) => n + x.minimumProviderPages, 0), 24);
  const periods: string[] = [];
  for (const window of manifest) {
    const params = new URLSearchParams(window.query);
    const parsed = parseHistoricalIngestionRequest(params);
    assert.ok(parsed.ok);
    if (!parsed.ok) return;
    assert.equal(parsed.options.mode, "BACKFILL");
    assert.deepEqual(parsed.options.providers, ["fred"]);
    assert.deepEqual(parsed.options.fred?.seriesIds, PRB_DATA_002_SERIES);
    assert.equal(parsed.options.fred?.limit, 100);
    assert.equal(window.seriesIds.length, 4);
    const elapsed = (Date.parse(window.to) - Date.parse(window.from)) / 86400000 + 1;
    assert.ok(elapsed <= 120, window.query);
    for (let month = 0; month < 4; month++) {
      const date = new Date(Date.parse(window.from));
      date.setUTCMonth(date.getUTCMonth() + month);
      periods.push(date.toISOString().slice(0, 10));
    }
  }
  assert.equal(new Set(periods).size, 24);
  assert.equal(periods[0], "2024-09-01");
  assert.equal(periods.at(-1), "2026-08-01");
  assert.deepEqual(manifest, buildPrbData002DryRunManifest());
});

test("#364: all four native sources remain qualified monthly seasonally-adjusted indices", () => {
  for (const id of PRB_DATA_002_SERIES) {
    const item = MACRO_SERIES_REGISTRY.find((entry) => entry.seriesId === id);
    assert.ok(item, id);
    assert.equal(item.source, "FRED");
    assert.equal(item.domain, "MACRO");
    assert.equal(item.frequency, "MONTHLY");
    assert.match(item.unit, /Index/);
  }
});

test("#364: provider parser rejects scope expansion and window overflow before writes", () => {
  const valid = buildPrbData002DryRunManifest()[0];
  for (const params of [
    new URLSearchParams({ providers: "coingecko", mode: "BACKFILL",
      fredSeries: PRB_DATA_002_SERIES.join(","), from: valid.from, to: valid.to }),
    new URLSearchParams({ providers: "fred,gdelt", mode: "BACKFILL",
      fredSeries: PRB_DATA_002_SERIES.join(","), from: valid.from, to: valid.to }),
    new URLSearchParams({ providers: "fred", mode: "BACKFILL",
      fredSeries: PRB_DATA_002_SERIES.join(",") + ",PAYEMS", from: "2024-09-01", to: "2025-02-01" }),
    new URLSearchParams({ providers: "fred", mode: "BACKFILL",
      fredSeries: PRB_DATA_002_SERIES.join(","), from: "2024-09-01", to: "2025-02-01" }),
  ]) {
    const parsed = parseHistoricalIngestionRequest(params);
    // Adding a registered fifth series is valid only for a *different*
    // request, not this frozen manifest; the manifest itself cannot generate it.
    assert.equal(parsed.ok, false);
  }
});

test("#364: repeated identical modern FRED observation/Evidence are idempotent without capture timestamp identity", () => {
  const first = canonical(input("123.450", "2026-10-16T11:00:00.000Z", "2026-10-16"));
  const rerun = canonical(input("123.4500", "2026-10-16T12:00:00.000Z", "2026-10-16"));
  assert.equal(first.observations[0].id, rerun.observations[0].id);
  assert.equal(first.evidence[0].id, rerun.evidence[0].id);
  assert.equal(marketMemoryDedupeKey("OBSERVATION", first.observations[0]),
    marketMemoryDedupeKey("OBSERVATION", rerun.observations[0]));
  assert.equal(marketMemoryDedupeKey("EVIDENCE", first.evidence[0]),
    marketMemoryDedupeKey("EVIDENCE", rerun.evidence[0]));
  assert.equal(marketMemoryEffectiveAt("OBSERVATION", first.observations[0]),
    "2025-08-01");
  assert.notEqual(first.observations[0].retrievedAt, rerun.observations[0].retrievedAt);
});

test("#364: changed FRED value appends a distinct factual revision at the same observed period", () => {
  const old = canonical(input("123.450", "2026-10-10T11:00:00.000Z", "2026-10-10"));
  const revised = canonical(input("123.451", "2026-10-16T11:00:00.000Z", "2026-10-16"));
  assert.notEqual(old.observations[0].id, revised.observations[0].id);
  assert.notEqual(marketMemoryDedupeKey("OBSERVATION", old.observations[0]),
    marketMemoryDedupeKey("OBSERVATION", revised.observations[0]));
  assert.equal(old.observations[0].observedAt, revised.observations[0].observedAt);
  assert.equal(old.observations[0].metadata?.releasedAt, null);
  assert.equal(revised.observations[0].metadata?.releasedAt, null);
});

test("#364: acquisition of an old reference period cannot backdate its knowability", () => {
  const backfilled = canonical(input("123.450", "2026-10-16T11:00:00.000Z", "2026-10-16")).observations[0];
  const rows = [{ observation: { ...backfilled, quality: "FRESH" as const },
    capturedAt: "2026-10-16T11:00:02.000Z" }];
  const before = selectPcepiMacroEvidenceAt(rows, "2026-10-16T10:59:59.000Z", "2025-08-01");
  assert.equal(before.status, "MISSING");
  assert.equal(before.latest, null);
  const after = selectPcepiMacroEvidenceAt(rows, "2026-10-16T11:00:03.000Z", "2025-08-01");
  assert.equal(after.status, "AVAILABLE");
  assert.equal(after.latest?.observationId, backfilled.id);
  assert.equal(after.latest?.knownBy, "RETRIEVED_AND_CAPTURED");
  assert.equal(after.latest?.releasedAt, null);
  assert.equal(after.latest?.capturedAt, "2026-10-16T11:00:02.000Z");
});
