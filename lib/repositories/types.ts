import type { EconomicEventResult } from "../domain/event-result";
import type { Context, Event, Evidence, Observation, ObservationDomain } from "../domain/types";

export type ObservationHistoryOrder = "ASC" | "DESC";

/**
 * Provider-independent logical identity for an Observation series.
 * `seriesKey` reuses the machine semantic key retained by normalization:
 * metadata.seriesId for current FRED observations or metadata.metricId for
 * current market observations. Providers that represent the same logical
 * series must normalize to the same key. Descriptive subjects, source IDs,
 * and per-measurement canonical IDs are not semantic-series identity.
 */
export type ObservationHistoryIdentity = {
  domain: ObservationDomain;
  seriesKey: string;
};

/**
 * Historical Observation query contract.
 *
 * Effective-time bounds are inclusive and apply to Observation.observedAt.
 * `retrievedAtOnOrBefore` is an inclusive availability/as-of cutoff: records
 * retrieved later must not appear in an earlier point-in-time view.
 *
 * This canonical contract uses Observation.retrievedAt (when P365 obtained
 * the provider record). Durable Market Memory captured_at is a later storage
 * write timestamp and remains an adapter concern. The durable adapter uses
 * canonical retrievedAt for this cutoff and never substitutes captured_at.
 *
 * Results use observedAt as the primary sort key, retrievedAt as the revision
 * tie-breaker, and id as the final deterministic tie-breaker. Invalid
 * timestamps or limits must be rejected explicitly.
 */
export type ObservationHistoryQuery = {
  identity: ObservationHistoryIdentity;
  /** Optional provenance qualification; never part of logical-series identity. */
  sourceId?: string;
  observedAtOnOrAfter?: string;
  observedAtOnOrBefore?: string;
  retrievedAtOnOrBefore?: string;
  order: ObservationHistoryOrder;
  /** Positive integer capped at 500 records per query. */
  limit: number;
};

export interface ObservationRepository { save(observation: Observation): Promise<void>; saveMany(observations: Observation[]): Promise<void>; findById(id: string): Promise<Observation | null>; }
/** Historical read capability is implemented by the durable adapter and stays separate from canonical write persistence. */
export interface HistoricalObservationRepository { findHistory(query: ObservationHistoryQuery): Promise<Observation[]>; }
export interface EventRepository { save(event: Event): Promise<void>; saveMany(events: Event[]): Promise<void>; findById(id: string): Promise<Event | null>; }
export interface EvidenceRepository { save(evidence: Evidence): Promise<void>; saveMany(evidence: Evidence[]): Promise<void>; findById(id: string): Promise<Evidence | null>; }
export interface ContextRepository { save(context: Context): Promise<void>; saveMany(contexts: Context[]): Promise<void>; findById(id: string): Promise<Context | null>; }
export interface EconomicEventResultRepository { save(result: EconomicEventResult): Promise<void>; saveMany(results: EconomicEventResult[]): Promise<void>; findById(id: string): Promise<EconomicEventResult | null>; }
