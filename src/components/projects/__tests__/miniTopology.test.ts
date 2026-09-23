import { describe, expect, it } from "vitest";
import type { PortalService } from "@/types/portal";
import {
  collectEdges,
  connectedIds,
  layoutMiniTopology,
  miniEdgePath,
} from "../miniTopology";

function node(
  id: string,
  deployTier: number,
  dependsOn: PortalService["dependsOn"] = [],
) {
  return {
    id,
    name: id,
    healthy: true,
    deployTier,
    dependsOn,
  } as PortalService;
}

const services = [
  node("mongodb", 0),
  node("vault", 1, ["mongodb"]),
  node("prism", 1, [
    { id: "vault", name: "vault", criticality: "optional" },
    "mongodb",
    "mongodb",
  ]),
  node("prism-client", 1, ["prism"]),
  node("lupos-bot", 2, ["prism"]),
  node("unrelated", 1),
];

describe("collectEdges", () => {
  it("keeps known targets once and carries criticality", () => {
    expect(collectEdges(services)).toContainEqual({
      source: "vault",
      target: "prism",
      criticality: "optional",
    });
    const prismMongo = collectEdges(services).filter(
      (edge) => edge.source === "mongodb" && edge.target === "prism",
    );
    expect(prismMongo).toHaveLength(1);
  });
});

describe("connectedIds", () => {
  it("walks the whole upstream chain but only direct dependents", () => {
    const ids = connectedIds("vault", collectEdges(services));
    expect([...ids].sort()).toEqual(["mongodb", "prism", "vault"]);
    expect(ids.has("prism-client")).toBe(false);
  });
});

describe("layoutMiniTopology", () => {
  it("lays nodes out one row per non-empty tier", () => {
    const layout = layoutMiniTopology(services[2], services)!;
    expect(layout.nodes.map((service) => service.id).sort()).toEqual([
      "lupos-bot",
      "mongodb",
      "prism",
      "prism-client",
      "vault",
    ]);
    expect(layout.tierRows.map((row) => row.tier)).toEqual([0, 1, 2]);
    expect(layout.positions.mongodb.y).toBeLessThan(layout.positions.prism.y);
    expect(layout.positions.prism.y).toBeLessThan(
      layout.positions["lupos-bot"].y,
    );
  });

  it("returns null for an isolated project", () => {
    expect(layoutMiniTopology(services[5], services)).toBeNull();
  });
});

describe("miniEdgePath", () => {
  it("connects stacked nodes bottom → top", () => {
    expect(miniEdgePath({ x: 0, y: 0 }, { x: 0, y: 200 })).toMatch(
      /^M 55 52 C/,
    );
  });

  it("connects side-by-side nodes right → left", () => {
    expect(miniEdgePath({ x: 0, y: 0 }, { x: 300, y: 0 })).toMatch(
      /^M 110 26 C/,
    );
  });
});
