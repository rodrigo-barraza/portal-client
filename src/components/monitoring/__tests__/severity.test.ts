import { describe, expect, it } from "vitest";
import { severityColor, severityOf, thresholdsFromSettings } from "../severity";

describe("severity", () => {
  it("escalates strictly above each bound", () => {
    expect(severityOf(40, [40, 80])).toBe("success");
    expect(severityOf(40.1, [40, 80])).toBe("warning");
    expect(severityOf(80, [40, 80])).toBe("warning");
    expect(severityOf(80.1, [40, 80])).toBe("danger");
  });

  it("maps to the theme's semantic colour tokens", () => {
    expect(severityColor(10, [40, 80])).toBe("var(--color-success)");
    expect(severityColor(95, [40, 80])).toBe("var(--color-danger)");
  });

  it("takes the alert ceiling from the user's settings", () => {
    const thresholds = thresholdsFromSettings({
      alertThresholdCpu: 90,
      alertThresholdMemory: 70,
    });
    expect(thresholds.cpu).toEqual([40, 90]);
    expect(thresholds.memory).toEqual([60, 70]);
    expect(severityOf(85, thresholds.cpu)).toBe("warning");
    expect(severityOf(75, thresholds.memory)).toBe("danger");
  });
});
