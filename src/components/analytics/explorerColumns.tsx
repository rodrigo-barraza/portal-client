"use client";

import { Network, Users } from "lucide-react";
import { timeAgo } from "@rodrigo-barraza/utilities-library";
import { BotTag, DeviceIcon } from "./ExplorerPrimitives";
import { formatCount, formatDurationMs, formatLocation, shortId } from "./analyticsFormat";
import type { DeviceInfo, ExplorerSession, IpUser, NamedVersion, Visitor } from "@/types/portal";
import styles from "../SessionExplorerComponent.module.css";

/**
 * TableComponent column definitions for the explorer's table view.
 *
 * The library table's row click is mouse-only (no focusable row), so each
 * row whose click opens a detail also renders its identifier as a real
 * button — the keyboard path to the same view.
 */

function timeValue(value: string | null | undefined): number {
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
}

function DeviceCell({
  device,
  browser,
  os,
}: {
  device: DeviceInfo | null | undefined;
  browser: NamedVersion | null | undefined;
  os: NamedVersion | null | undefined;
}) {
  return (
    <span className={styles["session-table-device"]}>
      <DeviceIcon type={device?.type} />
      {browser?.name || "?"} / {os?.name || "?"}
    </span>
  );
}

export function ipColumns(onOpenIp: (ip: string) => void) {
  return [
    {
      key: "ip",
      label: "IP Address",
      width: "15%",
      sortable: true,
      render: (row: IpUser) => (
        <button
          type="button"
          className={`${styles["session-table-id"]} ${styles["table-open-button"]}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenIp(row.ip);
          }}
        >
          <Network size={11} strokeWidth={2} aria-hidden />
          {row.ip}
        </button>
      ),
      sortValue: (row: IpUser) => row.ip,
    },
    {
      key: "visitorCount",
      label: "Visitors",
      width: "15%",
      sortable: true,
      render: (row: IpUser) => (
        <span className={styles["session-table-ip"]}>
          {formatCount(row.visitorIds.length, "visitor")} · {formatCount(row.sessionCount, "session")}
        </span>
      ),
      sortValue: (row: IpUser) => row.sessionCount,
    },
    {
      key: "browser",
      label: "Browser / OS",
      width: "23%",
      sortable: true,
      render: (row: IpUser) => (
        <DeviceCell device={row.lastDevice} browser={row.lastBrowser} os={row.lastOs} />
      ),
      sortValue: (row: IpUser) => row.lastBrowser?.name || "",
    },
    {
      key: "location",
      label: "Location",
      width: "23%",
      sortable: true,
      render: (row: IpUser) => (
        <span className={styles["session-table-geo"]}>{formatLocation(row.lastGeo)}</span>
      ),
      sortValue: (row: IpUser) => row.lastGeo?.country || "",
    },
    {
      key: "duration",
      label: "Duration",
      width: "12%",
      sortable: true,
      render: (row: IpUser) => (
        <span className={styles["session-table-duration"]}>
          {formatDurationMs(row.totalDuration)}
        </span>
      ),
      sortValue: (row: IpUser) => row.totalDuration,
    },
    {
      key: "lastSeen",
      label: "Last Seen",
      width: "12%",
      sortable: true,
      render: (row: IpUser) => (
        <span className={styles["session-table-time"]}>{timeAgo(row.lastSeen)}</span>
      ),
      sortValue: (row: IpUser) => timeValue(row.lastSeen),
    },
  ];
}

export function visitorColumns(onOpenIp: (ip: string) => void) {
  return [
    {
      key: "visitorId",
      label: "Visitor ID",
      width: "15%",
      sortable: true,
      render: (row: Visitor) => (
        <span className={styles["session-table-id"]} title={row.visitorId}>
          <Users size={11} strokeWidth={2} aria-hidden />
          {shortId(row.visitorId, 12)}
        </span>
      ),
      sortValue: (row: Visitor) => row.visitorId,
    },
    {
      key: "lastIp",
      label: "IP",
      width: "15%",
      sortable: true,
      render: (row: Visitor) =>
        row.lastIp ? (
          <button
            type="button"
            className={`${styles["session-table-ip"]} ${styles["visitor-meta-link"]}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenIp(row.lastIp!);
            }}
          >
            {row.lastIp}
          </button>
        ) : (
          <span className={styles["session-table-ip"]}>—</span>
        ),
      sortValue: (row: Visitor) => row.lastIp || "",
    },
    {
      key: "browser",
      label: "Browser / OS",
      width: "23%",
      sortable: true,
      render: (row: Visitor) => (
        <DeviceCell device={row.lastDevice} browser={row.lastBrowser} os={row.lastOs} />
      ),
      sortValue: (row: Visitor) => row.lastBrowser?.name || "",
    },
    {
      key: "location",
      label: "Location",
      width: "23%",
      sortable: true,
      render: (row: Visitor) => (
        <span className={styles["session-table-geo"]}>{formatLocation(row.lastGeo)}</span>
      ),
      sortValue: (row: Visitor) => row.lastGeo?.country || "",
    },
    {
      key: "sessionCount",
      label: "Sessions",
      width: "12%",
      sortable: true,
      render: (row: Visitor) => (
        <span className={styles["session-table-duration"]}>
          {formatCount(row.sessionCount, "session")}
        </span>
      ),
      sortValue: (row: Visitor) => row.sessionCount,
    },
    {
      key: "lastSeen",
      label: "Last Seen",
      width: "12%",
      sortable: true,
      render: (row: Visitor) => (
        <span className={styles["session-table-time"]}>{timeAgo(row.lastSeen)}</span>
      ),
      sortValue: (row: Visitor) => timeValue(row.lastSeen),
    },
  ];
}

export function sessionColumns(onOpenSession: (sessionId: string) => void) {
  return [
    {
      key: "sessionId",
      label: "Session",
      width: "15%",
      sortable: true,
      render: (row: ExplorerSession) => (
        <span className={styles["session-table-id"]}>
          <button
            type="button"
            className={styles["table-open-button"]}
            title={row.sessionId}
            onClick={(event) => {
              event.stopPropagation();
              onOpenSession(row.sessionId);
            }}
          >
            {shortId(row.sessionId, 8)}
          </button>
          {row.isBot && <BotTag />}
        </span>
      ),
      sortValue: (row: ExplorerSession) => row.sessionId,
    },
    {
      key: "ip",
      label: "IP",
      width: "15%",
      sortable: true,
      render: (row: ExplorerSession) => <span className={styles["session-table-ip"]}>{row.ip}</span>,
      sortValue: (row: ExplorerSession) => row.ip,
    },
    {
      key: "device",
      label: "Device",
      width: "23%",
      sortable: true,
      render: (row: ExplorerSession) => (
        <DeviceCell device={row.device} browser={row.browser} os={row.os} />
      ),
      sortValue: (row: ExplorerSession) => row.browser?.name || "",
    },
    {
      key: "location",
      label: "Location",
      width: "23%",
      sortable: true,
      render: (row: ExplorerSession) => (
        <span className={styles["session-table-geo"]}>{formatLocation(row.geo)}</span>
      ),
      sortValue: (row: ExplorerSession) => row.geo?.country || "",
    },
    {
      key: "duration",
      label: "Duration",
      width: "12%",
      sortable: true,
      render: (row: ExplorerSession) => (
        <span className={styles["session-table-duration"]}>{formatDurationMs(row.duration)}</span>
      ),
      sortValue: (row: ExplorerSession) => row.duration,
    },
    {
      key: "lastActive",
      label: "Last Active",
      width: "12%",
      sortable: true,
      render: (row: ExplorerSession) => (
        <span className={styles["session-table-time"]}>{timeAgo(row.updatedAt)}</span>
      ),
      sortValue: (row: ExplorerSession) => timeValue(row.updatedAt),
    },
  ];
}
