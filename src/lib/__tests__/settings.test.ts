import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  SETTING_LIMITS,
  clampSetting,
  getSettings,
  resetSettings,
  sanitizeSettings,
  updateSettings,
} from "@/lib/settings";

// Node's experimental localStorage shadows jsdom's in this environment, so
// state is driven through updateSettings/resetSettings, never storage.
describe("settings store", () => {
  beforeEach(() => {
    resetSettings();
  });

  it("starts from the defaults", () => {
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("merges a partial update and notifies subscribers", () => {
    const listener = vi.fn();
    window.addEventListener("portal:settings-change", listener);
    updateSettings({ showResponseTimes: false });
    window.removeEventListener("portal:settings-change", listener);

    expect(getSettings().showResponseTimes).toBe(false);
    expect(getSettings().defaultView).toBe(DEFAULT_SETTINGS.defaultView);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clamps numeric settings into their limits on write", () => {
    updateSettings({ healthCheckInterval: 0, containerPollingInterval: 9999 });
    expect(getSettings().healthCheckInterval).toBe(
      SETTING_LIMITS.healthCheckInterval.min,
    );
    expect(getSettings().containerPollingInterval).toBe(
      SETTING_LIMITS.containerPollingInterval.max,
    );
  });

  it("drops invalid enum values and unknown landing pages", () => {
    updateSettings({
      defaultView: "grid" as "card",
      defaultPage: "/nonsense",
    });
    expect(getSettings().defaultView).toBe(DEFAULT_SETTINGS.defaultView);
    expect(getSettings().defaultPage).toBe(DEFAULT_SETTINGS.defaultPage);
  });

  it("resets to the defaults", () => {
    updateSettings({ alertThresholdCpu: 50, telemetryEnabled: false });
    resetSettings();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe("sanitizeSettings", () => {
  it("keeps valid values and drops unknown keys and wrong types", () => {
    expect(
      sanitizeSettings({
        defaultView: "card",
        defaultPage: "/logs",
        showSystemSummary: "yes",
        alertThresholdCpu: 55,
        legacyAccentColor: "#fff",
      }),
    ).toEqual({
      defaultView: "card",
      defaultPage: "/logs",
      alertThresholdCpu: 55,
    });
  });

  it("drops non-finite numbers and clamps the rest", () => {
    expect(
      sanitizeSettings({
        healthCheckInterval: Number.NaN,
        alertThresholdMemory: 250,
        containerPollingInterval: 2.6,
      }),
    ).toEqual({ alertThresholdMemory: 100, containerPollingInterval: 3 });
  });
});

describe("clampSetting", () => {
  it("rounds and bounds a value", () => {
    expect(clampSetting("alertThresholdCpu", 4)).toBe(10);
    expect(clampSetting("alertThresholdCpu", 101)).toBe(100);
    expect(clampSetting("healthCheckInterval", 29.4)).toBe(29);
  });
});
