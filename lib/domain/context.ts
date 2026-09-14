import type { Context, Event, Observation } from "./types";

export function buildContext(input: {
  id: string;
  statement: string;
  observations: Observation[];
  events: Event[];
  createdAt?: string;
}): Context {
  return {
    id: input.id,
    statement: input.statement,
    observationIds: input.observations.map((item) => item.id),
    eventIds: input.events.map((item) => item.id),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function contextHasEvidence(context: Context): boolean {
  return context.observationIds.length > 0 || context.eventIds.length > 0;
}
