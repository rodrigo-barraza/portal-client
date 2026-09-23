import { describe, it, expect } from "vitest";
import type { PortalService } from "../../../types/portal";
import { projectAnalysis } from "../../__tests__/apiFixtures";
import {
  NODE_H,
  NODE_W,
  CLUSTER_PAD,
  MIN_ZOOM,
  buildTopologyServices,
  clusterRect,
  collectEdges,
  computeEdgeAnchors,
  computeLayers,
  computeLibraries,
  computeSelection,
  computeTypeGroups,
  edgeKey,
  edgePath,
  fitViewport,
  layoutTierNodes,
  layoutTypeNodes,
  matchServices,
  mergeAnalysisDeps,
  nodeBounds,
  typeClusterLabel,
  zoomAtPoint,
} from "../topologyLayout";

function service(
  id: string,
  overrides: Partial<PortalService> = {},
): PortalService {
  return { id, name: id, healthy: true, ...overrides };
}

describe("grouping", () => {
  it("groups by projectType in canonical order, extras last, members sorted", () => {
    const groups = computeTypeGroups([
      service("zeta", { projectType: "Service" }),
      service("lm", { projectType: "Inference" }),
      service("alpha", { projectType: "Service" }),
      service("web", { projectType: "Client" }),
      service("orphan"),
    ]);
    expect(groups.map((group) => group.type)).toEqual([
      "Service",
      "Client",
      "Inference",
      "Other",
    ]);
    expect(groups[0].members.map((member) => member.id)).toEqual([
      "alpha",
      "zeta",
    ]);
  });

  it("layers by deploy tier, defaulting to tier 2 and skipping non-tiered types", () => {
    const layers = computeLayers([
      service("db", { deployTier: 0 }),
      service("api", { deployTier: 1 }),
      service("bot"),
      service("lib", { projectType: "Library", deployTier: 0 }),
      service("weird", { deployTier: 9 }),
    ]);
    expect(layers.map((layer) => layer.map((entry) => entry.id))).toEqual([
      ["db"],
      ["api"],
      ["bot", "weird"],
    ]);
  });

  it("collects libraries, kits and tools alphabetically", () => {
    const libraries = computeLibraries([
      service("tool", { projectType: "Tool" }),
      service("api"),
      service("kit", { projectType: "Kit" }),
    ]);
    expect(libraries.map((entry) => entry.id)).toEqual(["kit", "tool"]);
  });

  it("labels type clusters with real plurals", () => {
    expect(typeClusterLabel("Library")).toBe("Libraries");
    expect(typeClusterLabel("Kit")).toBe("Toolkits");
    expect(typeClusterLabel("Inference")).toBe("Inference");
    expect(typeClusterLabel("Service")).toBe("Services");
  });
});

describe("layout", () => {
  it("places libraries left of the tiers without overlapping any node", () => {
    const tiers = [[service("db")], [service("a"), service("b")], []];
    const libraries = [service("lib1"), service("lib2"), service("lib3")];
    const positions = layoutTierNodes(tiers, libraries);

    expect(Object.keys(positions).sort()).toEqual([
      "a",
      "b",
      "db",
      "lib1",
      "lib2",
      "lib3",
    ]);
    const libraryRight = Math.max(
      ...["lib1", "lib2", "lib3"].map((id) => positions[id].x + NODE_W),
    );
    for (const id of ["db", "a", "b"])
      expect(positions[id].x).toBeGreaterThan(libraryRight);
    // Two library columns: the third wraps under the first
    expect(positions.lib3.x).toBe(positions.lib1.x);
    expect(positions.lib3.y).toBeGreaterThan(positions.lib1.y);
    // Tier 1 sits below tier 0
    expect(positions.a.y).toBeGreaterThan(positions.db.y + NODE_H);
  });

  it("lays type clusters out two per row without overlap", () => {
    const groups = computeTypeGroups([
      service("s1", { projectType: "Service" }),
      service("c1", { projectType: "Client" }),
      service("b1", { projectType: "Bot" }),
    ]);
    const positions = layoutTypeNodes(groups);
    expect(positions.c1.x).toBeGreaterThan(positions.s1.x + NODE_W);
    expect(positions.c1.y).toBe(positions.s1.y);
    expect(positions.b1.y).toBeGreaterThan(positions.s1.y + NODE_H);
  });
});

describe("edges", () => {
  it("builds dependency → dependent edges typed by the target's projectType", () => {
    const edges = collectEdges([
      service("api", {
        dependsOn: [
          "mongodb",
          { id: "lib", name: "lib", criticality: "optional" },
          { id: "api", name: "api" },
          "missing",
          { id: "mongodb", name: "MongoDB" },
        ],
      }),
      service("mongodb", { projectType: "Database" }),
      service("lib", { projectType: "Library" }),
    ]);
    expect(edges).toEqual([
      {
        source: "mongodb",
        target: "api",
        criticality: "required",
        type: "infra",
      },
      { source: "lib", target: "api", criticality: "optional", type: "import" },
    ]);
  });

  it("classifies edges into inference servers as infrastructure", () => {
    const edges = collectEdges([
      service("prism", { dependsOn: ["lm-studio"] }),
      service("lm-studio", { projectType: "Inference" }),
    ]);
    expect(edges[0].type).toBe("infra");
  });

  it("keys edges unambiguously even for hyphenated ids", () => {
    expect(edgeKey("a-b", "c")).not.toBe(edgeKey("a", "b-c"));
  });

  it("anchors side-by-side nodes horizontally and stacked nodes vertically", () => {
    expect(computeEdgeAnchors({ x: 0, y: 0 }, { x: 300, y: 10 })).toMatchObject(
      {
        side1: "right",
        side2: "left",
        x1: NODE_W,
        x2: 300,
      },
    );
    expect(computeEdgeAnchors({ x: 0, y: 200 }, { x: 10, y: 0 })).toMatchObject(
      {
        side1: "top",
        side2: "bottom",
        y1: 200,
        y2: NODE_H,
      },
    );
  });

  it("draws a cubic path between the anchors", () => {
    const path = edgePath(computeEdgeAnchors({ x: 0, y: 0 }, { x: 300, y: 0 }));
    expect(path).toMatch(/^M 130 32 C /);
    expect(path.endsWith("300 32")).toBe(true);
  });
});

describe("analysis merge", () => {
  const analysis = projectAnalysis({
    dependencies: {
      api: {
        imports: [
          { target: "lib", package: "@acme/lib" },
          { target: "mongodb", package: "mongodb" },
        ],
        apiCalls: [
          { target: "auth", envVar: "AUTH_SERVICE_URL" },
          { target: "lib", envVar: "LIB_SERVICE_URL" },
        ],
      },
      idle: { imports: [], apiCalls: [] },
    },
  });

  it("appends only newly detected dependencies, deduped", () => {
    const [merged] = mergeAnalysisDeps(
      [service("api", { dependsOn: ["mongodb"] })],
      analysis,
    );
    expect(merged.dependsOn).toEqual([
      "mongodb",
      { id: "lib", name: "lib", criticality: "required", source: "detected" },
      { id: "auth", name: "auth", criticality: "required", source: "detected" },
    ]);
  });

  it("returns untouched services when nothing new was detected", () => {
    const idle = service("idle", { dependsOn: ["x"] });
    expect(mergeAnalysisDeps([idle], analysis)[0]).toBe(idle);
    expect(mergeAnalysisDeps([idle], null)[0]).toBe(idle);
  });

  it("flattens services and infrastructure, flagging infrastructure", () => {
    const flattened = buildTopologyServices(
      { services: [service("api")], infrastructure: [service("mongodb")] },
      analysis,
    );
    expect(
      flattened.map((entry) => [entry.id, entry.isInfrastructure]),
    ).toEqual([
      ["api", false],
      ["mongodb", true],
    ]);
    expect(buildTopologyServices(undefined, null)).toEqual([]);
  });
});

describe("selection", () => {
  // db → api → web, db → worker, lib → api
  const edges = collectEdges([
    service("db", { projectType: "Database" }),
    service("lib", { projectType: "Library" }),
    service("api", { dependsOn: ["db", "lib"] }),
    service("web", { dependsOn: ["api"] }),
    service("admin", { dependsOn: ["web"] }),
    service("worker", { dependsOn: ["db"] }),
  ]);

  it("walks the full upstream chain plus immediate consumers", () => {
    const { connectedNodes, edgeDirections } = computeSelection("web", edges);
    expect([...connectedNodes].sort()).toEqual([
      "admin",
      "api",
      "db",
      "lib",
      "web",
    ]);
    expect(edgeDirections.get(edgeKey("api", "web"))).toBe("incoming");
    expect(edgeDirections.get(edgeKey("web", "admin"))).toBe("outgoing");
    expect(edgeDirections.get(edgeKey("db", "api"))).toBe("network");
    expect(edgeDirections.has(edgeKey("db", "worker"))).toBe(false);
  });

  it("is empty without a selection", () => {
    const { connectedNodes, edgeDirections } = computeSelection(null, edges);
    expect(connectedNodes.size).toBe(0);
    expect(edgeDirections.size).toBe(0);
  });
});

describe("search", () => {
  it("matches across name, device, type, environment and url", () => {
    const services = [
      service("a", { name: "Prism Service", device: "nas" }),
      service("b", { name: "Lights", url: "http://desktop:4100" }),
    ];
    expect(matchServices(services, "  ")).toBeNull();
    expect([...matchServices(services, "NAS")!]).toEqual(["a"]);
    expect([...matchServices(services, "desktop")!]).toEqual(["b"]);
    expect(matchServices(services, "nothing")!.size).toBe(0);
  });
});

describe("geometry", () => {
  const positions = { a: { x: 0, y: 0 }, b: { x: 200, y: 100 } };

  it("computes node bounds and padded cluster rects", () => {
    expect(nodeBounds(["a", "b", "ghost"], positions)).toEqual({
      x: 0,
      y: 0,
      width: 200 + NODE_W,
      height: 100 + NODE_H,
    });
    expect(clusterRect(["a"], positions)).toEqual({
      x: -CLUSTER_PAD,
      y: -CLUSTER_PAD,
      width: NODE_W + CLUSTER_PAD * 2,
      height: NODE_H + CLUSTER_PAD * 2,
    });
    expect(nodeBounds(["ghost"], positions)).toBeNull();
  });

  it("fits content centered and caps the zoom-in", () => {
    const fit = fitViewport(
      { x: 0, y: 0, width: 100, height: 100 },
      1000,
      800,
    )!;
    expect(fit.zoom).toBe(1.4);
    expect(fit.pan).toEqual({ x: 500 - 50 * 1.4, y: 400 - 50 * 1.4 });
    expect(
      fitViewport({ x: 0, y: 0, width: 100, height: 100 }, 0, 800),
    ).toBeNull();
  });

  it("fits huge content below the manual minimum zoom", () => {
    const fit = fitViewport(
      { x: 0, y: 0, width: 100_000, height: 100 },
      1000,
      800,
    )!;
    expect(fit.zoom).toBeLessThan(MIN_ZOOM);
  });

  it("zooms about a fixed point and clamps", () => {
    const zoomed = zoomAtPoint(
      { pan: { x: 0, y: 0 }, zoom: 1 },
      { x: 100, y: 100 },
      2,
    );
    expect(zoomed).toEqual({ pan: { x: -100, y: -100 }, zoom: 2 });
    expect(
      zoomAtPoint({ pan: { x: 0, y: 0 }, zoom: 2.9 }, { x: 0, y: 0 }, 2).zoom,
    ).toBe(3);
    // A fit below the minimum can zoom in, but never snaps or goes further out
    expect(
      zoomAtPoint({ pan: { x: 0, y: 0 }, zoom: 0.1 }, { x: 0, y: 0 }, 0.5).zoom,
    ).toBe(0.1);
  });
});
