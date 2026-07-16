"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ButtonComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  SegmentedControlComponent,
  DatePickerComponent,
} from "@rodrigo-barraza/components-library";
import { ArrowLeft, BarChart3, Scale } from "lucide-react";
import ApiService from "../services/ApiService";
import GAReportComponent from "./GAReportComponent";
import SessionReportComponent from "./SessionReportComponent";
import { DeltaBadge, SourceBadges } from "./AnalyticsPrimitives";
import { formatNumber } from "@rodrigo-barraza/utilities-library";
import styles from "./WebAnalytics.module.css";
import type { GAProperty, GAOverview, SessionOverview, SessionProject } from "../types/portal";

type AnalyticsSource = "ga" | "sessions";

const PRESET_PERIODS = ["7d", "30d", "90d"];
const isCustomPeriod = (period: string) => period.includes("_");

/**
 * PropertyDashboardComponent — unified detail page for one property.
 * A property can be tracked by Google Analytics (GA4), by our first-party
 * sessions-service, or both — GA properties join to session projects via
 * the registry serviceId. When both sources exist, a toggle switches
 * between them and a comparison panel shows the sources side by side.
 */
export default function PropertyDashboardComponent({
  propertyId,
  projectId,
}: {
  /** GA4 property id from /web-analytics/[propertyId] */
  propertyId?: string;
  /** sessions-service project id from /web-analytics/sessions/[projectId] */
  projectId?: string;
}) {
  const router = useRouter();
  const [properties, setProperties] = useState<GAProperty[] | null>(null);
  const [sessionProjects, setSessionProjects] = useState<SessionProject[] | null>(null);
  const [source, setSource] = useState<AnalyticsSource>(propertyId ? "ga" : "sessions");
  const [period, setPeriod] = useState("30d");
  const [error, setError] = useState<string | null>(null);

  const didFetch = useRef(false);

  // ── Resolve the property + linked sessions project ────────

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    (async () => {
      const [propertiesResponse, projectsResponse] = await Promise.all([
        ApiService.getGAProperties().catch((error: unknown) => {
          if (propertyId) setError(error instanceof Error ? error.message : String(error));
          return null;
        }),
        ApiService.getSessionProjects("all").catch(() => null),
      ]);
      setProperties(propertiesResponse?.properties || []);
      const projects = projectsResponse?.data;
      setSessionProjects(Array.isArray(projects) ? projects : []);
    })();
  }, [propertyId]);

  const loading = properties === null || sessionProjects === null;

  const gaProperty = useMemo(() => {
    if (!properties) return null;
    if (propertyId) return properties.find((property) => property.id === propertyId) || null;
    // Sessions route — join back to a GA property via registry serviceId
    return properties.find((property) => property.serviceId === projectId) || null;
  }, [properties, propertyId, projectId]);

  const sessionsProjectId = useMemo(() => {
    if (projectId) return projectId;
    if (!gaProperty?.serviceId || !sessionProjects) return null;
    return sessionProjects.some((project) => project.projectId === gaProperty.serviceId)
      ? gaProperty.serviceId
      : null;
  }, [projectId, gaProperty, sessionProjects]);

  const hasGA = !!gaProperty;
  const hasSessions = !!sessionsProjectId;
  const isUnified = hasGA && hasSessions;

  // Force a valid source if the preferred one isn't available
  const activeSource: AnalyticsSource =
    source === "ga" && !hasGA ? "sessions" : source === "sessions" && !hasSessions ? "ga" : source;

  const title = gaProperty?.label || sessionsProjectId || "Web Analytics";
  const subtitle = [
    gaProperty && `GA4 ${gaProperty.measurementId || gaProperty.id}`,
    sessionsProjectId && `sessions-service ${sessionsProjectId}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const [startDate, endDate] = useMemo(() => {
    if (isCustomPeriod(period)) return period.split("_");
    return ["", ""];
  }, [period]);

  const switchSource = (value: string) => {
    const nextSource = value as AnalyticsSource;
    // sessions-service only understands Nd presets — drop custom GA ranges
    if (nextSource === "sessions" && isCustomPeriod(period)) setPeriod("30d");
    setSource(nextSource);
  };

  // ── Loading / not-found states ────────────────────────────

  if (loading) {
    return (
      <div className={styles['dashboard']}>
        <PageHeaderComponent sticky={false} title="Web Analytics" subtitle="Loading property…" />
        <LoadingIndicatorComponent
          size="small"
          label="Loading property…"
          className="is-loading-centered-state"
        />
      </div>
    );
  }

  if (error || (!hasGA && !hasSessions)) {
    return (
      <div className={styles['dashboard']}>
        <PageHeaderComponent sticky={false} title="Web Analytics" subtitle="Property not found" />
        <div className={styles['empty-state']}>
          <BarChart3 size={40} strokeWidth={1.5} className={styles['empty-icon']} />
          <span className={styles['empty-title']}>
            {error ? "Analytics Error" : "Unknown property"}
          </span>
          <span className={styles['empty-detail']}>
            {error || `No GA4 property or tracked sessions project matches “${propertyId || projectId}”.`}
          </span>
          <ButtonComponent
            variant="text"
            size="small"
            icon={ArrowLeft}
            onClick={() => router.push("/web-analytics")}
          >
            All Properties
          </ButtonComponent>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className={`property-dashboard-component ${styles['dashboard']}`}>
      <PageHeaderComponent sticky={false} title={title} subtitle={subtitle}>
        <div className={styles['header-controls']}>
          <SegmentedControlComponent
            value={period}
            onChange={setPeriod}
            segments={PRESET_PERIODS.map((presetPeriod) => ({
              value: presetPeriod,
              label: presetPeriod,
            }))}
            compact
          />
          {activeSource === "ga" && (
            <DatePickerComponent
              from={startDate}
              to={endDate}
              onChange={(value: { from: string; to: string }) => {
                if (value && value.from && value.to) {
                  setPeriod(`${value.from}_${value.to}`);
                }
              }}
              placeholder="Custom range"
            />
          )}
        </div>
      </PageHeaderComponent>

      {/* ── Back bar + source toggle ──────────────────────────── */}
      <div className={styles['back-bar']}>
        <ButtonComponent
          variant="text"
          size="small"
          icon={ArrowLeft}
          onClick={() => router.push("/web-analytics")}
        >
          All Properties
        </ButtonComponent>
        <span className={styles['selected-label']}>{title}</span>
        <SourceBadges hasGA={hasGA} hasSessions={hasSessions} />
        {isUnified && (
          <SegmentedControlComponent
            value={activeSource}
            onChange={switchSource}
            segments={[
              { value: "ga", label: "Google Analytics" },
              { value: "sessions", label: "First-Party" },
            ]}
            compact
          />
        )}
      </div>

      {/* ── Source comparison (only when both sources track) ──── */}
      {isUnified && !isCustomPeriod(period) && (
        <SourceComparisonPanel
          propertyId={gaProperty!.id}
          projectId={sessionsProjectId!}
          period={period}
        />
      )}

      {/* ── Active source report ──────────────────────────────── */}
      {activeSource === "ga" ? (
        <GAReportComponent property={gaProperty!} period={period} />
      ) : (
        <SessionReportComponent projectId={sessionsProjectId!} period={period} />
      )}
    </div>
  );
}

// ── Source Comparison Panel ───────────────────────────────────

/**
 * Side-by-side GA4 vs first-party numbers for the same site and period.
 * GA undercounts (ad blockers, consent); sessions-service sees every
 * request — the delta column shows how far apart the two sources are.
 */
function SourceComparisonPanel({
  propertyId,
  projectId,
  period,
}: {
  propertyId: string;
  projectId: string;
  period: string;
}) {
  const [gaOverview, setGaOverview] = useState<GAOverview | null>(null);
  const [sessionOverview, setSessionOverview] = useState<SessionOverview | null>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    const requestId = ++requestSequence.current;
    (async () => {
      const [gaRes, sessionRes] = await Promise.all([
        ApiService.getGAOverview(propertyId, period).catch(() => null),
        ApiService.getSessionOverview(projectId, period).catch(() => null),
      ]);
      if (requestId !== requestSequence.current) return;
      setGaOverview(gaRes);
      setSessionOverview(sessionRes?.data ?? sessionRes);
    })();
  }, [propertyId, projectId, period]);

  if (!gaOverview || !sessionOverview) return null;

  const rows = [
    {
      metric: "Users / Visitors",
      ga: gaOverview.totalUsers,
      sessions: sessionOverview.uniqueVisitors,
    },
    {
      metric: "Sessions",
      ga: gaOverview.sessions,
      sessions: sessionOverview.totalSessions,
    },
    {
      metric: "Pageviews",
      ga: gaOverview.pageviews,
      sessions: sessionOverview.totalPageViews,
    },
  ];

  return (
    <div className={styles['panel']}>
      <div className={styles['panel-header']}>
        <Scale size={15} strokeWidth={2.2} className={styles['panel-icon']} />
        <span className={styles['panel-title']}>GA4 vs First-Party</span>
        <span className={styles['panel-meta']}>{period}</span>
      </div>
      <div className={styles['compare-grid']}>
        <span className={styles['compare-head']}>Metric</span>
        <span className={styles['compare-head']}>GA4</span>
        <span className={styles['compare-head']}>First-Party</span>
        <span className={styles['compare-head']}>Δ</span>
        {rows.map((row) => (
          <CompareRow key={row.metric} {...row} />
        ))}
      </div>
      <div className={styles['compare-note']}>
        First-party counts are server-observed (unaffected by ad blockers or consent
        banners, bots excluded); GA4 counts only consenting, unblocked browsers.
      </div>
    </div>
  );
}

function CompareRow({
  metric,
  ga,
  sessions,
}: {
  metric: string;
  ga: number;
  sessions: number;
}) {
  const delta = ga > 0 ? (sessions - ga) / ga : null;
  return (
    <>
      <span className={styles['compare-metric']}>{metric}</span>
      <span className={styles['compare-value']}>{formatNumber(ga)}</span>
      <span className={styles['compare-value']}>{formatNumber(sessions)}</span>
      <span className={styles['compare-delta']}>
        <DeltaBadge value={delta} />
      </span>
    </>
  );
}
