import { describe, expect, it } from "vitest";
import type { PortalService } from "@/types/portal";
import {
  EMPTY_FILTERS,
  buildFilterOptions,
  describeServiceMetadata,
  filterProjects,
  hasActiveFilters,
  projectHealth,
  projectsFromResponse,
  sortProjects,
  summarizeProjects,
} from "../projectModel";

const CHECKED = "2026-09-22T00:00:00.000Z";

function project(overrides: Partial<PortalService> & { id: string }): PortalService {
  return {
    name: overrides.id,
    healthy: true,
    checkedAt: CHECKED,
    projectType: "Service",
    ...overrides,
  };
}

describe("projectHealth", () => {
  it("never calls a library down", () => {
    expect(projectHealth(project({ id: "lib", projectType: "Library", healthy: false }))).toBe(
      "not-deployed",
    );
  });

  it("is unknown before the first check", () => {
    expect(projectHealth(project({ id: "a", healthy: false, checkedAt: undefined }))).toBe(
      "unknown",
    );
  });

  it("follows the health check otherwise", () => {
    expect(projectHealth(project({ id: "a" }))).toBe("healthy");
    expect(projectHealth(project({ id: "a", healthy: false }))).toBe("down");
  });
});

describe("projectsFromResponse", () => {
  const services = [project({ id: "api" }), project({ id: "legacy", projectType: "Infrastructure" })];
  const infrastructure = [project({ id: "mongodb", projectType: "Database" })];

  it("leaves infrastructure out by default", () => {
    expect(projectsFromResponse(services, infrastructure, false).map((item) => item.id)).toEqual([
      "api",
    ]);
  });

  it("includes the real infrastructure list when the setting is on", () => {
    const items = projectsFromResponse(services, infrastructure, true);
    expect(items.map((item) => item.id)).toEqual(["api", "legacy", "mongodb"]);
    expect(items.find((item) => item.id === "mongodb")?.isInfrastructure).toBe(true);
  });
});

describe("filterProjects", () => {
  const items = [
    project({ id: "api", name: "API", device: "Synology", visibility: "internal" }),
    project({ id: "web", name: "Web", healthy: false, visibility: "external", domain: "rod.dev" }),
    project({ id: "kit", name: "Kit", projectType: "Library", healthy: false }),
    project({ id: "new", name: "New", healthy: false, checkedAt: undefined }),
  ];
  const ids = (list: PortalService[]) => list.map((item) => item.id);

  it("matches status against real health (libraries and unchecked are neither)", () => {
    expect(ids(filterProjects(items, { ...EMPTY_FILTERS, status: ["unhealthy"] }, ""))).toEqual([
      "web",
    ]);
    expect(ids(filterProjects(items, { ...EMPTY_FILTERS, status: ["healthy"] }, ""))).toEqual([
      "api",
    ]);
  });

  it("combines select filters with search", () => {
    expect(ids(filterProjects(items, { ...EMPTY_FILTERS, visibility: ["external"] }, ""))).toEqual([
      "web",
    ]);
    expect(ids(filterProjects(items, EMPTY_FILTERS, " ROD.DEV "))).toEqual(["web"]);
    expect(ids(filterProjects(items, { ...EMPTY_FILTERS, device: ["Synology"] }, "api"))).toEqual([
      "api",
    ]);
  });

  it("knows when a filter is active", () => {
    expect(hasActiveFilters(EMPTY_FILTERS, "  ")).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, device: ["x"] }, "")).toBe(true);
  });
});

describe("buildFilterOptions", () => {
  it("derives type and device options from the data", () => {
    const options = buildFilterOptions([
      project({ id: "a", projectType: "Client", device: "b-host" }),
      project({ id: "b", projectType: "Bot", device: "a-host" }),
      project({ id: "c", projectType: "Client" }),
    ]);
    expect(Object.keys(options)).toEqual([
      "status",
      "visibility",
      "environment",
      "projectType",
      "device",
    ]);
    expect(options.projectType.values.map((option) => option.value)).toEqual(["Bot", "Client"]);
    expect(options.device.values.map((option) => option.value)).toEqual(["a-host", "b-host"]);
  });
});

describe("sortProjects", () => {
  const items = [
    project({ id: "b", name: "Beta", healthy: false }),
    project({ id: "a", name: "Alpha" }),
    project({ id: "c", name: "Gamma", projectType: "Library" }),
  ];
  const context = {
    sizes: { a: { sizeBytes: 10, sizeKB: 0 }, b: { sizeBytes: 300, sizeKB: 0 } },
    languages: {
      a: { primary: "TypeScript", breakdown: [] },
      b: { primary: "Go", breakdown: [] },
      c: { primary: "Rust", breakdown: [] },
    },
  };
  const names = (key: string, direction: "asc" | "desc") =>
    sortProjects(items, key, direction, context).map((item) => item.name);

  it("sorts by name", () => {
    expect(names("name", "asc")).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(names("name", "desc")).toEqual(["Gamma", "Beta", "Alpha"]);
  });

  it("sorts by language and size (these columns used to do nothing)", () => {
    expect(names("language", "asc")).toEqual(["Beta", "Gamma", "Alpha"]);
    expect(names("size", "desc")).toEqual(["Beta", "Alpha", "Gamma"]);
  });

  it("puts healthy first when sorting status ascending", () => {
    expect(names("status", "asc")).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("does not mutate its input", () => {
    const copy = [...items];
    sortProjects(items, "name", "desc", context);
    expect(items).toEqual(copy);
  });
});

describe("summarizeProjects", () => {
  it("separates down from not-yet-checked", () => {
    const summary = summarizeProjects([
      project({ id: "a", device: "nas" }),
      project({ id: "b", healthy: false, device: "nas" }),
      project({ id: "c", healthy: false, checkedAt: undefined, device: "pc" }),
      project({ id: "d", projectType: "Library", healthy: false }),
    ]);
    expect(summary).toMatchObject({
      total: 4,
      deployed: 3,
      nonDeployed: 1,
      healthy: 1,
      down: 1,
      unknown: 1,
      devices: ["nas", "pc"],
      types: ["Library", "Service"],
    });
  });
});

describe("describeServiceMetadata", () => {
  it("lists scalar metadata only, never objects from arbitrary health JSON", () => {
    const fields = describeServiceMetadata(
      project({
        id: "a",
        metadata: { version: { major: 1 } as unknown as string, nodeVersion: "v24.1.0" },
      }),
    );
    expect(fields).toEqual([{ label: "Node", value: "v24.1.0", mono: true }]);
  });

  it("adds the infrastructure figures for infrastructure entries", () => {
    const fields = describeServiceMetadata(
      project({
        id: "mongodb",
        isInfrastructure: true,
        metadata: { version: "8.0.4", uptime: 90, connections: 12, bucketNames: [] },
      }),
    );
    expect(fields.map((field) => field.label)).toEqual(["Version", "Uptime", "Connections"]);
  });
});
