"use client";

import { useState, useCallback } from "react";
import {
  Globe,
  Lock,
  Server,
} from "lucide-react";
import {
  AddressBadgeComponent,
  BadgeComponent,
  DeviceBadgeComponent,
  DomainBadgeComponent,
  DrawerComponent,
  PortBadgeComponent,
  ResponseTimeBadgeComponent,
  StatusBadgeComponent,
  TableComponent,
  VisibilityBadgeComponent,
} from "@rodrigo-barraza/components-library";
import { formatDuration, getRootDomain } from "@rodrigo-barraza/utilities-library";
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
      key: "status",
      label: "Status",
      sortable: true,
      render: (service) => (
        <StatusBadgeComponent healthy={service.healthy} />
      ),
      sortValue: (row) => (row.healthy ? 1 : 0),
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
      key: "visibility",
      label: "Visibility",
      sortable: true,
      render: (service) =>
        service.visibility ? (
          <VisibilityBadgeComponent visibility={service.visibility} icons={{ Globe, Lock }} />
        ) : null,
      sortValue: (row) => row.visibility || "",
    },
    {
      key: "port",
      label: "Port",
      sortable: true,
      render: (service) =>
        service.port ? (
          <PortBadgeComponent port={service.port} />
        ) : null,
      sortValue: (row) => row.port || 0,
    },
    {
      key: "address",
      label: "Address",
      sortable: true,
      description: "Internal IP and port (socket address)",
      render: (service) =>
        service.url ? (
          <AddressBadgeComponent address={service.url} link />
        ) : null,
      sortValue: (row) => row.url || "",
    },

    {
      key: "domain",
      label: "Domain",
      sortable: true,
      description: "Registrable root domain",
      render: (service) => {
        const root = getRootDomain(service.domain);
        return root ? (
          <DomainBadgeComponent domain={service.domain} icons={{ Globe }} />
        ) : null;
      },
      sortValue: (row) => getRootDomain(row.domain),
    },
    {
      key: "response",
      label: "Response",
      sortable: true,
      render: (service) =>
        service.responseTimeMs != null ? (
          <ResponseTimeBadgeComponent ms={service.responseTimeMs} formatter={formatDuration} />
        ) : null,
      sortValue: (row) => row.responseTimeMs ?? Infinity,
    },
    {
      key: "device",
      label: "Device",
      sortable: true,
      render: (service) =>
        service.device ? (
          <DeviceBadgeComponent device={service.device} icons={{ Server }} />
        ) : null,
      sortValue: (row) => row.device || "",
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
