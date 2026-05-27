"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Globe,
  ExternalLink,
  Database,
  Container,
  GitBranch,
  HardDrive,
  Link2,
  ShieldCheck,
} from "lucide-react";
import {
  BadgeComponent,
  DrawerComponent,
  TableComponent,
} from "@rodrigo-barraza/components-library";
import { formatBytes } from "@rodrigo-barraza/utilities-library";
import {
  SERVICE_TYPE_ICONS,
  SERVICE_TYPE_COLORS,
  DEPLOY_TIER_COLORS,
  DEFAULT_SERVICE_TYPE_ICON,
} from "../constants";
import type { PortalService, ContainerStats } from "../types/portal";
import ExpandedProjectPanel from "./ExpandedProjectPanelComponent";
import styles from "./ProjectTableComponent.module.css";

// ── GitHub Linguist Language Colors ────────────────────────────────
// Official colors from github/linguist for the most common languages.
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  Java: "#b07219",
  Go: "#00add8",
  Rust: "#dea584",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4f5d95",
  Swift: "#f05138",
  Kotlin: "#a97bff",
  Dart: "#00b4ab",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Lua: "#000080",
  Perl: "#0298c3",
  R: "#198ce7",
  Scala: "#c22d40",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
  Clojure: "#db5855",
  "Objective-C": "#438eff",
  Dockerfile: "#384d54",
  Makefile: "#427819",
  Nix: "#7e7eff",
  Zig: "#ec915c",
  Astro: "#ff5a03",
  MDX: "#fcb32c",
};

/** Fallback color for unlisted languages */
const DEFAULT_LANGUAGE_COLOR = "#8b8b8b";

// ── Formatting helpers ─────────────────────────────────────────────
const NON_DEPLOYED_TYPES = new Set(["Library", "Kit", "Tool"]);

/**
 * Column definitions for the centralized TableComponent.
 * Each column maps to a field on the service status object.

 */
function buildColumns(
  projectSizes: Record<string, { sizeBytes: number; sizeKB: number }> = {},
  projectLanguages: Record<
    string,
    { primary: string; breakdown: { language: string; percent: number }[] }
  > = {},
  excludeColumns = new Set<string>(),
) {
  return [
    {
      key: "name",
      label: "Project",
      sortable: true,
      render: (service: PortalService) => {
        const isNonDeployed = NON_DEPLOYED_TYPES.has(
          service.projectType as string,
        );
        const isHealthy = isNonDeployed ? true : service.healthy;
        const TypeIcon =
          (service.projectType &&
            SERVICE_TYPE_ICONS[service.projectType as string]) ||
          DEFAULT_SERVICE_TYPE_ICON;
        const iconClass = isNonDeployed
          ? styles.iconNeutral
          : isHealthy
            ? styles.iconHealthy
            : styles.iconUnhealthy;
        return (
          <div className={styles.nameCell}>
            <TypeIcon
              size={14}
              strokeWidth={2.6}
              className={`${styles.typeIcon} ${iconClass}`}
            />
            <span className={styles.serviceName}>{service.name}</span>
          </div>
        );
      },
      sortValue: (row: PortalService) => row.name || "",
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      render: (service: PortalService) => {
        if (!service.projectType) return null;
        const colors = SERVICE_TYPE_COLORS[service.projectType as string];
        return (
          <BadgeComponent
            variant="info"
            style={
              colors
                ? {
                    color: colors.color,
                    background: colors.subtle,
                    borderColor: `color-mix(in srgb, ${colors.color} 25%, transparent)`,
                  }
                : undefined
            }
          >
            {service.projectType}
          </BadgeComponent>
        );
      },
      sortValue: (row: PortalService) => row.projectType || "",
    },
    {
      key: "essential",
      label: "Essential",
      sortable: true,
      description: "Core scaffolding required to build & deploy new projects",
      render: (service: PortalService) => {
        if (!service.essential)
          return <span className={styles.mutedCell}>—</span>;
        return (
          <BadgeComponent
            variant="info"
            style={{
              color: "#f59e0b",
              background: "rgba(245, 158, 11, 0.10)",
              borderColor: "rgba(245, 158, 11, 0.25)",
            }}
          >
            <ShieldCheck
              size={11}
              strokeWidth={2.4}
              style={{ marginRight: 4 }}
            />
            Core
          </BadgeComponent>
        );
      },
      sortValue: (row: PortalService) => (row.essential ? 0 : 1),
    },
    {
      key: "tier",
      label: "Tier",
      sortable: true,
      render: (service: PortalService) => {
        const tier = service.deployTier;
        if (tier == null) return null;
        const colors = DEPLOY_TIER_COLORS[tier as number];
        return (
          <BadgeComponent
            variant="info"
            style={
              colors
                ? {
                    color: colors.color,
                    background: colors.subtle,
                    borderColor: `color-mix(in srgb, ${colors.color} 25%, transparent)`,
                  }
                : undefined
            }
          >
            {tier}
          </BadgeComponent>
        );
      },
      sortValue: (row: PortalService) =>
        typeof row.deployTier === "number" ? row.deployTier : 99,
    },
    {
      key: "description",
      label: "Description",
      sortable: false,
      render: (service: PortalService) =>
        service.description ? (
          <span className={styles.descriptionCell}>{service.description}</span>
        ) : (
          <span className={styles.mutedCell}>—</span>
        ),
    },
    {
      key: "domain",
      label: "Domain",
      sortable: true,
      render: (service: PortalService) =>
        service.domain ? (
          <BadgeComponent
            type="domain"
            domain={service.domain}
            icons={{ Globe }}
          />
        ) : (
          <span className={styles.mutedCell}>—</span>
        ),
      sortValue: (row: PortalService) => row.domain || "",
    },
    {
      key: "repo",
      label: "Repo",
      sortable: true,
      render: (service: PortalService) => {
        if (!service.repo) return <span className={styles.mutedCell}>—</span>;
        // Extract org/repo from GitHub URL
        const match = service.repo.match(/github\.com\/(.+?)(?:\.git)?$/);
        const slug = match ? match[1] : service.repo;
        return (
          <a
            href={service.repo}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.repoLink}
            onClick={(e) => e.stopPropagation()}
          >
            <GitBranch size={12} strokeWidth={2.2} />
            <span>{slug.split("/").pop()}</span>
            <ExternalLink
              size={10}
              strokeWidth={2}
              className={styles.externalIcon}
            />
          </a>
        );
      },
      sortValue: (row: PortalService) => row.repo || "",
    },
    {
      key: "language",
      label: "Language",
      sortable: true,
      description: "Primary language detected by GitHub Linguist",
      render: (service: PortalService) => {
        const langData = projectLanguages[service.id];
        if (!langData?.primary)
          return <span className={styles.mutedCell}>—</span>;
        const color =
          LANGUAGE_COLORS[langData.primary] || DEFAULT_LANGUAGE_COLOR;
        const topLangs = langData.breakdown
          .slice(0, 3)
          .map(
            (l: { language: string; percent: number }) =>
              `${l.language} ${l.percent}%`,
          )
          .join(", ");
        return (
          <span className={styles.languageCell} title={topLangs}>
            <span
              className={styles.languageDot}
              style={{ background: color }}
            />
            <span className={styles.languageName}>{langData.primary}</span>
          </span>
        );
      },
      sortValue: (row: PortalService) =>
        projectLanguages[row.id]?.primary || "",
    },
    {
      key: "dependencies",
      label: "Deps",
      sortable: true,
      description: "Number of upstream dependencies",
      render: (service: PortalService) => {
        const count = (service.dependsOn || []).length;
        if (count === 0) return <span className={styles.mutedCell}>—</span>;
        return (
          <BadgeComponent variant="info">
            <Link2 size={11} strokeWidth={2.2} style={{ marginRight: 4 }} />
            {count}
          </BadgeComponent>
        );
      },
      sortValue: (row: PortalService) => (row.dependsOn || []).length,
    },
    {
      key: "database",
      label: "Database",
      sortable: true,
      render: (service: PortalService) => {
        if (!service.db) return <span className={styles.mutedCell}>—</span>;
        return (
          <BadgeComponent variant="info">
            <Database size={11} strokeWidth={2.2} style={{ marginRight: 4 }} />
            {service.db}
          </BadgeComponent>
        );
      },
      sortValue: (row: PortalService) => row.db || "",
    },
    {
      key: "containers",
      label: "Containers",
      sortable: true,
      description: "Number of Docker containers for this project",
      render: (service: PortalService) => {
        if (!service.dockerProject)
          return <span className={styles.mutedCell}>—</span>;
        return (
          <BadgeComponent variant="info">
            <Container size={11} strokeWidth={2.2} style={{ marginRight: 4 }} />
            1
          </BadgeComponent>
        );
      },
      sortValue: (row: PortalService) => (row.dockerProject ? 1 : 0),
    },
    {
      key: "size",
      label: "Size",
      sortable: true,
      description: "GitHub repository size",
      render: (service: PortalService) => {
        const sizeData = projectSizes[service.id];
        if (!sizeData) return <span className={styles.mutedCell}>—</span>;
        return (
          <BadgeComponent variant="info">
            <HardDrive size={11} strokeWidth={2.2} style={{ marginRight: 4 }} />
            {formatBytes(sizeData.sizeBytes)}
          </BadgeComponent>
        );
      },
      sortValue: (row: PortalService) => projectSizes[row.id]?.sizeBytes ?? 0,
    },
  ].filter((col) => !excludeColumns.has(col.key));
}

interface ProjectTableProps {
  services: PortalService[];
  allServices?: PortalService[];
  projectSizes?: Record<string, { sizeBytes: number; sizeKB: number }>;
  projectLanguages?: Record<
    string,
    { primary: string; breakdown: { language: string; percent: number }[] }
  >;
  containerStats?: Record<string, ContainerStats>;
  excludeColumns?: string[];
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string, dir: "asc" | "desc") => void;
  title?: string;
  subtitle?: string;
}

export default function ProjectTableComponent({
  services,
  allServices = [],
  projectSizes = {},
  projectLanguages = {},
  containerStats = {},
  excludeColumns,
  sortKey,
  sortDir,
  onSort,
  title,
  subtitle,
}: ProjectTableProps) {
  const [selectedProject, setSelectedProject] = useState<PortalService | null>(
    null,
  );

  const excludeSet = useMemo(
    () =>
      excludeColumns ? new Set<string>(excludeColumns) : new Set<string>(),
    [excludeColumns],
  );

  const columns = useCallback(
    () => buildColumns(projectSizes, projectLanguages, excludeSet),
    [projectSizes, projectLanguages, excludeSet],
  )();

  const getRowClassName = useCallback((row: PortalService) => {
    if (NON_DEPLOYED_TYPES.has(row.projectType as string))
      return styles.rowNeutral;
    return row.healthy ? styles.rowHealthy : styles.rowUnhealthy;
  }, []);

  const handleRowClick = useCallback(
    (row: PortalService) => setSelectedProject(row),
    [],
  );

  if (services.length === 0) {
    return (
      <div className={styles.emptyState}>
        No projects match the selected filters
      </div>
    );
  }

  const stats = selectedProject?.dockerProject
    ? containerStats[selectedProject.dockerProject]
    : null;

  return (
    <>
      <TableComponent
        title={title}
        subtitle={subtitle}
        columns={columns}
        data={services}
        getRowKey={(row: PortalService) => row.id}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(key: string, dir: "asc" | "desc") =>
          onSort && onSort(key, dir)
        }
        emptyText="No projects match the selected filters"
        getRowClassName={getRowClassName}
        onRowClick={handleRowClick}
        activeRowKey={selectedProject?.id}
        storageKey="project-table"
      />

      <DrawerComponent
        open={!!selectedProject}
        onClose={() => setSelectedProject(null)}
        title={selectedProject?.name || "Project Detail"}
        width={640}
      >
        {selectedProject && (
          <ExpandedProjectPanel
            service={selectedProject}
            stats={stats ?? undefined}
            allServices={allServices}
          />
        )}
      </DrawerComponent>
    </>
  );
}
