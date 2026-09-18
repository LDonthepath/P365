import type { EconomicEventResult } from "../domain/event-result";
import type { Context, Event, Evidence, Observation, ObservationDomain } from "../domain/types";

export type ObservationHistoryOrder = "ASC" | "DESC";

/**
 * Stable semantic identity for an Observation series. `seriesKey` is the
 * source-native machine identity already retained by canonical normalization:
 * metadata.seriesId for FRED or metadata.metricId for CoinGecko/Yahoo.
 * Descriptive subjects and per-measurement canonical IDs are not identities.
 */
export type ObservationHistoryIdentity = {
  domain: ObservationDomain;
  sourceId: string;
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
 * write timestamp and remains an adapter concern. Until that adapter exists,
 * this contract does not claim durable point-in-time reconstruction.
 *
 * Results use observedAt as the primary sort key, retrievedAt as the revision
 * tie-breaker, and id as the final deterministic tie-breaker. Invalid
 * timestamps or limits must be rejected explicitly.
 */
export type ObservationHistoryQuery = {
  identity: ObservationHistoryIdentity;
  observedAtOnOrAfter?: string;
  observedAtOnOrBefore?: string;
  retrievedAtOnOrBefore?: string;
  order: ObservationHistoryOrder;
  /** Positive integer capped at 500 records per query. */
  limit: number;
};

export interface ObservationRepository { save(observation: Observation): Promise<void>; saveMany(observations: Observation[]): Promise<void>; findById(id: string): Promise<Observation | null>; }
/** Read capability kept separate until the durable adapter is implemented. */
export interface HistoricalObservationRepository { findHistory(query: ObservationHistoryQuery): Promise<Observation[]>; }
export interface EventRepository { save(event: Event): Promise<void>; saveMany(events: Event[]): Promise<void>; findById(id: string): Promise<Event | null>; }
export interface EvidenceRepository { save(evidence: Evidence): Promise<void>; saveMany(evidence: Evidence[]): Promise<void>; findById(id: string): Promise<Evidence | null>; }
export interface ContextRepository { save(context: Context): Promise<void>; saveMany(contexts: Context[]): Promise<void>; findById(id: string): Promise<Context | null>; }
export interface EconomicEventResultRepository { save(result: EconomicEventResult): Promise<void>; saveMany(results: EconomicEventResult[]): Promise<void>; findById(id: string): Promise<EconomicEventResult | null>; }
