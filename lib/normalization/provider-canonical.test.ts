import assert from "node:assert/strict";
import type { CalendarEvent, NewsItem } from "../data/types";
import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { MacroObservationInput } from "../data/fred";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import { calendarToCanonicalRecords as calendarFromProvider } from "./provider-canonical-events";
import { macroToCanonicalRecords as macroFromProvider } from "./provider-canonical-macro";
import { cryptoMarketToObservations as marketFromProvider } from "./provider-canonical-market";
import {
  calendarToCanonicalRecords as calendarFromCanonical,
  cryptoMarketToObservations as marketFromCanonical,
  macroToCanonicalRecords as macroFromCanonical,
  newsToEvidence as newsFromCanonical,
} from "../domain/normalize";

function withoutCaptureTimes<T extends { retrievedAt: string }>(item: T): Omit<T, "retrievedAt"> {
  const { retrievedAt: _retrievedAt, ...fact } = item;
  void _retrievedAt;
  return fact;
}

function main(): void {
  const forexFixture: CalendarEvent = {
    id: "ff-2026-us-cpi", time: "19:30", event: "CPI m/m",
    country: "USD", impact: "HIGH", status: "UPCOMING",
    dateISO: "2026-10-13T12:30:00.000Z",
  };
  const ff = calendarFromProvider([forexFixture], "forex-factory");
  const ffQualified = calendarFromCanonical([{
    id: forexFixture.id, event: forexFixture.event,
    country: forexFixture.country, impact: forexFixture.impact,
    status: forexFixture.status, dateISO: forexFixture.dateISO,
    jurisdiction: "US",
  }], "forex-factory");
  assert.deepEqual(ff.events.map(withoutCaptureTimes), ffQualified.events.map(withoutCaptureTimes));
  assert.deepEqual(
    ff.evidence.map((record) => withoutCaptureTimes({ ...record, capturedAt: "<capture>" })),
    ffQualified.evidence.map((record) => withoutCaptureTimes({ ...record, capturedAt: "<capture>" })),
  );
  assert.equal(ff.events[0]?.jurisdiction, "US");
  assert.equal(ff.events[0]?.sourceId, "forex-factory");
  assert.equal(ff.evidence[0]?.metadata?.country, "USD");
  assert.equal(ff.events[0]?.evidenceId, ff.evidence[0]?.id);

  const quote: CryptoMarketObservationInput = {
    metricId: "btc.spot.usd", symbol: "BTC", value: 65000,
    observedAt: "2026-09-20T00:00:00.000Z",
    retrievedAt: "2026-09-20T00:01:00.000Z",
    source: "CoinGecko", freshnessCalendar: "CONTINUOUS_24_7",
    provenance: {
      version: "v1", providerResource: "/simple/price",
      nativeInstrumentId: "bitcoin",
    },
    metadata: { unit: "USD", provider: "CoinGecko", providerAssetId: "bitcoin" },
  };
  const quoteProvider = marketFromProvider([quote], "coingecko-market");
  const quoteCanonical = marketFromCanonical([{
    metricId: quote.metricId, symbol: quote.symbol, value: quote.value,
    observedAt: quote.observedAt, retrievedAt: quote.retrievedAt,
    provenance: quote.provenance, freshnessCalendar: quote.freshnessCalendar,
    metadata: quote.metadata,
  }], "coingecko-market");
  assert.deepEqual(quoteProvider, quoteCanonical);
  assert.equal(quoteProvider.observations[0]?.identity?.measurementId, quoteCanonical.observations[0]?.identity?.measurementId);
  assert.equal(quoteProvider.observations[0]?.provenance?.nativeInstrumentId, "bitcoin");
  assert.equal(quoteProvider.observations[0]?.semantics?.informationClass, "PRICING");
  assert.equal(quoteProvider.evidence[0]?.id, quoteProvider.observations[0]?.evidenceId);

  const series = MACRO_SERIES_REGISTRY.find((item) => item.seriesId === "DGS10");
  assert.ok(series);
  const fed: MacroObservationInput = {
    series, value: "4.25", observationDate: "2026-09-19",
    previousValue: "4.20", vintageDate: "2026-09-19", releasedAt: null,
    retrievedAt: "2026-09-20T00:01:00.000Z",
    provenance: {
      version: "v1", providerResource: "/fred/series/observations",
      nativeSeriesId: "DGS10", observationDate: "2026-09-19",
      vintageDate: "2026-09-19",
    },
  };
  const macroProvider = macroFromProvider([fed], "fred");
  const macroCanonical = macroFromCanonical([{
    series: {
      seriesId: series.seriesId, subject: series.subject,
      frequency: series.frequency, unit: series.unit, source: series.source,
      domain: series.domain, freshnessMs: series.freshnessMs,
    },
    value: fed.value, observationDate: fed.observationDate,
    previousValue: fed.previousValue, vintageDate: fed.vintageDate,
    releasedAt: fed.releasedAt, retrievedAt: fed.retrievedAt, provenance: fed.provenance,
  }], "fred");
  assert.deepEqual(macroProvider, macroCanonical);
  assert.equal(macroProvider.observations[0]?.domain, "MACRO");
  assert.equal(macroProvider.observations[0]?.identity?.seriesKey, "DGS10");
  assert.equal(macroProvider.observations[0]?.provenance?.vintageDate, "2026-09-19");

  const news: NewsItem = {
    id: "item1", category: "MACRO", source: "Alpha Vantage",
    publishedAt: "2026-09-20T00:00:00.000Z", title: "Inflation release",
    summary: "Factual summary", url: "https://example.org/report",
  };
  // NEWS remains a durable historical information class even though live news fetchers
  // and their unused provider-side adapter have been retired.
  const canonicalNews = newsFromCanonical([news], "alpha-vantage")[0];
  assert.ok(canonicalNews);
  assert.equal(canonicalNews.sourceId, "alpha-vantage");
  assert.equal(canonicalNews.kind, "NEWS");
  assert.equal(canonicalNews.publishedAt, news.publishedAt);
  assert.equal(canonicalNews.metadata?.url, news.url);
  assert.equal(canonicalNews.metadata?.source, news.source);
  assert.equal(canonicalNews.id, newsFromCanonical([news], "alpha-vantage")[0]?.id);
  assert.deepEqual(newsFromCanonical([], "alpha-vantage"), []);

  // Report a zero-input materiality regression without touching timestamps.
  assert.deepEqual(marketFromProvider([], "coingecko-market"), marketFromCanonical([], "coingecko-market"));
  console.log("provider-canonical golden fixtures: Forex Factory, BTC, FRED, historical NEWS, empty PASS");
}

main();
