"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Globe,
  Lock,
  Play,
  RotateCcw,
  ScrollText,
  Square,
} from "lucide-react";
import { BadgeComponent, ResponseTimeBadgeComponent, TableComponent, VisibilityBadgeComponent } from "@rodrigo-barraza/components-library";
import { formatDuration, getRootDomain, getSubdomain } from "@rodrigo-barraza/utilities";
import { SERVICE_TYPE_ICONS, SERVICE_TYPE_COLORS, DEFAULT_SERVICE_TYPE_ICON } from "../constants";
import styles from "./ServiceTableComponent.module.css";


/**
 * Column definitions for the centralized TableComponent.
 * Each column maps to a field on the service status object.
 */
function buildColumns({ onRestart, onStop, onStart }) {
  return [
    {
      key: "name",
      label: "Service",
      sortable: true,
      render: (service) => {
        const isHealthy = service.healthy;
        const TypeIcon = SERVICE_TYPE_ICONS[service.serviceType] || DEFAULT_SERVICE_TYPE_ICON;
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
      render: (service) => {
        const isHealthy = service.healthy;
        return (
          <>
            <span className={`${styles.statusDot} ${isHealthy ? styles.dotHealthy : styles.dotUnhealthy}`} />
            <span className={`${styles.statusText} ${isHealthy ? styles.textHealthy : styles.textUnhealthy}`}>
              {isHealthy ? "Healthy" : "Down"}
            </span>
          </>
        );
      },
      sortValue: (row) => (row.healthy ? 1 : 0),
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      render: (service) => {
        if (!service.serviceType) return null;
        const colors = SERVICE_TYPE_COLORS[service.serviceType];
        return (
          <BadgeComponent
            variant="info"
            style={colors ? {
              color: colors.color,
              background: colors.subtle,
              borderColor: `color-mix(in srgb, ${colors.color} 25%, transparent)`,
            } : undefined}
          >
            {service.serviceType}
          </BadgeComponent>
        );
      },
      sortValue: (row) => row.serviceType || "",
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
          <code className={styles.mono}>:{service.port}</code>
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
          <span className={styles.mono}>
            {service.url.replace(/^https?:\/\//, "")}
          </span>
        ) : null,
      sortValue: (row) => row.url || "",
    },
    {
      key: "subdomain",
      label: "Subdomain",
      sortable: true,
      description: "Subdomain prefix (e.g. api.prism)",
      render: (service) => {
        const sub = getSubdomain(service.domain);
        return sub ? (
          <span className={styles.mono}>{sub}</span>
        ) : null;
      },
      sortValue: (row) => getSubdomain(row.domain),
    },
    {
      key: "domain",
      label: "Domain",
      sortable: true,
      description: "Registrable root domain",
      render: (service) => {
        const root = getRootDomain(service.domain);
        return root ? (
          <a
            href={`https://${service.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.domainLink}
            onClick={(e) => e.stopPropagation()}
          >
            <Globe size={10} strokeWidth={2} />
            {root}
          </a>
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
          <span className={styles.deviceText}>{service.device}</span>
        ) : null,
      sortValue: (row) => row.device || "",
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      align: "right",
      render: (service) => (
        <ActionCell
          service={service}
          onRestart={onRestart}
          onStop={onStop}
          onStart={onStart}
        />
      ),
    },
  ];
}

function ActionCell({ service, onRestart, onStop, onStart }) {
  const [restarting, setRestarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [starting, setStarting] = useState(false);

  const isHealthy = service.healthy;

  if (!service.restartable) return null;

  return (
    <div className={styles.actionRow}>
      {isHealthy ? (
        <button
          className={`${styles.actionBtn} ${styles.stopBtn} ${stopping ? styles.actionBtnLoading : ""}`}
          disabled={stopping || restarting}
          onClick={async (e) => {
            e.stopPropagation();
            setStopping(true);
            try { await onStop?.(service.id); }
            finally { setTimeout(() => setStopping(false), 5000); }
          }}
          title="Stop"
        >
          <Square size={9} strokeWidth={2.6} />
        </button>
      ) : (
        <button
          className={`${styles.actionBtn} ${styles.startBtn} ${starting ? styles.actionBtnLoading : ""}`}
          disabled={starting || restarting}
          onClick={async (e) => {
            e.stopPropagation();
            setStarting(true);
            try { await onStart?.(service.id); }
            finally { setTimeout(() => setStarting(false), 5000); }
          }}
          title="Start"
        >
          <Play size={9} strokeWidth={2.6} fill="currentColor" />
        </button>
      )}

      <Link
        href={`/logs?service=${service.id}`}
        className={`${styles.actionBtn} ${styles.logsBtn}`}
        title="Logs"
        onClick={(e) => e.stopPropagation()}
      >
        <ScrollText size={9} strokeWidth={2.6} />
      </Link>

      <button
        className={`${styles.actionBtn} ${styles.restartBtn} ${restarting ? styles.actionBtnLoading : ""}`}
        disabled={restarting || stopping || starting}
        onClick={async (e) => {
          e.stopPropagation();
          setRestarting(true);
          try { await onRestart?.(service.id); }
          finally { setTimeout(() => setRestarting(false), 5000); }
        }}
        title="Restart"
      >
        <RotateCcw size={9} strokeWidth={2.6} className={restarting ? styles.spin : ""} />
      </button>
    </div>
  );
}

export default function ServiceTableComponent({
  services,
  sortKey,
  sortDir,
  onSort,
  onRestart,
  onStop,
  onStart,
}) {
  const columns = useCallback(
    () => buildColumns({ onRestart, onStop, onStart }),
    [onRestart, onStop, onStart],
  )();

  const getRowClassName = useCallback(
    (row) => row.healthy ? styles.rowHealthy : styles.rowUnhealthy,
    [],
  );

  if (services.length === 0) {
    return (
      <div className={styles.emptyState}>
        No services match the selected filters
      </div>
    );
  }

  return (
    <TableComponent
      columns={columns}
      data={services}
      getRowKey={(row) => row.id}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={(key, dir) => onSort(key, dir)}
      emptyText="No services match the selected filters"
      getRowClassName={getRowClassName}
      storageKey="service-table"
    />
  );
}
