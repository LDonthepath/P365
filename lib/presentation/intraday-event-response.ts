const EVENT_RESULT_SENTINELS = new Set(["none", "null", "unknown", "n/a", "na"]);

const EVENT_RESULT_MULTIPLIER_LABEL_ID: Record<string, string> = {
  thousand: "ribu",
  thousands: "ribu",
  million: "juta",
  millions: "juta",
  billion: "miliar",
  billions: "miliar",
  trillion: "triliun",
  trillions: "triliun",
};

const EVENT_RESULT_UNIT_LABEL_ID: Record<string, string> = {
  job: "pekerjaan",
  jobs: "pekerjaan",
  barrel: "barel",
  barrels: "barel",
};

function displayToken(
  value: string | undefined,
  labels: Record<string, string>,
): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  const key = normalized.toLowerCase();
  if (EVENT_RESULT_SENTINELS.has(key)) return null;
  return labels[key] ?? normalized;
}

export function displayEventResultUnit(
  unit?: string,
  multiplier?: string,
): string | null {
  const unitLabel = displayToken(unit, EVENT_RESULT_UNIT_LABEL_ID);
  const multiplierLabel = displayToken(
    multiplier,
    EVENT_RESULT_MULTIPLIER_LABEL_ID,
  );
  if (!unitLabel) return multiplierLabel;
  if (!multiplierLabel) return unitLabel;
  return `${multiplierLabel} ${unitLabel}`;
}

export function formatEventResultValue(
  value: number | undefined,
  unit?: string,
  multiplier?: string,
): string {
  if (value === undefined) return "—";
  const suffix = displayEventResultUnit(unit, multiplier);
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
