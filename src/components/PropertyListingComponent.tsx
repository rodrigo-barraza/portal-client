"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, Table2, TrendingUp, ArrowRight, Activity } from "lucide-react";
import {
  LoadingIndicatorComponent,
  TableComponent,
  SegmentedControlComponent,
} from "@rodrigo-barraza/components-library";
import { formatNumber } from "@rodrigo-barraza/utilities-library";
import ApiService from "../services/ApiService";
import { SOURCE_COLORS, SourceBadges } from "./AnalyticsPrimitives";
import type { GAOverview, GAProperty, SessionProject } from "../types/portal";
import styles from "./WebAnalytics.module.css";

/**
 * PropertyListingComponent — unified web-analytics landing page.
 * A "property" is one site: it may be tracked by GA4, by our first-party
 * sessions-service, or both. GA properties join to session projects via
 * the registry serviceId, so a site with both trackers renders as ONE
 * card/row with both sources' numbers instead of two disconnected entries.
 */

interface GASummary {
  overview: GAOverview | null;
  realtime: { activeUsers: number } | null;
  loaded: boolean;
}

/** One site in the unified listing — GA property, sessions project, or both. */
interface UnifiedProperty {
  key: string;
  label: string;
  meta: string;
  domain?: string | null;
  ga?: GAProperty;
  sessions?: SessionProject;
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

  // Fetch overview + realtime for each GA property in parallel + session projects
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

    ApiService.getSessionProjects("30d")
      .then((projectsResponse) => {
        if (projectsResponse?.data && Array.isArray(projectsResponse.data)) {
          setSessionProjects(projectsResponse.data);
        }
      })
      .catch(() => {});
  }, [properties]);

  // ── Merge GA properties and session projects into one list ──

  const unifiedProperties = useMemo<UnifiedProperty[]>(() => {
    const sessionsByProjectId = new Map(
      sessionProjects.map((project) => [project.projectId, project]),
    );

    const merged: UnifiedProperty[] = properties.map((property) => {
      const linkedSessions = property.serviceId
        ? sessionsByProjectId.get(property.serviceId)
        : undefined;
      if (linkedSessions) sessionsByProjectId.delete(linkedSessions.projectId);
      return {
        key: `ga-${property.id}`,
        label: property.label,
        meta: [property.measurementId || property.id, linkedSessions?.projectId]
          .filter(Boolean)
          .join(" · "),
        domain: property.domain,
        ga: property,
        sessions: linkedSessions,
        linkHref: `/web-analytics/${property.id}`,
      };
    });

    // Remaining session projects have no GA counterpart — first-party only
    for (const project of sessionsByProjectId.values()) {
      merged.push({
        key: `fp-${project.projectId}`,
        label: project.projectId,
        meta: "sessions-service",
        sessions: project,
        linkHref: `/web-analytics/sessions/${encodeURIComponent(project.projectId)}`,
      });
    }

    return merged;
  }, [properties, sessionProjects]);

  const unifiedCount = unifiedProperties.filter((p) => p.ga && p.sessions).length;

  // ── Table columns ─────────────────────────────────────────

  const columns = [
    {
      key: "label",
      label: "Property",
      sortable: true,
      sortValue: (row: UnifiedProperty) => row.label,
      render: (row: UnifiedProperty) => (
        <div className={styles['property-list-name']}>
          <span className={styles['property-list-label']}>
            {row.label} <SourceBadges hasGA={!!row.ga} hasSessions={!!row.sessions} />
          </span>
          <span className={styles['property-list-id']}>{row.meta}</span>
        </div>
      ),
    },
    {
      key: "users",
      label: "GA4 Users",
      sortable: true,
      align: "left" as const,
      sortValue: (row: UnifiedProperty) =>
        summaries[row.ga?.id || ""]?.overview?.totalUsers ?? -1,
      render: (row: UnifiedProperty) => {
        const overview = summaries[row.ga?.id || ""]?.overview;
        return (
          <span className={styles['property-list-value']}>
            {overview ? formatNumber(overview.totalUsers) : "—"}
          </span>
        );
      },
    },
    {
      key: "pageviews",
      label: "GA4 Pageviews",
      sortable: true,
      align: "left" as const,
      sortValue: (row: UnifiedProperty) =>
        summaries[row.ga?.id || ""]?.overview?.pageviews ?? -1,
      render: (row: UnifiedProperty) => {
        const overview = summaries[row.ga?.id || ""]?.overview;
        return (
          <span className={styles['property-list-value']}>
            {overview ? formatNumber(overview.pageviews) : "—"}
          </span>
        );
      },
    },
    {
      key: "sessions",
      label: "GA4 Sessions",
      sortable: true,
      align: "left" as const,
      sortValue: (row: UnifiedProperty) =>
        summaries[row.ga?.id || ""]?.overview?.sessions ?? -1,
      render: (row: UnifiedProperty) => {
        const overview = summaries[row.ga?.id || ""]?.overview;
        return (
          <span className={styles['property-list-value']}>
            {overview ? formatNumber(overview.sessions) : "—"}
          </span>
        );
      },
    },
    {
      key: "fpVisitors",
      label: "1P Visitors",
      sortable: true,
      align: "left" as const,
      sortValue: (row: UnifiedProperty) => row.sessions?.uniqueVisitors ?? -1,
      render: (row: UnifiedProperty) => (
        <span className={styles['property-list-value']}>
          {row.sessions ? formatNumber(row.sessions.uniqueVisitors) : "—"}
        </span>
      ),
    },
    {
      key: "fpSessions",
      label: "1P Sessions",
      sortable: true,
      align: "left" as const,
      sortValue: (row: UnifiedProperty) => row.sessions?.sessionCount ?? -1,
      render: (row: UnifiedProperty) => (
        <span className={styles['property-list-value']}>
          {row.sessions ? formatNumber(row.sessions.sessionCount) : "—"}
        </span>
      ),
    },
    {
      key: "activeNow",
      label: "Active Now",
      sortable: true,
      align: "left" as const,
      sortValue: (row: UnifiedProperty) =>
        summaries[row.ga?.id || ""]?.realtime?.activeUsers ?? -1,
      render: (row: UnifiedProperty) => {
        const realtime = summaries[row.ga?.id || ""]?.realtime;
        return (
          <div
            className={`${styles['property-list-value']} ${styles['property-list-realtime']}`}
          >
            {realtime ? (
              <>
                <div className={styles['property-list-realtime-dot']} />
                {formatNumber(realtime.activeUsers)}
              </>
            ) : (
              "—"
            )}
          </div>
        );
      },
    },
  ];

  // ── Render ────────────────────────────────────────────────

  return (
    <>
      {/* ── Toolbar ── */}
      <div className={`property-listing-component ${styles['toolbar']}`}>
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
          {unifiedProperties.length}{" "}
          {unifiedProperties.length === 1 ? "property" : "properties"}
          {unifiedCount > 0 && ` · ${unifiedCount} unified (GA4 + first-party)`}
        </span>
      </div>

      {/* ── Card View ── */}
      {viewMode === "card" && (
        <div className={styles['property-grid']}>
          {unifiedProperties.map((property) => (
            <PropertyCard
              key={property.key}
              property={property}
              summary={property.ga ? summaries[property.ga.id] : undefined}
            />
          ))}
        </div>
      )}

      {/* ── List / Table View ── */}
      {viewMode === "list" && (
        <TableComponent<UnifiedProperty>
          columns={columns}
          data={unifiedProperties}
          getRowKey={(row: UnifiedProperty) => row.key}
          onRowClick={(row: UnifiedProperty) => router.push(row.linkHref)}
          emptyText="No properties or projects found"
        />
      )}
    </>
  );
}

// ── Property Card ─────────────────────────────────────────────

function PropertyCard({
  property,
  summary,
}: {
  property: UnifiedProperty;
  summary?: GASummary;
}) {
  const sessionsOnly = !property.ga;

  return (
    <Link href={property.linkHref} className={styles['property-card']}>
      <div className={styles['property-card-header']}>
        <div
          className={styles['property-card-icon']}
          style={
            sessionsOnly
              ? {
                  background: `color-mix(in srgb, ${SOURCE_COLORS.sessions} 8%, transparent)`,
                  color: SOURCE_COLORS.sessions,
                }
              : undefined
          }
        >
          {sessionsOnly ? (
            <Activity size={18} strokeWidth={2} />
          ) : (
            <TrendingUp size={18} strokeWidth={2} />
          )}
        </div>
        <div className={styles['property-card-info']}>
          <span className={styles['property-card-name']}>{property.label}</span>
          <span className={styles['property-card-meta']}>{property.meta}</span>
        </div>
        <SourceBadges hasGA={!!property.ga} hasSessions={!!property.sessions} />
        <ArrowRight size={14} strokeWidth={2} className={styles['property-card-arrow']} />
      </div>

      {property.domain && (
        <div className={styles['property-card-preview-container']}>
          <iframe
            src={`https://${property.domain}`}
            className={styles['property-card-preview-iframe']}
            title={`Preview of ${property.domain}`}
            loading="lazy"
            tabIndex={-1}
            sandbox="allow-scripts allow-same-origin"
          />
          <div className={styles['property-card-preview-overlay']} />
        </div>
      )}

      {/* ── Google Analytics stats ── */}
      {property.ga &&
        (summary?.loaded ? (
          summary.overview && (
            <div className={styles['property-card-stat-group']}>
              {property.sessions && (
                <span className={styles['property-card-stat-caption']}>
                  <span
                    className={styles['property-card-stat-caption-dot']}
                    style={{ background: SOURCE_COLORS.ga }}
                  />
                  Google Analytics
                </span>
              )}
              <div className={styles['property-card-stats']}>
                <CardStat value={summary.overview.totalUsers} label="Users" />
                <CardStat value={summary.overview.pageviews} label="Pageviews" />
                <CardStat value={summary.overview.sessions} label="Sessions" />
              </div>
            </div>
          )
        ) : (
          <LoadingIndicatorComponent size="small" label="Loading…" />
        ))}

      {/* ── First-party stats ── */}
      {property.sessions && (
        <div className={styles['property-card-stat-group']}>
          {property.ga && (
            <span className={styles['property-card-stat-caption']}>
              <span
                className={styles['property-card-stat-caption-dot']}
                style={{ background: SOURCE_COLORS.sessions }}
              />
              First-Party
            </span>
          )}
          <div className={styles['property-card-stats']}>
            <CardStat value={property.sessions.uniqueVisitors} label="Visitors" />
            <CardStat value={property.sessions.sessionCount} label="Sessions" />
          </div>
        </div>
      )}

      {property.ga && summary?.realtime && (
        <div className={styles['property-card-realtime']}>
          <div className={styles['property-card-realtime-dot']} />
          <span className={styles['property-card-realtime-value']}>
            {formatNumber(summary.realtime.activeUsers)}
          </span>
          <span>active now</span>
        </div>
      )}
    </Link>
  );
}

function CardStat({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles['property-card-stat']}>
      <span className={styles['property-card-stat-value']}>{formatNumber(value)}</span>
      <span className={styles['property-card-stat-label']}>{label}</span>
    </div>
  );
}
