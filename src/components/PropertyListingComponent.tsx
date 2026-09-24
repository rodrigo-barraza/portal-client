"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Globe,
  LayoutGrid,
  Table2,
  TrendingUp,
} from "lucide-react";
import {
  LoadingIndicatorComponent,
  TableComponent,
} from "@rodrigo-barraza/components-library";
import { formatCompact, formatDate } from "@rodrigo-barraza/utilities-library";
import ApiService from "../services/ApiService";
import { SOURCE_COLORS, SourceBadges } from "./AnalyticsPrimitives";
import useAsyncData, { unwrapData } from "./analytics/useAsyncData";
import { useVisiblePolling } from "./monitoring/useVisiblePolling";
import { joinMeta } from "./analytics/analyticsFormat";
import IconSegmentedControlComponent from "./analytics/IconSegmentedControlComponent";
import type {
  GAOverview,
  GAProperty,
  GARealtimeReport,
  SessionProjectSummary,
} from "../types/portal";
import styles from "./WebAnalytics.module.css";

/**
 * PropertyListingComponent — unified web-analytics landing page.
 * A "property" is one site: it may be tracked by GA4, by our first-party
 * sessions-service, or both. GA properties join to session projects via
 * the registry serviceId, so a site with both trackers renders as ONE
 * card/row with both sources' numbers instead of two disconnected entries.
 */

/** The window every number on this page covers. */
const LISTING_PERIOD = "30d";

interface GASummary {
  overview: GAOverview | null;
  realtime: GARealtimeReport | null;
}

/** One site in the unified listing — GA property, sessions project, or both. */
interface UnifiedProperty {
  key: string;
  label: string;
  meta: string;
  domain?: string | null;
  ga?: GAProperty;
  sessions?: SessionProjectSummary;
  linkHref: string;
}

type ViewMode = "card" | "list";

/**
 * Every project sessions-service has ever seen, with its LISTING_PERIOD
 * numbers and live count — one call: /projects lists quiet projects too,
 * so a site never vanishes (or loses its first-party badge) after a quiet
 * month.
 */
function loadSessionProjects(
  signal: AbortSignal,
): Promise<SessionProjectSummary[]> {
  return ApiService.getSessionProjects(
    { period: LISTING_PERIOD },
    { signal },
  ).then(unwrapData);
}

/**
 * Overview + realtime per GA property, filled in progressively as each
 * property's pair of requests lands (a slow property doesn't hold the rest).
 * A new property list — or leaving the page — aborts the old requests.
 */
function useGASummaries(properties: GAProperty[]): Record<string, GASummary> {
  const [summaries, setSummaries] = useState<Record<string, GASummary>>({});
  const propertyIds = properties.map((property) => property.id).join("\u0000");

  useVisiblePolling(
    async (isCurrent, signal) => {
      await Promise.all(
        properties.map(async (property) => {
          const [overview, realtime] = await Promise.all([
            ApiService.getGAOverview(property.id, LISTING_PERIOD, {
              signal,
            }).catch(() => null),
            ApiService.getGARealtime(property.id, { signal }).catch(() => null),
          ]);
          if (!isCurrent()) return;
          setSummaries((previous) => ({
            ...previous,
            [property.id]: { overview, realtime },
          }));
        }),
      );
    },
    null,
    { restartKey: propertyIds },
  );

  return summaries;
}

export default function PropertyListingComponent({
  properties,
}: {
  properties: GAProperty[];
}) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const summaries = useGASummaries(properties);
  const projects = useAsyncData("session-projects", loadSessionProjects);
  const sessionProjects = projects.data;

  // ── Merge GA properties and session projects into one list ──

  const unifiedProperties = useMemo<UnifiedProperty[]>(() => {
    const sessionsByProjectId = new Map(
      (sessionProjects ?? []).map((project) => [project.projectId, project]),
    );

    const merged: UnifiedProperty[] = properties.map((property) => {
      const linkedSessions = property.serviceId
        ? sessionsByProjectId.get(property.serviceId)
        : undefined;
      if (linkedSessions) sessionsByProjectId.delete(linkedSessions.projectId);
      return {
        key: `ga-${property.id}`,
        label: property.label,
        meta: joinMeta(
          property.measurementId || property.id,
          linkedSessions?.projectId,
        ),
        domain: property.domain,
        ga: property,
        sessions: linkedSessions,
        linkHref: `/web-analytics/${encodeURIComponent(property.id)}`,
      };
    });

    // Remaining session projects have no GA counterpart — first-party only
    for (const project of sessionsByProjectId.values()) {
      merged.push({
        key: `fp-${project.projectId}`,
        label: project.projectId,
        meta: joinMeta(
          "first-party",
          `since ${formatDate(project.firstSeenAt)}`,
        ),
        sessions: project,
        linkHref: `/web-analytics/sessions/${encodeURIComponent(project.projectId)}`,
      });
    }

    return merged;
  }, [properties, sessionProjects]);

  const unifiedCount = unifiedProperties.filter(
    (property) => property.ga && property.sessions,
  ).length;

  // ── Table columns ─────────────────────────────────────────

  const columns = useMemo(() => {
    const gaSummary = (row: UnifiedProperty) =>
      row.ga ? summaries[row.ga.id] : undefined;
    const valueCell = (value: number | null | undefined) => (
      <span className={styles["property-list-value"]}>
        {value == null ? "—" : formatCompact(value)}
      </span>
    );
    const liveCell = (active: number | null | undefined) => (
      <div
        className={`${styles["property-list-value"]} ${styles["property-list-realtime"]}`}
      >
        {active == null ? (
          "—"
        ) : (
          <>
            {active > 0 && (
              <div
                className={styles["property-list-realtime-dot"]}
                aria-hidden
              />
            )}
            {formatCompact(active)}
          </>
        )}
      </div>
    );

    return [
      {
        key: "label",
        label: "Property",
        sortable: true,
        sortValue: (row: UnifiedProperty) => row.label,
        render: (row: UnifiedProperty) => (
          <div className={styles["property-list-name"]}>
            <span className={styles["property-list-label"]}>
              {/* A real link: keyboard-reachable and middle-clickable,
                  unlike the row's click handler */}
              <Link
                href={row.linkHref}
                className={styles["property-list-link"]}
                onClick={(event) => event.stopPropagation()}
              >
                {row.label}
              </Link>{" "}
              <SourceBadges hasGA={!!row.ga} hasSessions={!!row.sessions} />
            </span>
            <span className={styles["property-list-id"]}>{row.meta}</span>
          </div>
        ),
      },
      {
        key: "users",
        label: "GA4 Users",
        sortable: true,
        align: "left" as const,
        sortValue: (row: UnifiedProperty) =>
          gaSummary(row)?.overview?.totalUsers ?? -1,
        render: (row: UnifiedProperty) =>
          valueCell(gaSummary(row)?.overview?.totalUsers),
      },
      {
        key: "pageviews",
        label: "GA4 Pageviews",
        sortable: true,
        align: "left" as const,
        sortValue: (row: UnifiedProperty) =>
          gaSummary(row)?.overview?.pageviews ?? -1,
        render: (row: UnifiedProperty) =>
          valueCell(gaSummary(row)?.overview?.pageviews),
      },
      {
        key: "sessions",
        label: "GA4 Sessions",
        sortable: true,
        align: "left" as const,
        sortValue: (row: UnifiedProperty) =>
          gaSummary(row)?.overview?.sessions ?? -1,
        render: (row: UnifiedProperty) =>
          valueCell(gaSummary(row)?.overview?.sessions),
      },
      {
        key: "fpVisitors",
        label: "1P Visitors",
        sortable: true,
        align: "left" as const,
        sortValue: (row: UnifiedProperty) => row.sessions?.visitors ?? -1,
        render: (row: UnifiedProperty) => valueCell(row.sessions?.visitors),
      },
      {
        key: "fpSessions",
        label: "1P Sessions",
        sortable: true,
        align: "left" as const,
        sortValue: (row: UnifiedProperty) => row.sessions?.sessions ?? -1,
        render: (row: UnifiedProperty) => valueCell(row.sessions?.sessions),
      },
      {
        key: "activeNow",
        label: "GA4 Active",
        sortable: true,
        align: "left" as const,
        sortValue: (row: UnifiedProperty) =>
          gaSummary(row)?.realtime?.activeUsers ?? -1,
        render: (row: UnifiedProperty) =>
          liveCell(gaSummary(row)?.realtime?.activeUsers),
      },
      {
        key: "fpActive",
        label: "1P Active",
        sortable: true,
        align: "left" as const,
        sortValue: (row: UnifiedProperty) => row.sessions?.live ?? -1,
        render: (row: UnifiedProperty) => liveCell(row.sessions?.live),
      },
    ];
  }, [summaries]);

  // ── Render ────────────────────────────────────────────────

  return (
    <>
      {/* ── Toolbar ── */}
      <div className={`property-listing-component ${styles["toolbar"]}`}>
        <div className={styles["toolbar-label"]}>
          <span>View</span>
        </div>
        <IconSegmentedControlComponent<ViewMode>
          value={viewMode}
          onChange={setViewMode}
          ariaLabel="View mode"
          segments={[
            {
              value: "card",
              icon: <LayoutGrid size={12} strokeWidth={2.2} />,
              label: "Card view",
            },
            {
              value: "list",
              icon: <Table2 size={12} strokeWidth={2.2} />,
              label: "Table view",
            },
          ]}
        />
        <span className={styles["property-summary"]}>
          {unifiedProperties.length}{" "}
          {unifiedProperties.length === 1 ? "property" : "properties"}
          {unifiedCount > 0 && ` · ${unifiedCount} unified (GA4 + first-party)`}
          {projects.loading && " · loading first-party projects…"}
          {projects.error && " · first-party projects unavailable"}
        </span>
      </div>

      {/* ── Card View ── */}
      {viewMode === "card" && (
        <div className={styles["property-grid"]}>
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

// ── Site Preview ──────────────────────────────────────────────

/**
 * The site's cached screenshot from portal-service (the same thumbnail the
 * /containers cards use). The previous live <iframe> booted every site's
 * SPA at once — and ran each site's own GA + session tracker, so merely
 * opening this page logged a visit to every property it lists.
 */
function SitePreview({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={styles["property-card-preview-fallback"]}>
        <Globe size={14} strokeWidth={2.2} aria-hidden />
        <span>{domain}</span>
      </div>
    );
  }

  return (
    <img
      src={ApiService.buildContainerPreviewUrl(domain)}
      alt=""
      className={styles["property-card-preview-image"]}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
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
    <Link href={property.linkHref} className={styles["property-card"]}>
      <div className={styles["property-card-header"]}>
        <div
          className={`${styles["property-card-icon"]} ${sessionsOnly ? styles["property-card-icon-fp"] : ""}`}
          aria-hidden
        >
          {sessionsOnly ? (
            <Activity size={18} strokeWidth={2} />
          ) : (
            <TrendingUp size={18} strokeWidth={2} />
          )}
        </div>
        <div className={styles["property-card-info"]}>
          <span className={styles["property-card-name"]}>{property.label}</span>
          <span className={styles["property-card-meta"]}>{property.meta}</span>
        </div>
        <SourceBadges hasGA={!!property.ga} hasSessions={!!property.sessions} />
        <ArrowRight
          size={14}
          strokeWidth={2}
          className={styles["property-card-arrow"]}
          aria-hidden
        />
      </div>

      {property.domain && (
        <div className={styles["property-card-preview-container"]}>
          <SitePreview domain={property.domain} />
          <div className={styles["property-card-preview-overlay"]} />
        </div>
      )}

      {/* ── Google Analytics stats ── */}
      {property.ga &&
        (summary ? (
          summary.overview && (
            <div className={styles["property-card-stat-group"]}>
              {property.sessions && (
                <span className={styles["property-card-stat-caption"]}>
                  <span
                    className={styles["property-card-stat-caption-dot"]}
                    style={{ background: SOURCE_COLORS.ga }}
                  />
                  Google Analytics
                </span>
              )}
              <div className={styles["property-card-stats"]}>
                <CardStat value={summary.overview.totalUsers} label="Users" />
                <CardStat
                  value={summary.overview.pageviews}
                  label="Pageviews"
                />
                <CardStat value={summary.overview.sessions} label="Sessions" />
              </div>
            </div>
          )
        ) : (
          <LoadingIndicatorComponent size="small" label="Loading…" />
        ))}

      {/* ── First-party stats ── */}
      {property.sessions && (
        <div className={styles["property-card-stat-group"]}>
          {property.ga && (
            <span className={styles["property-card-stat-caption"]}>
              <span
                className={styles["property-card-stat-caption-dot"]}
                style={{ background: SOURCE_COLORS.sessions }}
              />
              First-Party
            </span>
          )}
          <div className={styles["property-card-stats"]}>
            <CardStat value={property.sessions.visitors} label="Visitors" />
            <CardStat value={property.sessions.sessions} label="Sessions" />
            <CardStat value={property.sessions.live} label="Active now" />
          </div>
        </div>
      )}

      {property.ga && summary?.realtime && (
        <div className={styles["property-card-realtime"]}>
          <div className={styles["property-card-realtime-dot"]} aria-hidden />
          <span className={styles["property-card-realtime-value"]}>
            {formatCompact(summary.realtime.activeUsers)}
          </span>
          {/* Both sources count "active now" — say which this is */}
          <span>{property.sessions ? "active now in GA4" : "active now"}</span>
        </div>
      )}
    </Link>
  );
}

function CardStat({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles["property-card-stat"]}>
      <span className={styles["property-card-stat-value"]}>
        {formatCompact(value)}
      </span>
      <span className={styles["property-card-stat-label"]}>{label}</span>
    </div>
  );
}
