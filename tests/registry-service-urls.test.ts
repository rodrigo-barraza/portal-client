import { describe, it, expect } from "vitest";
import { deriveServiceUrls } from "../scripts/registry-service-urls.mjs";

describe("deriveServiceUrls", () => {
  const registry = {
    defaultHost: "10.1.2.3",
    projects: [
      { id: "portal-service", port: 4001, domain: "api.portal.example" },
      { id: "vault-service", port: 5599 },
    ],
  };

  it("derives internal and public URLs like the vault does", () => {
    expect(
      deriveServiceUrls(registry, [
        "portal-service",
        "vault-service",
        "missing",
      ]),
    ).toEqual({
      PORTAL_SERVICE_URL: "http://10.1.2.3:4001",
      PORTAL_SERVICE_PUBLIC_URL: "https://api.portal.example",
      VAULT_SERVICE_URL: "http://10.1.2.3:5599",
    });
  });

  it("returns nothing without a default host or port", () => {
    expect(deriveServiceUrls({ projects: [{ id: "x" }] }, ["x"])).toEqual({});
  });
});
