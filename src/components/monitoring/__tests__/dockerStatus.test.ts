import { describe, expect, it } from "vitest";
import {
  dockerUptimeSeconds,
  formatNanoseconds,
  formatUnixTimestamp,
  parseDockerUptime,
} from "../dockerStatus";

describe("parseDockerUptime", () => {
  it("reads the uptime out of Docker's status", () => {
    expect(parseDockerUptime("Up 2 hours")).toBe("2 hours");
    expect(parseDockerUptime("Up 5 minutes (healthy)")).toBe("5 minutes");
    expect(parseDockerUptime("Up About an hour (Paused)")).toBe(
      "About an hour",
    );
  });

  it("has no uptime for containers that are not up", () => {
    expect(parseDockerUptime("Exited (0) 3 days ago")).toBeNull();
    expect(parseDockerUptime("Created")).toBeNull();
    expect(parseDockerUptime("")).toBeNull();
    expect(parseDockerUptime(undefined)).toBeNull();
  });
});

describe("dockerUptimeSeconds", () => {
  it("inverts go-units HumanDuration for sorting", () => {
    expect(dockerUptimeSeconds("Up Less than a second")).toBe(0);
    expect(dockerUptimeSeconds("Up 1 second")).toBe(1);
    expect(dockerUptimeSeconds("Up About a minute")).toBe(60);
    expect(dockerUptimeSeconds("Up 45 minutes (healthy)")).toBe(2_700);
    expect(dockerUptimeSeconds("Up About an hour")).toBe(3_600);
    expect(dockerUptimeSeconds("Up 3 days")).toBe(259_200);
    expect(dockerUptimeSeconds("Up 2 weeks")).toBe(1_209_600);
  });

  it("orders longer uptimes after shorter ones", () => {
    const statuses = [
      "Up 3 days",
      "Up 5 minutes",
      "Up 2 hours",
      "Up About an hour",
    ];
    const sorted = [...statuses].sort(
      (first, second) =>
        (dockerUptimeSeconds(first) ?? 0) - (dockerUptimeSeconds(second) ?? 0),
    );
    expect(sorted).toEqual([
      "Up 5 minutes",
      "Up About an hour",
      "Up 2 hours",
      "Up 3 days",
    ]);
  });

  it("is null when not running or unparseable", () => {
    expect(dockerUptimeSeconds("Exited (137) 2 hours ago")).toBeNull();
    expect(dockerUptimeSeconds("Up forever")).toBeNull();
  });
});

describe("formatNanoseconds", () => {
  it("picks a readable unit", () => {
    expect(formatNanoseconds(0)).toBe("0s");
    expect(formatNanoseconds(12_500_000)).toBe("12.5ms");
    expect(formatNanoseconds(3_200_000_000)).toBe("3.2s");
    expect(formatNanoseconds(90_000_000_000)).toBe("1.5m");
  });
});

describe("formatUnixTimestamp", () => {
  it("renders a dash for missing timestamps", () => {
    expect(formatUnixTimestamp(0)).toBe("—");
    expect(formatUnixTimestamp(undefined)).toBe("—");
  });

  it("treats the value as seconds, not milliseconds", () => {
    expect(formatUnixTimestamp(1_758_000_000)).toContain("2025");
  });
});
