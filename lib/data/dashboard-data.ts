import "server-only";
import { fetchAlphaVantageCryptoNews, fetchMacroNews } from "./alpha-vantage";
import { fetchCoinDeskNews } from "./coindesk-rss";
import { fetchEconomicCalendar } from "./economic-calendar";
import type { CalendarEvent, NewsItem } from "./types";
import type { Event, Observation, ProviderHealth } from "../domain/types";
import { calendarToEvents, newsToObservations, providerHealth, P365_SOURCES } from "../domain/normalize";

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

export async function getDashboardData(): Promise<DashboardData> {
  const [macroResult, avCryptoResult, coinDeskResult, calendarResult] = await Promise.allSettled([
    fetchMacroNews(6),
    fetchAlphaVantageCryptoNews(4),
    fetchCoinDeskNews(6),
    fetchEconomicCalendar(6),
  ]);

  const unavailableSources: string[] = [];

  const macroNews = macroResult.status === "fulfilled" ? macroResult.value : [];
  if (macroNews.length === 0) unavailableSources.push("berita makro (Alpha Vantage)");

  const avCrypto = avCryptoResult.status === "fulfilled" ? avCryptoResult.value : [];
  const coinDesk = coinDeskResult.status === "fulfilled" ? coinDeskResult.value : [];
  const cryptoNews = sortByRecency(dedupeByTitle([...coinDesk, ...avCrypto])).slice(0, 6);
  if (cryptoNews.length === 0) unavailableSources.push("berita crypto (CoinDesk & Alpha Vantage)");

  const calendarEvents = calendarResult.status === "fulfilled" ? calendarResult.value : [];
  if (calendarEvents.length === 0) unavailableSources.push("kalender ekonomi (Financial Modeling Prep)");

  const observations = [
    ...newsToObservations(macroNews, P365_SOURCES.alphaVantage.id, "MACRO"),
    ...newsToObservations(cryptoNews, P365_SOURCES.coinDesk.id),
  ];
  const events = calendarToEvents(calendarEvents, P365_SOURCES.fmp.id);
  const providerHealth = [
    providerHealthForResult(P365_SOURCES.alphaVantage.id, macroResult, macroNews),
    providerHealthForResult(P365_SOURCES.coinDesk.id, coinDeskResult, coinDesk),
    providerHealthForResult(P365_SOURCES.fmp.id, calendarResult, calendarEvents),
  ];

  return {
    macroNews: sortByRecency(macroNews),
    cryptoNews,
    calendarEvents,
    unavailableSources,
    observations,
    events,
    providerHealth,
  };
}

function providerHealthForResult<T>(
  sourceId: string,
  result: PromiseSettledResult<T>,
  items: unknown[],
): ProviderHealth {
  if (result.status === "rejected") {
    return providerHealth(sourceId, items, "ERROR", result.reason instanceof Error ? result.reason.message : "Provider request failed");
  }
  return providerHealth(sourceId, items);
}
