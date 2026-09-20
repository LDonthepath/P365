import type { Jurisdiction } from "../domain/types";

export const EVENT_INGESTION_JURISDICTIONS = ["US", "CHINA", "JAPAN"] as const;
export type EventIngestionJurisdiction = typeof EVENT_INGESTION_JURISDICTIONS[number];

const FOREX_FACTORY_JURISDICTIONS: Readonly<Record<string, Jurisdiction>> = {
  USD: "US",
  CNY: "CHINA",
  JPY: "JAPAN",
};

const BIQUOTE_JURISDICTIONS: Readonly<Record<string, Jurisdiction>> = {
  US: "US",
  CN: "CHINA",
  JP: "JAPAN",
};

const BIQUOTE_COUNTRY_CODES: Readonly<Record<EventIngestionJurisdiction, string>> = {
  US: "US",
  CHINA: "CN",
  JAPAN: "JP",
};

export function forexFactoryJurisdiction(country: string): Jurisdiction {
  return FOREX_FACTORY_JURISDICTIONS[country.trim().toUpperCase()] ?? "OTHER";
}

export function biquoteJurisdiction(countryCode: string): Jurisdiction {
  return BIQUOTE_JURISDICTIONS[countryCode.trim().toUpperCase()] ?? "OTHER";
}

export function biquoteCountryCode(jurisdiction: EventIngestionJurisdiction): string {
  return BIQUOTE_COUNTRY_CODES[jurisdiction];
}
