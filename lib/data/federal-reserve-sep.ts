import "server-only";

import type { ObservationProvenance } from "../domain/types";
import { FOMC_CALENDAR_URL } from "./federal-reserve-events";
import type { ProviderAcquisitionMode } from "./provider-fetch-policy";
import { providerFetchPolicy } from "./provider-fetch-policy";
import { providerResult, type ProviderResult } from "./types";

const FEDERAL_RESERVE_ORIGIN = "https://www.federalreserve.gov";
const SEP_RESOURCE_RE = /^\/monetarypolicy\/fomcprojtabl(\d{8})\.htm$/i;
const MONTHS = new Map([
  ["january", 0],
  ["february", 1],
  ["march", 2],
  ["april", 3],
  ["may", 4],
  ["june", 5],
  ["july", 6],
  ["august", 7],
  ["september", 8],
  ["october", 9],
  ["november", 10],
  ["december", 11],
]);

export type FederalReserveSepHorizon = `YEAR_END_${number}` | "LONGER_RUN";
export type FederalReserveSepFactType = "PUBLISHED_MEDIAN" | "PARTICIPANT_COUNT";

export type FederalReserveSepObservationInput = {
  metricId: string;
  value: number;
  unit: "PERCENT" | "COUNT";
  observedAt: string;
  retrievedAt: string;
  releaseDate: string;
  sourceUrl: string;
  providerResource: string;
  horizon: FederalReserveSepHorizon;
  factType: FederalReserveSepFactType;
  midpointPct?: number;
  participantCount?: number;
  meetingStartDate?: string;
  meetingEndDate?: string;
  provenance: ObservationProvenance;
  metadata: Record<string, string | number | boolean | null>;
};

export type FederalReserveSepSource = {
  sourceUrl: string;
  providerResource: string;
  releaseDate: string;
};

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&ndash;|&#8211;|&#x2013;/gi, "–")
    .replace(/&mdash;|&#8212;|&#x2014;/gi, "—")
    .replace(/&rsquo;|&#8217;|&#x2019;/gi, "’")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function cellText(value: string): string {
  return decodeHtml(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function plainText(html: string): string {
  return cellText(html);
}

function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateFromCompact(value: string): string | null {
  if (!/^\d{8}$/.test(value)) return null;
  const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  return validDateOnly(date) ? date : null;
}

export function discoverFederalReserveSepSources(
  calendarHtml: string,
  asOf = new Date(),
): FederalReserveSepSource[] {
  const asOfDate = asOf.toISOString().slice(0, 10);
  const found = [...calendarHtml.matchAll(/href\s*=\s*["']([^"']*fomcprojtabl(\d{8})\.htm(?:[^"']*)?)["']/gi)]
    .flatMap((match): FederalReserveSepSource[] => {
      try {
        const url = new URL(match[1], FEDERAL_RESERVE_ORIGIN);
        const resourceMatch = url.pathname.match(SEP_RESOURCE_RE);
        const releaseDate = resourceMatch ? dateFromCompact(resourceMatch[1]) : null;
        if (!releaseDate || releaseDate > asOfDate) return [];
        return [{
          sourceUrl: `${FEDERAL_RESERVE_ORIGIN}${url.pathname}`,
          providerResource: url.pathname,
          releaseDate,
        }];
      } catch {
        return [];
      }
    });

  return [...new Map(found.map((item) => [item.providerResource, item])).values()]
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
}

function extractRows(tableHtml: string): string[][] {
  return [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) =>
      [...row[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)]
        .map((cell) => cellText(cell[1])),
    )
    .filter((row) => row.length > 0);
}

function extractTables(html: string): string[][][] {
  return [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)]
    .map((table) => extractRows(table[1]))
    .filter((rows) => rows.length > 0);
}

function horizonFromLabel(value: string): FederalReserveSepHorizon | null {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (/^longer run$/i.test(normalized)) return "LONGER_RUN";
  if (/^20\d{2}$/.test(normalized)) return `YEAR_END_${normalized}` as FederalReserveSepHorizon;
  return null;
}

function horizonLabels(rows: string[][]): FederalReserveSepHorizon[] {
  for (const row of rows) {
    const labels = row.flatMap((cell) =>
      (cell.match(/20\d{2}|Longer run/gi) ?? [])
        .map(horizonFromLabel)
        .filter((item): item is FederalReserveSepHorizon => item !== null),
    );
    if (labels.length < 2) continue;
    const repeatedFirst = labels.findIndex((label, index) => index > 0 && label === labels[0]);
    const firstGroup = repeatedFirst > 0 ? labels.slice(0, repeatedFirst) : labels;
    if (firstGroup.length >= 2) return firstGroup;
  }
  return [];
}

function numericCell(value: string): number | null {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseReleaseTimestamp(html: string): {
  observedAt: string;
  releaseDate: string;
  sourceTimeZone: "EDT" | "EST";
} | null {
  const match = plainText(html).match(
    /For release at\s+(\d{1,2}):(\d{2})\s*([ap])\.m\.,\s*(EDT|EST),\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/i,
  );
  if (!match) return null;

  const month = MONTHS.get(match[5].toLowerCase());
  const minute = Number(match[2]);
  let hour = Number(match[1]) % 12;
  if (match[3].toLowerCase() === "p") hour += 12;
  const day = Number(match[6]);
  const year = Number(match[7]);
  if (month === undefined || !Number.isInteger(minute) || !Number.isInteger(day) || !Number.isInteger(year)) {
    return null;
  }

  const zone = match[4].toUpperCase() as "EDT" | "EST";
  const utcOffsetHours = zone === "EDT" ? 4 : 5;
  const utc = new Date(Date.UTC(year, month, day, hour + utcOffsetHours, minute));
  const releaseDate = `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!validDateOnly(releaseDate) || !Number.isFinite(utc.getTime())) return null;

  return { observedAt: utc.toISOString(), releaseDate, sourceTimeZone: zone };
}

function parseMeetingDates(html: string): { meetingStartDate?: string; meetingEndDate?: string } {
  const match = plainText(html).match(
    /meeting held on\s+([A-Za-z]+)\s+(\d{1,2})\s*[–-]\s*(\d{1,2}),\s*(\d{4})/i,
  );
  if (!match) return {};
  const month = MONTHS.get(match[1].toLowerCase());
  if (month === undefined) return {};
  const year = Number(match[4]);
  const startDay = Number(match[2]);
  const endDay = Number(match[3]);
  const toDate = (day: number) =>
    `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const meetingStartDate = toDate(startDay);
  const meetingEndDate = toDate(endDay);
  if (!validDateOnly(meetingStartDate) || !validDateOnly(meetingEndDate)) return {};
  return { meetingStartDate, meetingEndDate };
}

function horizonSlug(horizon: FederalReserveSepHorizon): string {
  return horizon === "LONGER_RUN"
    ? "longer_run"
    : horizon.toLowerCase();
}

export function federalReserveSepMedianSeriesKey(horizon: FederalReserveSepHorizon): string {
  return `policy.us.sep.ffr.${horizonSlug(horizon)}.median_pct`;
}

export function federalReserveSepParticipantSeriesKey(
  horizon: FederalReserveSepHorizon,
  midpointPct: number,
): string {
  const millipct = Math.round(midpointPct * 1000);
  if (!Number.isSafeInteger(millipct) || millipct < 0) {
    throw new Error("SEP midpoint must map to a non-negative integer millipct identity");
  }
  return `policy.us.sep.ffr.${horizonSlug(horizon)}.midpoint_${millipct}_millipct.participant_count`;
}

function commonMetadata(input: {
  source: FederalReserveSepSource;
  releaseTimestamp: string;
  sourceTimeZone: "EDT" | "EST";
  horizon: FederalReserveSepHorizon;
  meetingStartDate?: string;
  meetingEndDate?: string;
}): Record<string, string | number | boolean | null> {
  return {
    provider: "Federal Reserve",
    providerResource: input.source.providerResource,
    sourceUrl: input.source.sourceUrl,
    releaseDate: input.source.releaseDate,
    releaseTimestamp: input.releaseTimestamp,
    sourceTimeZone: input.sourceTimeZone,
    horizon: input.horizon,
    meetingStartDate: input.meetingStartDate ?? null,
    meetingEndDate: input.meetingEndDate ?? null,
    dotRoundingIncrementPct: 0.125,
    parserVersion: "MACRO_SEP_001B_V0_1",
  };
}

export function parseFederalReserveSepHtml(
  html: string,
  source: FederalReserveSepSource,
  retrievedAt: string,
): FederalReserveSepObservationInput[] {
  const retrievedMs = Date.parse(retrievedAt);
  if (!Number.isFinite(retrievedMs)) {
    throw new Error("Malformed Federal Reserve SEP input: retrievedAt is invalid");
  }
  if (!SEP_RESOURCE_RE.test(source.providerResource)) {
    throw new Error("Malformed Federal Reserve SEP input: provider resource is not an accessible SEP page");
  }

  const release = parseReleaseTimestamp(html);
  if (!release || release.releaseDate !== source.releaseDate) {
    throw new Error("Malformed Federal Reserve SEP HTML: release timestamp is missing or inconsistent");
  }
  if (Date.parse(release.observedAt) > retrievedMs) {
    throw new Error("Malformed Federal Reserve SEP HTML: release timestamp is in the future relative to retrieval");
  }

  const pageText = plainText(html);
  if (!/Summary of Economic Projections/i.test(pageText)) {
    throw new Error("Malformed Federal Reserve SEP HTML: SEP heading is missing");
  }
  if (!/nearest\s+1\/8\s+percentage\s+point/i.test(pageText)) {
    throw new Error("Malformed Federal Reserve SEP HTML: dot-rounding note is missing");
  }

  const tables = extractTables(html);
  const table1 = tables.find((rows) =>
    rows.some((row) => row.some((cell) => /Federal funds rate/i.test(cell)))
    && rows.some((row) => row.some((cell) => /^Median/i.test(cell))),
  );
  if (!table1) throw new Error("Malformed Federal Reserve SEP HTML: Table 1 federal-funds-rate row is missing");

  const mediansHorizons = horizonLabels(table1);
  const ffrRow = table1.find((row) => row.some((cell) => /^Federal funds rate$/i.test(cell.trim())));
  if (!ffrRow || mediansHorizons.length < 2) {
    throw new Error("Malformed Federal Reserve SEP HTML: published median horizons are missing");
  }

  const ffrLabelIndex = ffrRow.findIndex((cell) => /^Federal funds rate$/i.test(cell.trim()));
  const medianValues = ffrRow
    .slice(ffrLabelIndex + 1)
    .map(numericCell)
    .filter((value): value is number => value !== null)
    .slice(0, mediansHorizons.length);
  if (medianValues.length !== mediansHorizons.length) {
    throw new Error("Malformed Federal Reserve SEP HTML: published median values do not match horizons");
  }

  const figure2 = tables.find((rows) =>
    rows.some((row) => row.some((cell) => /Midpoint of target range or target level/i.test(cell))),
  );
  if (!figure2) throw new Error("Malformed Federal Reserve SEP HTML: Figure 2 dot table is missing");
  const dotHorizons = horizonLabels(figure2);
  if (dotHorizons.length < 2) {
    throw new Error("Malformed Federal Reserve SEP HTML: Figure 2 horizons are missing");
  }

  const meeting = parseMeetingDates(html);
  const provenance: ObservationProvenance = {
    version: "v1",
    providerResource: source.providerResource,
  };
  const common = (horizon: FederalReserveSepHorizon) => commonMetadata({
    source,
    releaseTimestamp: release.observedAt,
    sourceTimeZone: release.sourceTimeZone,
    horizon,
    ...meeting,
  });

  const medians = mediansHorizons.map((horizon, index): FederalReserveSepObservationInput => {
    const metricId = federalReserveSepMedianSeriesKey(horizon);
    const value = medianValues[index];
    return {
      metricId,
      value,
      unit: "PERCENT",
      observedAt: release.observedAt,
      retrievedAt,
      releaseDate: release.releaseDate,
      sourceUrl: source.sourceUrl,
      providerResource: source.providerResource,
      horizon,
      factType: "PUBLISHED_MEDIAN",
      ...meeting,
      provenance,
      metadata: {
        ...common(horizon),
        metricId,
        factType: "PUBLISHED_MEDIAN",
        unit: "PERCENT",
        publishedMedianPct: value,
      },
    };
  });

  const participantCounts: FederalReserveSepObservationInput[] = [];
  for (const row of figure2) {
    const midpoint = numericCell(row[0] ?? "");
    if (midpoint === null) continue;
    const cells = row.slice(1, 1 + dotHorizons.length);
    for (let index = 0; index < dotHorizons.length; index += 1) {
      const count = numericCell(cells[index] ?? "");
      if (count === null || count === 0) continue;
      if (!Number.isInteger(count) || count < 0) {
        throw new Error("Malformed Federal Reserve SEP HTML: participant count must be a non-negative integer");
      }
      const horizon = dotHorizons[index];
      const metricId = federalReserveSepParticipantSeriesKey(horizon, midpoint);
      participantCounts.push({
        metricId,
        value: count,
        unit: "COUNT",
        observedAt: release.observedAt,
        retrievedAt,
        releaseDate: release.releaseDate,
        sourceUrl: source.sourceUrl,
        providerResource: source.providerResource,
        horizon,
        factType: "PARTICIPANT_COUNT",
        midpointPct: midpoint,
        participantCount: count,
        ...meeting,
        provenance,
        metadata: {
          ...common(horizon),
          metricId,
          factType: "PARTICIPANT_COUNT",
          unit: "COUNT",
          midpointPct: midpoint,
          participantCount: count,
        },
      });
    }
  }

  if (participantCounts.length === 0) {
    throw new Error("Malformed Federal Reserve SEP HTML: Figure 2 contains no participant observations");
  }

  return [...medians, ...participantCounts];
}

export async function fetchFederalReserveSepObservations(
  acquisitionMode: ProviderAcquisitionMode = "CACHED",
): Promise<ProviderResult<FederalReserveSepObservationInput>> {
  const retrievedAt = new Date().toISOString();
  try {
    const calendarResponse = await fetch(FOMC_CALENDAR_URL, {
      ...providerFetchPolicy(acquisitionMode, 6 * 60 * 60),
      signal: AbortSignal.timeout(10_000),
    });
    if (!calendarResponse.ok) {
      return providerResult(
        "federal-reserve",
        "ERROR",
        [],
        `Federal Reserve FOMC calendar HTTP ${calendarResponse.status}`,
        undefined,
        retrievedAt,
      );
    }

    const sources = discoverFederalReserveSepSources(await calendarResponse.text(), new Date(retrievedAt));
    const source = sources[0];
    if (!source) {
      return providerResult(
        "federal-reserve",
        "EMPTY",
        [],
        "No published Federal Reserve accessible SEP page found",
        undefined,
        retrievedAt,
      );
    }

    const sepResponse = await fetch(source.sourceUrl, {
      ...providerFetchPolicy(acquisitionMode, 6 * 60 * 60),
      signal: AbortSignal.timeout(10_000),
    });
    if (!sepResponse.ok) {
      return providerResult(
        "federal-reserve",
        "ERROR",
        [],
        `Federal Reserve SEP HTTP ${sepResponse.status}`,
        undefined,
        retrievedAt,
      );
    }

    const data = parseFederalReserveSepHtml(await sepResponse.text(), source, retrievedAt);
    return providerResult(
      "federal-reserve",
      "SUCCESS",
      data,
      `Federal Reserve SEP ${source.releaseDate}: ${data.length} canonical raw facts parsed from accessible HTML`,
      undefined,
      retrievedAt,
    );
  } catch (error) {
    return providerResult(
      "federal-reserve",
      "ERROR",
      [],
      error instanceof Error ? error.message : "Federal Reserve SEP request failed",
      undefined,
      retrievedAt,
    );
  }
}
