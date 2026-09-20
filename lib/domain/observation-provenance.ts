import type { Observation, ObservationProvenance } from "./types";

export const OBSERVATION_PROVENANCE_VERSION = "v1" as const;

export const OBSERVATION_PROVIDER_RESOURCES = {
  fredObservations: "/fred/series/observations",
  coinGeckoSimplePrice: "/simple/price",
  coinGeckoGlobal: "/global",
  yahooChart: "/v8/finance/chart",
} as const;

function assertNonEmpty(value: string | undefined, field: string): void {
  if (value !== undefined && !value.trim()) {
    throw new Error(`Observation provenance ${field} must be non-empty when supplied.`);
  }
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function assertObservationProvenance(provenance: ObservationProvenance): void {
  if (provenance.version !== OBSERVATION_PROVENANCE_VERSION) {
    throw new Error("Observation provenance version is unsupported.");
  }

  assertNonEmpty(provenance.providerResource, "providerResource");
  assertNonEmpty(provenance.nativeSeriesId, "nativeSeriesId");
  assertNonEmpty(provenance.nativeInstrumentId, "nativeInstrumentId");
  assertNonEmpty(provenance.nativeSymbol, "nativeSymbol");
  assertNonEmpty(provenance.observationDate, "observationDate");
  assertNonEmpty(provenance.vintageDate, "vintageDate");

  const resource = provenance.providerResource;
  if (!resource.startsWith("/") || resource.startsWith("//") || /[?#\s]/.test(resource)) {
    throw new Error("Observation provenance providerResource must be a credential-free path.");
  }
  if (/(api[_-]?key|token|authorization|secret|credential)/i.test(resource)) {
    throw new Error("Observation provenance providerResource must not contain credentials.");
  }
  if (provenance.observationDate !== undefined && !isDateOnly(provenance.observationDate)) {
    throw new Error("Observation provenance observationDate must be YYYY-MM-DD.");
  }
  if (provenance.vintageDate !== undefined && !isDateOnly(provenance.vintageDate)) {
    throw new Error("Observation provenance vintageDate must be YYYY-MM-DD.");
  }
}

function metadataString(observation: Observation, field: string): string | undefined {
  const value = observation.metadata?.[field];
  return typeof value === "string" ? value : undefined;
}

/** Strict validation for new normalized current Observations only. */
export function assertCurrentObservationInvariants(observation: Observation): void {
  if (!observation.sourceId.trim()) throw new Error("Observation sourceId must be non-empty.");
  if (!Number.isFinite(Date.parse(observation.observedAt))) {
    throw new Error("Observation observedAt must be a valid timestamp.");
  }
  if (!Number.isFinite(Date.parse(observation.retrievedAt))) {
    throw new Error("Observation retrievedAt must be a valid timestamp.");
  }
  if (!observation.identity) throw new Error("Current Observation identity is required.");
  if (!observation.provenance) throw new Error("Current Observation provenance is required.");

  assertObservationProvenance(observation.provenance);
  const seriesKey = metadataString(observation, "seriesId") ?? metadataString(observation, "metricId");
  if (!seriesKey?.trim() || observation.identity.seriesKey !== seriesKey) {
    throw new Error("Observation identity.seriesKey must match the canonical metadata series key.");
  }

  const provenance = observation.provenance;
  if (observation.sourceId === "fred") {
    if (
      provenance.providerResource !== OBSERVATION_PROVIDER_RESOURCES.fredObservations
      || provenance.nativeSeriesId !== seriesKey
      || provenance.observationDate !== metadataString(observation, "observationDate")
      || provenance.observationDate !== observation.observedAt.slice(0, 10)
      || provenance.vintageDate !== (metadataString(observation, "vintageDate") ?? undefined)
      || provenance.nativeInstrumentId !== undefined
      || provenance.nativeSymbol !== undefined
    ) {
      throw new Error("FRED Observation provenance is inconsistent with its canonical fact.");
    }
  }

  if (observation.sourceId === "coingecko-market") {
    if (provenance.providerResource === OBSERVATION_PROVIDER_RESOURCES.coinGeckoSimplePrice) {
      if (
        !provenance.nativeInstrumentId
        || provenance.nativeInstrumentId !== metadataString(observation, "providerAssetId")
        || provenance.nativeSeriesId
        || provenance.nativeSymbol
      ) {
        throw new Error("CoinGecko asset provenance requires only a native instrument identity.");
      }
    } else if (provenance.providerResource === OBSERVATION_PROVIDER_RESOURCES.coinGeckoGlobal) {
      if (
        provenance.nativeInstrumentId
        || metadataString(observation, "providerAssetId")
        || provenance.nativeSeriesId
        || provenance.nativeSymbol
      ) {
        throw new Error("CoinGecko global provenance must not fabricate a native instrument identity.");
      }
    } else {
      throw new Error("CoinGecko Observation provenance has an unsupported provider resource.");
    }
  }

  if (observation.sourceId === "yahoo-finance") {
    if (
      provenance.providerResource !== OBSERVATION_PROVIDER_RESOURCES.yahooChart
      || !provenance.nativeSymbol
      || provenance.nativeSeriesId !== undefined
      || provenance.nativeInstrumentId !== undefined
    ) {
      throw new Error("Yahoo Observation provenance requires a chart resource and native symbol.");
    }
    if (provenance.nativeSymbol !== metadataString(observation, "symbol")) {
      throw new Error("Yahoo native symbol must match compatibility metadata.");
    }
  }
}
