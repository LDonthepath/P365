import { supabaseCanonicalRepositories, supabaseHistoricalObservationRepository, supabaseMarketSnapshotRepository } from "../data/market-memory-store";
import { supabaseEconomicEventResultRepository } from "../data/economic-event-result-repository";
import { supabaseHistoricalEconomicEventResultRepository } from "../data/supabase-event-result-history";
import { supabaseHistoricalEventRepository } from "../data/supabase-event-history";
import { supabaseHistoricalMarketSnapshotRepository } from "../data/supabase-snapshot-history";
import { InMemoryContextRepository, InMemoryEventRepository, InMemoryEvidenceRepository, InMemoryHistoricalEventRepository, InMemoryMarketSnapshotRepository, InMemoryObservationRepository } from "./memory";
import type { ContextRepository, EconomicEventResultRepository, EventRepository, EvidenceRepository, HistoricalEconomicEventResultRepository, HistoricalEventRepository, HistoricalMarketSnapshotRepository, HistoricalObservationRepository, MarketSnapshotRepository, ObservationRepository } from "./types";

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

const inMemoryHistoricalEventRepository =
  process.env.P365_MEMORY_PERSISTENCE === "memory"
    ? new InMemoryHistoricalEventRepository(canonicalRepositories.events as InMemoryEventRepository)
    : null;

export const historicalEventRepository: HistoricalEventRepository =
  inMemoryHistoricalEventRepository ?? supabaseHistoricalEventRepository;

export const economicEventResultRepository: EconomicEventResultRepository = supabaseEconomicEventResultRepository;
export const historicalEconomicEventResultRepository: HistoricalEconomicEventResultRepository = supabaseHistoricalEconomicEventResultRepository;

const inMemorySnapshotRepository = new InMemoryMarketSnapshotRepository();

export const marketSnapshotRepository: MarketSnapshotRepository =
  process.env.P365_MEMORY_PERSISTENCE === "memory"
    ? inMemorySnapshotRepository
    : supabaseMarketSnapshotRepository;

export const historicalMarketSnapshotRepository: HistoricalMarketSnapshotRepository =
  process.env.P365_MEMORY_PERSISTENCE === "memory"
    ? inMemorySnapshotRepository
    : supabaseHistoricalMarketSnapshotRepository;
