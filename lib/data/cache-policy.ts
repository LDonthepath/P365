export type P365CacheTag = "p365-fast" | "p365-medium" | "p365-slow";

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
