import "server-only";
import type { CalendarEvent, CalendarImpact, CalendarStatus, ProviderResult } from "./types";
import { providerResult } from "./types";
import type { ProviderAcquisitionMode } from "./provider-fetch-policy";
import { providerFetchPolicy } from "./provider-fetch-policy";

const FOREX_FACTORY_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
type ForexFactoryEvent = { title?: unknown; country?: unknown; date?: unknown; impact?: unknown };
function mapImpact(raw: unknown): CalendarImpact { const value = typeof raw === "string" ? raw.toLowerCase() : ""; if (value === "high") return "HIGH"; if (value === "medium") return "MEDIUM"; return "LOW"; }
function toJakartaTime(date: Date): string { return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(date); }
function jakartaDate(date: Date): string { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date); const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value; return `${value("year")}-${value("month")}-${value("day")}`; }
function statusFor(date: Date, now: Date): CalendarStatus { const dayMs = 24 * 60 * 60 * 1000; const today = new Date(`${jakartaDate(now)}T00:00:00Z`); const target = new Date(`${jakartaDate(date)}T00:00:00Z`); const diffDays = Math.round((target.getTime() - today.getTime()) / dayMs); if (diffDays < 0) return "PAST"; if (diffDays === 0) return date.getTime() > now.getTime() ? "TODAY" : "PAST"; if (diffDays === 1) return "TOMORROW"; return "UPCOMING"; }
function isLikelyJson(contentType: string | null, body: string): boolean { if (contentType?.toLowerCase().includes("json")) return true; const first = body.trimStart().charAt(0); return first === "[" || first === "{"; }
function isForexFactoryEvent(value: unknown): value is ForexFactoryEvent { if (!value || typeof value !== "object") return false; const item = value as ForexFactoryEvent; return typeof item.title === "string" && item.title.trim().length > 0 && typeof item.country === "string" && item.country.trim().length > 0 && typeof item.date === "string" && item.date.trim().length > 0; }
export async function fetchEconomicCalendar(
  limit: number | undefined = 6,
  acquisitionMode: ProviderAcquisitionMode = "CACHED",
): Promise<ProviderResult<CalendarEvent>> {
  const now = new Date();
  try {
    const res = await fetch(FOREX_FACTORY_URL, {
      ...providerFetchPolicy(acquisitionMode, 3600),
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });
    const contentType = res.headers.get("content-type");
    const body = await res.text();
    if (!res.ok) return providerResult("forex-factory", "ERROR", [], `ForexFactory HTTP ${res.status}`);
    if (!isLikelyJson(contentType, body)) return providerResult("forex-factory", "ERROR", [], "ForexFactory returned a non-JSON response");
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { return providerResult("forex-factory", "ERROR", [], "ForexFactory returned invalid JSON"); }
    if (!Array.isArray(parsed)) return providerResult("forex-factory", "ERROR", [], "ForexFactory calendar returned a non-array response");
    const validItems = parsed.filter(isForexFactoryEvent);
    if (parsed.length > 0 && validItems.length === 0) return providerResult("forex-factory", "ERROR", [], "ForexFactory calendar contained no valid event records");
    const obtained = validItems.flatMap((item, index): CalendarEvent[] => {
      const date = new Date(item.date as string);
      if (!Number.isFinite(date.getTime())) return [];
      const status = statusFor(date, now);
      // Dashboard reads keep their historical presentation behavior. Independent
      // ingestion (no limit) retains the complete obtained weekly feed, including
      // already-released entries that may still be useful schedule facts.
      if (status === "PAST" && limit !== undefined) return [];
      return [{ id: `forexfactory-${date.toISOString()}-${item.country}-${item.title}-${index}`, time: toJakartaTime(date), event: item.title as string, country: item.country as string, impact: mapImpact(item.impact), status, dateISO: date.toISOString() }];
    }).sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());
    const events = limit === undefined ? obtained : obtained.slice(0, limit);
    return providerResult(
      "forex-factory",
      events.length > 0 ? "SUCCESS" : "EMPTY",
      events,
      events.length > 0
        ? limit === undefined ? "Forex Factory current-week feed ingested without the dashboard presentation cap" : undefined
        : "ForexFactory returned no upcoming events in the current weekly feed",
    );
  } catch (error) {
    return providerResult("forex-factory", "ERROR", [], error instanceof Error ? error.message : "ForexFactory request failed");
  }
}
