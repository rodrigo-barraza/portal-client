"use client";

import { ArrowRight, Film } from "lucide-react";
import { timeAgo } from "@rodrigo-barraza/utilities-library";
import { DeviceIcon } from "./ExplorerPrimitives";
import {
  countryFlag,
  formatDurationMs,
  formatExact,
  formatSessionLocation,
  formatTimestamp,
  joinMeta,
  shortId,
} from "./analyticsFormat";
import type { SessionSortKey, SessionSummary } from "@/types/portal";
import styles from "../SessionExplorerComponent.module.css";

/**
 * TableComponent columns of the session explorer. Sorting happens on the
 * server, so only the columns sessions-service can sort by are sortable,
 * and their keys ARE the API's sort keys.
 *
 * The library table's row click is mouse-only (no focusable row), so the
 * Started cell renders a real button — the keyboard path to the detail.
 */

/** The columns whose header sorts the list — keyed by the API sort key. */
export const SORTABLE_COLUMNS: readonly SessionSortKey[] = [
  "startedAt",
  "pageviews",
  "engagedMs",
];

function VisitorCell({ row }: { row: SessionSummary }) {
  const returning = row.sessionNumber > 1;
  return (
    <span className={styles["cell-stack"]}>
      <span
        className={`${styles["cell-primary"]} ${styles["cell-mono"]}`}
        title={row.visitorId}
      >
        {shortId(row.visitorId, 8)}
      </span>
      <span className={styles["cell-secondary"]}>
        <span
          className={`${styles["tag"]} ${returning ? styles["tag-returning"] : styles["tag-new"]}`}
        >
          {returning ? `returning #${row.sessionNumber}` : "new"}
        </span>
        {row.userId && <span title={row.userId}>{row.userId}</span>}
      </span>
    </span>
  );
}

function SourceCell({ row }: { row: SessionSummary }) {
  const from = row.referrerHost ?? row.source;
  return (
    <span className={styles["cell-stack"]}>
      <span className={styles["cell-primary"]}>{row.channel}</span>
      {(from || row.campaign) && (
        <span className={styles["cell-secondary"]}>
          {from && <span title={from}>{from}</span>}
          {row.campaign && (
            <span
              className={`${styles["tag"]} ${styles["tag-campaign"]}`}
              title={`Campaign ${row.campaign}`}
            >
              {row.campaign}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function PathCell({ row }: { row: SessionSummary }) {
  const exitedElsewhere = row.exitPath && row.exitPath !== row.entryPath;
  return (
    <span className={styles["cell-stack"]}>
      <span className={styles["cell-path"]} title={row.entryPath}>
        {row.entryPath}
      </span>
      {exitedElsewhere && (
        <span className={styles["cell-secondary"]} title={row.exitPath}>
          <ArrowRight size={10} strokeWidth={2.2} aria-label="exited on" />
          <span className={styles["cell-mono"]}>{row.exitPath}</span>
        </span>
      )}
    </span>
  );
}

export function sessionColumns(onOpenSession: (sessionId: string) => void) {
  return [
    {
      key: "startedAt",
      label: "Started",
      sortable: true,
      render: (row: SessionSummary) => (
        <span className={styles["cell-stack"]}>
          <button
            type="button"
            className={styles["table-open-button"]}
            aria-label={`Open session started ${formatTimestamp(row.startedAt)}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenSession(row.sessionId);
            }}
          >
            {formatTimestamp(row.startedAt)}
          </button>
          <span className={styles["cell-secondary"]}>
            seen {timeAgo(row.lastSeenAt)}
          </span>
        </span>
      ),
    },
    {
      key: "visitor",
      label: "Visitor",
      sortable: false,
      render: (row: SessionSummary) => <VisitorCell row={row} />,
    },
    {
      key: "location",
      label: "Location",
      sortable: false,
      render: (row: SessionSummary) => (
        <span className={styles["cell-stack"]}>
          <span
            className={styles["cell-primary"]}
            title={joinMeta(row.city, row.region, row.country)}
          >
            {[countryFlag(row.country), formatSessionLocation(row, "Unknown")]
              .filter(Boolean)
              .join(" ")}
          </span>
        </span>
      ),
    },
    {
      key: "client",
      label: "Device · Browser · OS",
      sortable: false,
      render: (row: SessionSummary) => (
        <span className={styles["cell-stack"]}>
          <span className={styles["session-table-device"]}>
            <DeviceIcon type={row.device} />
            {joinMeta(row.browser ?? "Unknown", row.os ?? "Unknown")}
          </span>
          <span className={styles["cell-secondary"]}>
            {joinMeta(row.device, row.screen)}
          </span>
        </span>
      ),
    },
    {
      key: "source",
      label: "Source",
      sortable: false,
      render: (row: SessionSummary) => <SourceCell row={row} />,
    },
    {
      key: "path",
      label: "Entry → Exit",
      sortable: false,
      render: (row: SessionSummary) => <PathCell row={row} />,
    },
    {
      key: "pageviews",
      label: "Pages",
      sortable: true,
      align: "right" as const,
      render: (row: SessionSummary) => (
        <span className={styles["cell-number"]}>
          {formatExact(row.pageviews)}
        </span>
      ),
    },
    {
      key: "engagedMs",
      label: "Engaged",
      sortable: true,
      align: "right" as const,
      render: (row: SessionSummary) => (
        <span className={styles["cell-number"]}>
          {formatDurationMs(row.engagedMs)}
        </span>
      ),
    },
    {
      key: "replay",
      label: "Replay",
      sortable: false,
      align: "center" as const,
      render: (row: SessionSummary) =>
        row.hasReplay ? (
          <span
            className={styles["replay-mark"]}
            title="Has a replay recording"
          >
            <Film size={13} strokeWidth={2.2} aria-label="Has a replay" />
          </span>
        ) : null,
    },
  ];
}
