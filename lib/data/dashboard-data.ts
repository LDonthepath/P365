import "server-only";
import { fetchAlphaVantageCryptoNews, fetchMacroNews } from "./alpha-vantage";
import { fetchCoinDeskNews } from "./coindesk-rss";
import { fetchEconomicCalendar } from "./economic-calendar";
import { fetchCryptoMarketObservations } from "./crypto-market";
import { fetchFredMacroObservations } from "./fred";
import { fetchFomcEvents } from "./federal-reserve-events";
import type { CalendarEvent, NewsItem, ProviderResult } from "./types";
import type { Evidence, Event, Observation, ProviderHealth } from "../domain/types";
import {
  calendarToCanonicalRecords,
  cryptoMarketToObservations,
  fomcToCanonicalRecords,
  macroToCanonicalRecords,
  newsToEvidence,
  providerHealthForResult,
  P365_SOURCES,
} from "../domain/normalize";

export type DashboardData = {
  macroNews: NewsItem[];
  cryptoNews: NewsItem[];
  calendarEvents: CalendarEvent[];
  unavailableSources: string[];
  observations: Observation[];
  macroObservations: Observation[];
  events: Event[];
  evidence: Evidence[];
  providerHealth: ProviderHealth[];
};

function dedupeByTitle(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortByRecency(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

function resultOrEmpty<T>(result: PromiseSettledResult<ProviderResult<T>>): ProviderResult<T> {
  if (result.status === "fulfilled") return result.value;
  return { status: "ERROR", data: [], message: result.reason instanceof Error ? result.reason.message : "Provider request failed" };
}

export async function getDashboardData(): Promise<DashboardData> {
  const [macroResult, avCryptoResult, coinDeskResult, calendarResult, cryptoMarketResult, fredResult, fomcResult] = await Promise.allSettled([
    fetchMacroNews(6),
    fetchAlphaVantageCryptoNews(4),
    fetchCoinDeskNews(6),
    fetchEconomicCalendar(6),
    fetchCryptoMarketObservations(["BTC", "ETH"]),
    fetchFredMacroObservations(),
    fetchFomcEvents(),
  ]);

  const macroProvider = resultOrEmpty(macroResult);
  const avCryptoProvider = resultOrEmpty(avCryptoResult);
  const coinDeskProvider = resultOrEmpty(coinDeskResult);
  const calendarProvider = resultOrEmpty(calendarResult);
  const cryptoMarketProvider = resultOrEmpty(cryptoMarketResult);
  const fredProvider = resultOrEmpty(fredResult);
  const fomcProvider = resultOrEmpty(fomcResult);

  const macroNews = macroProvider.data;
  const avCrypto = avCryptoProvider.data;
  const coinDesk = coinDeskProvider.data;
  const cryptoNews = sortByRecency(dedupeByTitle([...coinDesk, ...avCrypto])).slice(0, 6);
  const calendarEvents = calendarProvider.data;

  const unavailableSources: string[] = [];
  if (macroProvider.status !== "SUCCESS") unavailableSources.push(`berita makro (Alpha Vantage: ${macroProvider.status})`);
  if (cryptoNews.length === 0 || (coinDeskProvider.status !== "SUCCESS" && avCryptoProvider.status !== "SUCCESS")) {
    unavailableSources.push(`berita crypto (CoinDesk: ${coinDeskProvider.status}; Alpha Vantage: ${avCryptoProvider.status})`);
  }
  if (calendarProvider.status !== "SUCCESS") unavailableSources.push(`kalender ekonomi (Financial Modeling Prep: ${calendarProvider.status})`);
  if (cryptoMarketProvider.status !== "SUCCESS") unavailableSources.push(`market crypto (Alpha Vantage: ${cryptoMarketProvider.status})`);
  if (fredProvider.status !== "SUCCESS") unavailableSources.push(`observasi makro (FRED: ${fredProvider.status})`);
  if (fomcProvider.status !== "SUCCESS") unavailableSources.push(`event FOMC (Federal Reserve: ${fomcProvider.status})`);

  const newsEvidence = [
    ...newsToEvidence(macroNews, P365_SOURCES.alphaVantage.id),
    ...newsToEvidence(avCrypto, P365_SOURCES.alphaVantage.id),
    ...newsToEvidence(coinDesk, P365_SOURCES.coinDesk.id),
  ];
  const calendarRecords = calendarToCanonicalRecords(calendarEvents, P365_SOURCES.fmp.id);
  const fomcRecords = fomcToCanonicalRecords(fomcProvider.data, P365_SOURCES.federalReserve.id);
  const events = [...calendarRecords.events, ...fomcRecords.events];
  const marketFacts = cryptoMarketToObservations(cryptoMarketProvider.data, P365_SOURCES.alphaVantageMarket.id);
  const macroFacts = macroToCanonicalRecords(fredProvider.data, P365_SOURCES.fred.id);
  const fredHealth = providerHealthForResult(P365_SOURCES.fred.id, fredProvider);
  if (fredProvider.status === "SUCCESS" && macroFacts.observations.length > 0 && macroFacts.observations.every((item) => item.quality === "STALE")) {
    fredHealth.status = "STALE";
  }
  const observations = [...marketFacts.observations, ...macroFacts.observations];
  const evidence = [...newsEvidence, ...calendarRecords.evidence, ...fomcRecords.evidence, ...marketFacts.evidence, ...macroFacts.evidence];
  const providerHealth = [
    providerHealthForResult(P365_SOURCES.alphaVantage.id, macroProvider),
    providerHealthForResult(P365_SOURCES.coinDesk.id, coinDeskProvider),
    providerHealthForResult(P365_SOURCES.fmp.id, calendarProvider),
    providerHealthForResult(P365_SOURCES.alphaVantageMarket.id, cryptoMarketProvider),
    fredHealth,
    providerHealthForResult(P365_SOURCES.federalReserve.id, fomcProvider),
  ];

  return { macroNews: sortByRecency(macroNews), cryptoNews, calendarEvents, unavailableSources, observations, macroObservations: macroFacts.observations, events, evidence, providerHealth };
}
