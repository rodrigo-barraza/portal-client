"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutGrid,
  Table2,
  TrendingUp,
  ArrowRight,
  Activity,
} from "lucide-react";
import {
  LoadingIndicatorComponent,
  TableComponent,
  SegmentedControlComponent,
} from "@rodrigo-barraza/components-library";
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
  domain?: string | null;
}

interface GASummary {
  overview: GAOverview | null;
  realtime: { activeUsers: number } | null;
  loaded: boolean;
}

interface CombinedPropertyRow {
  id: string;
  type: "ga" | "session";
  label: string;
  subtitle: string;
  users: number | null;
  pageviews: number | null;
  sessions: number | null;
  activeNow: number | null;
  linkHref: string;
}

export default function PropertyListingComponent({
  properties,
}: {
  properties: GAProperty[];
}) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState("card");
  const [summaries, setSummaries] = useState<Record<string, GASummary>>({});
  const [sessionProjects, setSessionProjects] = useState<SessionProject[]>([]);
  const didFetch = useRef(false);

  // Fetch overview + realtime for each property in parallel + session projects
  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    for (const property of properties) {
      Promise.all([
        ApiService.getGAOverview(property.id, "30d").catch(() => null),
        ApiService.getGARealtime(property.id).catch(() => null),
      ]).then(([overview, realtime]) => {
        setSummaries((prev) => ({
          ...prev,
          [property.id]: { overview, realtime, loaded: true },
        }));
      });
    }

    // Fetch sessions-service projects
    ApiService.getSessionProjects("30d")
      .then((projectsResponse) => {
        if (projectsResponse?.data && Array.isArray(projectsResponse.data)) {
          setSessionProjects(projectsResponse.data);
        }
      })
      .catch(() => {});
  }, [properties]);

  const tableData: CombinedPropertyRow[] = [
    ...properties.map((prop) => {
      const propertySummary = summaries[prop.id];
      return {
        id: prop.id,
        type: "ga" as const,
        label: prop.label,
        subtitle: prop.measurementId || prop.id,
        users: propertySummary?.overview
          ? propertySummary.overview.totalUsers
          : null,
        pageviews: propertySummary?.overview
          ? propertySummary.overview.pageviews
          : null,
        sessions: propertySummary?.overview
          ? propertySummary.overview.sessions
          : null,
        activeNow: propertySummary?.realtime
          ? propertySummary.realtime.activeUsers
          : null,
        linkHref: `/web-analytics/${prop.id}`,
      };
    }),
    ...sessionProjects.map((proj) => ({
      id: proj.projectId,
      type: "session" as const,
      label: proj.projectId,
      subtitle: "sessions-service",
      users: proj.uniqueVisitors,
      pageviews: null,
      sessions: proj.sessionCount,
      activeNow: null,
      linkHref: `/web-analytics/sessions/${encodeURIComponent(proj.projectId)}`,
    })),
  ];

  const columns = [
    {
      key: "label",
      label: "Property",
      sortable: true,
      sortValue: (row: CombinedPropertyRow) => row.label,
      render: (row: CombinedPropertyRow) => (
        <div className={styles['property-list-name']}>
          <span className={styles['property-list-label']}>{row.label}</span>
          <span className={styles['property-list-id']}>{row.subtitle}</span>
        </div>
      ),
    },
    {
      key: "users",
      label: "Users",
      sortable: true,
      align: "left" as const,
      sortValue: (row: CombinedPropertyRow) => row.users ?? -1,
      render: (row: CombinedPropertyRow) => (
        <span className={styles['property-list-value']}>
          {row.users !== null ? formatNumber(row.users) : "—"}
        </span>
      ),
    },
    {
      key: "pageviews",
      label: "Pageviews",
      sortable: true,
      align: "left" as const,
      sortValue: (row: CombinedPropertyRow) => row.pageviews ?? -1,
      render: (row: CombinedPropertyRow) => (
        <span className={styles['property-list-value']}>
          {row.pageviews !== null ? formatNumber(row.pageviews) : "—"}
        </span>
      ),
    },
    {
      key: "sessions",
      label: "Sessions",
      sortable: true,
      align: "left" as const,
      sortValue: (row: CombinedPropertyRow) => row.sessions ?? -1,
      render: (row: CombinedPropertyRow) => (
        <span className={styles['property-list-value']}>
          {row.sessions !== null ? formatNumber(row.sessions) : "—"}
        </span>
      ),
    },
    {
      key: "activeNow",
      label: "Active Now",
      sortable: true,
      align: "left" as const,
      sortValue: (row: CombinedPropertyRow) => row.activeNow ?? -1,
      render: (row: CombinedPropertyRow) => (
        <div
          className={`${styles['property-list-value']} ${styles['property-list-realtime']}`}
        >
          {row.activeNow !== null ? (
            <>
              <div className={styles['property-list-realtime-dot']} />
              {formatNumber(row.activeNow)}
            </>
          ) : (
            "—"
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles['toolbar-label']}>
          <span>View</span>
        </div>
        <SegmentedControlComponent
          value={viewMode}
          onChange={(value: string) => setViewMode(value)}
          segments={[
            { value: "card", icon: <LayoutGrid size={12} strokeWidth={2.2} /> },
            { value: "list", icon: <Table2 size={12} strokeWidth={2.2} /> },
          ]}
          compact
        />
        <span className={styles['property-summary']}>
          {properties.length}{" "}
          {properties.length === 1 ? "property" : "properties"}
          {sessionProjects.length > 0 &&
            ` · ${sessionProjects.length} session ${sessionProjects.length === 1 ? "project" : "projects"}`}
        </span>
      </div>

      {/* ── Card View ── */}
      {viewMode === "card" && (
        <div className={styles['property-grid']}>
          {properties.map((prop: GAProperty) => {
            const propertySummary = summaries[prop.id];
            return (
              <Link
                key={prop.id}
                href={`/web-analytics/${prop.id}`}
                className={styles['property-card']}
              >
                <div className={styles['property-card-header']}>
                  <div className={styles['property-card-icon']}>
                    <TrendingUp size={18} strokeWidth={2} />
                  </div>
                  <div className={styles['property-card-info']}>
                    <span className={styles['property-card-name']}>
                      {prop.label}
                    </span>
                    <span className={styles['property-card-meta']}>
                      {prop.measurementId || prop.id}
                    </span>
                  </div>
                  <ArrowRight
                    size={14}
                    strokeWidth={2}
                    className={styles['property-card-arrow']}
                  />
                </div>

                {prop.domain && (
                  <div className={styles['property-card-preview-container']}>
                    <iframe
                      src={`https://${prop.domain}`}
                      className={styles['property-card-preview-iframe']}
                      title={`Preview of ${prop.domain}`}
                      loading="lazy"
                      tabIndex={-1}
                      sandbox="allow-scripts allow-same-origin"
                    />
                    <div className={styles['property-card-preview-overlay']} />
                  </div>
                )}

                {propertySummary?.loaded ? (
                  <>
                    {propertySummary.overview && (
                      <div className={styles['property-card-stats']}>
                        <div className={styles['property-card-stat']}>
                          <span className={styles['property-card-stat-value']}>
                            {formatNumber(propertySummary.overview.totalUsers)}
                          </span>
                          <span className={styles['property-card-stat-label']}>
                            Users
                          </span>
                        </div>
                        <div className={styles['property-card-stat']}>
                          <span className={styles['property-card-stat-value']}>
                            {formatNumber(propertySummary.overview.pageviews)}
                          </span>
                          <span className={styles['property-card-stat-label']}>
                            Pageviews
                          </span>
                        </div>
                        <div className={styles['property-card-stat']}>
                          <span className={styles['property-card-stat-value']}>
                            {formatNumber(propertySummary.overview.sessions)}
                          </span>
                          <span className={styles['property-card-stat-label']}>
                            Sessions
                          </span>
                        </div>
                      </div>
                    )}
                    {propertySummary.realtime && (
                      <div className={styles['property-card-realtime']}>
                        <div className={styles['property-card-realtime-dot']} />
                        <span className={styles['property-card-realtime-value']}>
                          {formatNumber(propertySummary.realtime.activeUsers)}
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
              className={styles['property-card']}
            >
              <div className={styles['property-card-header']}>
                <div
                  className={styles['property-card-icon']}
                  style={{
                    background: "rgba(16, 185, 129, 0.08)",
                    color: "#10b981",
                  }}
                >
                  <Activity size={18} strokeWidth={2} />
                </div>
                <div className={styles['property-card-info']}>
                  <span className={styles['property-card-name']}>
                    {proj.projectId}
                  </span>
                  <span className={styles['property-card-meta']}>
                    sessions-service
                  </span>
                </div>
                <ArrowRight
                  size={14}
                  strokeWidth={2}
                  className={styles['property-card-arrow']}
                />
              </div>

              <div className={styles['property-card-stats']}>
                <div className={styles['property-card-stat']}>
                  <span className={styles['property-card-stat-value']}>
                    {formatNumber(proj.uniqueVisitors)}
                  </span>
                  <span className={styles['property-card-stat-label']}>Visitors</span>
                </div>
                <div className={styles['property-card-stat']}>
                  <span className={styles['property-card-stat-value']}>
                    {formatNumber(proj.sessionCount)}
                  </span>
                  <span className={styles['property-card-stat-label']}>Sessions</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── List / Table View ── */}
      {viewMode === "list" && (
        <TableComponent<CombinedPropertyRow>
          columns={columns}
          data={tableData}
          getRowKey={(row: CombinedPropertyRow) => row.id}
          onRowClick={(row: CombinedPropertyRow) => router.push(row.linkHref)}
          emptyText="No properties or projects found"
        />
      )}
    </>
  );
}
