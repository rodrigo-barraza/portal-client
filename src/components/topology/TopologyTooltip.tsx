"use client";

import type { Ref } from "react";
import { Link2, Package } from "lucide-react";
import { formatSize } from "@/lib/format";
import type {
  DependencyRef,
  PortalService,
  ProjectAnalysis,
  RepoSize,
} from "../../types/portal";
import styles from "../TopologyComponent.module.css";

const TOOLTIP_WIDTH = 300;

/** Viewport position for a tooltip following the cursor, kept on-screen horizontally. */
export function tooltipPosition(clientX: number, clientY: number) {
  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1000;
  return {
    left: Math.min(clientX + 16, viewportWidth - TOOLTIP_WIDTH),
    top: clientY - 10,
  };
}

const dependencyName = (dependency: string | DependencyRef) =>
  typeof dependency === "string" ? dependency : dependency.name;

const isOptional = (dependency: string | DependencyRef) =>
  typeof dependency !== "string" && dependency.criticality === "optional";

const TONE_CLASSES = {
  healthy: styles["tooltip-healthy"],
  unhealthy: styles["tooltip-unhealthy"],
};

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <div className={styles["tooltip-row"]}>
      <span className={styles["tooltip-label"]}>{label}</span>
      <span
        className={`${styles["tooltip-value"]}${tone ? ` ${TONE_CLASSES[tone]}` : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Hover card for a node. Rendered at the hover-start point; the parent
 * moves it with the cursor through `ref` so mouse moves never re-render.
 */
export function TopologyTooltip({
  ref,
  service,
  clientX,
  clientY,
  analysis,
  repoSize,
}: {
  ref?: Ref<HTMLDivElement>;
  service: PortalService;
  clientX: number;
  clientY: number;
  analysis: ProjectAnalysis | null;
  repoSize: RepoSize | undefined;
}) {
  const detected = analysis?.dependencies?.[service.id];
  const detectedImports = detected?.imports ?? [];
  const detectedApiCalls = detected?.apiCalls ?? [];
  const dependencies = service.dependsOn ?? [];
  const required = dependencies.filter((dependency) => !isOptional(dependency));
  const optional = dependencies.filter(isOptional);
  const owner = analysis?.owners?.[service.id];

  return (
    <div
      ref={ref}
      className={styles["tooltip"]}
      style={tooltipPosition(clientX, clientY)}
    >
      <div className={styles["tooltip-name"]}>{service.name}</div>
      <Row
        label="Status"
        value={service.healthy ? "Healthy" : "Down"}
        tone={service.healthy ? "healthy" : "unhealthy"}
      />
      {service.device && <Row label="Device" value={service.device} />}
      {service.url && <Row label="URL" value={service.url} />}
      {service.environment && (
        <Row label="Environment" value={service.environment} />
      )}
      {service.visibility && (
        <Row label="Visibility" value={service.visibility} />
      )}
      {repoSize && (
        <Row label="Repo Size" value={formatSize(repoSize.sizeKB)} />
      )}
      {owner && <Row label="Owner" value={owner} />}
      {service.responseTimeMs != null && (
        <Row label="Latency" value={`${service.responseTimeMs}ms`} />
      )}
      {service.error && !service.healthy && (
        <Row label="Error" value={service.error} tone="unhealthy" />
      )}

      {(detectedImports.length > 0 || detectedApiCalls.length > 0) && (
        <div className={styles["tooltip-deps"]}>
          {detectedImports.length > 0 && (
            <>
              <span className={styles["tooltip-dep-label"]}>
                <Package size={10} strokeWidth={2.2} /> Imports
              </span>
              <span className={styles["tooltip-dep-list"]}>
                {detectedImports.map((entry) => entry.target).join(", ")}
              </span>
            </>
          )}
          {detectedApiCalls.length > 0 && (
            <>
              <span className={styles["tooltip-dep-label"]}>
                <Link2 size={10} strokeWidth={2.2} /> API Calls
              </span>
              <span className={styles["tooltip-dep-list"]}>
                {detectedApiCalls.map((entry) => entry.target).join(", ")}
              </span>
            </>
          )}
        </div>
      )}

      {dependencies.length > 0 && (
        <div className={styles["tooltip-deps"]}>
          {required.length > 0 && (
            <>
              <span className={styles["tooltip-dep-label"]}>↑ Requires</span>
              <span className={styles["tooltip-dep-list"]}>
                {required.map(dependencyName).join(", ")}
              </span>
            </>
          )}
          {optional.length > 0 && (
            <>
              <span
                className={`${styles["tooltip-dep-label"]} ${styles["tooltip-dep-label-optional"]}`}
              >
                ↑ Optional
              </span>
              <span
                className={`${styles["tooltip-dep-list"]} ${styles["tooltip-dep-list-optional"]}`}
              >
                {optional.map(dependencyName).join(", ")}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
