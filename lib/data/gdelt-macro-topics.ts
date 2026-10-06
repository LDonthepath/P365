export const GDELT_MACRO_MATCHER_VERSION = "gdelt-macro-title-topics-v1" as const;
export const GDELT_MACRO_TOPICS = [
  "CENTRAL_BANK_POLICY", "ECONOMIC_RELEASE", "LIQUIDITY_FUNDING",
  "FISCAL_TRADE", "RATES_FX", "GEOPOLITICAL_SUPPLY",
] as const;
export type GdeltMacroTopic = (typeof GDELT_MACRO_TOPICS)[number];

/** Bounded English title discovery. These labels do not verify facts or impact. */
export function gdeltMacroTopics(title: string): GdeltMacroTopic[] {
  const text = title.normalize("NFKC").replace(/\s+/g, " ").trim();
  const bank = /\b(?:Federal Reserve|Fed|FOMC|Bank of Japan|BoJ|People['’]s Bank of China|PBoC)\b/i.test(text);
  const jurisdiction = /\b(?:U\.?S\.?|United States|American|China|Chinese|Japan|Japanese)\b/i.test(text);
  const policy = /\b(?:interest rates?|monetary policy|rate (?:hikes?|cuts?|decision)|(?:hikes?|cuts?) rates?|policy (?:rates?|decision)|forward guidance|meeting minutes|FOMC minutes|economic projections?|intervention|reserve requirement)\b/i.test(text);
  const topics: GdeltMacroTopic[] = [];
  if (bank && policy) topics.push("CENTRAL_BANK_POLICY");
  if (jurisdiction && /\b(?:inflation|CPI|PCE|PPI|nonfarm payrolls?|employment report|jobless claims|unemployment|GDP|retail sales|PMI|industrial production|total social financing|M2)\b/i.test(text)) {
    topics.push("ECONOMIC_RELEASE");
  }
  if ((bank || /\b(?:SOFR|repo market|bank reserves|U\.?S\.? Treasury)\b/i.test(text))
    && /\b(?:repo|funding|bank reserves|reserve balances|liquidity facilit(?:y|ies)|quantitative easing|quantitative tightening|QE|QT|reserve requirement|RRR)\b/i.test(text)) {
    topics.push("LIQUIDITY_FUNDING");
  }
  if ((jurisdiction || /\b(?:U\.?S\.? Treasury|Treasury Department)\b/i.test(text))
    && /\b(?:tariffs?|sanctions?|refunding|bond auctions?|Treasury auctions?|issuance|fiscal stimulus|government borrowing|trade restrictions?)\b/i.test(text)) {
    topics.push("FISCAL_TRADE");
  }
  const instrument = /\b(?:U\.?S\.? Treasury|Treasury yields?|Treasury inflation protected securities|DXY|U\.?S\.? dollar|USD|greenback|Japanese yen|offshore yuan|USDCNH|USDJPY)\b/i.test(text) || /\bTIPS\b/.test(text);
  if (instrument && /\b(?:yields?|rates?|bonds?|currency|currencies|strengthens?|weakens?|rises?|falls?|surges?|drops?|rall(?:y|ies)|selloff|sell-off)\b/i.test(text)) {
    topics.push("RATES_FX");
  }
  if (/\b(?:Iran|Israel|Russia|Ukraine|China|Taiwan|Strait of Hormuz|Red Sea|Suez)\b/i.test(text)
    && /\b(?:military|conflict|war|sanctions?|shipping|blockade|oil supply|energy disruption|missile|invasion)\b/i.test(text)) {
    topics.push("GEOPOLITICAL_SUPPLY");
  }
  return topics;
}

export type GdeltMacroInputArticle = {
  title: string; url: string; domain: string;
  providerDate: string | null;
  providerDateSemantics: "PUBLICATION_OR_FIRST_SEEN" | "UNAVAILABLE";
};
export type GdeltMacroCandidate = GdeltMacroInputArticle & { topics: GdeltMacroTopic[] };
export const GDELT_MACRO_QUALIFICATION_BYTE_LIMIT = 64 * 1024;

/** Proposed qualification bounds only; not a production storage budget. */
export function extractGdeltMacroCandidates(items: GdeltMacroInputArticle[], limit = 30) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Macro candidate limit must be 1..100");
  const seen = new Set<string>();
  const matches: GdeltMacroCandidate[] = [];
  let duplicateUrlCount = 0;
  let unmatchedCount = 0;
  let overlargeMatchedCount = 0;
  let matchingCandidateCount = 0;
  const topicMatchCounts = Object.fromEntries(GDELT_MACRO_TOPICS.map((topic) => [topic, 0])) as Record<GdeltMacroTopic, number>;
  for (const item of items) {
    if (seen.has(item.url)) { duplicateUrlCount++; continue; }
    seen.add(item.url);
    const topics = gdeltMacroTopics(item.title);
    if (!topics.length) { unmatchedCount++; continue; }
    matchingCandidateCount++;
    for (const topic of topics) topicMatchCounts[topic]++;
    if (item.title.length > 1024 || item.url.length > 4096 || item.domain.length > 255) {
      overlargeMatchedCount++; continue;
    }
    matches.push({ ...item, topics });
  }
  const queues = GDELT_MACRO_TOPICS.map((topic) => matches.filter((item) => item.topics.includes(topic)));
  const positions = queues.map(() => 0);
  const selected = new Set<string>();
  const candidates: GdeltMacroCandidate[] = [];
  let candidateBytes = 2; // JSON array brackets
  let byteExcludedCount = 0;
  while (candidates.length < limit) {
    let advanced = false;
    for (let i = 0; i < queues.length && candidates.length < limit; i++) {
      while (positions[i] < queues[i].length && selected.has(queues[i][positions[i]].url)) positions[i]++;
      const candidate = queues[i][positions[i]++];
      if (!candidate) continue;
      advanced = true;
      selected.add(candidate.url);
      const bytes = new TextEncoder().encode(JSON.stringify(candidate)).byteLength + (candidates.length ? 1 : 0);
      if (candidateBytes + bytes > GDELT_MACRO_QUALIFICATION_BYTE_LIMIT) { byteExcludedCount++; continue; }
      candidates.push(candidate);
      candidateBytes += bytes;
    }
    if (!advanced) break;
  }
  return {
    scope: "MACRO" as const, matcherVersion: GDELT_MACRO_MATCHER_VERSION,
    candidateCoverage: matchingCandidateCount === candidates.length ? "COMPLETE" as const : "TRUNCATED" as const,
    matchingCandidateCount, retainedCandidateCount: candidates.length, topicMatchCounts,
    duplicateUrlCount, unmatchedCount, overlargeMatchedCount, byteExcludedCount,
    candidateBytes, candidateByteLimit: GDELT_MACRO_QUALIFICATION_BYTE_LIMIT,
    candidates, languageCoverage: "BOUNDED_ENGLISH_TITLE_PATTERNS" as const,
  };
}
