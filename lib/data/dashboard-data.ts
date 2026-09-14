import "server-only";
import { fetchAlphaVantageCryptoNews, fetchMacroNews } from "./alpha-vantage";
import { fetchCoinDeskNews } from "./coindesk-rss";
import { fetchEconomicCalendar } from "./economic-calendar";
import type { CalendarEvent, NewsItem } from "./types";

export type DashboardData = {
  macroNews: NewsItem[];
  cryptoNews: NewsItem[];
  calendarEvents: CalendarEvent[];
  unavailableSources: string[];
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

  return {
    macroNews: sortByRecency(macroNews),
    cryptoNews,
    calendarEvents,
    unavailableSources,
  };
}
