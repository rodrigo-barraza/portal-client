"use client";

import { useSyncExternalStore } from "react";

/**
 * Portal settings store — single source of truth for user preferences.
 *
 * Settings persist to localStorage and broadcast changes via a custom
 * event so every consumer (Projects, Containers, session tracker, root
 * redirect) re-renders live when a setting changes, including across tabs.
 *
 * Every setting here is consumed somewhere real — do not add settings
 * that nothing reads.
 */
export interface PortalSettings {
  // Dashboard
  defaultView: "card" | "table";
  defaultPage: string;
  showSystemSummary: boolean;
  showInfrastructure: boolean;

  // Monitoring
  autoRefreshEnabled: boolean;
  /** Seconds between project health polls */
  healthCheckInterval: number;
  /** Seconds between Docker container stats polls */
  containerPollingInterval: number;
  showResponseTimes: boolean;
  /** Highlight containers above this CPU percentage */
  alertThresholdCpu: number;
  /** Highlight containers above this memory percentage */
  alertThresholdMemory: number;

  // Data & Privacy
  telemetryEnabled: boolean;
}

export const DEFAULT_SETTINGS: PortalSettings = {
  defaultView: "table",
  defaultPage: "/containers",
  showSystemSummary: true,
  showInfrastructure: false,

  autoRefreshEnabled: true,
  healthCheckInterval: 30,
  containerPollingInterval: 5,
  showResponseTimes: true,
  alertThresholdCpu: 80,
  alertThresholdMemory: 85,

  telemetryEnabled: true,
};

/** Pages a user can pick as their landing page (root `/` redirects here). */
export const LANDING_PAGES = [
  { value: "/containers", label: "Containers" },
  { value: "/projects", label: "Projects" },
  { value: "/devices", label: "Devices" },
  { value: "/topology", label: "Topology" },
  { value: "/logs", label: "Logs" },
  { value: "/object-store", label: "Object Store" },
] as const;

const STORAGE_KEY = "portal:settings";
const CHANGE_EVENT = "portal:settings-change";

let cachedSnapshot: PortalSettings | null = null;

/** Keep only known keys with sane types; drop legacy/dead keys silently. */
function sanitize(stored: Record<string, unknown>): Partial<PortalSettings> {
  const next: Partial<PortalSettings> = {};
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof PortalSettings)[]) {
    const value = stored[key];
    const defaultValue = DEFAULT_SETTINGS[key];
    if (typeof value === typeof defaultValue) {
      if (typeof value === "number" && !Number.isFinite(value)) continue;
      (next as Record<string, unknown>)[key] = value;
    }
  }
  return next;
}

function readFromStorage(): PortalSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...sanitize(JSON.parse(stored)) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function getSettings(): PortalSettings {
  if (!cachedSnapshot) cachedSnapshot = readFromStorage();
  return cachedSnapshot;
}

export function updateSettings(partial: Partial<PortalSettings>): void {
  cachedSnapshot = { ...getSettings(), ...partial };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedSnapshot));
  } catch {
    // localStorage unavailable/full — keep the in-memory value
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function resetSettings(): void {
  cachedSnapshot = { ...DEFAULT_SETTINGS };
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function subscribe(callback: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    cachedSnapshot = null; // another tab wrote — re-read
    callback();
  };
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function getServerSnapshot(): PortalSettings {
  return DEFAULT_SETTINGS;
}

/** Live-updating settings — re-renders on any settings change, in any tab. */
export function usePortalSettings(): PortalSettings {
  return useSyncExternalStore(subscribe, getSettings, getServerSnapshot);
}
