"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { LayoutGrid, Table2, TrendingUp, ArrowRight, Activity } from "lucide-react";
import { LoadingIndicatorComponent } from "@rodrigo-barraza/components-library";
import { formatNumber } from "@rodrigo-barraza/utilities-library";
import ApiService from "../services/ApiService";
import type { GAOverview, SessionProject } from "../types/portal";
import styles from "./GoogleAnalyticsComponent.module.css";

/**
 * PropertyListingComponent — multi-property landing page.
 * Shows all GA4 properties in a card grid or list/table view,
 * plus tracked sessions-service projects below.
 */
interface GAProperty {
  id: string;
  label: string;
  measurementId?: string;
}

interface GASummary {
  overview: GAOverview | null;
  realtime: { activeUsers: number } | null;
  loaded: boolean;
}

export default function PropertyListingComponent({
  properties,
}: {
  properties: GAProperty[];
}) {
  const [viewMode, setViewMode] = useState("card");
  const [summaries, setSummaries] = useState<Record<string, GASummary>>({});
  const [sessionProjects, setSessionProjects] = useState<SessionProject[]>([]);
  const didFetch = useRef(false);

  // Fetch overview + realtime for each property in parallel + session projects
  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    for (const prop of properties) {
      Promise.all([
        ApiService.getGAOverview(prop.id, "30d").catch(() => null),
        ApiService.getGARealtime(prop.id).catch(() => null),
      ]).then(([overview, realtime]) => {
        setSummaries((prev) => ({
          ...prev,
          [prop.id]: { overview, realtime, loaded: true },
        }));
      });
    }

    // Fetch sessions-service projects
    ApiService.getSessionProjects("30d")
      .then((res) => {
        if (res?.data && Array.isArray(res.data)) {
          setSessionProjects(res.data);
        }
      })
      .catch(() => {});
  }, [properties]);

  return (
    <>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLabel}>
          <span>View</span>
        </div>
        <div className={styles.segmentedControl}>
          <button
            className={`${styles.segmentBtn} ${viewMode === "card" ? styles.segmentActive : ""}`}
            onClick={() => setViewMode("card")}
            title="Card view"
          >
            <LayoutGrid size={12} strokeWidth={2.2} />
          </button>
          <button
            className={`${styles.segmentBtn} ${viewMode === "list" ? styles.segmentActive : ""}`}
            onClick={() => setViewMode("list")}
            title="List view"
          >
            <Table2 size={12} strokeWidth={2.2} />
          </button>
        </div>
        <span className={styles.propertySummary}>
          {properties.length}{" "}
          {properties.length === 1 ? "property" : "properties"}
          {sessionProjects.length > 0 &&
            ` · ${sessionProjects.length} session ${sessionProjects.length === 1 ? "project" : "projects"}`}
        </span>
      </div>

      {/* ── Card View ── */}
      {viewMode === "card" && (
        <div className={styles.propertyGrid}>
          {properties.map((prop: GAProperty) => {
            const s = summaries[prop.id];
            return (
              <Link
                key={prop.id}
                href={`/web-analytics/${prop.id}`}
                className={styles.propertyCard}
              >
                <div className={styles.propertyCardHeader}>
                  <div className={styles.propertyCardIcon}>
                    <TrendingUp size={18} strokeWidth={2} />
                  </div>
                  <div className={styles.propertyCardInfo}>
                    <span className={styles.propertyCardName}>
                      {prop.label}
                    </span>
                    <span className={styles.propertyCardMeta}>
                      {prop.measurementId || prop.id}
                    </span>
                  </div>
                  <ArrowRight
                    size={14}
                    strokeWidth={2}
                    className={styles.propertyCardArrow}
                  />
                </div>

                {s?.loaded ? (
                  <>
                    {s.overview && (
                      <div className={styles.propertyCardStats}>
                        <div className={styles.propertyCardStat}>
                          <span className={styles.propertyCardStatValue}>
                            {formatNumber(s.overview.totalUsers)}
                          </span>
                          <span className={styles.propertyCardStatLabel}>
                            Users
                          </span>
                        </div>
                        <div className={styles.propertyCardStat}>
                          <span className={styles.propertyCardStatValue}>
                            {formatNumber(s.overview.pageviews)}
                          </span>
                          <span className={styles.propertyCardStatLabel}>
                            Pageviews
                          </span>
                        </div>
                        <div className={styles.propertyCardStat}>
                          <span className={styles.propertyCardStatValue}>
                            {formatNumber(s.overview.sessions)}
                          </span>
                          <span className={styles.propertyCardStatLabel}>
                            Sessions
                          </span>
                        </div>
                      </div>
                    )}
                    {s.realtime && (
                      <div className={styles.propertyCardRealtime}>
                        <div className={styles.propertyCardRealtimeDot} />
                        <span className={styles.propertyCardRealtimeValue}>
                          {formatNumber(s.realtime.activeUsers)}
                        </span>
                        <span>active now</span>
                      </div>
                    )}
                  </>
                ) : (
                  <LoadingIndicatorComponent size="small" label="Loading…" />
                )}
              </Link>
            );
          })}

          {/* ── Sessions Projects Cards ── */}
          {sessionProjects.map((proj) => (
            <Link
              key={proj.projectId}
              href={`/web-analytics/sessions/${encodeURIComponent(proj.projectId)}`}
              className={styles.propertyCard}
            >
              <div className={styles.propertyCardHeader}>
                <div
                  className={styles.propertyCardIcon}
                  style={{
                    background: "rgba(16, 185, 129, 0.08)",
                    color: "#10b981",
                  }}
                >
                  <Activity size={18} strokeWidth={2} />
                </div>
                <div className={styles.propertyCardInfo}>
                  <span className={styles.propertyCardName}>
                    {proj.projectId}
                  </span>
                  <span className={styles.propertyCardMeta}>
                    sessions-service
                  </span>
                </div>
                <ArrowRight
                  size={14}
                  strokeWidth={2}
                  className={styles.propertyCardArrow}
                />
              </div>

              <div className={styles.propertyCardStats}>
                <div className={styles.propertyCardStat}>
                  <span className={styles.propertyCardStatValue}>
                    {formatNumber(proj.uniqueVisitors)}
                  </span>
                  <span className={styles.propertyCardStatLabel}>
                    Visitors
                  </span>
                </div>
                <div className={styles.propertyCardStat}>
                  <span className={styles.propertyCardStatValue}>
                    {formatNumber(proj.sessionCount)}
                  </span>
                  <span className={styles.propertyCardStatLabel}>
                    Sessions
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── List / Table View ── */}
      {viewMode === "list" && (
        <div className={styles.propertyList}>
          <div className={styles.propertyListHeader}>
            <span className={styles.propertyListHeaderCell}>Property</span>
            <span className={styles.propertyListHeaderCell}>Users</span>
            <span className={styles.propertyListHeaderCell}>Pageviews</span>
            <span className={styles.propertyListHeaderCell}>Sessions</span>
            <span className={styles.propertyListHeaderCell}>Active Now</span>
          </div>
          {properties.map((prop: GAProperty) => {
            const s = summaries[prop.id];
            return (
              <Link
                key={prop.id}
                href={`/web-analytics/${prop.id}`}
                className={styles.propertyListRow}
              >
                <div className={styles.propertyListName}>
                  <span className={styles.propertyListLabel}>{prop.label}</span>
                  <span className={styles.propertyListId}>
                    {prop.measurementId || prop.id}
                  </span>
                </div>
                <span className={styles.propertyListValue}>
                  {s?.overview ? formatNumber(s.overview.totalUsers) : "—"}
                </span>
                <span className={styles.propertyListValue}>
                  {s?.overview ? formatNumber(s.overview.pageviews) : "—"}
                </span>
                <span className={styles.propertyListValue}>
                  {s?.overview ? formatNumber(s.overview.sessions) : "—"}
                </span>
                <div
                  className={`${styles.propertyListValue} ${styles.propertyListRealtime}`}
                >
                  {s?.realtime ? (
                    <>
                      <div className={styles.propertyListRealtimeDot} />
                      {formatNumber(s.realtime.activeUsers)}
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              </Link>
            );
          })}

          {/* ── Session projects in list view ── */}
          {sessionProjects.map((proj) => (
            <Link
              key={proj.projectId}
              href={`/web-analytics/sessions/${encodeURIComponent(proj.projectId)}`}
              className={styles.propertyListRow}
            >
              <div className={styles.propertyListName}>
                <span className={styles.propertyListLabel}>{proj.projectId}</span>
                <span className={styles.propertyListId}>sessions-service</span>
              </div>
              <span className={styles.propertyListValue}>
                {formatNumber(proj.uniqueVisitors)}
              </span>
              <span className={styles.propertyListValue}>—</span>
              <span className={styles.propertyListValue}>
                {formatNumber(proj.sessionCount)}
              </span>
              <div className={`${styles.propertyListValue} ${styles.propertyListRealtime}`}>
                —
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
