export type MacroFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY";

export type MacroSeriesDefinition = {
  seriesId: string;
  subject: string;
  frequency: MacroFrequency;
  unit: string;
  source: "FRED";
  /** Canonical Observation domain. MACRO = macro fundamentals/policy; ASSET = cross-asset market instrument. */
  domain: "MACRO" | "ASSET";
  /** Maximum age of the underlying observation before it is stale. */
  freshnessMs: number;
  /** Server cache duration appropriate for the series publication cadence. */
  revalidateSeconds: number;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Canonical free-first registry for Macro Data Foundation v0.1.
 * Series IDs are FRED series identifiers; their source agencies are recorded in
 * FRED metadata/evidence rather than spread throughout ingestion code.
 */
export const MACRO_SERIES_REGISTRY = [
  { seriesId: "FEDFUNDS", subject: "Federal Funds Rate", frequency: "MONTHLY", unit: "Percent", source: "FRED", domain: "MACRO", freshnessMs: 45 * DAY, revalidateSeconds: 12 * 60 * 60 },
  { seriesId: "EFFR", subject: "Effective Federal Funds Rate", frequency: "DAILY", unit: "Percent", source: "FRED", domain: "MACRO", freshnessMs: 5 * DAY, revalidateSeconds: 6 * 60 * 60 },
  { seriesId: "WALCL", subject: "Federal Reserve Total Assets", frequency: "WEEKLY", unit: "Millions of U.S. Dollars", source: "FRED", domain: "MACRO", freshnessMs: 14 * DAY, revalidateSeconds: 12 * 60 * 60 },
  { seriesId: "WRESBAL", subject: "Reserve Balances with Federal Reserve Banks", frequency: "WEEKLY", unit: "Millions of U.S. Dollars", source: "FRED", domain: "MACRO", freshnessMs: 14 * DAY, revalidateSeconds: 12 * 60 * 60 },
  { seriesId: "M2SL", subject: "M2 Money Stock", frequency: "MONTHLY", unit: "Billions of U.S. Dollars", source: "FRED", domain: "MACRO", freshnessMs: 45 * DAY, revalidateSeconds: 12 * 60 * 60 },
  { seriesId: "WTREGEN", subject: "U.S. Treasury General Account", frequency: "WEEKLY", unit: "Millions of U.S. Dollars", source: "FRED", domain: "MACRO", freshnessMs: 14 * DAY, revalidateSeconds: 12 * 60 * 60 },
  { seriesId: "SOFR", subject: "Secured Overnight Financing Rate", frequency: "DAILY", unit: "Percent", source: "FRED", domain: "MACRO", freshnessMs: 5 * DAY, revalidateSeconds: 6 * 60 * 60 },
  { seriesId: "IORB", subject: "Interest Rate on Reserve Balances", frequency: "DAILY", unit: "Percent", source: "FRED", domain: "MACRO", freshnessMs: 5 * DAY, revalidateSeconds: 6 * 60 * 60 },
  { seriesId: "RRPONTSYD", subject: "Overnight Reverse Repurchase Agreements", frequency: "DAILY", unit: "Billions of U.S. Dollars", source: "FRED", domain: "MACRO", freshnessMs: 5 * DAY, revalidateSeconds: 6 * 60 * 60 },
  { seriesId: "CPIAUCSL", subject: "Consumer Price Index for All Urban Consumers: All Items", frequency: "MONTHLY", unit: "Index 1982-1984=100", source: "FRED", domain: "MACRO", freshnessMs: 45 * DAY, revalidateSeconds: 12 * 60 * 60 },
  { seriesId: "CPILFESL", subject: "Consumer Price Index for All Urban Consumers: All Items Less Food and Energy", frequency: "MONTHLY", unit: "Index 1982-1984=100", source: "FRED", domain: "MACRO", freshnessMs: 45 * DAY, revalidateSeconds: 12 * 60 * 60 },
  { seriesId: "PCEPI", subject: "Personal Consumption Expenditures: Chain-type Price Index", frequency: "MONTHLY", unit: "Index 2017=100", source: "FRED", domain: "MACRO", freshnessMs: 45 * DAY, revalidateSeconds: 12 * 60 * 60 },
  { seriesId: "PCEPILFE", subject: "Personal Consumption Expenditures Excluding Food and Energy: Chain-type Price Index", frequency: "MONTHLY", unit: "Index 2017=100", source: "FRED", domain: "MACRO", freshnessMs: 45 * DAY, revalidateSeconds: 12 * 60 * 60 },
  { seriesId: "UNRATE", subject: "Unemployment Rate", frequency: "MONTHLY", unit: "Percent", source: "FRED", domain: "MACRO", freshnessMs: 45 * DAY, revalidateSeconds: 12 * 60 * 60 },
  { seriesId: "PAYEMS", subject: "All Employees, Total Nonfarm", frequency: "MONTHLY", unit: "Thousands of Persons", source: "FRED", domain: "MACRO", freshnessMs: 45 * DAY, revalidateSeconds: 12 * 60 * 60 },
  { seriesId: "ICSA", subject: "Initial Claims", frequency: "WEEKLY", unit: "Number", source: "FRED", domain: "MACRO", freshnessMs: 14 * DAY, revalidateSeconds: 12 * 60 * 60 },
  { seriesId: "DGS2", subject: "2-Year Treasury Constant Maturity Rate", frequency: "DAILY", unit: "Percent", source: "FRED", domain: "MACRO", freshnessMs: 5 * DAY, revalidateSeconds: 6 * 60 * 60 },
  { seriesId: "DGS10", subject: "10-Year Treasury Constant Maturity Rate", frequency: "DAILY", unit: "Percent", source: "FRED", domain: "MACRO", freshnessMs: 5 * DAY, revalidateSeconds: 6 * 60 * 60 },
  { seriesId: "DFII10", subject: "10-Year Treasury Inflation-Indexed Security, Constant Maturity", frequency: "DAILY", unit: "Percent", source: "FRED", domain: "MACRO", freshnessMs: 5 * DAY, revalidateSeconds: 6 * 60 * 60 },
  { seriesId: "DTWEXBGS", subject: "US Broad Trade-Weighted Dollar Index", frequency: "DAILY", unit: "Index Mar 1973=100", source: "FRED", domain: "MACRO", freshnessMs: 5 * DAY, revalidateSeconds: 6 * 60 * 60 },
  { seriesId: "GDPC1", subject: "Real Gross Domestic Product", frequency: "QUARTERLY", unit: "Billions of Chained 2017 Dollars", source: "FRED", domain: "MACRO", freshnessMs: 135 * DAY, revalidateSeconds: 24 * 60 * 60 },
  { seriesId: "VIXCLS", subject: "CBOE Volatility Index: VIX", frequency: "DAILY", unit: "Index", source: "FRED", domain: "ASSET", freshnessMs: 5 * DAY, revalidateSeconds: 6 * 60 * 60 },
  { seriesId: "SP500", subject: "S&P 500", frequency: "DAILY", unit: "Index", source: "FRED", domain: "ASSET", freshnessMs: 5 * DAY, revalidateSeconds: 6 * 60 * 60 },
  { seriesId: "NASDAQCOM", subject: "NASDAQ Composite Index", frequency: "DAILY", unit: "Index Feb 5, 1971=100", source: "FRED", domain: "ASSET", freshnessMs: 5 * DAY, revalidateSeconds: 6 * 60 * 60 },
  { seriesId: "DCOILWTICO", subject: "Crude Oil Prices: West Texas Intermediate (WTI)", frequency: "DAILY", unit: "Dollars per Barrel", source: "FRED", domain: "ASSET", freshnessMs: 5 * DAY, revalidateSeconds: 6 * 60 * 60 },
] as const satisfies readonly MacroSeriesDefinition[];

export type MacroSeriesId = (typeof MACRO_SERIES_REGISTRY)[number]["seriesId"];
