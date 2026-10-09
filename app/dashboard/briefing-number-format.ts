export type BriefingNumberOptions = Pick<
  Intl.NumberFormatOptions,
  "minimumFractionDigits" | "maximumFractionDigits" | "signDisplay"
>;

/** Angka presentasi untuk Bagian 01–02: pemisah ribuan titik, desimal koma. */
export function formatBriefingNumber(
  value: number,
  options: BriefingNumberOptions = {},
): string {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

export function formatBriefingPercent(value: number, digits = 2): string {
  return `${formatBriefingNumber(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: "exceptZero",
  })}%`;
}

export function formatBriefingBasisPoints(value: number, digits = 1): string {
  return `${formatBriefingNumber(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: "exceptZero",
  })} bps`;
}
