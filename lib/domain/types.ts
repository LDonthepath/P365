export type SourceType = "NEWS" | "MARKET" | "CALENDAR" | "MACRO" | "OTHER";
export type SourceHealthStatus = "HEALTHY" | "EMPTY" | "ERROR" | "UNAVAILABLE" | "STALE";
export type DataQuality = "FRESH" | "STALE" | "PARTIAL" | "UNKNOWN";
export type Confidence = "CONFIRMED" | "LEANING" | "PENDING";
export type ObservationDomain = "MARKET" | "MACRO" | "ASSET" | "OTHER";

/**
 * Additive financial-market semantics.
 *
 * ObservationDomain remains the legacy compatibility classification used by
 * existing persistence/history contracts. These dimensions describe what the
 * observation means without rewriting historical records.
 */
export type MarketDomain =
  | "ECONOMY"
  | "POLICY"
  | "LIQUIDITY_FUNDING"
  | "FISCAL_SOVEREIGN"
  | "RATES"
  | "FX"
  | "EQUITY"
  | "CREDIT"
  | "COMMODITY"
  | "VOLATILITY"
  | "CRYPTO"
  | "DERIVATIVES";

export type InformationClass =
  | "OBSERVATION"
  | "EXPECTATION"
  | "PRICING"
  | "POSITIONING"
  | "FLOW"
  | "INVENTORY"
  | "EVENT"
  | "EVIDENCE"
  | "DERIVED_METRIC"
  | "MODEL_ESTIMATE"
  | "DERIVED_STATE";

export type Jurisdiction =
  | "US"
  | "EURO_AREA"
  | "JAPAN"
  | "CHINA"
  | "UK"
  | "CANADA"
  | "AUSTRALIA"
  | "GLOBAL"
  | "OTHER";

export type InstrumentType =
  | "ECONOMIC_SERIES"
  | "POLICY_RATE"
  | "MONEY_MARKET_RATE"
  | "BALANCE_SHEET"
  | "CASH"
  | "SOVEREIGN_BOND"
  | "CREDIT_INDEX"
  | "FX_INDEX"
  | "FX_PAIR"
  | "INDEX"
  | "FUTURE"
  | "OPTION"
  | "SWAP"
  | "ETF"
  | "FUND"
  | "COMMODITY_CONTRACT"
  | "CRYPTO_SPOT"
  | "CRYPTO_DERIVATIVE"
  | "OTHER";

export type ParticipantClass =
  | "OFFICIAL"
  | "BANK"
  | "DEALER"
  | "ASSET_MANAGER"
  | "LEVERAGED_FUND"
  | "PENSION_INSURER"
  | "ETF_FUND"
  | "CORPORATE"
  | "HOUSEHOLD"
  | "NONBANK"
  | "OTHER";

export type ObservationSemantics = {
  ontologyVersion: "v0.1";
  marketDomain: MarketDomain;
  informationClass: InformationClass;
  jurisdiction?: Jurisdiction;
  instrument?: InstrumentType;
  asset?: string;
  participant?: ParticipantClass;
  tenor?: string;
};
export type EventStatus = "UPCOMING" | "ACTIVE" | "PAST" | "UNKNOWN";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export type Source = { id: string; name: string; type: SourceType; status: SourceHealthStatus };

export type EvidenceRef = {
  id: string;
  sourceId: string;
  observationId?: string;
  eventId?: string;
  capturedAt: string;
};

export type Evidence = {
  id: string;
  sourceId: string;
  kind: "NEWS" | "OBSERVATION" | "EVENT";
  subject: string;
  content: string;
  /** Backward-compatible alias for P365 retrieval/capture time. */
  capturedAt: string;
  /** P365 retrieval/capture timestamp. Never substitutes for source publication/release time. */
  retrievedAt: string;
  /** Source-native publication timestamp, when available. */
  publishedAt?: string;
  /** Source-native release/result timestamp, when available. */
  releasedAt?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type Observation = {
  id: string;
  domain: ObservationDomain;
  subject: string;
  value: string;
  /** Source-native observation timestamp when the provider supplies a timestamp. */
  observedAt: string;
  /** P365 retrieval/capture timestamp. */
  retrievedAt: string;
  sourceId: string;
  quality: DataQuality;
  evidenceId: string;
  /** Additive semantic dimensions. Optional for legacy persisted records. */
  semantics?: ObservationSemantics;
  metadata?: Record<string, string | number | boolean | null>;
};

export type Event = {
  id: string;
  subject: string;
  description: string;
  /** Actual occurrence time, when known. */
  occurredAt?: string;
  /** Scheduled event time, when known. */
  scheduledAt?: string;
  /** Result/release time, when applicable and known. */
  releasedAt?: string;
  /** P365 retrieval/capture timestamp. */
  retrievedAt: string;
  status: EventStatus;
  importance: "HIGH" | "MEDIUM" | "LOW";
  sourceId: string;
  evidenceId: string;
};

export type ContextScope =
  | "CRYPTO_MARKET"
  | "MACRO_MONETARY_POLICY"
  | "MACRO_LIQUIDITY"
  | "MACRO_INFLATION"
  | "MACRO_LABOR"
  | "MACRO_RATES"
  | "MACRO_USD"
  | "MACRO_GROWTH"
  | "ECONOMIC_EVENTS";

export type Context = {
  id: string;
  scope: ContextScope;
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

export type Risk = {
  id: string;
  domain: string;
  level: RiskLevel;
  statement: string;
  reason: string;
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
  evidenceIds: string[];
  createdAt: string;
};

export type ProviderHealth = {
  sourceId: string;
  status: SourceHealthStatus;
  fetchedAt: string;
  itemCount: number;
  message?: string;
};
