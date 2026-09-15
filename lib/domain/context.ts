import type { Context, Event, Observation } from "./types";
import { assertContextHasEvidence } from "./contracts";

export function buildContext(input: {
  id: string;
  statement: string;
  observations: Observation[];
  events: Event[];
  createdAt?: string;
}): Context {
  const context = {
    id: input.id,
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
 * Groups existing canonical facts into neutral, traceable dashboard contexts.
 * This layer deliberately does not infer market direction, regime, sentiment,
 * liquidity, or risk. It only establishes which facts belong together.
 */
export function buildDashboardContexts(input: {
  observations: Observation[];
  events: Event[];
  createdAt?: string;
}): Context[] {
  const contexts: Context[] = [];
  const createdAt = input.createdAt ?? new Date().toISOString();

  const btcObservations = input.observations.filter((item) => item.subject === "BTC/USD spot rate");
  if (btcObservations.length > 0) {
    contexts.push(buildContext({
      id: "context-btc-market",
      statement: "BTC/USD market observations grouped by asset and source time.",
      observations: btcObservations,
      events: [],
      createdAt,
    }));
  }

  const ethObservations = input.observations.filter((item) => item.subject === "ETH/USD spot rate");
  if (ethObservations.length > 0) {
    contexts.push(buildContext({
      id: "context-eth-market",
      statement: "ETH/USD market observations grouped by asset and source time.",
      observations: ethObservations,
      events: [],
      createdAt,
    }));
  }

  if (input.observations.some((item) => item.domain === "MACRO")) {
    contexts.push(buildContext({
      id: "context-macro-observations",
      statement: "Macro observations grouped as a common monitoring context.",
      observations: input.observations.filter((item) => item.domain === "MACRO"),
      events: [],
      createdAt,
    }));
  }

  if (input.events.length > 0) {
    contexts.push(buildContext({
      id: "context-economic-events",
      statement: "Scheduled economic events grouped for temporal monitoring.",
      observations: [],
      events: input.events,
      createdAt,
    }));
  }

  return contexts;
}
