"use client";

import type { DataQuality, Observation } from "@/lib/domain/types";

const STATUS_LABEL_ID: Record<"PENDING" | "FRESH" | "PARTIAL" | "UNAVAILABLE", string> = {
  PENDING: "BELUM ADA",
  FRESH: "TERBARU",
  PARTIAL: "SEBAGIAN",
  UNAVAILABLE: "TIDAK TERSEDIA",
};
export function StatusBadge({ value }: { value: "PENDING" | "FRESH" | "PARTIAL" | "UNAVAILABLE" }) {
  return <span className={`status-badge ${value.toLowerCase()}`}>{STATUS_LABEL_ID[value]}</span>;
}

export function EmptyPanelNote({ label }: { label: string }) {
  return <p className="muted">Data {label} belum tersedia saat ini. Coba muat ulang beberapa saat lagi.</p>;
}


export function observationStatus(qualities: DataQuality[]): "PENDING" | "FRESH" | "PARTIAL" {
  return qualities.length === 0 ? "PENDING" : qualities.every((item) => item === "FRESH") ? "FRESH" : "PARTIAL";
}


export function numberValue(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatSignedMoney(value: number): string {
  return `${value > 0 ? "+" : ""}${formatMoney(value)}`;
}

export function formatSignedPercentValue(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatContracts(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function recencyLabel(value: "CURRENT" | "STALE" | "UNKNOWN"): string {
  if (value === "CURRENT") return "TERBARU";
  if (value === "STALE") return "PERLU DIPERBARUI";
  return "STATUS WAKTU BELUM PASTI";
}

export function qualityLabel(value: DataQuality): string {
  if (value === "FRESH") return "TERBARU";
  if (value === "STALE") return "PERLU DIPERBARUI";
  return "TERSEDIA";
}

export function observationChangePercent(observation: Observation | undefined): number | null {
  const raw = observation?.metadata?.changePct;
  if (raw === null || raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function TerminalChange({ value, label = "PERUBAHAN" }: { value: number | null; label?: string }) {
  const direction = value === null || value === 0 ? "neutral" : value > 0 ? "up" : "down";
  return <span className={`terminal-change ${direction}`}>{label} {value === null ? "—" : formatSignedPercentValue(value)}</span>;
}

export function marketTapeQualityTone(value: DataQuality | undefined): "current" | "stale" | "neutral" {
  if (value === "FRESH") return "current";
  if (value === "STALE") return "stale";
  return "neutral";
}



