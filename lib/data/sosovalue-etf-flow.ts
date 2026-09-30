import "server-only";

import type { ObservationProvenance } from "../domain/types";
import { OBSERVATION_PROVIDER_RESOURCES } from "../domain/observation-provenance";
import { providerFetchPolicy, type ProviderAcquisitionMode } from "./provider-fetch-policy";
import { providerResult, type ProviderResult } from "./types";

export const SOSOVALUE_BASE_URL = "https://openapi.sosovalue.com/openapi/v1" as const;
export const SOSOVALUE_ETF_FLOW_PROVIDER_RESOURCE = OBSERVATION_PROVIDER_RESOURCES.soSoValueEtfSummaryHistory;
export const SOSOVALUE_ETF_FLOW_SOURCE_ID = "sosovalue-etf-flow" as const;
export const SOSOVALUE_ETF_FLOW_MATURITY_POLICY = "SOSOVALUE_ETF_FLOW_MATURITY_V0_1" as const;
export const SOSOVALUE_ETF_FLOW_COMPLETION_BASIS = "P365_PROVIDER_DATE_ADVANCEMENT" as const;
export const SOSOVALUE_ETF_FLOW_MATURITY_STATUS = "MATURED_ELIGIBLE_UNDER_P365_POLICY" as const;
export const SOSOVALUE_MAX_BACKFILL_CALENDAR_DAYS = 28;
export const SOSOVALUE_HISTORY_LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SoSoValueBtcEtfFlowBackfillRange = { from: string; to: string };

export function soSoValueBackfillRangeError(range: SoSoValueBtcEtfFlowBackfillRange): string | null {
  if (!isDateOnly(range.from) || !isDateOnly(range.to) || range.from > range.to) {
    return "SoSoValue BACKFILL requires valid from/to date bounds";
  }
  const inclusiveDays = (Date.parse(`${range.to}T00:00:00.000Z`) - Date.parse(`${range.from}T00:00:00.000Z`)) / DAY_MS + 1;
  return inclusiveDays > SOSOVALUE_MAX_BACKFILL_CALENDAR_DAYS
    ? `SoSoValue BACKFILL is limited to ${SOSOVALUE_MAX_BACKFILL_CALENDAR_DAYS} calendar days`
    : null;
}

export type SoSoValueBtcEtfFlowObservationInput = {
  metricId: "crypto.us_spot_btc_etf_net_flow.usd";
  value: number;
  observedAt: string;
  retrievedAt: string;
  providerTradingDate: string;
  providerResource: typeof SOSOVALUE_ETF_FLOW_PROVIDER_RESOURCE;
  providerSymbol: "BTC";
  countryCode: "US";
  aggregateField: "total_net_inflow";
  unit: "USD";
  maturityPolicy: typeof SOSOVALUE_ETF_FLOW_MATURITY_POLICY;
  completionBasis: typeof SOSOVALUE_ETF_FLOW_COMPLETION_BASIS;
  maturityStatus: typeof SOSOVALUE_ETF_FLOW_MATURITY_STATUS;
  provenance: ObservationProvenance;
  metadata: Record<string, string | number | boolean | null>;
};

export type SoSoValueBtcEtfFlowQuery = {
  mode: "FORWARD" | "BACKFILL";
  range?: SoSoValueBtcEtfFlowBackfillRange;
  acquisitionMode?: ProviderAcquisitionMode;
};

type Dependencies = {
  fetch?: typeof fetch;
  now?: () => Date;
  apiKey?: () => string | undefined;
};

type ValidRow = { date: string; totalNetInflow: number };

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function responseRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("SoSoValue malformed payload: expected a documented row array or success envelope");
  }
  const record = payload as Record<string, unknown>;
  const documentedEnvelopeKeys = new Set(["code", "message", "data", "details"]);
  const unsupportedEnvelopeKeys = Object.keys(record)
    .filter((key) => !documentedEnvelopeKeys.has(key))
    .sort();
  if (unsupportedEnvelopeKeys.length > 0) {
    throw new Error(
      `SoSoValue malformed payload: success envelope contains unsupported fields: ${unsupportedEnvelopeKeys.join(",")}`,
    );
  }
  if (record.code !== 0) {
    throw new Error("SoSoValue malformed payload: provider envelope code must be 0");
  }
  if (!Array.isArray(record.data)) {
    throw new Error("SoSoValue malformed payload: success envelope data must be an array");
  }
  return record.data;
}

function validateRows(payload: unknown, retrievedAt: string): ValidRow[] {
  const rows = responseRows(payload);
  const retrievalUtcDate = retrievedAt.slice(0, 10);
  const validated: ValidRow[] = [];
  const dates = new Set<string>();
  for (const candidate of rows) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error("SoSoValue malformed payload: every history row must be an object");
    }
    const row = candidate as Record<string, unknown>;
    if (!isDateOnly(row.date)) {
      throw new Error("SoSoValue malformed payload: date must be YYYY-MM-DD");
    }
    if (row.date > retrievalUtcDate) {
      throw new Error(`SoSoValue malformed payload: trading date ${row.date} is later than the UTC retrieval date`);
    }
    if (dates.has(row.date)) {
      throw new Error(`SoSoValue malformed payload: duplicate trading date ${row.date}`);
    }
    if (typeof row.total_net_inflow !== "number" || !Number.isFinite(row.total_net_inflow)) {
      throw new Error(`SoSoValue malformed payload: total_net_inflow must be a finite number for ${row.date}`);
    }
    dates.add(row.date);
    validated.push({ date: row.date, totalNetInflow: row.total_net_inflow });
  }
  for (let index = 1; index < validated.length; index += 1) {
    if (validated[index - 1].date <= validated[index].date) {
      throw new Error("SoSoValue malformed payload: trading dates must be strictly descending");
    }
  }
  return validated;
}

function inputFromRow(row: ValidRow, retrievedAt: string): SoSoValueBtcEtfFlowObservationInput {
  const observedAt = `${row.date}T00:00:00.000Z`;
  const metadata = {
    metricId: "crypto.us_spot_btc_etf_net_flow.usd",
    provider: "SoSoValue",
    providerResource: SOSOVALUE_ETF_FLOW_PROVIDER_RESOURCE,
    providerTradingDate: row.date,
    providerSymbol: "BTC",
    countryCode: "US",
    aggregateField: "total_net_inflow",
    unit: "USD",
    maturityPolicy: SOSOVALUE_ETF_FLOW_MATURITY_POLICY,
    completionBasis: SOSOVALUE_ETF_FLOW_COMPLETION_BASIS,
    maturityStatus: SOSOVALUE_ETF_FLOW_MATURITY_STATUS,
    frequency: "DAILY",
  } as const;
  return {
    metricId: "crypto.us_spot_btc_etf_net_flow.usd",
    value: row.totalNetInflow,
    observedAt,
    retrievedAt,
    providerTradingDate: row.date,
    providerResource: SOSOVALUE_ETF_FLOW_PROVIDER_RESOURCE,
    providerSymbol: "BTC",
    countryCode: "US",
    aggregateField: "total_net_inflow",
    unit: "USD",
    maturityPolicy: SOSOVALUE_ETF_FLOW_MATURITY_POLICY,
    completionBasis: SOSOVALUE_ETF_FLOW_COMPLETION_BASIS,
    maturityStatus: SOSOVALUE_ETF_FLOW_MATURITY_STATUS,
    provenance: {
      version: "v1",
      providerResource: SOSOVALUE_ETF_FLOW_PROVIDER_RESOURCE,
      nativeSymbol: "BTC",
      observationDate: row.date,
    },
    metadata: { ...metadata },
  };
}

function credentialSafeMessage(error: unknown, apiKey: string): string {
  const message = error instanceof Error ? error.message : "SoSoValue request failed";
  return apiKey ? message.split(apiKey).join("[REDACTED]") : message;
}

function selectBackfillRows(
  rows: ValidRow[],
  range: SoSoValueBtcEtfFlowBackfillRange | undefined,
): ValidRow[] {
  if (!range) throw new Error("SoSoValue BACKFILL requires explicit from/to date bounds");
  if (rows.length === 0) throw new Error("SoSoValue BACKFILL cannot prove provider coverage from an empty response");
  const newest = rows[0].date;
  const oldest = rows.at(-1)?.date ?? newest;
  if (range.to >= newest) {
    throw new Error("SoSoValue BACKFILL requested to must be strictly earlier than the newest provider trading date");
  }
  if (range.from < oldest) {
    throw new Error("SoSoValue BACKFILL requested history exceeds provider-returned coverage");
  }
  return rows.slice(1).filter((row) => row.date >= range.from && row.date <= range.to);
}

/**
 * Acquires one bounded history response. The provider's newest valid trading
 * date is always a provisional maturity witness and is never returned as a
 * canonical candidate.
 */
export async function fetchSoSoValueBtcEtfFlowObservations(
  query: SoSoValueBtcEtfFlowQuery,
  dependencies: Dependencies = {},
): Promise<ProviderResult<SoSoValueBtcEtfFlowObservationInput>> {
  if (query.mode === "BACKFILL") {
    if (!query.range) return providerResult("sosovalue", "ERROR", [], "SoSoValue BACKFILL requires explicit from/to date bounds");
    const rangeError = soSoValueBackfillRangeError(query.range);
    if (rangeError) return providerResult("sosovalue", "ERROR", [], rangeError);
  }
  const apiKey = (dependencies.apiKey ?? (() => process.env.SOSOVALUE_API_KEY))();
  if (!apiKey) {
    return providerResult("sosovalue", "UNAVAILABLE", [], "SOSOVALUE_API_KEY is not configured");
  }
  const fetcher = dependencies.fetch ?? fetch;
  const now = dependencies.now ?? (() => new Date());
  const url = new URL(`${SOSOVALUE_BASE_URL}${SOSOVALUE_ETF_FLOW_PROVIDER_RESOURCE}`);
  url.searchParams.set("symbol", "BTC");
  url.searchParams.set("country_code", "US");
  url.searchParams.set("limit", String(SOSOVALUE_HISTORY_LIMIT));

  try {
    const response = await fetcher(url.toString(), {
      method: "GET",
      headers: { accept: "application/json", "x-soso-api-key": apiKey },
      ...providerFetchPolicy(query.acquisitionMode ?? "FRESH", 300),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`SoSoValue HTTP ${response.status}`);
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("SoSoValue invalid JSON response");
    }
    const retrievedAt = now().toISOString();
    const rows = validateRows(payload, retrievedAt);
    const selected = query.mode === "BACKFILL"
      ? selectBackfillRows(rows, query.range)
      : rows.slice(1);
    const data = selected.map((row) => inputFromRow(row, retrievedAt));
    return providerResult(
      "sosovalue",
      data.length > 0 ? "SUCCESS" : "EMPTY",
      data,
      data.length > 0 ? undefined : "No maturity-eligible SoSoValue rows in the qualified response",
      undefined,
      retrievedAt,
    );
  } catch (error) {
    const retrievedAt = now().toISOString();
    const message = credentialSafeMessage(error, apiKey);
    return providerResult("sosovalue", "ERROR", [], message, undefined, retrievedAt);
  }
}
