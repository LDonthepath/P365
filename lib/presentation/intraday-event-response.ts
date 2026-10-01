export function displayEventResultUnit(unit?: string): string | null {
  const normalized = unit?.trim();
  if (!normalized) return null;
  const sentinel = normalized.toLowerCase();
  if (sentinel === "none" || sentinel === "null" || sentinel === "unknown" || sentinel === "n/a" || sentinel === "na") {
    return null;
  }
  return normalized;
}

export function formatEventResultValue(value: number | undefined, unit?: string): string {
  if (value === undefined) return "—";
  const suffix = displayEventResultUnit(unit);
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  return suffix ? `${formatted} ${suffix}` : formatted;
}

export function classifyRoundedMove(
  value: number,
  fractionDigits: number,
): { verb: "naik" | "turun" | "relatif datar"; amount: string } {
  const rounded = Number(value.toFixed(fractionDigits));
  if (rounded === 0) return { verb: "relatif datar", amount: "" };
  return {
    verb: rounded > 0 ? "naik" : "turun",
    amount: ` ${Math.abs(rounded).toFixed(fractionDigits)}%`,
  };
}

export function formatMovePercent(value: number | undefined, fractionDigits = 2): string {
  if (value === undefined) return "—";
  const rounded = Number(value.toFixed(fractionDigits));
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(fractionDigits)}%`;
}
