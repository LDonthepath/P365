// A bounded display-only heuristic. It does not classify article bodies,
// source authority, sentiment, importance, or a headline's causal relevance.
export type CatalystTitleExclusion =
  | "PROMOTIONAL_TITLE"
  | "OTHER_ASSET_ONLY"
  | "GOLD_RESOURCE_REPORT";

export function catalystTitleExclusion(
  title: string,
  scope: "MAKRO" | "CRYPTO" | "BTC" | "GOLD",
): CatalystTitleExclusion | null {
  const text = title.normalize("NFKC").replace(/\s+/g, " ").trim();
  // Reporting on fraud/enforcement is relevant even when it quotes sales copy.
  const reportsRisk = /\b(?:fraud|scam|charges?|charged|lawsuit|sues?|investigat(?:e|es|ion|ions)|warns?|warning|hacked|hack|theft|bans?|banned)\b/i.test(text);
  const investmentPitch = /\b(?:best|top)\s+(?:\d+\s+)?(?:crypto(?:currenc(?:y|ies))?|coins?|tokens?|altcoins?)\s+(?:to\s+(?:buy|invest(?:\s+in)?)|for\s+investment)\b/i.test(text);
  const roiPitch = /\bpotential\s+roi\b|\bguaranteed\s+(?:returns?|profits?)\b/i.test(text);
  const presalePitch = /\b(?:presale|pre-sale|token\s+sale)\b/i.test(text)
    && /\b(?:roi|returns?|profits?|buy|invest|join|ending|ends|last\s+chance)\b/i.test(text);
  if (!reportsRisk && (investmentPitch || roiPitch || presalePitch)) {
    return "PROMOTIONAL_TITLE";
  }

  if (scope === "BTC" && /\bbitcoin\s+cash\b|\bbch\b/i.test(text)) {
    const otherAssetRemoved = text.replace(/\bbitcoin\s+cash\b|\bbch\b/gi, "");
    if (!/\bbitcoin\b|\bbtc\b/i.test(otherAssetRemoved)) return "OTHER_ASSET_ONLY";
  }
  if (scope === "GOLD"
    && /\bNI\s*43[-–\s]?101\b|\b(?:drill|drilling)\s+results\b/i.test(text)
    && !/\bgold\s+prices?\b|\bbullion\b|\bXAU(?:USD)?\b/i.test(text)) {
    return "GOLD_RESOURCE_REPORT";
  }
  // Unknown wording/languages remain visible; absence of a matched pattern is
  // not proof that a headline is relevant to a market move.
  return null;
}
