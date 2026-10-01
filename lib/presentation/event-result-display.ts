const MULTIPLIER_LABEL_ID: Record<string, string> = {
  thousand: "ribu",
  thousands: "ribu",
  million: "juta",
  millions: "juta",
  billion: "miliar",
  billions: "miliar",
  trillion: "triliun",
  trillions: "triliun",
};

const UNIT_LABEL_ID: Record<string, string> = {
  barrel: "barel",
  barrels: "barel",
};

function unitLabel(unit?: string, multiplier?: string): string {
  const rawUnit = unit?.trim() ?? "";
  const normalizedUnit = rawUnit.toLowerCase();
  const rawMultiplier = multiplier?.trim().toLowerCase() ?? "";
  const localizedUnit = ["none", "null", "n/a", "na"].includes(normalizedUnit)
    ? ""
    : UNIT_LABEL_ID[normalizedUnit] ?? rawUnit;
  const localizedMultiplier = MULTIPLIER_LABEL_ID[rawMultiplier];

  if (!localizedUnit) return localizedMultiplier ?? "";
  if (!localizedMultiplier || rawMultiplier === "none") return localizedUnit;
  return `${localizedMultiplier} ${localizedUnit}`;
}

export function formatEventResultValue(
  value: number | undefined,
  unit?: string,
  multiplier?: string,
): string {
  if (value === undefined) return "—";
  const formatted = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
  }).format(value);
  const label = unitLabel(unit, multiplier);
  return label ? `${formatted} ${label}` : formatted;
}
