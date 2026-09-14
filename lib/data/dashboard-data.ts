import "server-only";
import { fetchAlphaVantageCryptoNews, fetchMacroNews } from "./alpha-vantage";
import { fetchCoinDeskNews } from "./coindesk-rss";
import { fetchEconomicCalendar } from "./economic-calendar";
import type { CalendarEvent, NewsItem, ProviderResult } from "./types";
import type { Event, Observation, ProviderHealth } from "../domain/types";
import { calendarToEvents, newsToObservations, providerHealthForResult, P365_SOURCES } from "../domain/normalize";

export type DashboardData = {
  macroNews: NewsItem[];
  cryptoNews: NewsItem[];
  calendarEvents: CalendarEvent[];
  unavailableSources: string[];
  observations: Observation[];
  events: Event[];
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
  const [macroResult, avCryptoResult, coinDeskResult, calendarResult] = await Promise.allSettled([
    fetchMacroNews(6),
    fetchAlphaVantageCryptoNews(4),
    fetchCoinDeskNews(6),
    fetchEconomicCalendar(6),
  ]);

  const macroProvider = resultOrEmpty(macroResult);
  const avCryptoProvider = resultOrEmpty(avCryptoResult);
  const coinDeskProvider = resultOrEmpty(coinDeskResult);
  const calendarProvider = resultOrEmpty(calendarResult);

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

  const observations = [
    ...newsToObservations(macroNews, P365_SOURCES.alphaVantage.id, "MACRO"),
    ...newsToObservations(avCrypto, P365_SOURCES.alphaVantage.id),
    ...newsToObservations(coinDesk, P365_SOURCES.coinDesk.id),
  ];
  const events = calendarToEvents(calendarEvents, P365_SOURCES.fmp.id);
  const providerHealth = [
    providerHealthForResult(P365_SOURCES.alphaVantage.id, macroProvider),
    providerHealthForResult(P365_SOURCES.coinDesk.id, coinDeskProvider),
    providerHealthForResult(P365_SOURCES.fmp.id, calendarProvider),
  ];

  return { macroNews: sortByRecency(macroNews), cryptoNews, calendarEvents, unavailableSources, observations, events, providerHealth };
}
