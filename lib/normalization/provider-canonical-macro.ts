/* Retained macro-provider DTO adapters. No market-provider DTO dependency. */
import type { MacroObservationInput } from "../data/fred";
import type { FederalReserveSepObservationInput } from "../data/federal-reserve-sep";
import type { CanonicalMacroInput, CanonicalSepInput } from "../domain/normalization-inputs";
import {
  federalReserveSepToCanonicalRecords as buildSepRecords,
  macroToCanonicalRecords as buildMacroRecords,
} from "../domain/normalize";

export { P365_SOURCES } from "../domain/normalize";

export function federalReserveSepToCanonicalRecords(items: FederalReserveSepObservationInput[]) {
  const qualified: CanonicalSepInput[] = items.map(({ metricId, value, observedAt, retrievedAt, unit, factType, releaseDate, provenance, metadata }) =>
    ({ metricId, value, observedAt, retrievedAt, unit, factType, releaseDate, provenance, metadata }));
  return buildSepRecords(qualified);
}

export function macroToCanonicalRecords(items: MacroObservationInput[], sourceId: string) {
  const qualified: CanonicalMacroInput[] = items.map(({ series, value, observationDate, previousValue, vintageDate, releasedAt, retrievedAt, provenance }) =>
    ({ series: {
      seriesId: series.seriesId, subject: series.subject, frequency: series.frequency,
      unit: series.unit, source: series.source, domain: series.domain, freshnessMs: series.freshnessMs,
    }, value, observationDate, previousValue, vintageDate, releasedAt, retrievedAt, provenance }));
  return buildMacroRecords(qualified, sourceId);
}
