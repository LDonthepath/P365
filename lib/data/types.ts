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

export type ProviderResult<T> = {
  status: ProviderResultStatus;
  data: T[];
  message?: string;
};
