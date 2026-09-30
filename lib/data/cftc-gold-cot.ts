import "server-only";

import type { ObservationProvenance } from "../domain/types";
import { OBSERVATION_PROVIDER_RESOURCES } from "../domain/observation-provenance";
import { providerFetchPolicy, type ProviderAcquisitionMode } from "./provider-fetch-policy";
import { providerResult, type ProviderResult } from "./types";

export const CFTC_PRE_BASE_URL = "https://publicreporting.cftc.gov" as const;
export const CFTC_GOLD_COT_DATASET_ID = "72hh-3qpy" as const;
export const CFTC_GOLD_CONTRACT_MARKET_CODE = "088691" as const;
export const CFTC_GOLD_MARKET_NAME = "GOLD - COMMODITY EXCHANGE INC." as const;
export const CFTC_GOLD_COT_SOURCE_ID = "cftc-gold-cot" as const;
export const CFTC_GOLD_COT_PROVIDER_RESOURCE = OBSERVATION_PROVIDER_RESOURCES.cftcDisaggregatedFuturesOnly;
export const CFTC_GOLD_COT_REPORT_FAMILY = "DISAGGREGATED_FUTURES_ONLY" as const;
export const CFTC_GOLD_COT_FORWARD_REPORT_LIMIT = 8;
export const CFTC_GOLD_COT_MAX_BACKFILL_CALENDAR_DAYS = 370;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CftcGoldCotBackfillRange = { from: string; to: string };
export type CftcGoldCotParticipant =
  | "PRODUCER_MERCHANT_PROCESSOR_USER"
  | "SWAP_DEALER"
  | "MANAGED_MONEY"
  | "OTHER_REPORTABLES"
  | "NONREPORTABLE";
export type CftcGoldCotPositionSide = "OPEN_INTEREST" | "LONG" | "SHORT" | "SPREADING";

const SERIES = [
  {
    metricId: "gold.cftc.comex.open_interest.contracts",
    aliases: ["open_interest_all"],
    participant: null,
    side: "OPEN_INTEREST",
  },
  {
    metricId: "gold.cftc.producer_merchant.long.contracts",
    aliases: ["prod_merc_positions_long", "prod_merc_positions_long_all"],
    participant: "PRODUCER_MERCHANT_PROCESSOR_USER",
    side: "LONG",
  },
  {
    metricId: "gold.cftc.producer_merchant.short.contracts",
    aliases: ["prod_merc_positions_short", "prod_merc_positions_short_all"],
    participant: "PRODUCER_MERCHANT_PROCESSOR_USER",
    side: "SHORT",
  },
  {
    metricId: "gold.cftc.swap_dealer.long.contracts",
    aliases: ["swap_positions_long_all"],
    participant: "SWAP_DEALER",
    side: "LONG",
  },
  {
    metricId: "gold.cftc.swap_dealer.short.contracts",
    aliases: ["swap__positions_short_all", "swap_positions_short_all"],
    participant: "SWAP_DEALER",
    side: "SHORT",
  },
  {
    metricId: "gold.cftc.swap_dealer.spreading.contracts",
    aliases: ["swap__positions_spread_all", "swap_positions_spread_all"],
    participant: "SWAP_DEALER",
    side: "SPREADING",
  },
  {
    metricId: "gold.cftc.managed_money.long.contracts",
    aliases: ["m_money_positions_long_all"],
    participant: "MANAGED_MONEY",
    side: "LONG",
  },
  {
    metricId: "gold.cftc.managed_money.short.contracts",
    aliases: ["m_money_positions_short_all"],
    participant: "MANAGED_MONEY",
    side: "SHORT",
  },
  {
    metricId: "gold.cftc.managed_money.spreading.contracts",
    aliases: ["m_money_positions_spread"],
    participant: "MANAGED_MONEY",
    side: "SPREADING",
  },
  {
    metricId: "gold.cftc.other_reportables.long.contracts",
    aliases: ["other_rept_positions_long", "other_rept_positions_long_all"],
    participant: "OTHER_REPORTABLES",
    side: "LONG",
  },
  {
    metricId: "gold.cftc.other_reportables.short.contracts",
    aliases: ["other_rept_positions_short", "other_rept_positions_short_all"],
    participant: "OTHER_REPORTABLES",
    side: "SHORT",
  },
  {
    metricId: "gold.cftc.other_reportables.spreading.contracts",
    aliases: ["other_rept_positions_spread", "other_rept_positions_spread_all"],
    participant: "OTHER_REPORTABLES",
    side: "SPREADING",
  },
  {
    metricId: "gold.cftc.nonreportable.long.contracts",
    aliases: ["nonrept_positions_long_all"],
    participant: "NONREPORTABLE",
    side: "LONG",
  },
  {
    metricId: "gold.cftc.nonreportable.short.contracts",
    aliases: ["nonrept_positions_short_all"],
    participant: "NONREPORTABLE",
    side: "SHORT",
  },
] as const satisfies ReadonlyArray<{
  metricId: string;
  aliases: readonly string[];
  participant: CftcGoldCotParticipant | null;
  side: CftcGoldCotPositionSide;
}>;

export type CftcGoldCotMetricId = typeof SERIES[number]["metricId"];

export type CftcGoldCotObservationInput = {
  metricId: CftcGoldCotMetricId;
  value: number;
  observedAt: string;
  retrievedAt: string;
  reportDate: string;
  datasetId: typeof CFTC_GOLD_COT_DATASET_ID;
  contractMarketCode: typeof CFTC_GOLD_CONTRACT_MARKET_CODE;
  marketName: typeof CFTC_GOLD_MARKET_NAME;
  reportFamily: typeof CFTC_GOLD_COT_REPORT_FAMILY;
  providerResource: typeof CFTC_GOLD_COT_PROVIDER_RESOURCE;
  providerField: string;
  participantCategory: CftcGoldCotParticipant | null;
  positionSide: CftcGoldCotPositionSide;
  unit: "CONTRACTS";
  frequency: "WEEKLY";
  provenance: ObservationProvenance;
  metadata: Record<string, string | number | boolean | null>;
};

export type CftcGoldCotQuery = {
  mode: "FORWARD" | "BACKFILL";
  range?: CftcGoldCotBackfillRange;
  acquisitionMode?: ProviderAcquisitionMode;
};

type Dependencies = {
  fetch?: typeof fetch;
  now?: () => Date;
};

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function cftcGoldCotBackfillRangeError(range: CftcGoldCotBackfillRange): string | null {
  if (!isDateOnly(range.from) || !isDateOnly(range.to) || range.from > range.to) {
    return "CFTC Gold COT BACKFILL requires valid from/to date bounds";
  }
  const inclusiveDays = (Date.parse(`${range.to}T00:00:00.000Z`) - Date.parse(`${range.from}T00:00:00.000Z`)) / DAY_MS + 1;
  return inclusiveDays > CFTC_GOLD_COT_MAX_BACKFILL_CALENDAR_DAYS
    ? `CFTC Gold COT BACKFILL is limited to ${CFTC_GOLD_COT_MAX_BACKFILL_CALENDAR_DAYS} calendar days`
    : null;
}

function reportDate(value: unknown): string {
  if (typeof value !== "string") throw new Error("CFTC malformed payload: report date must be a string");
  const date = value.slice(0, 10);
  if (!isDateOnly(date)) throw new Error("CFTC malformed payload: report date must contain YYYY-MM-DD");
  return date;
}

function targetCode(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("CFTC malformed payload: contract market code is missing");
  }
  return String(value).replaceAll('"', "").trim();
}

function contracts(value: unknown, field: string, report: string): number {
  const numberValue = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value)
      : Number.NaN;
  if (!Number.isSafeInteger(numberValue) || numberValue < 0) {
    throw new Error(`CFTC malformed payload: ${field} must be a non-negative integer for ${report}`);
  }
  return numberValue;
}

function resolveProviderField(
  record: Record<string, unknown>,
  aliases: readonly string[],
  metricId: string,
): { field: string; value: unknown } {
  for (const field of aliases) {
    if (Object.prototype.hasOwnProperty.call(record, field)) {
      return { field, value: record[field] };
    }
  }
  const available = Object.keys(record).sort().join(",");
  throw new Error(
    `CFTC malformed payload: missing required field for ${metricId}; expected ${aliases.join("|")}; available fields: ${available}`,
  );
}

function validateRows(payload: unknown): Array<{ reportDate: string; record: Record<string, unknown> }> {
  if (!Array.isArray(payload)) throw new Error("CFTC malformed payload: expected an array");
  const rows: Array<{ reportDate: string; record: Record<string, unknown> }> = [];
  const dates = new Set<string>();

  for (const candidate of payload) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error("CFTC malformed payload: every row must be an object");
    }
    const record = candidate as Record<string, unknown>;
    const date = reportDate(record.report_date_as_yyyy_mm_dd);
    if (targetCode(record.cftc_contract_market_code) !== CFTC_GOLD_CONTRACT_MARKET_CODE) {
      throw new Error(`CFTC malformed payload: unexpected contract market code for ${date}`);
    }
    if (typeof record.market_and_exchange_names === "string"
      && record.market_and_exchange_names.trim() !== CFTC_GOLD_MARKET_NAME) {
      throw new Error(`CFTC malformed payload: unexpected market name for ${date}`);
    }
    if (typeof record.futonly_or_combined === "string") {
      const reportFamily = record.futonly_or_combined.toLowerCase().replaceAll(/[^a-z]/g, "");
      if (reportFamily !== "futonly" && reportFamily !== "futuresonly") {
        throw new Error(`CFTC malformed payload: row is not Futures Only for ${date}`);
      }
    }
    if (dates.has(date)) throw new Error(`CFTC malformed payload: duplicate report date ${date}`);
    dates.add(date);
    rows.push({ reportDate: date, record });
  }

  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index - 1].reportDate <= rows[index].reportDate) {
      throw new Error("CFTC malformed payload: report dates must be strictly descending");
    }
  }
  return rows;
}

function rowToInputs(
  row: { reportDate: string; record: Record<string, unknown> },
  retrievedAt: string,
): CftcGoldCotObservationInput[] {
  return SERIES.map((series) => {
    const resolved = resolveProviderField(row.record, series.aliases, series.metricId);
    const value = contracts(resolved.value, resolved.field, row.reportDate);
    const observedAt = `${row.reportDate}T00:00:00.000Z`;
    const metadata = {
      metricId: series.metricId,
      provider: "CFTC",
      providerResource: CFTC_GOLD_COT_PROVIDER_RESOURCE,
      datasetId: CFTC_GOLD_COT_DATASET_ID,
      contractMarketCode: CFTC_GOLD_CONTRACT_MARKET_CODE,
      marketName: CFTC_GOLD_MARKET_NAME,
      reportFamily: CFTC_GOLD_COT_REPORT_FAMILY,
      reportDate: row.reportDate,
      providerField: resolved.field,
      participantCategory: series.participant,
      positionSide: series.side,
      unit: "CONTRACTS",
      frequency: "WEEKLY",
    } as const;

    return {
      metricId: series.metricId,
      value,
      observedAt,
      retrievedAt,
      reportDate: row.reportDate,
      datasetId: CFTC_GOLD_COT_DATASET_ID,
      contractMarketCode: CFTC_GOLD_CONTRACT_MARKET_CODE,
      marketName: CFTC_GOLD_MARKET_NAME,
      reportFamily: CFTC_GOLD_COT_REPORT_FAMILY,
      providerResource: CFTC_GOLD_COT_PROVIDER_RESOURCE,
      providerField: resolved.field,
      participantCategory: series.participant,
      positionSide: series.side,
      unit: "CONTRACTS",
      frequency: "WEEKLY",
      provenance: {
        version: "v1",
        providerResource: CFTC_GOLD_COT_PROVIDER_RESOURCE,
        nativeSeriesId: resolved.field,
        nativeInstrumentId: CFTC_GOLD_CONTRACT_MARKET_CODE,
        observationDate: row.reportDate,
      },
      metadata: { ...metadata },
    };
  });
}

function buildUrl(query: CftcGoldCotQuery): string {
  const url = new URL(`${CFTC_PRE_BASE_URL}${CFTC_GOLD_COT_PROVIDER_RESOURCE}`);
  const where = [`cftc_contract_market_code='${CFTC_GOLD_CONTRACT_MARKET_CODE}'`];
  if (query.mode === "BACKFILL" && query.range) {
    where.push(
      `report_date_as_yyyy_mm_dd between '${query.range.from}T00:00:00.000' and '${query.range.to}T23:59:59.999'`,
    );
  }
  url.searchParams.set("$where", where.join(" AND "));
  url.searchParams.set("$order", "report_date_as_yyyy_mm_dd DESC");
  url.searchParams.set("$limit", String(query.mode === "FORWARD" ? CFTC_GOLD_COT_FORWARD_REPORT_LIMIT : 1000));
  return url.toString();
}

export async function fetchCftcGoldCotObservations(
  query: CftcGoldCotQuery,
  dependencies: Dependencies = {},
): Promise<ProviderResult<CftcGoldCotObservationInput>> {
  if (query.mode === "BACKFILL") {
    if (!query.range) {
      return providerResult("cftc", "ERROR", [], "CFTC Gold COT BACKFILL requires explicit from/to date bounds");
    }
    const rangeError = cftcGoldCotBackfillRangeError(query.range);
    if (rangeError) return providerResult("cftc", "ERROR", [], rangeError);
  }

  const fetcher = dependencies.fetch ?? fetch;
  const now = dependencies.now ?? (() => new Date());
  try {
    const response = await fetcher(buildUrl(query), {
      method: "GET",
      headers: { accept: "application/json" },
      ...providerFetchPolicy(query.acquisitionMode ?? "FRESH", 86_400),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`CFTC HTTP ${response.status}`);

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("CFTC invalid JSON response");
    }

    const retrievedAt = now().toISOString();
    const rows = validateRows(payload);
    if (query.mode === "BACKFILL" && query.range) {
      for (const row of rows) {
        if (row.reportDate < query.range.from || row.reportDate > query.range.to) {
          throw new Error(`CFTC malformed payload: report date ${row.reportDate} is outside requested BACKFILL bounds`);
        }
      }
    }
    const data = rows.flatMap((row) => rowToInputs(row, retrievedAt));
    return providerResult(
      "cftc",
      data.length > 0 ? "SUCCESS" : "EMPTY",
      data,
      data.length > 0 ? undefined : "No CFTC Gold COT rows in the qualified response",
      undefined,
      retrievedAt,
    );
  } catch (error) {
    const retrievedAt = now().toISOString();
    return providerResult(
      "cftc",
      "ERROR",
      [],
      error instanceof Error ? error.message : "CFTC request failed",
      undefined,
      retrievedAt,
    );
  }
}
