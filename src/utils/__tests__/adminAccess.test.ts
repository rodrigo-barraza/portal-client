import { describe, it, expect } from "vitest";
import {
  ADMIN_ROLE,
  canAccessAdminSide,
  hasAdminRole,
  isPrivateHost,
} from "@/utils/adminAccess";

describe("isPrivateHost", () => {
  it.each([
    "localhost",
    "localhost:4000",
    "127.0.0.1",
    "10.2.3.4:80",
    "172.16.0.1",
    "192.168.86.2:4000",
    "[::1]:4000",
  ])("treats %s as private", (host) => expect(isPrivateHost(host)).toBe(true));

  it.each([
    "portal.example",
    "172.32.0.1",
    "8.8.8.8",
    "localhost.evil.com",
    "",
    null,
    undefined,
  ])("treats %s as public", (host) => expect(isPrivateHost(host)).toBe(false));
});

describe("admin gate", () => {
  it("requires the admin role on public hosts", () => {
    expect(hasAdminRole([ADMIN_ROLE])).toBe(true);
    expect(hasAdminRole(["viewer"])).toBe(false);
    expect(hasAdminRole(undefined)).toBe(false);
    expect(canAccessAdminSide({ roles: [], host: "portal.example" })).toBe(
      false,
    );
    expect(
      canAccessAdminSide({ roles: [ADMIN_ROLE], host: "portal.example" }),
    ).toBe(true);
  });

  it("lets private-network hosts through (no session exists there)", () => {
    expect(canAccessAdminSide({ roles: null, host: "localhost:4000" })).toBe(
      true,
    );
  });
});
