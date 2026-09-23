export const P365_CADENCE_CACHE_TAGS = [
  "p365-fast",
  "p365-medium",
  "p365-slow",
] as const;

export type P365CacheTag = (typeof P365_CADENCE_CACHE_TAGS)[number];

/**
 * Complete cache-tag set owned by the dashboard manual-refresh contract.
 *
 * `p365-dashboard` remains for providers that still use the legacy direct
 * dashboard tag. Cadence-aware providers use one of P365_CADENCE_CACHE_TAGS.
 * Keeping the union here makes manual invalidation follow the cache topology
 * instead of duplicating tag knowledge inside the Server Action.
 */
export const P365_DASHBOARD_CACHE_TAGS = [
  "p365-dashboard",
  ...P365_CADENCE_CACHE_TAGS,
] as const;

const FAST_CADENCES = new Set([
  5 * 60,
  15 * 60,
  30 * 60,
  60 * 60,
  6 * 60 * 60,
]);

/**
 * Maps an existing provider cache cadence to the canonical P365 cache group.
 *
 * Cadence is authoritative at the provider/series level; the tag only groups
 * entries for explicit invalidation. Every supported cadence is whitelisted
 * so a new cadence cannot silently enter an existing invalidation group.
 */
export function cacheTagForRevalidate(revalidateSeconds: number): P365CacheTag {
  if (FAST_CADENCES.has(revalidateSeconds)) return "p365-fast";
  if (revalidateSeconds === 12 * 60 * 60) return "p365-medium";
  if (revalidateSeconds === 24 * 60 * 60) return "p365-slow";

  throw new Error(
    `Unsupported P365 cache cadence: ${revalidateSeconds}s`,
  );
}
