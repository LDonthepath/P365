import type { Context, ContextScope, Event, Observation } from "./types";
import { assertContextHasEvidence } from "./contracts";

const MACRO_GROUPS: Array<{
  scope: ContextScope;
  id: string;
  label: string;
  seriesIds: string[];
}> = [
  { scope: "MACRO_MONETARY_POLICY", id: "macro-monetary-policy", label: "monetary policy", seriesIds: ["FEDFUNDS", "EFFR", "WALCL", "WRESBAL"] },
  { scope: "MACRO_LIQUIDITY", id: "macro-liquidity", label: "liquidity", seriesIds: ["M2SL", "WTREGEN", "RRPONTSYD"] },
  { scope: "MACRO_INFLATION", id: "macro-inflation", label: "inflation", seriesIds: ["CPIAUCSL", "CPILFESL", "PCEPI", "PCEPILFE"] },
  { scope: "MACRO_LABOR", id: "macro-labor", label: "labor", seriesIds: ["UNRATE", "PAYEMS", "ICSA"] },
  { scope: "MACRO_RATES", id: "macro-rates", label: "rates", seriesIds: ["DGS2", "DGS10", "DFII10"] },
  { scope: "MACRO_USD", id: "macro-usd", label: "USD", seriesIds: ["DTWEXBGS"] },
  { scope: "MACRO_GROWTH", id: "macro-growth", label: "growth", seriesIds: ["GDPC1"] },
];

export function buildContext(input: {
  id: string;
  scope: ContextScope;
  statement: string;
  observations: Observation[];
  events: Event[];
  createdAt?: string;
}): Context {
  const context = {
    id: input.id,
    scope: input.scope,
    statement: input.statement,
    observationIds: input.observations.map((item) => item.id),
    eventIds: input.events.map((item) => item.id),
    createdAt: input.createdAt ?? new Date().toISOString(),
  } satisfies Context;

  return assertContextHasEvidence(context);
}

export function contextHasEvidence(context: Context): boolean {
  return context.observationIds.length > 0 || context.eventIds.length > 0;
}

/**
 * Groups canonical facts into explicit, neutral contexts.
 * No direction, regime, sentiment, liquidity-flow, capital-flow, or risk
 * inference is performed here.
 */
export function buildDashboardContexts(input: {
  observations: Observation[];
  events: Event[];
  createdAt?: string;
}): Context[] {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const contexts: Context[] = [];
  const cryptoObservations = input.observations.filter((item) => item.domain === "ASSET");

  const cryptoByAsset = new Map<string, Observation[]>();
  for (const observation of cryptoObservations) {
    const symbol = typeof observation.metadata?.symbol === "string"
      ? observation.metadata.symbol
      : observation.subject.split("/")[0];
    if (!symbol) continue;
    const group = cryptoByAsset.get(symbol) ?? [];
    group.push(observation);
    cryptoByAsset.set(symbol, group);
  }

  for (const [symbol, observations] of cryptoByAsset.entries()) {
    contexts.push(buildContext({
      id: `context-crypto-${symbol.toLowerCase()}`,
      scope: "CRYPTO_MARKET",
      statement: `${symbol}/USD market observations grouped as part of the Crypto Market context.`,
      observations,
      events: [],
      createdAt,
    }));
  }

  const macroObservations = input.observations.filter((item) => item.domain === "MACRO");
  for (const group of MACRO_GROUPS) {
    const observations = macroObservations.filter((item) => {
      const seriesId = item.metadata?.seriesId;
      return typeof seriesId === "string" && group.seriesIds.includes(seriesId);
    });
    if (observations.length === 0) continue;

    contexts.push(buildContext({
      id: `context-${group.id}`,
      scope: group.scope,
      statement: `Macro observations grouped for ${group.label} monitoring.`,
      observations,
      events: [],
      createdAt,
    }));
  }

  if (input.events.length > 0) {
    contexts.push(buildContext({
      id: "context-economic-events",
      scope: "ECONOMIC_EVENTS",
      statement: "Scheduled economic events grouped for temporal monitoring.",
      observations: [],
      events: input.events,
      createdAt,
    }));
  }

  return contexts;
}
