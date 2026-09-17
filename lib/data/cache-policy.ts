export type P365CacheTag = "p365-fast" | "p365-medium" | "p365-slow";

/**
 * Maps an existing provider cache cadence to the canonical P365 cache group.
 *
 * Cadence is authoritative at the provider/series level; the tag only groups
 * entries for explicit invalidation. Unsupported cadences fail fast so a new
 * provider cadence cannot silently enter the wrong invalidation group.
 */
export function cacheTagForRevalidate(revalidateSeconds: number): P365CacheTag {
  if (revalidateSeconds <= 6 * 60 * 60) return "p365-fast";
  if (revalidateSeconds === 12 * 60 * 60) return "p365-medium";
  if (revalidateSeconds === 24 * 60 * 60) return "p365-slow";

  throw new Error(
    `Unsupported P365 cache cadence: ${revalidateSeconds}s`,
  );
}
