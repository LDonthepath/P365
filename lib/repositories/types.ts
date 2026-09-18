import type { EconomicEventResult } from "../domain/event-result";
import type { Context, Event, Evidence, Observation, ObservationDomain } from "../domain/types";

export type ObservationHistoryOrder = "ASC" | "DESC";

/**
 * Stable semantic identity for an Observation history query. The query does
 * not use canonical object IDs because IDs may vary across measurements or
 * source corrections.
 */
export type ObservationHistoryIdentity = {
  domain: ObservationDomain;
  subject: string;
  sourceId: string;
  /** Required when the provider exposes a canonical series identifier. */
  seriesId?: string;
};

/**
 * Historical Observation query contract.
 *
 * Time bounds are inclusive and apply to Observation.observedAt (the
 * canonical effective time), never retrievedAt or Market Memory captured_at.
 * Results must use observedAt as the primary sort key, retrievedAt as the
 * correction/version tie-breaker, and id as the final deterministic
 * tie-breaker. Invalid timestamps or limits must be rejected explicitly.
 */
export type ObservationHistoryQuery = {
  identity: ObservationHistoryIdentity;
  observedAtOnOrAfter?: string;
  observedAtOnOrBefore?: string;
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
