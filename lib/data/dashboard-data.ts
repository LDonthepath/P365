import "server-only";
import { fetchAlphaVantageCryptoNews, fetchMacroNews } from "./alpha-vantage";
import { fetchCoinDeskNews } from "./coindesk-rss";
import { fetchEconomicCalendar } from "./economic-calendar";
import { fetchCryptoMarketObservations } from "./crypto-market";
import { fetchFredMacroObservations } from "./fred";
import { fetchFomcEvents } from "./federal-reserve-events";
import type { CalendarEvent, NewsItem, ProviderResult } from "./types";
import type { Context, Evidence, Event, Observation, ProviderHealth } from "../domain/types";
import { buildDashboardContexts } from "../domain/context";
import { calendarToCanonicalRecords, cryptoMarketToObservations, fomcToCanonicalRecords, macroToCanonicalRecords, newsToEvidence, providerHealthForResult, P365_SOURCES } from "../domain/normalize";

export type DashboardData = {
  macroNews: NewsItem[]; cryptoNews: NewsItem[]; calendarEvents: CalendarEvent[]; calendarProviderMessage?: string;
  unavailableSources: string[]; observations: Observation[]; macroObservations: Observation[]; events: Event[];
  contexts: Context[]; evidence: Evidence[]; providerHealth: ProviderHealth[];
};

function normalizeNewsUrl(url: string): string { return url.trim().replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase(); }
function dedupeNewsBySource(items: NewsItem[], sourceId: string): NewsItem[] { const seen = new Set<string>(); return items.filter((item) => { const key = `${sourceId}:${normalizeNewsUrl(item.url)}`; if (!normalizeNewsUrl(item.url) || seen.has(key)) return false; seen.add(key); return true; }); }
function dedupeByTitle(items: NewsItem[]): NewsItem[] { const seen = new Set<string>(); return items.filter((item) => { const key = item.title.trim().toLowerCase(); if (!key || seen.has(key)) return false; seen.add(key); return true; }); }
function sortByRecency(items: NewsItem[]): NewsItem[] { return [...items].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()); }
function resultOrEmpty<T>(result: PromiseSettledResult<ProviderResult<T>>): ProviderResult<T> { if (result.status === "fulfilled") return result.value; return { status: "ERROR", data: [], message: result.reason instanceof Error ? result.reason.message : "Provider request failed" }; }
function jakartaDate(dateISO: string): string { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(dateISO)); const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value; return `${value("year")}-${value("month")}-${value("day")}`; }
function isFomcCalendarEvent(item: CalendarEvent): boolean { return /\bfomc\b|federal open market committee/i.test(item.event); }
function dedupeCalendarEvents(calendarEvents: CalendarEvent[], fomcDates: string[]): CalendarEvent[] { const officialFomcDates = new Set(fomcDates.map(jakartaDate)); return calendarEvents.filter((item) => !isFomcCalendarEvent(item) || !officialFomcDates.has(jakartaDate(item.dateISO))); }

export async function getDashboardData(): Promise<DashboardData> {
  const [macroResult, avCryptoResult, coinDeskResult, calendarResult, cryptoMarketResult, fredResult, fomcResult] = await Promise.allSettled([fetchMacroNews(6), fetchAlphaVantageCryptoNews(4), fetchCoinDeskNews(6), fetchEconomicCalendar(6), fetchCryptoMarketObservations(["BTC", "ETH"]), fetchFredMacroObservations(), fetchFomcEvents()]);
  const macroProvider = resultOrEmpty(macroResult); const avCryptoProvider = resultOrEmpty(avCryptoResult); const coinDeskProvider = resultOrEmpty(coinDeskResult); const calendarProvider = resultOrEmpty(calendarResult); const cryptoMarketProvider = resultOrEmpty(cryptoMarketResult); const fredProvider = resultOrEmpty(fredResult); const fomcProvider = resultOrEmpty(fomcResult);
  const macroNews = dedupeNewsBySource(macroProvider.data, P365_SOURCES.alphaVantage.id); const avCrypto = dedupeNewsBySource(avCryptoProvider.data, P365_SOURCES.alphaVantage.id); const coinDesk = dedupeNewsBySource(coinDeskProvider.data, P365_SOURCES.coinDesk.id); const cryptoNews = sortByRecency(dedupeByTitle([...coinDesk, ...avCrypto])).slice(0, 6);
  const calendarEvents = dedupeCalendarEvents(calendarProvider.data, fomcProvider.data.map((item) => item.scheduledAt)); const calendarProviderMessage = calendarProvider.message;
  const unavailableSources: string[] = [];
  if (macroProvider.status !== "SUCCESS") unavailableSources.push(`berita makro (Alpha Vantage: ${macroProvider.status})`);
  if (cryptoNews.length === 0 || (coinDeskProvider.status !== "SUCCESS" && avCryptoProvider.status !== "SUCCESS")) unavailableSources.push(`berita crypto (CoinDesk: ${coinDeskProvider.status}; Alpha Vantage: ${avCryptoProvider.status})`);
  if (calendarProvider.status !== "SUCCESS") unavailableSources.push(`kalender ekonomi (Forex Factory: ${calendarProvider.status})`);
  if (cryptoMarketProvider.status !== "SUCCESS") unavailableSources.push(`market crypto (CoinGecko: ${cryptoMarketProvider.status})`);
  if (fredProvider.status !== "SUCCESS") unavailableSources.push(`observasi makro (FRED: ${fredProvider.status})`);
  if (fomcProvider.status !== "SUCCESS") unavailableSources.push(`event FOMC (Federal Reserve: ${fomcProvider.status})`);
  const newsEvidence = [...newsToEvidence(macroNews, P365_SOURCES.alphaVantage.id), ...newsToEvidence(avCrypto, P365_SOURCES.alphaVantage.id), ...newsToEvidence(coinDesk, P365_SOURCES.coinDesk.id)];
  const calendarRecords = calendarToCanonicalRecords(calendarEvents, P365_SOURCES.forexFactory.id); const fomcRecords = fomcToCanonicalRecords(fomcProvider.data, P365_SOURCES.federalReserve.id); const events = [...calendarRecords.events, ...fomcRecords.events];
  const marketFacts = cryptoMarketToObservations(cryptoMarketProvider.data, P365_SOURCES.coinGeckoMarket.id); const macroFacts = macroToCanonicalRecords(fredProvider.data, P365_SOURCES.fred.id);
  const fredHealth = providerHealthForResult(P365_SOURCES.fred.id, fredProvider); if (fredProvider.status === "SUCCESS" && macroFacts.observations.length > 0 && macroFacts.observations.every((item) => item.quality === "STALE")) fredHealth.status = "STALE";
  const observations = [...marketFacts.observations, ...macroFacts.observations]; const evidence = [...newsEvidence, ...calendarRecords.evidence, ...fomcRecords.evidence, ...marketFacts.evidence, ...macroFacts.evidence]; const contexts = buildDashboardContexts({ observations, events });
  const providerHealth = [providerHealthForResult(P365_SOURCES.alphaVantage.id, macroProvider), providerHealthForResult(P365_SOURCES.coinDesk.id, coinDeskProvider), providerHealthForResult(P365_SOURCES.forexFactory.id, calendarProvider), providerHealthForResult(P365_SOURCES.coinGeckoMarket.id, cryptoMarketProvider), fredHealth, providerHealthForResult(P365_SOURCES.federalReserve.id, fomcProvider)];
  return { macroNews: sortByRecency(macroNews), cryptoNews, calendarEvents, calendarProviderMessage, unavailableSources, observations, macroObservations: macroFacts.observations, events, contexts, evidence, providerHealth };
}
