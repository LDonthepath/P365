import assert from "node:assert/strict";
import test from "node:test";
import {
  CFTC_GOLD_COT_FORWARD_REPORT_LIMIT,
  CFTC_GOLD_COT_MAX_BACKFILL_CALENDAR_DAYS,
  CFTC_GOLD_COT_PROVIDER_RESOURCE,
  cftcGoldCotBackfillRangeError,
  fetchCftcGoldCotObservations,
} from "./cftc-gold-cot";

function row(date: string): Record<string, unknown> {
  return {
    market_and_exchange_names: "GOLD - COMMODITY EXCHANGE INC.",
    report_date_as_yyyy_mm_dd: `${date}T00:00:00.000`,
    cftc_contract_market_code: "088691",
    open_interest_all: "500000",
    prod_merc_positions_long: "70000",
    prod_merc_positions_short: "180000",
    swap_positions_long_all: "90000",
    swap__positions_short_all: "45000",
    swap__positions_spread_all: "35000",
    m_money_positions_long_all: "210000",
    m_money_positions_short_all: "35000",
    m_money_positions_spread_all: "25000",
    other_rept_positions_long: "45000",
    other_rept_positions_short: "30000",
    other_rept_positions_spread: "15000",
    nonrept_positions_long_all: "50000",
    nonrept_positions_short_all: "60000",
    futonly_or_combined: "FutOnly",
  };
}

function fetchJson(payload: unknown, status = 200): typeof fetch {
  return (async () => new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  })) as typeof fetch;
}

test("acquires bounded CFTC Gold Futures Only rows and expands raw participant series", async () => {
  let requested = "";
  const fetcher = (async (input: RequestInfo | URL) => {
    requested = String(input);
    return new Response(JSON.stringify([
      row("2026-09-29"),
      row("2026-09-22"),
    ]), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  const result = await fetchCftcGoldCotObservations(
    { mode: "FORWARD" },
    { fetch: fetcher, now: () => new Date("2026-10-02T19:31:00.000Z") },
  );

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.data.length, 28, "two weekly reports expand to fourteen raw series each");
  assert.equal(result.retrievedAt, "2026-10-02T19:31:00.000Z");

  const url = new URL(requested);
  assert.equal(url.origin, "https://publicreporting.cftc.gov");
  assert.equal(url.pathname, CFTC_GOLD_COT_PROVIDER_RESOURCE);
  assert.match(url.searchParams.get("$where") ?? "", /cftc_contract_market_code='088691'/);
  assert.equal(url.searchParams.get("$order"), "report_date_as_yyyy_mm_dd DESC");
  assert.equal(url.searchParams.get("$limit"), String(CFTC_GOLD_COT_FORWARD_REPORT_LIMIT));

  const managedLong = result.data.find((item) => item.metricId === "gold.cftc.managed_money.long.contracts");
  assert.ok(managedLong);
  assert.equal(managedLong.value, 210000);
  assert.equal(managedLong.observedAt, "2026-09-29T00:00:00.000Z");
  assert.equal(managedLong.reportDate, "2026-09-29");
  assert.equal(managedLong.participantCategory, "MANAGED_MONEY");
  assert.equal(managedLong.positionSide, "LONG");
  assert.equal(managedLong.providerField, "m_money_positions_long_all");
  assert.equal(managedLong.provenance.nativeInstrumentId, "088691");
  assert.equal(managedLong.provenance.nativeSeriesId, "m_money_positions_long_all");
  assert.equal(managedLong.provenance.observationDate, "2026-09-29");
  assert.equal(managedLong.metadata.frequency, "WEEKLY");
  assert.equal("releasedAt" in managedLong.metadata, false);
});

test("accepts documented provider field aliases while preserving the actual field in provenance", async () => {
  const aliased = row("2026-09-29");
  delete aliased.prod_merc_positions_long;
  aliased.prod_merc_positions_long_all = "70000";
  delete aliased.swap__positions_short_all;
  aliased.swap_positions_short_all = "45000";
  delete aliased.other_rept_positions_long;
  aliased.other_rept_positions_long_all = "45000";

  const result = await fetchCftcGoldCotObservations(
    { mode: "FORWARD" },
    { fetch: fetchJson([aliased]), now: () => new Date("2026-10-02T19:31:00.000Z") },
  );
  assert.equal(result.status, "SUCCESS");
  assert.equal(
    result.data.find((item) => item.metricId === "gold.cftc.producer_merchant.long.contracts")?.providerField,
    "prod_merc_positions_long_all",
  );
  assert.equal(
    result.data.find((item) => item.metricId === "gold.cftc.swap_dealer.short.contracts")?.providerField,
    "swap_positions_short_all",
  );
});

test("fails closed on contract, report-family, duplicate-date, and schema mismatch", async () => {
  const wrongContract = row("2026-09-29");
  wrongContract.cftc_contract_market_code = "088695";
  const contractResult = await fetchCftcGoldCotObservations(
    { mode: "FORWARD" },
    { fetch: fetchJson([wrongContract]), now: () => new Date("2026-10-02T19:31:00.000Z") },
  );
  assert.equal(contractResult.status, "ERROR");
  assert.match(contractResult.message ?? "", /unexpected contract market code/);

  const combined = row("2026-09-29");
  combined.futonly_or_combined = "Combined";
  const combinedResult = await fetchCftcGoldCotObservations(
    { mode: "FORWARD" },
    { fetch: fetchJson([combined]), now: () => new Date("2026-10-02T19:31:00.000Z") },
  );
  assert.equal(combinedResult.status, "ERROR");
  assert.match(combinedResult.message ?? "", /not Futures Only/);

  const duplicateResult = await fetchCftcGoldCotObservations(
    { mode: "FORWARD" },
    { fetch: fetchJson([row("2026-09-29"), row("2026-09-29")]), now: () => new Date("2026-10-02T19:31:00.000Z") },
  );
  assert.equal(duplicateResult.status, "ERROR");
  assert.match(duplicateResult.message ?? "", /duplicate report date/);

  const malformed = row("2026-09-29");
  delete malformed.m_money_positions_long_all;
  const malformedResult = await fetchCftcGoldCotObservations(
    { mode: "FORWARD" },
    { fetch: fetchJson([malformed]), now: () => new Date("2026-10-02T19:31:00.000Z") },
  );
  assert.equal(malformedResult.status, "ERROR");
  assert.match(malformedResult.message ?? "", /missing required field for gold\.cftc\.managed_money\.long\.contracts/);
  assert.match(malformedResult.message ?? "", /available fields:/);
});

test("rejects malformed or out-of-order report dates and non-integer positions", async () => {
  const outOfOrder = await fetchCftcGoldCotObservations(
    { mode: "FORWARD" },
    { fetch: fetchJson([row("2026-09-22"), row("2026-09-29")]), now: () => new Date("2026-10-02T19:31:00.000Z") },
  );
  assert.equal(outOfOrder.status, "ERROR");
  assert.match(outOfOrder.message ?? "", /strictly descending/);

  const fractional = row("2026-09-29");
  fractional.open_interest_all = "500000.5";
  const fractionalResult = await fetchCftcGoldCotObservations(
    { mode: "FORWARD" },
    { fetch: fetchJson([fractional]), now: () => new Date("2026-10-02T19:31:00.000Z") },
  );
  assert.equal(fractionalResult.status, "ERROR");
  assert.match(fractionalResult.message ?? "", /non-negative integer/);
});

test("enforces bounded explicit CFTC backfill and server query bounds", async () => {
  assert.equal(
    cftcGoldCotBackfillRangeError({ from: "2025-09-28", to: "2026-10-02" }),
    null,
  );
  assert.equal(
    cftcGoldCotBackfillRangeError({ from: "2025-09-27", to: "2026-10-02" }),
    `CFTC Gold COT BACKFILL is limited to ${CFTC_GOLD_COT_MAX_BACKFILL_CALENDAR_DAYS} calendar days`,
  );

  let requested = "";
  const fetcher = (async (input: RequestInfo | URL) => {
    requested = String(input);
    return new Response(JSON.stringify([row("2026-09-29")]), { status: 200 });
  }) as typeof fetch;
  const result = await fetchCftcGoldCotObservations(
    { mode: "BACKFILL", range: { from: "2026-09-01", to: "2026-09-30" } },
    { fetch: fetcher, now: () => new Date("2026-10-02T19:31:00.000Z") },
  );
  assert.equal(result.status, "SUCCESS");
  assert.match(
    new URL(requested).searchParams.get("$where") ?? "",
    /report_date_as_yyyy_mm_dd between '2026-09-01T00:00:00\.000' and '2026-09-30T23:59:59\.999'/,
  );
  assert.equal(new URL(requested).searchParams.get("$limit"), "1000");
});

test("provider HTTP and JSON failures remain explicit", async () => {
  const http = await fetchCftcGoldCotObservations(
    { mode: "FORWARD" },
    { fetch: fetchJson({ message: "upstream" }, 503), now: () => new Date("2026-10-02T19:31:00.000Z") },
  );
  assert.equal(http.status, "ERROR");
  assert.equal(http.errorCode, "UPSTREAM_UNAVAILABLE");

  const invalidJson = (async () => new Response("{", { status: 200 })) as typeof fetch;
  const malformed = await fetchCftcGoldCotObservations(
    { mode: "FORWARD" },
    { fetch: invalidJson, now: () => new Date("2026-10-02T19:31:00.000Z") },
  );
  assert.equal(malformed.status, "ERROR");
  assert.equal(malformed.errorCode, "MALFORMED_PAYLOAD");
});
