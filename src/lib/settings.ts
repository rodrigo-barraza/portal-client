"use client";

import { useSyncExternalStore } from "react";
import { SETTINGS_STORAGE_KEY } from "./storageKeys";

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

/** Allowed range of every numeric setting (inclusive). Values outside it are
 *  clamped on write and on read, so a hand-edited or stale stored value can
 *  never, say, poll health every 0 seconds. */
export const SETTING_LIMITS = {
  healthCheckInterval: { min: 5, max: 300 },
  containerPollingInterval: { min: 1, max: 60 },
  alertThresholdCpu: { min: 10, max: 100 },
  alertThresholdMemory: { min: 10, max: 100 },
} as const satisfies Partial<
  Record<keyof PortalSettings, { min: number; max: number }>
>;

type LimitedSetting = keyof typeof SETTING_LIMITS;

const VIEW_MODES: readonly PortalSettings["defaultView"][] = ["card", "table"];

const CHANGE_EVENT = "portal:settings-change";

let cachedSnapshot: PortalSettings | null = null;

function isLimitedSetting(key: keyof PortalSettings): key is LimitedSetting {
  return key in SETTING_LIMITS;
}

/** Clamp a numeric setting into its allowed range (whole numbers only). */
export function clampSetting(key: LimitedSetting, value: number): number {
  const { min, max } = SETTING_LIMITS[key];
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Keep only known keys with valid values: right type, numbers finite and
 * clamped into range, enums and landing pages from their allowed sets.
 * Legacy/dead keys and invalid values are dropped silently.
 */
export function sanitizeSettings(
  stored: Record<string, unknown>,
): Partial<PortalSettings> {
  const next: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof PortalSettings)[]) {
    const value = stored[key];
    if (typeof value !== typeof DEFAULT_SETTINGS[key]) continue;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) continue;
      next[key] = isLimitedSetting(key) ? clampSetting(key, value) : value;
    } else if (key === "defaultView") {
      if (VIEW_MODES.includes(value as PortalSettings["defaultView"])) {
        next[key] = value;
      }
    } else if (key === "defaultPage") {
      if (LANDING_PAGES.some((page) => page.value === value)) next[key] = value;
    } else {
      next[key] = value;
    }
  }
  return next as Partial<PortalSettings>;
}

function readFromStorage(): PortalSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...sanitizeSettings(parsed as Record<string, unknown>),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function getSettings(): PortalSettings {
  if (!cachedSnapshot) cachedSnapshot = readFromStorage();
  return cachedSnapshot;
}

/** Merge `partial` into the settings. Invalid values are dropped and
 *  numbers are clamped into {@link SETTING_LIMITS}. */
export function updateSettings(partial: Partial<PortalSettings>): void {
  cachedSnapshot = { ...getSettings(), ...sanitizeSettings(partial) };
  try {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(cachedSnapshot),
    );
  } catch {
    // localStorage unavailable/full — keep the in-memory value
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function resetSettings(): void {
  cachedSnapshot = { ...DEFAULT_SETTINGS };
  try {
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function subscribe(callback: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== SETTINGS_STORAGE_KEY && event.key !== null) return;
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
