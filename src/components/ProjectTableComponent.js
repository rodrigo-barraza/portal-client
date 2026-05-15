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
  DomainBadgeComponent,
  DrawerComponent,
  TableComponent,
} from "@rodrigo-barraza/components-library";
import { formatBytes } from "@rodrigo-barraza/utilities-library";
import { SERVICE_TYPE_ICONS, SERVICE_TYPE_COLORS, DEPLOY_TIER_COLORS, DEFAULT_SERVICE_TYPE_ICON } from "../constants";
import ExpandedProjectPanel from "./ExpandedProjectPanelComponent";
import styles from "./ProjectTableComponent.module.css";


// ── Formatting helpers ─────────────────────────────────────────────
const NON_DEPLOYED_TYPES = new Set(["Library", "Kit", "Tool"]);

/**
 * Column definitions for the centralized TableComponent.
 * Each column maps to a field on the service status object.
 * @param {object} projectSizes
 * @param {Set<string>} [excludeColumns] — column keys to omit
 */
function buildColumns(projectSizes = {}, excludeColumns = new Set()) {
  return [
    {
      key: "name",
      label: "Project",
      sortable: true,
      render: (service) => {
        const isNonDeployed = NON_DEPLOYED_TYPES.has(service.projectType);
        const isHealthy = isNonDeployed ? true : service.healthy;
        const TypeIcon = SERVICE_TYPE_ICONS[service.projectType] || DEFAULT_SERVICE_TYPE_ICON;
        const iconClass = isNonDeployed ? styles.iconNeutral : (isHealthy ? styles.iconHealthy : styles.iconUnhealthy);
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
      sortValue: (row) => row.name || "",
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      render: (service) => {
        if (!service.projectType) return null;
        const colors = SERVICE_TYPE_COLORS[service.projectType];
        return (
          <BadgeComponent
            variant="info"
            style={colors ? {
              color: colors.color,
              background: colors.subtle,
              borderColor: `color-mix(in srgb, ${colors.color} 25%, transparent)`,
            } : undefined}
          >
            {service.projectType}
          </BadgeComponent>
        );
      },
      sortValue: (row) => row.projectType || "",
    },
    {
      key: "essential",
      label: "Essential",
      sortable: true,
      description: "Core scaffolding required to build & deploy new projects",
      render: (service) => {
        if (!service.essential) return <span className={styles.mutedCell}>—</span>;
        return (
          <BadgeComponent
            variant="info"
            style={{
              color: "#f59e0b",
              background: "rgba(245, 158, 11, 0.10)",
              borderColor: "rgba(245, 158, 11, 0.25)",
            }}
          >
            <ShieldCheck size={11} strokeWidth={2.4} style={{ marginRight: 4 }} />
            Core
          </BadgeComponent>
        );
      },
      sortValue: (row) => (row.essential ? 0 : 1),
    },
    {
      key: "tier",
      label: "Tier",
      sortable: true,
      render: (service) => {
        const tier = service.deployTier;
        if (tier == null) return null;
        const colors = DEPLOY_TIER_COLORS[tier];
        return (
          <BadgeComponent
            variant="info"
            style={colors ? {
              color: colors.color,
              background: colors.subtle,
              borderColor: `color-mix(in srgb, ${colors.color} 25%, transparent)`,
            } : undefined}
          >
            {tier}
          </BadgeComponent>
        );
      },
      sortValue: (row) => row.deployTier ?? 99,
    },
    {
      key: "description",
      label: "Description",
      sortable: false,
      render: (service) =>
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
      render: (service) =>
        service.domain ? (
          <DomainBadgeComponent domain={service.domain} icons={{ Globe }} />
        ) : (
          <span className={styles.mutedCell}>—</span>
        ),
      sortValue: (row) => row.domain || "",
    },
    {
      key: "repo",
      label: "Repo",
      sortable: true,
      render: (service) => {
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
            <ExternalLink size={10} strokeWidth={2} className={styles.externalIcon} />
          </a>
        );
      },
      sortValue: (row) => row.repo || "",
    },
    {
      key: "dependencies",
      label: "Deps",
      sortable: true,
      description: "Number of upstream dependencies",
      render: (service) => {
        const count = (service.dependsOn || []).length;
        if (count === 0) return <span className={styles.mutedCell}>—</span>;
        return (
          <BadgeComponent variant="info">
            <Link2 size={11} strokeWidth={2.2} style={{ marginRight: 4 }} />
            {count}
          </BadgeComponent>
        );
      },
      sortValue: (row) => (row.dependsOn || []).length,
    },
    {
      key: "database",
      label: "Database",
      sortable: true,
      render: (service) => {
        if (!service.db) return <span className={styles.mutedCell}>—</span>;
        return (
          <BadgeComponent variant="info">
            <Database size={11} strokeWidth={2.2} style={{ marginRight: 4 }} />
            {service.db}
          </BadgeComponent>
        );
      },
      sortValue: (row) => row.db || "",
    },
    {
      key: "containers",
      label: "Containers",
      sortable: true,
      description: "Number of Docker containers for this project",
      render: (service) => {
        if (!service.dockerProject) return <span className={styles.mutedCell}>—</span>;
        return (
          <BadgeComponent variant="info">
            <Container size={11} strokeWidth={2.2} style={{ marginRight: 4 }} />
            1
          </BadgeComponent>
        );
      },
      sortValue: (row) => (row.dockerProject ? 1 : 0),
    },
    {
      key: "size",
      label: "Size",
      sortable: true,
      description: "GitHub repository size",
      render: (service) => {
        const sizeData = projectSizes[service.id];
        if (!sizeData) return <span className={styles.mutedCell}>—</span>;
        return (
          <BadgeComponent variant="info">
            <HardDrive size={11} strokeWidth={2.2} style={{ marginRight: 4 }} />
            {formatBytes(sizeData.sizeBytes)}
          </BadgeComponent>
        );
      },
      sortValue: (row) => projectSizes[row.id]?.sizeBytes ?? 0,
    },
  ].filter((col) => !excludeColumns.has(col.key));
}




export default function ProjectTableComponent({
  services,
  allServices = [],
  projectSizes = {},
  containerStats = {},
  excludeColumns,
  sortKey,
  sortDir,
  onSort,
}) {
  const [selectedProject, setSelectedProject] = useState(null);

  const excludeSet = useMemo(
    () => (excludeColumns ? new Set(excludeColumns) : new Set()),
    [excludeColumns],
  );

  const columns = useCallback(
    () => buildColumns(projectSizes, excludeSet),
    [projectSizes, excludeSet],
  )();

  const getRowClassName = useCallback(
    (row) => {
      if (NON_DEPLOYED_TYPES.has(row.projectType)) return styles.rowNeutral;
      return row.healthy ? styles.rowHealthy : styles.rowUnhealthy;
    },
    [],
  );

  const handleRowClick = useCallback(
    (row) => setSelectedProject(row),
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
        columns={columns}
        data={services}
        getRowKey={(row) => row.id}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(key, dir) => onSort(key, dir)}
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
          <ExpandedProjectPanel service={selectedProject} stats={stats} allServices={allServices} />
        )}
      </DrawerComponent>
    </>
  );
}
