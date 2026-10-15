import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFILLAMA_STABLECOIN_PEG_TYPE,
  DEFILLAMA_STABLECOIN_RESOURCE,
  qualifyDefiLlamaStablecoinRows,
  type DefiLlamaStablecoinObservationInput,
} from "./defillama-stablecoins";

const RETRIEVED_AT = "2026-09-29T12:00:00.000Z";
const DAY = 24 * 60 * 60;
const retrievedSeconds = Date.parse(RETRIEVED_AT) / 1000;

function row(date: number | string, peggedUSD: unknown) {
  return { date, totalCirculatingUSD: { peggedUSD } };
}
const forward = (payload: unknown) => qualifyDefiLlamaStablecoinRows(payload, RETRIEVED_AT, { mode: "FORWARD" });

test("MACRO-CUT-003P: DefiLlama historical schema, FORWARD latest selection, provenance, and explicit zero are preserved", () => {
  const valid = forward([
    row(String(retrievedSeconds - DAY), 100),
    row(String(retrievedSeconds), 110),
  ]);
  assert.equal(valid.length, 1);
  assert.equal(valid[0]?.value, 110);
  assert.equal(valid[0]?.observedAt, RETRIEVED_AT);
  assert.equal(valid[0]?.retrievedAt, RETRIEVED_AT);
  assert.equal(valid[0]?.pegType, "peggedUSD");
  assert.equal(valid[0]?.unit, "USD");
  assert.equal(valid[0]?.providerResource, DEFILLAMA_STABLECOIN_RESOURCE);
  assert.equal(valid[0]?.provenance.observationDate, "2026-09-29");
  assert.equal(valid[0]?.provenance.providerResource, DEFILLAMA_STABLECOIN_RESOURCE);
  assert.equal(valid[0]?.metadata.providerEffectiveTimestamp, RETRIEVED_AT);
  assert.equal(valid[0]?.metadata.providerEffectiveDate, "2026-09-29");
  assert.equal(valid[0]?.metadata.pegType, DEFILLAMA_STABLECOIN_PEG_TYPE);
  assert.equal(forward([row(retrievedSeconds, 0)])[0]?.value, 0);
  assert.deepEqual(forward([]), []);
  const typed: DefiLlamaStablecoinObservationInput = valid[0]!;
  assert.equal(typed.metricId, "crypto.usd_stablecoin_market_cap.usd");
});

test("MACRO-CUT-003P: malformed DefiLlama values or future dates fail closed, never become zero or EMPTY", () => {
  const invalid: unknown[] = [
    [ { date: retrievedSeconds } ],
    [ { date: retrievedSeconds, totalCirculatingUSD: {} } ],
    [ row(retrievedSeconds, "110") ],
    [ row(retrievedSeconds, null) ],
    [ row("not-a-date", 110) ],
    [ row(retrievedSeconds + DAY, 110) ],
    [ row(retrievedSeconds, Number.NaN) ],
    [ row(retrievedSeconds, Number.POSITIVE_INFINITY) ],
    [ row(retrievedSeconds, Number.NEGATIVE_INFINITY) ],
    { date: retrievedSeconds },
    [ null ],
  ];
  for (const payload of invalid) {
    assert.throws(() => forward(payload), /DefiLlama malformed payload/, JSON.stringify(payload));
  }
  assert.throws(
    () => qualifyDefiLlamaStablecoinRows([], "not-time", { mode: "FORWARD" }),
    /retrieval timestamp is invalid/,
  );
});

test("MACRO-CUT-003P: BACKFILL inclusive range selects only qualified dates, sorted, with invalid bounds rejected", () => {
  const payload = [
    row(Date.parse("2026-09-04T00:00:00.000Z") / 1000, 104),
    row(Date.parse("2026-09-01T00:00:00.000Z") / 1000, 100),
    row(Date.parse("2026-08-31T00:00:00.000Z") / 1000, 90),
    row(Date.parse("2026-09-03T00:00:00.000Z") / 1000, 103),
  ];
  const selected = qualifyDefiLlamaStablecoinRows(payload, RETRIEVED_AT, {
    mode: "BACKFILL",
    range: { from: "2026-09-01", to: "2026-09-03" },
  });
  assert.deepEqual(selected.map(item => item.observedAt.slice(0, 10)), ["2026-09-01", "2026-09-03"]);
  assert.deepEqual(selected.map(item => item.value), [100, 103]);
  assert.throws(() => qualifyDefiLlamaStablecoinRows([], RETRIEVED_AT, { mode: "BACKFILL" }), /explicit range/);
  for (const range of [
    { from: "2026-09-99", to: "2026-09-01" },
    { from: "2026-09-04", to: "2026-09-01" },
  ]) {
    assert.throws(() => qualifyDefiLlamaStablecoinRows(payload, RETRIEVED_AT, { mode: "BACKFILL", range }), /valid from\/to date bounds/);
  }
});

test("MACRO-CUT-003P: live DefiLlama HTTP fetch absent but historical DTO imports and source identity remain", () => {
  const source = readFileSync(new URL("./defillama-stablecoins.ts", import.meta.url), "utf8");
  const historical = readFileSync(new URL("../application/historical-ingestion-normalization.ts", import.meta.url), "utf8");
  const contract = readFileSync(new URL("../application/historical-ingestion-contract.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /server-only|fetchDefiLlamaStablecoinObservations|stablecoins\.llama\.fi|providerFetchPolicy|\bfetch\(/);
  assert.match(source, /export type DefiLlamaStablecoinObservationInput/);
  assert.match(source, /export type DefiLlamaStablecoinBackfillRange/);
  assert.match(source, /function parseRows\(/);
  assert.match(source, /function selectRows\(/);
  assert.match(historical, /import type \{ DefiLlamaStablecoinObservationInput \} from "\.\.\/data\/defillama-stablecoins"/);
  assert.match(contract, /DefiLlamaStablecoinBackfillRange, DefiLlamaStablecoinObservationInput/);
});
