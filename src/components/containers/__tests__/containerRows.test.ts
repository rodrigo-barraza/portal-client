import { describe, expect, it } from "vitest";
import type { PortalService } from "@/types/portal";
import { deviceSystemInfo } from "../../__tests__/apiFixtures";
import {
  buildContainerRows,
  classifyContainer,
  containerStatusKind,
  filterContainerRows,
  memoryUsage,
  normalizeSystemInfo,
  summarizeContainers,
  type DockerContainer,
  type HostMemory,
} from "../containerRows";

const GIB = 1024 ** 3;

function container(
  overrides: Partial<DockerContainer> & { name: string },
): DockerContainer {
  return {
    device: "synology",
    state: "running",
    status: "Up 2 hours",
    cpu: { percent: 10, cores: 4 },
    memory: { used: GIB, limit: 16 * GIB, percent: 6.25 },
    network: { rx: 100, tx: 50 },
    ...overrides,
  };
}

function service(
  overrides: Partial<PortalService> & { id: string },
): PortalService {
  return {
    name: overrides.id,
    healthy: true,
    checkedAt: "2026-09-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("classifyContainer", () => {
  it("prefers the registry type, falling back to the name", () => {
    expect(classifyContainer("ledger", "Client")).toBe("client");
    expect(classifyContainer("lupos-bot")).toBe("bot");
    expect(classifyContainer("prism-client")).toBe("client");
    expect(classifyContainer("mongodb")).toBe("service");
  });
});

describe("containerStatusKind", () => {
  it("trusts Docker when the container is not running", () => {
    // The registry health cache still says healthy right after a stop.
    expect(
      containerStatusKind("exited", service({ id: "a", healthy: true })),
    ).toBe("down");
  });

  it("defers to the registry health check for running services", () => {
    expect(
      containerStatusKind("running", service({ id: "a", healthy: false })),
    ).toBe("down");
    expect(
      containerStatusKind("running", service({ id: "a", healthy: true })),
    ).toBe("healthy");
  });

  it("is unknown until the first health check lands", () => {
    expect(
      containerStatusKind(
        "running",
        service({ id: "a", healthy: false, checkedAt: undefined }),
      ),
    ).toBe("unknown");
  });

  it("treats unregistered running containers as healthy", () => {
    expect(containerStatusKind("running", null)).toBe("healthy");
  });
});

describe("buildContainerRows", () => {
  it("gives same-named containers on different hosts distinct ids", () => {
    const rows = buildContainerRows(
      [
        container({ name: "prism-service" }),
        container({ name: "prism-service", device: "workstation" }),
      ],
      [service({ id: "prism", dockerProject: "prism-service" })],
    );
    expect(rows.map((row) => row.id)).toEqual([
      "synology::prism-service",
      "workstation::prism-service",
    ]);
    expect(rows.every((row) => row.serviceId === "prism")).toBe(true);
  });

  it("joins registry metadata by dockerProject", () => {
    const [row] = buildContainerRows(
      [container({ name: "ledger-client" })],
      [
        service({
          id: "ledger-client",
          dockerProject: "ledger-client",
          projectType: "Client",
          port: 3000,
          domain: "ledger.rod.dev",
          responseTimeMs: 42,
          visibility: "external",
        }),
      ],
    );
    expect(row).toMatchObject({
      serviceId: "ledger-client",
      registered: true,
      restartable: true,
      projectType: "client",
      port: 3000,
      domain: "ledger.rod.dev",
      responseTimeMs: 42,
      visibility: "external",
      statusKind: "healthy",
    });
  });

  it("leaves unregistered containers without a service id", () => {
    const [row] = buildContainerRows([container({ name: "watchtower" })], []);
    expect(row).toMatchObject({
      serviceId: null,
      registered: false,
      restartable: false,
    });
  });

  it("sorts by name, then device", () => {
    const rows = buildContainerRows(
      [
        container({ name: "b", device: "synology" }),
        container({ name: "a", device: "workstation" }),
        container({ name: "a", device: "synology" }),
      ],
      [],
    );
    expect(rows.map((row) => row.id)).toEqual([
      "synology::a",
      "workstation::a",
      "synology::b",
    ]);
  });
});

describe("filterContainerRows", () => {
  const rows = buildContainerRows(
    [
      container({ name: "prism-client", device: "synology" }),
      container({ name: "prism-service", device: "workstation" }),
      container({ name: "lupos-bot", device: "synology" }),
    ],
    [
      service({
        id: "prism-client",
        dockerProject: "prism-client",
        domain: "prism.rod.dev",
      }),
    ],
  );

  it("filters by device, type and search text together", () => {
    const names = (filters: Parameters<typeof filterContainerRows>[1]) =>
      filterContainerRows(rows, filters).map((row) => row.containerName);
    expect(names({ devices: ["synology"], types: [], query: "" })).toEqual([
      "lupos-bot",
      "prism-client",
    ]);
    expect(names({ devices: [], types: ["bot"], query: "" })).toEqual([
      "lupos-bot",
    ]);
    expect(names({ devices: [], types: [], query: "  PRISM " })).toEqual([
      "prism-client",
      "prism-service",
    ]);
    expect(names({ devices: [], types: [], query: "rod.dev" })).toEqual([
      "prism-client",
    ]);
    expect(
      names({ devices: ["synology"], types: ["service"], query: "" }),
    ).toEqual([]);
  });
});

describe("normalizeSystemInfo", () => {
  it("normalizes to an array and treats empty as missing", () => {
    const host = deviceSystemInfo({ deviceId: "a" });
    expect(normalizeSystemInfo(host)).toEqual([host]);
    expect(normalizeSystemInfo([host])).toEqual([host]);
    expect(normalizeSystemInfo([])).toBeNull();
  });
});

describe("memoryUsage", () => {
  it("treats a host-sized limit as uncapped", () => {
    expect(
      memoryUsage({ used: GIB, limit: 16 * GIB, percent: 6.25 }, 16 * GIB),
    ).toEqual({
      capped: false,
      percent: 6.25,
    });
  });

  it("measures capped containers against their own limit", () => {
    expect(
      memoryUsage({ used: GIB, limit: 2 * GIB, percent: 6.25 }, 16 * GIB),
    ).toEqual({
      capped: true,
      percent: 50,
    });
  });
});

describe("summarizeContainers", () => {
  const rows = buildContainerRows(
    [
      container({
        name: "a",
        device: "synology",
        cpu: { percent: 30, cores: 4 },
      }),
      container({
        name: "b",
        device: "workstation",
        state: "exited",
        status: "Exited (0) 1 hour ago",
        cpu: { percent: 0, cores: 4 },
        memory: { used: 0, limit: 32 * GIB, percent: 0 },
      }),
    ],
    [service({ id: "a", dockerProject: "a", responseTimeMs: 100 })],
  );
  const systemInfo: HostMemory[] = [
    { deviceId: "synology", totalMemory: 16 * GIB },
    { deviceId: "workstation", totalMemory: 32 * GIB },
  ];

  it("counts health and running state from the rows", () => {
    const summary = summarizeContainers(rows, systemInfo, []);
    expect(summary).toMatchObject({
      total: 2,
      healthy: 1,
      running: 1,
      stopped: 1,
      totalCpu: 30,
      averageCpu: 15,
      memoryUsed: GIB,
      memoryLimit: 48 * GIB,
      networkRx: 200,
      responseSamples: 1,
      averageResponseMs: 100,
    });
  });

  it("limits host RAM to the selected devices", () => {
    expect(
      summarizeContainers(rows, systemInfo, ["synology"]).memoryLimit,
    ).toBe(16 * GIB);
  });

  it("falls back to the per-device cgroup limit without system info", () => {
    expect(summarizeContainers(rows, null, []).memoryLimit).toBe(48 * GIB);
  });
});
