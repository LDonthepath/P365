import "server-only";
import type { ProviderResult } from "./types";
import { providerResult } from "./types";

const FOMC_CALENDAR_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
export type FomcEventInput = { scheduledAt: string; label: string; sourceUrl: string };
function text(value: string): string { return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(); }
function monthNumber(value: string): number | null { const result = new Date(`${value} 1, 2000`).getUTCMonth(); return Number.isFinite(result) ? result : null; }
function parseUpcomingFomcMeetings(html: string, now = new Date()): FomcEventInput[] {
  const matches = [...html.matchAll(/fomc-meeting__month[^>]*>([\s\S]*?)<\/[^>]+>[\s\S]*?fomc-meeting__date[^>]*>([\s\S]*?)<\/[^>]+>/gi)];
  const years = [now.getUTCFullYear(), now.getUTCFullYear() + 1];
  const todayAnchorMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const events = matches.flatMap((match): FomcEventInput[] => {
    const month = monthNumber(text(match[1])); const dayMatch = text(match[2]).match(/\d{1,2}/);
    if (month === null || !dayMatch) return [];
    const day = Number(dayMatch[0]);
    const candidates = years.map((year) => new Date(Date.UTC(year, month, day, 0, 0, 0)));
    const scheduled = candidates.find((candidate) => candidate.getTime() >= todayAnchorMs);
    if (!scheduled || scheduled.getUTCDate() !== day || scheduled.getUTCMonth() !== month) return [];
    return [{ scheduledAt: scheduled.toISOString(), label: `${text(match[1])} ${text(match[2])}`, sourceUrl: FOMC_CALENDAR_URL }];
  });
  return [...new Map(events.map((event) => [event.scheduledAt, event])).values()].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export async function fetchFomcEvents(limit = 6): Promise<ProviderResult<FomcEventInput>> {
  try {
    const response = await fetch(FOMC_CALENDAR_URL, { next: { revalidate: 24 * 60 * 60, tags: ["p365-dashboard"] }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return providerResult("federal-reserve", "ERROR", [], `Federal Reserve FOMC calendar HTTP ${response.status}`);
    const data = parseUpcomingFomcMeetings(await response.text()).slice(0, limit);
    return providerResult("federal-reserve", data.length ? "SUCCESS" : "EMPTY", data, data.length ? undefined : "No parseable upcoming FOMC meetings");
  } catch (error) { return providerResult("federal-reserve", "ERROR", [], error instanceof Error ? error.message : "Federal Reserve FOMC calendar request failed"); }
}
