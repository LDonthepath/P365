/**
 * Provider-independent, already-qualified inputs for canonical record builders.
 * Provider adapters own parsing/field selection and jurisdiction mapping.
 * These structural contracts retain original factual clocks, metadata and lineage.
 * Do not import provider DTOs here: even type-only imports reverse the dependency.
 */
import type { Jurisdiction, ObservationProvenance } from "./types";
import type { MacroCadenceFrequency, MarketFreshnessCalendar } from "./freshness";

export type CanonicalNewsInput = {
  id: string; title: string; summary: string; category: string;
  source: string; publishedAt: string; url: string;
};

export type CalendarCanonicalInput = {
  id: string; event: string; country: string; dateISO: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  status: "UPCOMING" | "TODAY" | "TOMORROW" | "PAST";
  /** Resolved by an upstream calendar-specific adapter. */
  jurisdiction: Jurisdiction;
};

export type CanonicalMarketInput = {
  metricId: string; symbol: string; value: number;
  observedAt: string; retrievedAt: string;
  provenance: ObservationProvenance;
  freshnessCalendar: MarketFreshnessCalendar;
  metadata: Record<string, string | number | boolean | null>;
};

type CanonicalDailyFact = {
  metricId: string; value: number; observedAt: string; retrievedAt: string;
  unit: string; provenance: ObservationProvenance;
  metadata: Record<string, string | number | boolean | null>;
};

export type CanonicalLiquidityInput = CanonicalDailyFact & { pegType: str¶»§q«^