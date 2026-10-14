import assert from "node:assert/strict";
import test from "node:test";
import { providerResult } from "../data/types";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import type { MacroObservationInput } from "../data/fred";
import type { GdeltGalFeedSnapshot } from "../data/gdelt-gal";
import {
  canonicalizeRetainedMacroResult,
  isRetainedMacroHistoricalProvider,
} from "./historical-ingestion-macro-normalization";
import { canonicalizeHistoricalResult } from "./historical-ingestion-normalization";
import { cftcGoldCotBackfillRangeError, soSoValueBackfillRangeError } from "../data/provider-backfill-ranges";
import { cftcGoldCotBackfillRangeError as cftcPublic } from "../data/cftc-gold-cot";
import { soSoValueBackfillRangeError as etfPublic } from "../data/sosovalue-etf-flow";
import { EVENT_INGESTION_PROVIDERS } from "./event-ingestion";

test("MACRO-CUT-003B: FRED emits same canonical identity, evidence and vintage as previous dispatch", () => {
  const series = MACRO_SERIES_REGISTRY[0];
  const row: MacroObservationInput = {
    series, value: "0.25", observationDate: "2020-01-01",
    previousValue: null, vintageDate: "2020-01-01", releasedAt: null,
    retrievedAt: "2026-09-20T09:00:01.000Z",
    provenance: {
      version: "v1",
      providerResource: "/fred/series/observations",
      nativeSeriesId: series.seriesId,
      observationDate: "2020-01-01",
      vintageDate: "2020-01-01",
    },
  };
  const result = providerResult("fred", "SUCCESS", [row], undefined, undefined, row.retrievedAt);
  const direct = canonicalizeRetainedMacroResult(result, "fred");
  const legacy = canonicalizeHistoricalResult(result, "fred", "FORWARD");
  assert.deepEqual(direct, legacy);
  assert.equal(direct.observations.length, 1);
  assert.equal(direct.observations[0].sourceId, "fred");
  assert.equal(direct.evidence.length, 1);
  assert.equal(direct.observations[0].evidenceId, direct.evidence[0].id);
  assert.equal(direct.observations[0].metadata?.vintageDate, "2020-01-01");
});

test("MACRO-CUT-003B: SEP, GDELT and Biquote legacy contracts stay intact", () => {
  assert.equal(isRetainedMacroHistoricalProvider("fred"), true);
  assert.equal(isRetainedMacroHistoricalProvider("federal-reserve-sep"), true);
  assert.equal(isRetainedMacroHistoricalProvider("gdelt"), true);
  assert.equal(isRetainedMacroHistoricalProvider("coingecko"), false);
  const sep = canonicalizeRetainedMacroResult(providerResult("federal-reserve", "EMPTY", []), "federal-reserve-sep");
  assert.deepEqual(sep, { observations: [], evidence: [] });
  const gdeltRow: GdeltGalFeedSnapshot = {
    asset: "BTC", feedLastBuildAt: "2026-10-04T12:00:00.000Z",
    feedWindowStartAt: "2026-10-04T11:45:00.000Z",
    coverage: "ROLLING_15_MINUTES", totalFeedItems: 0, invalidItemCount: 0,
    matchingCandidateCount: 0, candidateCoverage: "COMPLETE", candidates: [],
  };
  const result = providerResult("gdelt", "SUCCESS", [gdeltRow], undefined, undefined, "2026-10-04T12:00:05.000Z");
  const direct = canonicalizeRetainedMacroResult(result, "gdelt");
  const legacy = canonicalizeHistoricalResult(result, "gdelt", "FORWARD");
  assert.deepEqual(direct, legacy);
  assert.equal(direct.observations.length, 0);
  assert.equal(direct.evidence[0].sourceId, "gdelt");
  assert.equal(direct.evidence[0].metadata?.gdeltAsset, "BTC");
  assert.deepEqual(EVENT_INGESTION_PROVIDERS, ["forex-factory", "biquote", "federal-reserve"]);
  assert.equal(MACRO_SERIES_REGISTRY.length, 37);
});

test("MACRO-CUT-003B: extracted market range policy has identical error behavior and public exports", () => {
  for (const range of [
    { from: "2026-10-01", to: "2026-10-01" },
    { from: "2026-02-28", to: "2026-03-01" },
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-10-05", to: "2026-10-02" },
    { from: "2026-01-01", to: "2026-10-14" },
  ]) {
    assert.equal(soSoValueBackfillRangeError(range), etfPublic(range));
    assert.equal(cftcGoldCotBackfillRangeError(range), cftcPublic(range));
  }
  assert.equal(soSoValueBackfillRangeError({ from: "2026-10-01", to: "2026-10-29" }),
    "SoSoValue BACKFILL is limited to 28 calendar days");
  assert.equal(cftcGoldCotBackfillRangeError({ from: "2025-10-01", to: "2026-10-14" }),
    "CFTC Gold COT BACKFILL is limited to 370 calendar days");
});
