import type { Context, Event, Evidence, Observation } from "../domain/types";
import { supabaseCanonicalRepositories, supabaseHistoricalObservationRepository } from "../data/market-memory-store";
import { supabaseEconomicEventResultRepository } from "../data/economic-event-result-repository";
import { supabaseHistoricalEconomicEventResultRepository } from "../data/supabase-event-result-history";
import { InMemoryContextRepository, InMemoryEventRepository, InMemoryEvidenceRepository, InMemoryObservationRepository } from "./memory";
import type { ContextRepository, EconomicEventResultRepository, EventRepository, EvidenceRepository, HistoricalEconomicEventResultRepository, HistoricalObservationRepository, ObservationRepository } from "./types";

export type CanonicalRepositories = {
  observations: ObservationRepository;
  events: EventRepository;
  evidence: EvidenceRepository;
  contexts: ContextRepository;
};

/** Durable canonical persistence. Set P365_MEMORY_PERSISTENCE=memory only for local development. */
export const canonicalRepositories: CanonicalRepositories =
  process.env.P365_MEMORY_PERSISTENCE === "memory"
    ? {
        observations: new InMemoryObservationRepository(),
        events: new InMemoryEventRepository(),
        evidence: new InMemoryEvidenceRepository(),
        contexts: new InMemoryContextRepository(),
      }
    : supabaseCanonicalRepositories;

export const historicalObservationRepository: HistoricalObservationRepository =
  process.env.P365_MEMORY_PERSISTENCE === "memory"
    ? canonicalRepositories.observations as InMemoryObservationRepository
    : supabaseHistoricalObservationRepository;

export const economicEventResultRepository: EconomicEventResultRepository = supabaseEconomicEventResultRepository;
export const historicalEconomicEventResultRepository: HistoricalEconomicEventResultRepository = supabaseHistoricalEconomicEventResultRepository;

export async function persistCanonicalDashboardData(
  repositories: CanonicalRepositories,
  data: { observations: Observation[]; events: Event[]; evidence: Evidence[]; contexts: Context[] },
): Promise<void> {
  await Promise.all([
    repositories.observations.saveMany(data.observations),
    repositories.events.saveMany(data.events),
    repositories.evidence.saveMany(data.evidence),
    repositories.contexts.saveMany(data.contexts),
  ]);
}
