import "server-only";
import type { CalendarEvent, CalendarImpact, CalendarStatus, ProviderResult } from "./types";

const FMP_BASE = "https://financialmodelingprep.com/api/v3/economic_calendar";

type FmpEvent = { event: string; date: string; country: string; impact?: string };

function mapImpact(raw?: string): CalendarImpact {
  const value = (raw ?? "").toLowerCase();
  if (value.includes("high")) return "HIGH";
  if (value.includes("medium")) return "MEDIUM";
  return "LOW";
}

function toJakartaTime(utcDate: Date): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(utcDate);
}

function statusFor(date: Date, now: Date): CalendarStatus {
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / dayMs);
  if (diffDays < 0) return "PAST";
  if (diffDays === 0) return date.getTime() > now.getTime() ? "TODAY" : "PAST";
  if (diffDays === 1) return "TOMORROW";
  return "UPCOMING";
}

export async function fetchEconomicCalendar(limit = 6): Promise<ProviderResult<CalendarEvent>> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return { status: "UNAVAILABLE", data: [], message: "FMP_API_KEY is not configured" };

  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = new URL(FMP_BASE);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("apikey", apiKey);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
    if (!res.ok) return { status: "ERROR", data: [], message: `FMP HTTP ${res.status}` };
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return { status: "EMPTY", data: [] };

    const events = (data as FmpEvent[])
      .filter((item) => item.country === "US")
      .map((item, index): CalendarEvent => {
        const date = new Date(`${item.date.replace(" ", "T")}Z`);
        return {
          id: `${item.event}-${item.date}-${index}`,
          time: toJakartaTime(date),
          event: item.event,
          country: item.country,
          impact: mapImpact(item.impact),
          status: statusFor(date, now),
          dateISO: date.toISOString(),
        };
      })
      .filter((item) => item.status !== "PAST")
      .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime())
      .slice(0, limit);
    return { status: events.length > 0 ? "SUCCESS" : "EMPTY", data: events };
  } catch (error) {
    return { status: "ERROR", data: [], message: error instanceof Error ? error.message : "FMP request failed" };
  }
}
