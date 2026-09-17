import type { Event } from "./types";

export type EventExpectedType =
  | "FORECAST"
  | "CONSENSUS"
  | "OFFICIAL_PROJECTION";

/**
 * Canonical released result and expectation data attached to an economic Event.
 *
 * Event describes the event lifecycle (what/when/status). EventResult carries
 * numeric outcome/baseline fields without assuming that every expectation is
 * a market consensus. Provider-specific payloads stay outside this contract.
 */
export type EconomicEventResult = {
  eventId: Event["id"];
  actual?: number;
  expected?: number;
  expectedType?: EventExpectedType;
  previous?: number;
  revisedPrevious?: number;
  revision?: number;
  unit?: string;
  period?: string;
  releasedAt?: string;
  sourceId: string;
  evidenceId: string;
};

export function assertEconomicEventResult(result: EconomicEventResult): EconomicEventResult {
  if (!result.eventId) throw new Error("Economic event result requires eventId.");
  if (!result.sourceId) throw new Error("Economic event result requires sourceId.");
  if (!result.evidenceId) throw new Error("Economic event result requires evidenceId.");

  if (result.expected === undefined && result.expectedType !== undefined) {
    throw new Error("Economic event result cannot declare expectedType without expected.");
  }

  if (result.expected !== undefined && result.expectedType === undefined) {
    throw new Error("Economic event result requires expectedType when expected is present.");
  }

  for (const [field, value] of [
    ["actual", result.actual],
    ["expected", result.expected],
    ["previous", result.previous],
    ["revisedPrevious", result.revisedPrevious],
    ["revision", result.revision],
  ] as const) {
    if (value !== undefined && !Number.isFinite(value)) {
      throw new Error(`Economic event result ${field} must be finite when provided.`);
    }
  }

  return result;
}
