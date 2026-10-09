import assert from "node:assert/strict";
import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { DefiLlamaStablecoinObservationInput } from "../data/defillama-stablecoins";
import {
  CFTC_GOLD_CONTRACT_MARKET_CODE,
  CFTC_GOLD_COT_DATASET_ID,
  CFTC_GOLD_COT_PROVIDER_RESOURCE,
  CFTC_GOLD_COT_REPORT_FAMILY,
  type CftcGoldCotObservationInput,
} from "../data/cftc-gold-cot";
import type { MacroObservationInput } from "../data/fred";
import type { FederalReserveSepObservationInput } from "../data/federal-reserve-sep";
import type { GdeltGalFeedSnapshot } from "../data/gdelt-gal";
import { BINANCE_SPOT_FLOW_INTERVAL_MS, type BinanceSpotKline } from "../data/binance-spot-flow";
import type { BinanceOrderBookSnapshot } from "../data/binance-order-book";
import type { HyperliquidPerpOrderBookSnapshot } from "../data/hyperliquid-perp-order-book";
import {
  SOSOVALUE_ETF_FLOW_COMPLETION_BASIS,
  SOSOVALUE_ETF_FLOW_MATURITY_POLICY,
  SOSOVALUE_ETF_FLOW_MATURITY_STATUS,
  SOSOVALUE_ETF_FLOW_PROVIDER_RESOURCE,
  type SoSoValueBtcEtfFlowObservationInput,
} from "../data/sosovalue-etf-flow";
import { cryptoMarketToObservations } from "../domain/normalize";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import { providerFetchPolicy } from "../data/provider-fetch-policy";
import { providerResult, type ProviderResult } from "../data/types";
import { InMemoryEvidenceRepository, InMemoryObservationRepository } from "../repositories/memory";
import { GDELT_GAL_DURABLE_SNAPSHOT_METHODOLOGY } from "./gdelt-gal-history";
import { BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY } from "./btc-spot-flow-history";
import {
  BINANCE_BTC_SPOT_ORDER_BOOK_DURABLE_METHODOLOGY,
  HYPERLIQUID_BTC_PERP_ORDER_BOOK_DURABLE_METHODOLOGY,
} from "./btc-order-book-history";
import type { CanonicalRepositories } from "../repositories/dashboard-repository";
import {
  runHistoricalIngestion,
  type HistoricalIngestionAcquisition,
  type HistoricalIngestionProvider,
} from "./historical-ingestion";
import { parseHistoricalIngestionRequest } from "./historical-ingestion-request";

function observationInput(metricId: string): CryptoMarketObservationInput {
  return {
    metricId,
    symbol: "BTC",
    value: 100,
    observedAt: "2026-09-20T09:00:00.000Z",
    retrievedAt: "2026-09-20T09:00:01.000Z",
    source: "CoinGecko",
    freshnessCalendar: "CONTINUOUS_24_7",
    provenance: {
      version: "v1",
      providerResource: "/simple/price",
      nativeInstrumentId: "bitcoin",
    },
    metadata: { unit: "USD", providerAssetId: "bitcoin", endpoint: "/simple/price" },
  };
}

function marketResult(
  provider: "coingecko" | "yahoo-finance",
  data: CryptoMarketObservationInput[],
  status: ProviderResult<CryptoMarketObservationInput>["status"] = "SUCCESS",
): ProviderResult<CryptoMarketObservationInput> {
  return providerResult(provider, status, data, status === "ERROR" ? "provider failed" : undefined);
}

function macroInput(): MacroObservationInput {
  return {
    series: MACRO_SERIES_REGISTRY[0],
    value: "0.25",
    observationDate: "2020-01-01",
    previousValue: null,
    vintageDate: "2020-01-01",
    releasedAt: null,
    retrievedAt: "2026-09-20T09:00:01.000Z",
    provenance: {
      version: "v1",
      providerResource: "/fred/series/observations",
      nativeSeriesId: MACRO_SERIES_REGISTRY[0].seriesId,
      observationDate: "2020-01-01",
      vintageDate: "2020-01-01",
    },
  };
}

function sepInput(): FederalReserveSepObservationInput {
  const metricId = "policy.us.sep.ffr.year_end_2026.median_pct";
  const observedAt = "2026-09-16T18:00:00.000Z";
  const providerResource = "/monetarypolicy/fomcprojtabl20260916.htm";
  return {
    metricId,
    value: 4.1,
    unit: "PERCENT",
    observedAt,
    retrievedAt: "2026-10-06T13:10:00.000Z",
    releaseDate: "2026-09-16",
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20260916.htm",
    providerResource,
    horizon: "YEAR_END_2026",
    factType: "PUBLISHED_MEDIAN",
    meetingStartDate: "2026-09-15",
    meetingEndDate: "2026-09-16",
    provenance: { version: "v1", providerResource },
    metadata: {
      provider: "Federal Reserve",
      providerResource,
      sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20260916.htm",
      releaseDate: "2026-09-16",
      releaseTimestamp: observedAt,
      sourceTimeZone: "EDT",
      horizon: "YEAR_END_2026",
      meetingStartDate: "2026-09-15",
      meetingEndDate: "2026-09-16",
      dotRoundingIncrementPct: 0.125,
      parserVersion: "MACRO_SEP_001B_V0_1",
      metricId,
      factType: "PUBLISHED_MEDIAN",
      unit: "PERCENT",
      publishedMedianPct: 4.1,
    },
  };
}

function stablecoinInput(observedAt: string, value: number): DefiLlamaStablecoinObservationInput {
  return {
    metricId: "crypto.usd_stablecoin_market_cap.usd",
    value,
    observedAt,
    retrievedAt: "2026-09-29T12:00:00.000Z",
    providerResource: "/stablecoincharts/all",
    pegType: "peggedUSD",
    unit: "USD",
    provenance: {
      version: "v1",
      providerResource: "/stablecoincharts/all",
      observationDate: observedAt.slice(0, 10),
    },
    metadata: {
      metricId: "crypto.usd_stablecoin_market_cap.usd",
      unit: "USD",
      pegType: "peggedUSD",
      providerResource: "/stablecoincharts/all",
      providerEffectiveDate: observedAt.slice(0, 10),
      providerEffectiveTimestamp: observedAt,
      frequency: "DAILY",
    },
  };
}

function etfFlowInput(date: string, value: number): SoSoValueBtcEtfFlowObservationInput {
  return {
    metricId: "crypto.us_spot_btc_etf_net_flow.usd",
    value,
    observedAt: `${date}T00:00:00.000Z`,
    retrievedAt: "2026-09-30T12:00:00.000Z",
    providerTradingDate: date,
    providerResource: SOSOVALUE_ETF_FLOW_PROVIDER_RESOURCE,
    providerSymbol: "BTC",
    countryCode: "US",
    aggregateField: "total_net_inflow",
    unit: "USD",
    maturityPolicy: SOSOVALUE_ETF_FLOW_MATURITY_POLICY,
    completionBasis: SOSOVALUE_ETF_FLOW_COMPLETION_BASIS,
    maturityStatus: SOSOVALUE_ETF_FLOW_MATURITY_STATUS,
    provenance: {
      version: "v1",
      providerResource: SOSOVALUE_ETF_FLOW_PROVIDER_RESOURCE,
      nativeSymbol: "BTC",
      observationDate: date,
    },
    metadata: {
      metricId: "crypto.us_spot_btc_etf_net_flow.usd",
      provider: "SoSoValue",
      providerResource: SOSOVALUE_ETF_FLOW_PROVIDER_RESOURCE,
      providerTradingDate: date,
      providerSymbol: "BTC",
      countryCode: "US",
      aggregateField: "total_net_inflow",
      unit: "USD",
      maturityPolicy: SOSOVALUE_ETF_FLOW_MATURITY_POLICY,
      completionBasis: SOSOVALUE_ETF_FLOW_COMPLETION_BASIS,
      maturityStatus: SOSOVALUE_ETF_FLOW_MATURITY_STATUS,
      frequency: "DAILY",
    },
  };
}

function cftcInput(value: number): CftcGoldCotObservationInput {
  const reportDate = "2026-09-29";
  return {
    metricId: "gold.cftc.managed_money.long.contracts",
    value,
    observedAt: `${reportDate}T00:00:00.000Z`,
    retrievedAt: "2026-10-02T19:31:00.000Z",
    reportDate,
    datasetId: CFTC_GOLD_COT_DATASET_ID,
    contractMarketCode: CFTC_GOLD_CONTRACT_MARKET_CODE,
    marketName: "GOLD - COMMODITY EXCHANGE INC.",
    reportFamily: CFTC_GOLD_COT_REPORT_FAMILY,
    providerResource: CFTC_GOLD_COT_PROVIDER_RESOURCE,
    providerField: "m_money_positions_long_all",
    participantCategory: "MANAGED_MONEY",
    positionSide: "LONG",
    unit: "CONTRACTS",
    frequency: "WEEKLY",
    provenance: {
      version: "v1",
      providerResource: CFTC_GOLD_COT_PROVIDER_RESOURCE,
      nativeSeriesId: "m_money_positions_long_all",
      nativeInstrumentId: CFTC_GOLD_CONTRACT_MARKET_CODE,
      observationDate: reportDate,
    },
    metadata: {
      metricId: "gold.cftc.managed_money.long.contracts",
      provider: "CFTC",
      providerResource: CFTC_GOLD_COT_PROVIDER_RESOURCE,
      datasetId: CFTC_GOLD_COT_DATASET_ID,
      contractMarketCode: CFTC_GOLD_CONTRACT_MARKET_CODE,
      marketName: "GOLD - COMMODITY EXCHANGE INC.",
      reportFamily: CFTC_GOLD_COT_REPORT_FAMILY,
      reportDate,
      providerField: "m_money_positions_long_all",
      participantCategory: "MANAGED_MONEY",
      positionSide: "LONG",
      unit: "CONTRACTS",
      frequency: "WEEKLY",
    },
  };
}


function binanceSpotKline(): BinanceSpotKline {
  const providerIntervalStartMs = Date.parse("2026-10-04T12:00:00.000Z");
  return {
    symbol: "BTCUSDT",
    providerIntervalStartMs,
    providerCloseTimeMs: providerIntervalStartMs + BINANCE_SPOT_FLOW_INTERVAL_MS - 1,
    open: 100000,
    high: 101000,
    low: 99000,
    close: 100500,
    baseVolumeBtc: 10,
    quoteVolumeUsdt: 1005000,
    tradeCount: 200,
    takerBuyBaseVolumeBtc: 6,
    takerBuyQuoteVolumeUsdt: 603000,
  };
}

function binanceOrderBookSnapshot(): BinanceOrderBookSnapshot {
  return {
    symbol: "BTCUSDT",
    lastUpdateId: 991,
    bids: [
      { priceUsdt: 100000, quantityBtc: 1 },
      { priceUsdt: 99950, quantityBtc: 2 },
      { priceUsdt: 99500, quantityBtc: 3 },
    ],
    asks: [
      { priceUsdt: 100010, quantityBtc: 1.5 },
      { priceUsdt: 100060, quantityBtc: 2.5 },
      { priceUsdt: 100600, quantityBtc: 3.5 },
    ],
  };
}

function hyperliquidOrderBookSnapshot(): HyperliquidPerpOrderBookSnapshot {
  return {
    coin: "BTC",
    providerTimeMs: Date.parse("2026-10-04T13:00:00.000Z"),
    bids: [
      { price: 100000, quantityBtc: 2, restingOrderCount: 4 },
      { price: 99990, quantityBtc: 3, restingOrderCount: 5 },
    ],
    asks: [
      { price: 100010, quantityBtc: 1, restingOrderCount: 2 },
      { price: 100020, quantityBtc: 2, restingOrderCount: 3 },
    ],
  };
}

function gdeltSnapshot(asset: "BTC" | "GOLD"): GdeltGalFeedSnapshot {
  return {
    asset,
    feedLastBuildAt: "2026-10-04T12:00:00.000Z",
    feedWindowStartAt: "2026-10-04T11:45:00.000Z",
    coverage: "ROLLING_15_MINUTES",
    totalFeedItems: 500,
    invalidItemCount: 2,
    matchingCandidateCount: asset === "BTC" ? 1 : 0,
    candidateCoverage: "COMPLETE",
    candidates: asset === "BTC"
      ? [{
          asset,
          url: "https://example.com/bitcoin",
          title: "Bitcoin rises after macro headline",
          domain: "example.com",
          providerDate: "2026-10-04T11:59:00.000Z",
          providerDateSemantics: "PUBLICATION_OR_FIRST_SEEN",
        }]
      : [],
  };
}

function repositories(): {
  repositories: CanonicalRepositories;
  observations: InMemoryObservationRepository;
  evidence: InMemoryEvidenceRepository;
} {
  const observations = new InMemoryObservationRepository();
  const evidence = new InMemoryEvidenceRepository();
  return {
    observations,
    evidence,
    repositories: {
      observations,
      evidence,
      events: { save: async () => undefined, saveMany: async () => undefined, findById: async () => null },
      contexts: { save: async () => undefined, saveMany: async () => undefined, findById: async () => null },
    },
  };
}

function acquisition(calls: HistoricalIngestionProvider[]): HistoricalIngestionAcquisition {
  const record = <T>(provider: HistoricalIngestionProvider, result: ProviderResult<T>) => async () => {
    calls.push(provider);
    return result;
  };
  return {
    coingecko: record("coingecko", marketResult("coingecko", [observationInput("btc.spot.usd")])),
    "coingecko-context": record("coingecko-context", marketResult("coingecko", [])),
    gold: record("gold", marketResult("yahoo-finance", [])),
    dxy: record("dxy", marketResult("yahoo-finance", [])),
    russell: record("russell", marketResult("yahoo-finance", [])),
    usdjpy: record("usdjpy", marketResult("yahoo-finance", [])),
    usdcnh: record("usdcnh", marketResult("yahoo-finance", [])),
    fred: record("fred", providerResult("fred", "EMPTY", [])),
    "federal-reserve-sep": record("federal-reserve-sep", providerResult("federal-reserve", "EMPTY", [])),
    defillama: record("defillama", providerResult("defillama", "EMPTY", [])),
    sosovalue: record("sosovalue", providerResult("sosovalue", "EMPTY", [])),
    cftc: record("cftc", providerResult("cftc", "EMPTY", [])),
    gdelt: record("gdelt", providerResult("gdelt", "EMPTY", [])),
    "binance-spot": record("binance-spot", providerResult("binance-spot", "EMPTY", [])),
    "binance-book": record("binance-book", providerResult("binance-spot", "EMPTY", [])),
    "hyperliquid-book": record("hyperliquid-book", providerResult("hyperliquid", "EMPTY", [])),
  };
}

async function main(): Promise<void> {
  const spotMetrics = ["btc.spot.usd", "eth.spot.usd"];
  const contextMetrics = [
    "btc.market_cap.usd", "eth.market_cap.usd",
    "crypto.total_market_cap.usd", "crypto.total_volume_24h.usd",
    "crypto.btc_dominance.pct", "crypto.eth_dominance.pct",
  ];
  const mixedRows = [...spotMetrics, ...contextMetrics].map(observationInput);
  const originalCanonical = cryptoMarketToObservations(mixedRows, "coingecko-market");
  for (const lane of ["coingecko", "coingecko-context"] as const) {
    const calls: HistoricalIngestionProvider[] = [];
    const store = repositories();
    const sources = acquisition(calls);
    sources[lane] = async () => {
      calls.push(lane);
      // Include an unapproved metric to prove the persistence boundary fails closed.
      return marketResult("coingecko", [...mixedRows, observationInput("crypto.unapproved.usd")]);
    };
    const report = await runHistoricalIngestion(
      { mode: "FORWARD", providers: [lane, lane] },
      { acquisition: sources, repositories: store.repositories },
    );
    const allowed = lane === "coingecko" ? spotMetrics : contextMetrics;
    assert.deepEqual(calls, [lane], "each lane is independently acquired and deduplicated");
    assert.equal(report.status, "SUCCESS");
    assert.equal(report.providers[0].provider, lane);
    assert.equal(report.persistedObservations, allowed.length);
    assert.equal(report.persistedEvidence, allowed.length);
    for (const expected of originalCanonical.observations) {
      const saved = await store.observations.findById(expected.id);
      const savedEvidence = await store.evidence.findById(expected.evidenceId);
      if (allowed.includes(String(expected.metadata?.metricId))) {
        assert.deepEqual(saved, expected, "lane preserves canonical ID/source/series/semantics/provenance");
        assert.deepEqual(savedEvidence, originalCanonical.evidence.find((row) => row.id === expected.evidenceId));
      } else {
        assert.equal(saved, null, "opposite-lane Observation must never persist");
        assert.equal(savedEvidence, null, "opposite-lane Evidence must never persist");
      }
    }
    assert.deepEqual(
      parseHistoricalIngestionRequest(new URLSearchParams(`mode=FORWARD&providers=${lane}`)),
      { ok: true, options: { mode: "FORWARD", providers: [lane] } },
    );
    assert.equal(parseHistoricalIngestionRequest(new URLSearchParams(`mode=BACKFILL&providers=${lane}&from=2026-10-01&to=2026-10-02`)).ok, false);
    await assert.rejects(runHistoricalIngestion(
      { mode: "BACKFILL", providers: [lane] },
      { acquisition: sources, repositories: store.repositories },
    ), /BACKFILL requires exactly one supported provider/);
    sources[lane] = async () => marketResult("coingecko", mixedRows.filter((row) => !allowed.includes(row.metricId)));
    const excludedOnly = await runHistoricalIngestion(
      { mode: "FORWARD", providers: [lane] },
      { acquisition: sources, repositories: repositories().repositories },
    );
    assert.equal(excludedOnly.status, "EMPTY");
    assert.equal(excludedOnly.persistedObservations, 0);
    assert.equal(excludedOnly.persistedEvidence, 0);
  }

  const selectedCalls: HistoricalIngestionProvider[] = [];
  const selectedStore = repositories();
  const selectedReport = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["coingecko"] },
    { acquisition: acquisition(selectedCalls), repositories: selectedStore.repositories },
  );
  assert.deepEqual(selectedCalls, ["coingecko"], "unselected providers must not be acquired");
  assert.equal(selectedReport.status, "SUCCESS");
  assert.equal(selectedReport.providers[0].normalized, 1);
  assert.equal(selectedReport.persistedObservations, 1);

  const sepStore = repositories();
  const sepAcquisition = acquisition([]);
  sepAcquisition["federal-reserve-sep"] = async () =>
    providerResult("federal-reserve", "SUCCESS", [sepInput()], undefined, undefined, "2026-10-06T13:10:00.000Z");
  const sepReport = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["federal-reserve-sep"] },
    { acquisition: sepAcquisition, repositories: sepStore.repositories },
  );
  assert.equal(sepReport.status, "SUCCESS");
  assert.equal(sepReport.persistedObservations, 1);
  assert.equal(sepReport.persistedEvidence, 1);
  const sepHistory = await sepStore.observations.findHistory({
    identity: { domain: "MACRO", seriesKey: "policy.us.sep.ffr.year_end_2026.median_pct" },
    order: "ASC",
    limit: 10,
  });
  assert.equal(sepHistory.length, 1);
  assert.equal(sepHistory[0]?.observedAt, "2026-09-16T18:00:00.000Z");
  assert.equal(sepHistory[0]?.semantics?.marketDomain, "POLICY");
  assert.equal(sepHistory[0]?.semantics?.informationClass, "EXPECTATION");
  assert.equal(sepHistory[0]?.semantics?.instrument, "POLICY_RATE");
  assert.equal(sepHistory[0]?.metadata?.factType, "PUBLISHED_MEDIAN");
  await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["federal-reserve-sep"] },
    { acquisition: sepAcquisition, repositories: sepStore.repositories },
  );
  const sepRepeat = await sepStore.observations.findHistory({
    identity: { domain: "MACRO", seriesKey: "policy.us.sep.ffr.year_end_2026.median_pct" },
    order: "ASC",
    limit: 10,
  });
  assert.equal(sepRepeat.length, 1, "repeated SEP forward ingestion must remain idempotent");

  const asiaFxStore = repositories();
  const asiaFxAcquisition = acquisition([]);
  asiaFxAcquisition.usdjpy = async () => marketResult("yahoo-finance", [{
    ...observationInput("fx.usdjpy.jpy_per_usd"),
    symbol: "USDJPY=X",
    value: 150.25,
    source: "Yahoo Finance",
    freshnessCalendar: "GLOBAL_FX_24_5",
    provenance: { version: "v1", providerResource: "/v8/finance/chart", nativeSymbol: "USDJPY=X" },
    metadata: { unit: "JPY_PER_USD", baseCurrency: "USD", quoteCurrency: "JPY", endpoint: "v8/finance/chart" },
  }]);
  asiaFxAcquisition.usdcnh = async () => marketResult("yahoo-finance", [{
    ...observationInput("fx.usdcnh.cnh_per_usd"),
    symbol: "USDCNH=X",
    value: 7.12,
    source: "Yahoo Finance",
    freshnessCalendar: "GLOBAL_FX_24_5",
    provenance: { version: "v1", providerResource: "/v8/finance/chart", nativeSymbol: "USDCNH=X" },
    metadata: { unit: "CNH_PER_USD", baseCurrency: "USD", quoteCurrency: "CNH", endpoint: "v8/finance/chart" },
  }]);
  const asiaFxReport = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["usdjpy", "usdcnh"] },
    { acquisition: asiaFxAcquisition, repositories: asiaFxStore.repositories },
  );
  assert.equal(asiaFxReport.status, "SUCCESS");
  assert.equal(asiaFxReport.persistedObservations, 2);
  const jpyHistory = await asiaFxStore.observations.findHistory({
    identity: { domain: "ASSET", seriesKey: "fx.usdjpy.jpy_per_usd" },
    order: "ASC",
    limit: 10,
  });
  const cnhHistory = await asiaFxStore.observations.findHistory({
    identity: { domain: "ASSET", seriesKey: "fx.usdcnh.cnh_per_usd" },
    order: "ASC",
    limit: 10,
  });
  assert.equal(jpyHistory[0]?.semantics?.jurisdiction, "JAPAN");
  assert.equal(jpyHistory[0]?.semantics?.instrument, "FX_PAIR");
  assert.equal(cnhHistory[0]?.semantics?.jurisdiction, "CHINA");
  assert.equal(cnhHistory[0]?.semantics?.instrument, "FX_PAIR");

  await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["coingecko"] },
    { acquisition: acquisition([]), repositories: selectedStore.repositories },
  );
  const history = await selectedStore.observations.findHistory({
    identity: { domain: "ASSET", seriesKey: "btc.spot.usd" },
    order: "ASC",
    limit: 10,
  });
  assert.equal(history.length, 1, "repeated ingestion must retain canonical idempotency");

  const backfillStore = repositories();
  const backfillAcquisition = acquisition([]);
  backfillAcquisition.fred = async () => providerResult("fred", "SUCCESS", [macroInput()]);
  const backfillOptions = {
    mode: "BACKFILL" as const,
    providers: ["fred" as const],
    fred: { observationStart: "2020-01-01", observationEnd: "2020-01-31", limit: 100 },
  };
  await runHistoricalIngestion(backfillOptions, {
    acquisition: backfillAcquisition,
    repositories: backfillStore.repositories,
  });
  await runHistoricalIngestion(backfillOptions, {
    acquisition: backfillAcquisition,
    repositories: backfillStore.repositories,
  });
  const backfillHistory = await backfillStore.observations.findHistory({
    identity: { domain: "MACRO", seriesKey: MACRO_SERIES_REGISTRY[0].seriesId },
    order: "ASC",
    limit: 10,
  });
  assert.equal(backfillHistory.length, 1, "repeated backfill must retain canonical idempotency");


  // DATA-NFCI-001: selected 120-day FRED acquisition uses the existing canonical
  // append-only writer, and replaying the same window is physically idempotent.
  const nfciInput = (key: "NFCI" | "ANFCI", value: string): MacroObservationInput => {
    const series = MACRO_SERIES_REGISTRY.find((item) => item.seriesId === key);
    assert.ok(series);
    return {
      series, value, observationDate: "2026-10-02", previousValue: null,
      vintageDate: "2026-10-07", releasedAt: null,
      retrievedAt: "2026-10-09T09:00:00.000Z",
      provenance: {
        version: "v1", providerResource: "/fred/series/observations",
        nativeSeriesId: key, observationDate: "2026-10-02",
        vintageDate: "2026-10-07",
      },
    };
  };
  const selectiveParse = parseHistoricalIngestionRequest(new URLSearchParams(
    "mode=BACKFILL&providers=fred&fredSeries=NFCI,ANFCI&from=2026-07-01&to=2026-10-09",
  ));
  assert.equal(selectiveParse.ok, true);
  if (!selectiveParse.ok) throw new Error("selected-series backfill must parse");
  const selectiveStore = repositories();
  const selectiveAcquisition = acquisition([]);
  selectiveAcquisition.fred = async () => providerResult("fred", "SUCCESS", [
    nfciInput("NFCI", "-0.494"), nfciInput("ANFCI", "-0.504"),
  ]);
  const selectiveFirst = await runHistoricalIngestion(selectiveParse.options, {
    acquisition: selectiveAcquisition, repositories: selectiveStore.repositories,
  });
  assert.equal(selectiveFirst.status, "SUCCESS");
  assert.equal(selectiveFirst.providers[0]?.acquired, 2);
  for (const key of ["NFCI", "ANFCI"] as const) {
    const observations = await selectiveStore.observations.findHistory({
      identity: { domain: "MACRO", seriesKey: key }, order: "ASC",
    });
    assert.equal(observations.length, 1);
    assert.equal(observations[0]?.metadata?.unit, "Index");
    assert.equal(observations[0]?.metadata?.frequency, "WEEKLY");
    assert.equal(observations[0]?.semantics?.informationClass, "DERIVED_METRIC");
    assert.equal(observations[0]?.provenance?.nativeSeriesId, key);
  }
  await runHistoricalIngestion(selectiveParse.options, {
    acquisition: selectiveAcquisition, repositories: selectiveStore.repositories,
  });
  for (const key of ["NFCI", "ANFCI"] as const) {
    const observations = await selectiveStore.observations.findHistory({
      identity: { domain: "MACRO", seriesKey: key }, order: "ASC",
    });
    assert.equal(observations.length, 1, "replayed selected-series fact stays idempotent");
  }

  const incompleteBackfillStore = repositories();
  const incompleteBackfillAcquisition = acquisition([]);
  incompleteBackfillAcquisition.fred = async () => providerResult(
    "fred",
    "ERROR",
    [macroInput()],
    "one requested series could not prove completeness",
  );
  const incompleteBackfill = await runHistoricalIngestion(backfillOptions, {
    acquisition: incompleteBackfillAcquisition,
    repositories: incompleteBackfillStore.repositories,
  });
  assert.equal(incompleteBackfill.status, "PARTIAL");
  assert.equal(incompleteBackfill.persistedObservations, 1);
  assert.equal(incompleteBackfill.providers[0].status, "ERROR");
  assert.match(incompleteBackfill.providers[0].error ?? "", /could not prove completeness/);

  const defillamaStore = repositories();
  const defillamaAcquisition = acquisition([]);
  defillamaAcquisition.defillama = async () => providerResult("defillama", "SUCCESS", [
    stablecoinInput("2026-09-27T00:00:00.000Z", 100),
    stablecoinInput("2026-09-29T00:00:00.000Z", 110),
  ]);
  const defillamaForward = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["defillama"] },
    { acquisition: defillamaAcquisition, repositories: defillamaStore.repositories },
  );
  assert.equal(defillamaForward.persistedObservations, 1, "routine DefiLlama FORWARD persists only latest row");
  assert.equal(defillamaForward.providers[0].acquired, 2);
  assert.equal(defillamaForward.providers[0].normalized, 1);

  const defillamaBackfillStore = repositories();
  const defillamaBackfillAcquisition = acquisition([]);
  defillamaBackfillAcquisition.defillama = defillamaAcquisition.defillama;
  const defillamaBackfill = await runHistoricalIngestion(
    {
      mode: "BACKFILL",
      providers: ["defillama"],
      defillama: { from: "2026-09-01", to: "2026-09-29" },
    },
    { acquisition: defillamaBackfillAcquisition, repositories: defillamaBackfillStore.repositories },
  );
  assert.equal(defillamaBackfill.persistedObservations, 2, "explicit DefiLlama BACKFILL retains bounded selected rows");
  const defillamaBackfillHistory = await defillamaBackfillStore.observations.findHistory({
    identity: { domain: "MARKET", seriesKey: "crypto.usd_stablecoin_market_cap.usd" },
    order: "ASC",
    limit: 10,
  });
  assert.equal(defillamaBackfillHistory.length, 2);
  assert.equal(
    defillamaBackfillHistory[0]?.quality,
    "STALE",
    "old backfill quality remains truthful without making factual history unavailable",
  );

  const partialStore = repositories();
  const partialAcquisition = acquisition([]);
  partialAcquisition.gold = async () => marketResult("yahoo-finance", [], "ERROR");
  const partial = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["coingecko", "gold"] },
    { acquisition: partialAcquisition, repositories: partialStore.repositories },
  );
  assert.equal(partial.status, "PARTIAL", "one provider failure must not suppress another provider write");
  assert.equal(partial.persistedObservations, 1);
  assert.equal(partial.providers.find((item) => item.provider === "gold")?.error, "provider failed");

  const isolatedStore = repositories();
  const isolatedAcquisition = acquisition([]);
  isolatedAcquisition.defillama = async () => providerResult("defillama", "ERROR", [], "DefiLlama unavailable");
  const isolated = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["coingecko", "defillama"] },
    { acquisition: isolatedAcquisition, repositories: isolatedStore.repositories },
  );
  assert.equal(isolated.status, "PARTIAL");
  assert.equal(isolated.persistedObservations, 1, "DefiLlama failure cannot suppress another successful provider");

  const sosovalueStore = repositories();
  const sosovalueAcquisition = acquisition([]);
  sosovalueAcquisition.sosovalue = async () => providerResult("sosovalue", "SUCCESS", [
    etfFlowInput("2026-09-29", 100),
    etfFlowInput("2026-09-26", 90),
  ]);
  const sosovalueForward = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["sosovalue"] },
    { acquisition: sosovalueAcquisition, repositories: sosovalueStore.repositories },
  );
  assert.equal(sosovalueForward.persistedObservations, 2, "FORWARD retains the provider's bounded matured correction window");
  const sosovalueHistory = await sosovalueStore.observations.findHistory({
    identity: { domain: "MARKET", seriesKey: "crypto.us_spot_btc_etf_net_flow.usd" },
    order: "ASC",
    limit: 10,
  });
  assert.equal(sosovalueHistory.length, 2);
  assert.ok(sosovalueHistory.every((item) => item.quality === "UNKNOWN"));

  const sosovalueFailureAcquisition = acquisition([]);
  sosovalueFailureAcquisition.sosovalue = async () => providerResult("sosovalue", "ERROR", [], "SoSoValue unavailable");
  const sosovalueIsolated = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["coingecko", "sosovalue"] },
    { acquisition: sosovalueFailureAcquisition, repositories: repositories().repositories },
  );
  assert.equal(sosovalueIsolated.status, "PARTIAL");
  assert.equal(sosovalueIsolated.persistedObservations, 1, "SoSoValue failure cannot suppress CoinGecko");

  const cftcStore = repositories();
  const cftcAcquisition = acquisition([]);
  cftcAcquisition.cftc = async () => providerResult("cftc", "SUCCESS", [cftcInput(210000)]);
  const cftcForward = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["cftc"] },
    { acquisition: cftcAcquisition, repositories: cftcStore.repositories },
  );
  assert.equal(cftcForward.status, "SUCCESS");
  assert.equal(cftcForward.persistedObservations, 1);
  assert.equal(cftcForward.persistedEvidence, 1);
  const cftcHistory = await cftcStore.observations.findHistory({
    identity: { domain: "MARKET", seriesKey: "gold.cftc.managed_money.long.contracts" },
    order: "ASC",
    limit: 10,
  });
  assert.equal(cftcHistory.length, 1);
  assert.equal(cftcHistory[0]?.quality, "UNKNOWN");
  assert.equal(cftcHistory[0]?.semantics?.participant, "MANAGED_MONEY");


  const gdeltStore = repositories();
  const gdeltAcquisition = acquisition([]);
  gdeltAcquisition.gdelt = async () => providerResult(
    "gdelt",
    "SUCCESS",
    [gdeltSnapshot("BTC"), gdeltSnapshot("GOLD")],
    undefined,
    undefined,
    "2026-10-04T12:00:05.000Z",
  );
  const gdeltForward = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["gdelt"] },
    { acquisition: gdeltAcquisition, repositories: gdeltStore.repositories },
  );
  assert.equal(gdeltForward.status, "SUCCESS");
  assert.equal(gdeltForward.providers[0].acquired, 2);
  assert.equal(gdeltForward.providers[0].normalized, 2);
  assert.equal(gdeltForward.persistedObservations, 0);
  assert.equal(gdeltForward.persistedEvidence, 2);

  await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["gdelt"] },
    { acquisition: gdeltAcquisition, repositories: gdeltStore.repositories },
  );
  const gdeltHistory = await gdeltStore.evidence.findHistory({
    sourceId: "gdelt",
    kind: "NEWS",
    metadataEquals: {
      methodology: GDELT_GAL_DURABLE_SNAPSHOT_METHODOLOGY,
    },
    order: "ASC",
    limit: 10,
  });
  assert.equal(gdeltHistory.length, 2, "repeated same-build GDELT ingestion must remain idempotent");
  assert.deepEqual(
    gdeltHistory.map((item) => item.metadata?.gdeltAsset).sort(),
    ["BTC", "GOLD"],
  );

  const spotFlowStore = repositories();
  const spotFlowAcquisition = acquisition([]);
  spotFlowAcquisition["binance-spot"] = async () => providerResult(
    "binance-spot",
    "SUCCESS",
    [binanceSpotKline()],
    undefined,
    undefined,
    "2026-10-04T12:05:02.000Z",
  );
  const spotFlowForward = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["binance-spot"] },
    { acquisition: spotFlowAcquisition, repositories: spotFlowStore.repositories },
  );
  assert.equal(spotFlowForward.status, "SUCCESS");
  assert.equal(spotFlowForward.providers[0].acquired, 1);
  assert.equal(spotFlowForward.providers[0].normalized, 1);
  assert.equal(spotFlowForward.persistedObservations, 0);
  assert.equal(spotFlowForward.persistedEvidence, 1);

  await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["binance-spot"] },
    { acquisition: spotFlowAcquisition, repositories: spotFlowStore.repositories },
  );
  const spotFlowHistory = await spotFlowStore.evidence.findHistory({
    sourceId: "binance-spot",
    kind: "OBSERVATION",
    metadataEquals: {
      methodology: BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY,
      pair: "BTCUSDT",
    },
    order: "ASC",
    limit: 10,
  });
  assert.equal(spotFlowHistory.length, 1, "repeated same-window Binance flow ingestion must remain idempotent");
  assert.equal(spotFlowHistory[0]?.metadata?.netTakerBaseVolumeBtc, 2);

  const orderBookStore = repositories();
  const orderBookAcquisition = acquisition([]);
  orderBookAcquisition["binance-book"] = async () => providerResult(
    "binance-spot",
    "SUCCESS",
    [binanceOrderBookSnapshot()],
    undefined,
    undefined,
    "2026-10-04T13:00:01.000Z",
  );
  orderBookAcquisition["hyperliquid-book"] = async () => providerResult(
    "hyperliquid",
    "SUCCESS",
    [hyperliquidOrderBookSnapshot()],
    undefined,
    undefined,
    "2026-10-04T13:00:01.000Z",
  );
  const orderBookForward = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["binance-book", "hyperliquid-book"] },
    { acquisition: orderBookAcquisition, repositories: orderBookStore.repositories },
  );
  assert.equal(orderBookForward.status, "SUCCESS");
  assert.equal(orderBookForward.persistedObservations, 0);
  assert.equal(orderBookForward.persistedEvidence, 2);

  await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["binance-book", "hyperliquid-book"] },
    { acquisition: orderBookAcquisition, repositories: orderBookStore.repositories },
  );
  const durableSpotBook = await orderBookStore.evidence.findHistory({
    sourceId: "binance-spot",
    kind: "OBSERVATION",
    metadataEquals: {
      methodology: BINANCE_BTC_SPOT_ORDER_BOOK_DURABLE_METHODOLOGY,
      venue: "BINANCE",
    },
    order: "ASC",
    limit: 10,
  });
  const durablePerpBook = await orderBookStore.evidence.findHistory({
    sourceId: "hyperliquid",
    kind: "OBSERVATION",
    metadataEquals: {
      methodology: HYPERLIQUID_BTC_PERP_ORDER_BOOK_DURABLE_METHODOLOGY,
      venue: "HYPERLIQUID",
    },
    order: "ASC",
    limit: 10,
  });
  assert.equal(durableSpotBook.length, 1, "same Binance sampled snapshot stays idempotent");
  assert.equal(durablePerpBook.length, 1, "same Hyperliquid provider snapshot stays idempotent");
  assert.equal(durableSpotBook[0]?.metadata?.marketType, "SPOT");
  assert.equal(durablePerpBook[0]?.metadata?.marketType, "PERPETUAL");

  const cftcFailureAcquisition = acquisition([]);
  cftcFailureAcquisition.cftc = async () => providerResult("cftc", "ERROR", [], "CFTC unavailable");
  const cftcIsolated = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["coingecko", "cftc"] },
    { acquisition: cftcFailureAcquisition, repositories: repositories().repositories },
  );
  assert.equal(cftcIsolated.status, "PARTIAL");
  assert.equal(cftcIsolated.persistedObservations, 1, "CFTC failure cannot suppress CoinGecko");

  const failingStore = repositories();
  failingStore.repositories.observations.saveMany = async () => { throw new Error("storage unavailable"); };
  const failed = await runHistoricalIngestion(
    { mode: "FORWARD", providers: ["coingecko"] },
    { acquisition: acquisition([]), repositories: failingStore.repositories },
  );
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.providers[0].status, "PERSISTENCE_ERROR");
  assert.equal(failed.providers[0].error, "storage unavailable");

  assert.deepEqual(providerFetchPolicy("FRESH", 300), { cache: "no-store" });
  assert.deepEqual(providerFetchPolicy("CACHED", 300), {
    next: { revalidate: 300, tags: ["p365-fast"] },
  });

  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=FORWARD&providers=coingecko,gold,dxy,usdjpy,usdcnh,gdelt")),
    { ok: true, options: { mode: "FORWARD", providers: ["coingecko", "gold", "dxy", "usdjpy", "usdcnh", "gdelt"] } },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=FORWARD&providers=coingecko,unknown")),
    { ok: false, error: "Unsupported providers: unknown" },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=BACKFILL&providers=gold&from=2026-09-01&to=2026-09-20")),
    { ok: false, error: "BACKFILL requires exactly one supported provider: fred, defillama, sosovalue, or cftc" },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=BACKFILL&providers=fred&from=2026-09-01&to=2026-09-20")),
    {
      ok: true,
      options: {
        mode: "BACKFILL",
        providers: ["fred"],
        fred: { observationStart: "2026-09-01", observationEnd: "2026-09-20", limit: 100 },
      },
    },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=BACKFILL&providers=fred&fredSeries=NFCI,ANFCI&from=2026-07-01&to=2026-10-09")),
    { ok: true, options: { mode: "BACKFILL", providers: ["fred"],
      fred: { observationStart: "2026-07-01", observationEnd: "2026-10-09", limit: 100,
        seriesIds: ["NFCI", "ANFCI"] } } },
  );
  for (const url of [
    "mode=BACKFILL&providers=fred&fredSeries=NFCI,ANFCI&from=2026-01-01&to=2026-10-09",
    "mode=BACKFILL&providers=fred&fredSeries=NFCI,NFCI&from=2026-07-01&to=2026-10-09",
    "mode=BACKFILL&providers=fred&fredSeries=INVALID&from=2026-07-01&to=2026-10-09",
    "mode=BACKFILL&providers=fred,coingecko-context&fredSeries=NFCI&from=2026-07-01&to=2026-10-09",
  ]) assert.equal(parseHistoricalIngestionRequest(new URLSearchParams(url)).ok, false, url);

  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=BACKFILL&providers=defillama&from=2026-09-01&to=2026-10-05")),
    {
      ok: true,
      options: {
        mode: "BACKFILL",
        providers: ["defillama"],
        defillama: { from: "2026-09-01", to: "2026-10-05" },
      },
    },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=BACKFILL&providers=defillama&from=2026-09-01&to=2026-10-06")),
    { ok: false, error: "DefiLlama BACKFILL is limited to 35 calendar days" },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=BACKFILL&providers=fred,defillama&from=2026-09-01&to=2026-09-20")),
    { ok: false, error: "BACKFILL requires exactly one supported provider: fred, defillama, sosovalue, or cftc" },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=BACKFILL&providers=sosovalue&from=2026-09-02&to=2026-09-29")),
    {
      ok: true,
      options: { mode: "BACKFILL", providers: ["sosovalue"], sosovalue: { from: "2026-09-02", to: "2026-09-29" } },
    },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=BACKFILL&providers=sosovalue&from=2026-09-01&to=2026-09-29")),
    { ok: false, error: "SoSoValue BACKFILL is limited to 28 calendar days" },
    "a 28-day date difference is 29 inclusive calendar days and is rejected",
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=BACKFILL&providers=fred,sosovalue&from=2026-09-01&to=2026-09-20")),
    { ok: false, error: "BACKFILL requires exactly one supported provider: fred, defillama, sosovalue, or cftc" },
    "mixed-provider BACKFILL remains rejected",
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=FORWARD&providers=federal-reserve-sep")),
    { ok: true, options: { mode: "FORWARD", providers: ["federal-reserve-sep"] } },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=BACKFILL&providers=federal-reserve-sep&from=2026-01-01&to=2026-10-01")),
    { ok: false, error: "BACKFILL requires exactly one supported provider: fred, defillama, sosovalue, or cftc" },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=FORWARD&providers=cftc")),
    { ok: true, options: { mode: "FORWARD", providers: ["cftc"] } },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=FORWARD&providers=binance-spot")),
    { ok: true, options: { mode: "FORWARD", providers: ["binance-spot"] } },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=FORWARD&providers=binance-book,hyperliquid-book")),
    { ok: true, options: { mode: "FORWARD", providers: ["binance-book", "hyperliquid-book"] } },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=BACKFILL&providers=cftc&from=2025-09-28&to=2026-10-02")),
    {
      ok: true,
      options: { mode: "BACKFILL", providers: ["cftc"], cftc: { from: "2025-09-28", to: "2026-10-02" } },
    },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=BACKFILL&providers=cftc&from=2025-09-27&to=2026-10-02")),
    { ok: false, error: "CFTC Gold COT BACKFILL is limited to 370 calendar days" },
  );
  assert.deepEqual(
    parseHistoricalIngestionRequest(new URLSearchParams("mode=BACKFILL&providers=cftc,sosovalue&from=2026-09-01&to=2026-09-20")),
    { ok: false, error: "BACKFILL requires exactly one supported provider: fred, defillama, sosovalue, or cftc" },
  );

  await assert.rejects(
    runHistoricalIngestion(
      { mode: "BACKFILL", providers: ["fred"],
        fred: { observationStart: "2026-01-01", observationEnd: "2026-10-09",
          limit: 100, seriesIds: ["NFCI", "ANFCI"] } },
      { acquisition: acquisition([]), repositories: repositories().repositories },
    ), /limited to 120 calendar days/,
    "runtime must reject an over-wide FRED selective backfill even without HTTP parsing",
  );

  await assert.rejects(
    runHistoricalIngestion(
      {
        mode: "BACKFILL",
        providers: ["defillama"],
        defillama: { from: "2026-09-01", to: "2026-10-06" },
      },
      { acquisition: acquisition([]), repositories: repositories().repositories },
    ),
    /limited to 35 calendar days/,
    "runtime must reject an over-wide DefiLlama backfill even outside the HTTP parser",
  );
}

void main();
