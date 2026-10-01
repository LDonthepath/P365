function formatMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function dollarScale(unit: string): number | null {
  const normalized = unit.trim().toLowerCase();
  const dollarUnit = normalized.includes("dollar") || normalized.includes("usd") || normalized.includes("$");
  if (!dollarUnit) return null;
  if (normalized.includes("billion")) return 1_000_000_000;
  if (normalized.includes("million")) return 1_000_000;
  if (normalized.includes("thousand")) return 1_000;
  return 1;
}

export function formatMacroDisplayValue(value: string, unit: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  const normalized = unit.trim().toLowerCase();
  if (normalized.includes("percent") || normalized === "%") return `${numeric.toFixed(2)}%`;
  const scale = dollarScale(unit);
  if (scale !== null) return formatMoney(numeric * scale);
  return value;
}

export function formatMacroDisplayDelta(value: number | null, unit: string): string {
  if (value === null) return "—";
  if (Math.abs(value) < 0.0000001) return "tidak berubah";

  const normalized = unit.trim().toLowerCase();
  if (normalized.includes("percent") || normalized === "%") {
    return `${value > 0 ? "+" : ""}${value.toFixed(2)} poin persentase`;
  }

  const scale = dollarScale(unit);
  if (scale !== null) {
    const amount = formatMoney(value * scale);
    return value > 0 ? `+${amount}` : amount;
  }

  const formatted = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
  return `${value > 0 ? "+" : ""}${formatted}${unit ? ` ${unit}` : ""}`;
}
