export type SourceType = "NEWS" | "MARKET" | "CALENDAR" | "MACRO" | "OTHER";

export type SourceHealthStatus = "HEALTHY" | "EMPTY" | "ERROR" | "UNAVAILABLE" | "STALE";

export type DataQuality = "FRESH" | "STALE" | "PARTIAL" | "UNKNOWN";

export type Confidence = "CONFIRMED" | "LEANING" | "PENDING";

export type ObservationDomain = "MARKET" | "MACRO" | "ASSET" | "NEWS" | "OTHER";

export type EventStatus = "UPCOMING" | "ACTIVE" | "PAST" | "UNKNOWN";

export type Source = {
  id: string;
  name: string;
  type: SourceType;
  status: SourceHealthStatus;
};

export type EvidenceRef = {
  id: string;
  sourceId: string;
  observationId?: string;
  eventId?: string;
  capturedAt: string;
};

export type Observation = {
  id: string;
  domain: ObservationDomain;
  subject: string;
  value: string;
  observedAt: string;
  sourceId: string;
  quality: DataQuality;
  evidenceId: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type Event = {
  id: string;
  subject: string;
  description: string;
  occurredAt?: string;
  scheduledAt?: string;
  status: EventStatus;
  importance: "HIGH" | "MEDIUM" | "LOW";
  sourceId: string;
  evidenceId: string;
};

export type Context = {
  id: string;
  statement: string;
  observationIds: string[];
  eventIds: string[];
  createdAt: string;
};

export type State = {
  id: string;
  domain: string;
  value: string;
  confidence: Confidence;
  evaluatedAt: string;
  evidenceIds: string[];
};

export type Intelligence = {
  id: string;
  what: string;
  why: string;
  confirms: EvidenceRef[];
  contradicts: EvidenceRef[];
  invalidates: string[];
  monitor: string[];
  confidence: Confidence;
  createdAt: string;
};

export type ProviderHealth = {
  sourceId: string;
  status: SourceHealthStatus;
  fetchedAt: string;
  itemCount: number;
  message?: string;
};
