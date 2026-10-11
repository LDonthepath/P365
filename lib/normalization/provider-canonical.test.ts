import assert from "node:assert/strict";
import type { CalendarEvent, NewsItem } from "../data/types";
import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { MacroObservationInput } from "../data/fred";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import {
  calendarToCanonicalRecords as calendarFromProvider,
  cryptoMarketToObservations as marketFromProvider,
  macroToCanonicalRecords as macroFromProvider,
  newsToEvidence as newsFromProvider,
} from "./provider-canonical";
import {
  calendarToCanonicalRecords as calendarFromCanonical,
  cryptoMarketToObservations as marketFromCanonical,
  macroToCanonicalRecords as macroFromCanonical,
  newsToEvidence as newsFromCanonical,
} from "../domain/normalize";

function withoutCaptureTimes<T extends { retrievedAt: string }>(item: T): Omit<T, "retrievedAt"> {
  const { retrievedAt: _retrievedAt, ...fact } = item;
  void _retrievedAt;
  return fact;
}

function main(): void {
  const forexFixture: CalendarEvent = {
    id: "ff-2026-us-cpi", time: "19:30", event: "CPI m/m",
    country: "USD", impact: "HIGH", status: "UPCOMING",
    dateISO: "2026-10-13T12:30:00.000Z",
  };
  const ff = calendarFromProvider([forexFixture], "forex-factory");
  const ffQualified = calendarFromCanonical([{
    id: forexFixture.id, event: forexFixture.event,
    country: forexFixture.country, impact: forexFixture.impact,
    status: forexFixture.status, dateISO: forexFixture.dateISO,
    jurisdiction: ¶»§q«^