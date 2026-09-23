import { describe, it, expect } from "vitest";
import { formatSize } from "@/lib/format";

describe("formatSize (kilobytes)", () => {
  it("keeps small sizes in KB, rounded to one decimal", () => {
    expect(formatSize(0)).toBe("0 KB");
    expect(formatSize(6.5)).toBe("6.5 KB");
    expect(formatSize(0.1 + 0.2)).toBe("0.3 KB");
    expect(formatSize(22.299999999999997)).toBe("22.3 KB");
  });

  it("switches to MB and GB", () => {
    expect(formatSize(1024)).toBe("1.0 MB");
    expect(formatSize(1536)).toBe("1.5 MB");
    expect(formatSize(1024 * 1024 * 2.25)).toBe("2.3 GB");
  });
});
