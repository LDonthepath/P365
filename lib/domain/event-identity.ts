import type { Event, EventIdentity, Jurisdiction } from "./types";

const RECONCILIABLE_JURISDICTIONS = new Set<Jurisdiction>(["US", "CHINA", "JAPAN"]);

function normalizedSubject(subject: string): string {
  return subject
    .trim()
    .toLowerCase()
    .replace(/\by\s*\/\s*y\b/g, " yoy ")
    .replace(/\bm\s*\/\s*m\b/g, " mom ")
    .replace(/\bq\s*\/\s*q\b/g, " qoq ")
    .replace(/&/g, " and ")
    .replace(/\bspeaks\b/g, "speech")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Provider-neutral semantic key with deliberately narrow aliases.
 *
 * This is not fuzzy matching. Unknown subjects keep their normalized literal
 * identity so nearby releases at the same timestamp cannot silently collapse.
 */
export function eventSemanticKey(subject: string): string | null {
  const normalized = normalizedSubject(subject);
  if (!normalized) return null;

  if (
    normalized === "crude oil inventories"
    || normalized === "eia crude oil stocks change"
  ) {
    return "eia-crude-oil-stocks-change";
  }

  if (
    normalized === "nonfarm payrolls"
    || normalized === "non farm payrolls"
    || normalized === "nonfarm employment change"
    || normalized === "non farm employment change"
  ) {
    return "nonfarm-payrolls";
  }

  // Role wording differs across providers; exact timestamp + jurisdiction still
  // gate reconciliation, and only a Fed/FOMC speech enters this alias.
  const fedSpeaker = normalized.match(
    /^(?:fed|federal reserve|fomc)\b.*\b([a-z][a-z0-9]*) speech$/,
  );
  if (fedSpeaker) return `fed-official-${fedSpeaker[1]}-speech`;

  return normalized.replace(/ /g, "-");
}

export function buildEventIdentity(input: {
  subject: string;
  jurisdiction: Jurisdiction | undefined;
  scheduledAt: string | undefined;
}): EventIdentity | undefined {
  if (
    !input.jurisdiction
    || !RECONCILIABLE_JURISDICTIONS.has(input.jurisdiction)
    || input.jurisdiction === "OTHER"
    || !input.scheduledAt
  ) return undefined;

  const scheduledAtMs = Date.parse(input.scheduledAt);
  if (!Number.isFinite(scheduledAtMs)) return undefined;

  const semanticKey = eventSemanticKey(input.subject);
  if (!semanticKey) return undefined;

  const scheduledAt = new Date(scheduledAtMs).toISOString();
  const jurisdiction = input.jurisdiction as EventIdentity["jurisdiction"];
  return {
    version: "v1",
    key: `event:v1:${jurisdiction}:${scheduledAt}:${semanticKey}`,
    semanticKey,
    scheduledAt,
    jurisdiction,
  };
}

function eventRepresentativeRank(event: Event): [number, string] {
  // Biquote is preferred where identity overlaps because its EventResult
  // lifecycle owns actual/forecast/previous snapshots. This affects only the
  // dashboard representative; provider Evidence remains separate.
  const sourceRank = event.sourceId === "biquote"
    ? 0
    : event.sourceId === "federal-reserve"
      ? 1
      : event.sourceId === "forex-factory"
        ? 2
        : 3;
  return [sourceRank, event.id];
}

function preferRepresentative(left: Event, right: Event): Event {
  const [leftRank, leftId] = eventRepresentativeRank(left);
  const [rightRank, rightId] = eventRepresentativeRank(right);
  if (leftRank !== rightRank) return leftRank < rightRank ? left : right;
  return leftId.localeCompare(rightId) <= 0 ? left : right;
}

/**
 * Reconciles only Events that carry a qualified identity. Legacy/unqualified
 * Events stay separate. Returned order follows first identity appearance.
 */
export function reconcileEvents(events: Event[]): Event[] {
  const output: Event[] = [];
  const indexByIdentity = new Map<string, number>();

  for (const event of events) {
    const key = event.identity?.key;
    if (!key) {
      output.push(event);
      continue;
    }

    const existingIndex = indexByIdentity.get(key);
    if (existingIndex === undefined) {
      indexByIdentity.set(key, output.length);
      output.push(event);
      continue;
    }

    output[existingIndex] = preferRepresentative(output[existingIndex], event);
  }

  return output;
}
