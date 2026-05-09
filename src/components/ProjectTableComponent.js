"use client";

import { useState, useCallback } from "react";
import {
  Globe,
  ExternalLink,
  Database,
  Container,
  GitBranch,
  Link2,
} from "lucide-react";
import {
  BadgeComponent,
  DomainBadgeComponent,
  DrawerComponent,
  TableComponent,
} from "@rodrigo-barraza/components-library";
import { SERVICE_TYPE_ICONS, SERVICE_TYPE_COLORS, DEPLOY_TIER_COLORS, DEFAULT_SERVICE_TYPE_ICON } from "../constants";
import ExpandedProjectPanel from "./ExpandedProjectPanel";
import styles from "./ProjectTableComponent.module.css";


// ── Formatting helpers ─────────────────────────────────────────────

/**
 * Column definitions for the centralized TableComponent.
 * Each column maps to a field on the service status object.
 */
function buildColumns() {
  return [
    {
      key: "name",
      label: "Project",
      sortable: true,
      render: (service) => {
        const isHealthy = service.healthy;
        const TypeIcon = SERVICE_TYPE_ICONS[service.projectType] || DEFAULT_SERVICE_TYPE_ICON;
        return (
          <div className={styles.nameCell}>
            <TypeIcon
              size={14}
              strokeWidth={2.6}
              className={`${styles.typeIcon} ${isHealthy ? styles.iconHealthy : styles.iconUnhealthy}`}
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
  ];
}




export default function ProjectTableComponent({
  services,
  allServices = [],
  containerStats = {},
  sortKey,
  sortDir,
  onSort,
}) {
  const [selectedProject, setSelectedProject] = useState(null);

  const columns = useCallback(
    () => buildColumns(),
    [],
  )();

  const getRowClassName = useCallback(
    (row) => row.healthy ? styles.rowHealthy : styles.rowUnhealthy,
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
