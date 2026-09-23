import { describe, it, expect } from "vitest";
import { resolvePortalServiceUrl } from "@/config";

const urls = {
  internalUrl: "http://10.0.0.5:4001",
  publicUrl: "https://api.portal.example/",
};

describe("resolvePortalServiceUrl", () => {
  it("uses the internal URL on the server", () => {
    expect(resolvePortalServiceUrl({ pageHost: null, ...urls })).toBe(
      "http://10.0.0.5:4001",
    );
  });

  it("uses the internal URL for a page on a private host", () => {
    expect(
      resolvePortalServiceUrl({ pageHost: "localhost:4000", ...urls }),
    ).toBe("http://10.0.0.5:4001");
    expect(
      resolvePortalServiceUrl({ pageHost: "192.168.1.20:4000", ...urls }),
    ).toBe("http://10.0.0.5:4001");
  });

  it("uses the public URL (no trailing slash) for a page on a public host", () => {
    expect(
      resolvePortalServiceUrl({ pageHost: "portal.example", ...urls }),
    ).toBe("https://api.portal.example");
  });

  it("falls back to whichever URL exists, else empty", () => {
    expect(
      resolvePortalServiceUrl({
        pageHost: "portal.example",
        internalUrl: "http://10.0.0.5:4001",
        publicUrl: undefined,
      }),
    ).toBe("http://10.0.0.5:4001");
    expect(
      resolvePortalServiceUrl({
        pageHost: null,
        internalUrl: undefined,
        publicUrl: undefined,
      }),
    ).toBe("");
  });
});
