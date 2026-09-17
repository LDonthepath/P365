import "server-only";
import type { EconomicEventResult } from "../domain/event-result";
import type { EconomicEventResultRepository } from "../repositories/types";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.P365_MEMORY_WRITE_KEY ?? process.env.SUPABASE_SECRET_KEY;

function requireConfig(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("P365 durable Market Memory requires SUPABASE_URL and a server-only Supabase write key.");
  }

  return { url: SUPABASE_URL.replace(/\/$/, ""), key: SUPABASE_KEY };
}

function rowFor(result: EconomicEventResult) {
  const effectiveAt = result.releasedAt ?? result.retrievedAt;
  return {
    record_type: "EVENT_RESULT" as const,
    canonical_id: result.id,
    effective_at: effectiveAt,
    dedupe_key: `EVENT_RESULT:${result.id}:${effectiveAt}`,
    payload: result,
  };
}

async function insert(rows: ReturnType<typeof rowFor>[]): Promise<void> {
  if (rows.length === 0) return;
  const { url, key } = requireConfig();
  const response = await fetch(`${url}/rest/v1/market_memory?on_conflict=dedupe_key`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase Market Memory write failed (${response.status}): ${detail}`);
  }
}

export const supabaseEconomicEventResultRepository: EconomicEventResultRepository = {
  async save(result) {
    await insert([rowFor(result)]);
  },

  async saveMany(results) {
    await insert(results.map(rowFor));
  },

  async findById(id) {
    const { url, key } = requireConfig();
    const params = new URLSearchParams({
      select: "payload",
      record_type: "eq.EVENT_RESULT",
      canonical_id: `eq.${id}`,
      limit: "1",
    });
    const response = await fetch(`${url}/rest/v1/market_memory?${params.toString()}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Supabase Market Memory read failed (${response.status}): ${detail}`);
    }

    const rows = (await response.json()) as Array<{ payload: EconomicEventResult }>;
    return rows[0]?.payload ?? null;
  },
};
