export type NewsItem = {
  id: string;
  category: string;
  source: string;
  publishedAt: string; // ISO 8601
  title: string;
  summary: string;
  url: string;
};

export type CalendarImpact = "HIGH" | "MEDIUM" | "LOW";
export type CalendarStatus = "UPCOMING" | "TODAY" | "TOMORROW" | "PAST";

export type CalendarEvent = {
  id: string;
  time: string; // HH:mm, Asia/Jakarta
  event: string;
  country: string;
  impact: CalendarImpact;
  status: CalendarStatus;
  dateISO: string;
};

export type ProviderResultStatus = "SUCCESS" | "EMPTY" | "ERROR" | "UNAVAILABLE";

export type ProviderId =
  | "alpha-vantage"
  | "coindesk-rss"
  | "forex-factory"
  | "coingecko"
  | "fred"
  | "federal-reserve"
  | "biquote"
  | "yahoo-finance";

export type ProviderErrorCode =
  | "CONFIGURATION"
  | "AUTHENTICATION"
  | "RATE_LIMIT"
  | "HTTP_ERROR"
  | "UPSTREAM_UNAVAILABLE"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "MALFORMED_PAYLOAD"
  | "UNKNOWN_ERROR";

export type ProviderResult<T> = {
  providerId: ProviderId;
  status: ProviderResultStatus;
  data: T[];
  /** P365 retrieval timestamp for this provider operation. */
  retrievedAt: string;
  message?: string;
  errorCode?: ProviderErrorCode;
};

export function classifyProviderError(message: string): ProviderErrorCode {
  const normalized = message.toLowerCase();
  if (normalized.includes("not configured") || normalized.includes("is not configured")) return "CONFIGURATION";
  if (/(http|status)\s+(401|403)\b/.test(normalized)) return "AUTHENTICATION";
  if (/(http|status)\s+429\b|rate.?limit|too many requests/.test(normalized)) return "RATE_LIMIT";
  if (/(http|status)\s+5\d\d\b/.test(normalized)) return "UPSTREAM_UNAVAILABLE";
  if (/(http|status)\s+4\d\d\b/.test(normalized)) return "HTTP_ERROR";
  if (normalized.includes("timeout") || normalized.includes("timed out") || normalized.includes("aborted")) return "TIMEOUT";
  if (normalized.includes("malformed") || normalized.includes("invalid json") || normalized.includes("unexpected token")) return "MALFORMED_PAYLOAD";
  if (normalized.includes("fetch failed") || normalized.includes("network") || normalized.includes("request failed")) return "NETWORK_ERROR";
  return "UNKNOWN_ERROR";
}

export function providerResult<T>(
  providerId: ProviderId,
  status: ProviderResultStatus,
  data: T[] = [],
  message?: string,
  errorCode?: ProviderErrorCode,
  retrievedAt = new Date().toISOString(),
): ProviderResult<T> {
  return {
    providerId,
    status,
    data,
    retrievedAt,
    ...(message ? { message } : {}),
    ...((status === "ERROR" || status === "UNAVAILABLE") && message
      ? { errorCode: errorCode ?? classifyProviderError(message) }
      : {}),
  };
}

/**
 * Max upcoming events kept from the Forex Factory calendar (nearest first, all
 * impacts). Shared so presentation code can tell when the list may be truncated.
 */
export const ECONOMIC_CALENDAR_LIMIT = 6;
