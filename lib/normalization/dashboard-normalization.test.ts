import assert from "node:assert/strict";
import test from "node:test";
import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { ProviderResult, ProviderId } from "../data/types";
import type { DashboardIngestion } from "../ingestion/dashboard-ingestion";
import { normalizeDashboardData } from "./dashboard-normalization";

const RETRIEVED = "2026-10-12T13:59:00.000Z";
const result = <T>(providerId: ProviderId, status: ProviderResult<T>["status"], data: T[] = []): ProviderResult<T> =>
  ({ providerId, status, data, retrievedAt: RETRIEVED });

function input(): DashboardIngestion {
  return {
    macroNews: result("alpha-vantage", "EMPTY"),
    alphaVantageCryptoNews: result("alpha-vantage", "EMPTY"),
    coinDeskNews: result("coindesk-rss", "EMPTY"),
    calendar: result("forex-factory", "EMPTY"),
    biquoteCalendar: result("biquote", "EMPTY"),
    cryptoMarket: result("coingecko", "EMPTY"),
    goldSpot: result("yahoo-finance", "ERROR"),
    russell2000: result("yahoo-finance", "EMPTY"),
    dxy: result("yahoo-finance", "SUCCESS", [{
      metricId: "dxy.index.usd", symbol: "DX-Y.NYB", value: 99,
      observedAt: "2026-10-12T13:58:00.000Z", retrievedAt: RETRIEVED,
      source: "Yahoo Finance", freshnessCalendar: "ICE_USDX",
      provenance: { version: "v1", providerResource: "/v8/finance/chart", nativeSymbol: "DX-Y.NYB" },
      metadata: { unit: "USD", symbol: "DX-Y.NYB" },
    } satisfies CryptoMarketObservationInput]),
    fred: result("fred", "EMPTY"),
    fomc: result("federal-reserve", "EMPTY"),
  };
}

test("RECOVERY-G1-04: Yahoo Gold ERROR with DXY SUCCESS cannot be masked by the aggregate", () => {
  const data = normalizeDashboardData(input());
  const states = new Map(data.yahooSeriesHealth?.map((x) => [x.seriesKey, x.status]));
  assert.equal(states.get("gold.futures.usd"), "ERROR");
  assert.equal(states.get("dxy.index.usd"), "HEALTHY");
  assert.equal(states.get("russell2000.index.usd"), "EMPTY");
  assert.equal(data.providerHealth.find((x) => x.sourceId === "yahoo-finance")?.status, "ERROR");
  assert.equal(data.providerHealth.filter((x) => x.sourceId === "yahoo-finance").length, 1);
  assert.ok(data.unavailableSources.some((x) => x.includes("COMEX") && x.includes("gagal")));
  assert.ok(!data.unavailableSources.some((x) => x.includes("DXY (Yahoo")));
  assert.equal(data.observations.some((x) => x.metadata?.metricId === "gold.futures.usd"), false);
  assert.equal(data.observations.find((x) => x.metadata?.metricId === "dxy.index.usd")?.sourceId, "yahoo-finance");
});

test("RECOVERY-G1-04: EMPTY status stays EMPTY with a successful empty response", () => {
  const fixture = input();
  fixture.goldSpot = result("yahoo-finance", "SUCCESS");
  fixture.russell2000 = result("yahoo-finance", "UNAVAILABLE");
  const data = normalizeDashboardData(fixture);
  assert.equal(data.yahooSeriesHealth?.find((x) => x.seriesKey === "gold.futures.usd")?.status, "EMPTY");
  assert.equal(data.yahooSeriesHealth?.find((x) => x.seriesKey === "dxy.index.usd")?.status, "HEALTHY");
  assert.equal(data.providerHealth.find((x) => x.sourceId === "yahoo-finance")?.status, "UNAVAILABLE");
});
