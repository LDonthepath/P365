import { OBSERVATION_PROVIDER_RESOURCES } from "../domain/observation-provenance";
import { USD_STABLECOIN_MARKET_CAP_SERIES_KEY } from "../domain/observation-semantics";
import type { ObservationProvenance } from "../domain/types";

/** Canonical provider-qualified DTO and deterministic validation only; live HTTP acquisition retired. */
export const DEFILLAMA_STABLECOIN_RESOURCE = OBSERVATION_PROVIDER_RESOURCES.defiLlamaStablecoinChartsAll;
export const DEFILLAMA_STABLECOIN_PEG_TYPE = "peggedUSD" as const;

export type DefiLlamaStablecoinBackfillRange = {
  from: string;
  to: string;
};

export type DefiLlamaStablecoinObservationInput = {
  metricId: typeof USD_STABLECOIN_MARKET_CAP_SERIES_KEY;
  value: number;
  observedAt: string;
  retrievedAt: string;
  providerResource: typeof DEFILLAMA_STABLECOIN_RESOURCE;
  pegType: typeof DEFILLAMA_STABLECOIN_PEG_TYPE;
  unit: "USD";
  provenance: ObservationProvenance;
  metadata: Record<string, string | number | boolean | null>;
};

export type DefiLlamaStablecoinSelectionOptions = {
  mode: "FORWARD" | "BACKFILL";
  range?: DefiLlamaStablecoinBackfillRange;
};

function dateOnly(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? parsed : null;
}

function observedAtFromUnix(value: unknown): string | null {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || !Number.isInteger(seconds) || seconds < 0) return null;
  const timestamp = seconds * 1000;
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function parseRows(payload: unknown, retrievedAt: string): DefiLlamaStablecoinObservationInput[] {
  if (!Array.isArray(payload)) throw new Error("DefiLlama malformed payload: expected a historical row array");
  const retrievedAtMs = Date.parse(retrievedAt);
  if (!Number.isFinite(retrievedAtMs)) throw new Error("DefiLlama retrieval timestamp is invalid");

  return payload.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error(`DefiLlama malformed payload: row ${index} is not an object`);
    }
    const row = candidate as Record<string, unknown>;
    const observedAt = observedAtFromUnix(row.date);
    if (!observedAt || Date.parse(observedAt) > retrievedAtMs) {
      throw new Error(`DefiLlama malformed payload: row ${index} has an invalid or future date`);
    }
    const totalCirculatingUSD = row.totalCirculatingUSD;
    if (!totalCirculatingUSD || typeof totalCirculatingUSD !== "object" || Array.isArray(totalCirculatingUSD)) {
      throw new Error(`DefiLlama malformed payload: row ${index} lacks totalCirculatingUSD`);
    }
    const peggedUSD = (totalCirculatingUSD as Record<string, unknown>).peggedUSD;
    if (typeof peggedUSD !== "number" || !Number.isFinite(peggedUSD)) {
      throw new Error(`DefiLlama malformed payload: row ${index} lacks a finite peggedUSD value`);
    }

    const providerEffectiveDate = observedAt.slice(0, 10);
    return {
      metricId: USD_STABLECOIN_MARKET_CAP_SERIES_KEY,
      value: peggedUSD,
      observedAt,
      retrievedAt,
      providerResource: DEFILLAMA_STABLECOIN_RESOURCE,
      pegType: DEFILLAMA_STABLECOIN_PEG_TYPE,
      unit: "USD",
      provenance: {
        version: "v1",
        providerResource: DEFILLAMA_STABLECOIN_RESOURCE,
        observationDate: providerEffectiveDate,
      },
      metadata: {
        metricId: USD_STABLECOIN_MARKET_CAP_SERIES_KEY,
        unit: "USD",
        pegType: DEFILLAMA_STABLECOIN_PEG_TYPE,
        providerResource: DEFILLAMA_STABLECOIN_RESOURCE,
        providerEffectiveDate,
        providerEffectiveTimestamp: observedAt,
        frequency: "DAILY",
      },
    };
  });
}

function selectRows(
  rows: DefiLlamaStablecoinObservationInput[],
  options: DefiLlamaStablecoinSelectionOptions,
): DefiLlamaStablecoinObservationInput[] {
  if (options.mode === "FORWARD") {
    return rows.length === 0
      ? []
      : [rows.reduce((latest, row) => row.observedAt > latest.observedAt ? row : latest)];
  }

  if (!options.range) throw new Error("DefiLlama BACKFILL requires an explicit range");
  const from = dateOnly(options.range.from);
  const to = dateOnly(options.range.to);
  if (from === null || to === null || from > to) {
    throw new Error("DefiLlama BACKFILL requires valid from/to date bounds");
  }
  return rows
    .filter((row) => {
      const effectiveDate = row.observedAt.slice(0, 10);
      return effectiveDate >= options.range!.from && effectiveDate <= options.range!.to;
    })
    .sort((left, right) => left.observedAt.localeCompare(right.observedAt));
}

/**
 * Qualifies an already-acquired DefiLlama payload without network access.
 * Preserves exact historical peggedUSD validation, provenance, and FORWARD/BACKFILL selection.
 */
export function qualifyDefiLlamaStablecoinRows(
  payload: unknown,
  retrievedAt: string,
  options: DefiLlamaStablecoinSelectionOptions,
): DefiLlamaStablecoinObservationInput[] {
  return selectRows(parseRows(payload, retrievedAt), options);
}
