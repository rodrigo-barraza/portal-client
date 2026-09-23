"use client";

import { Fragment, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ButtonComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  SegmentedControlComponent,
  DatePickerComponent,
  DATE_PRESETS_DATE_ONLY,
} from "@rodrigo-barraza/components-library";
import { ArrowLeft, ChartColumn, Scale } from "lucide-react";
import ApiService from "../services/ApiService";
import GAReportComponent from "./GAReportComponent";
import SessionReportComponent from "./SessionReportComponent";
import { DeltaBadge, Panel, SourceBadges } from "./AnalyticsPrimitives";
import useAsyncData, { unwrapData } from "./analytics/useAsyncData";
import { joinMeta, percentChange, readableErrorMessage } from "./analytics/analyticsFormat";
import {
  PRESET_PERIODS,
  isCustomPeriod,
  parseCustomPeriod,
  toCustomPeriod,
} from "./analytics/analyticsSeries";
import { formatNumber } from "@rodrigo-barraza/utilities-library";
import styles from "./WebAnalytics.module.css";
import type { GAProperty, GAOverview, SessionOverview, SessionProject } from "../types/portal";

type AnalyticsSource = "ga" | "sessions";

const DEFAULT_PERIOD = "30d";
const PERIOD_SEGMENTS = PRESET_PERIODS.map((presetPeriod) => ({
  value: presetPeriod,
  label: presetPeriod,
}));
/**
 * GA takes whole-day ranges only: no sub-day ("Last 5 minutes") presets,
 * and no "All Time" — GA has no unbounded range, and the picker's clear
 * button already returns to the default period.
 */
const CUSTOM_RANGE_PRESETS = DATE_PRESETS_DATE_ONLY.filter((preset) => preset.label !== "All Time");

interface PropertyRegistry {
  properties: GAProperty[];
  sessionProjects: SessionProject[];
  /** GA registry failure — only fatal on a GA route. */
  gaError: Error | null;
}

async function loadRegistry(): Promise<PropertyRegistry> {
  const [propertiesResult, projectsResult] = await Promise.allSettled([
    ApiService.getGAProperties(),
    ApiService.getSessionProjects("all"),
  ]);
  const projects =
    projectsResult.status === "fulfilled"
      ? unwrapData<SessionProject[] | null>(projectsResult.value)
      : null;
  return {
    properties:
      propertiesResult.status === "fulfilled" ? (propertiesResult.value?.properties ?? []) : [],
    sessionProjects: Array.isArray(projects) ? projects : [],
    gaError:
      propertiesResult.status === "rejected"
        ? propertiesResult.reason instanceof Error
          ? propertiesResult.reason
          : new Error(String(propertiesResult.reason))
        : null,
  };
}

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
  const [source, setSource] = useState<AnalyticsSource>(propertyId ? "ga" : "sessions");
  const [period, setPeriod] = useState(DEFAULT_PERIOD);

  const registry = useAsyncData("registry", loadRegistry);
  const properties = registry.data?.properties ?? null;
  const sessionProjects = registry.data?.sessionProjects ?? null;
  const error = propertyId ? (registry.data?.gaError ?? null) : null;

  const gaProperty = useMemo(() => {
    if (!properties) return null;
    if (propertyId) return properties.find((property) => property.id === propertyId) ?? null;
    // Sessions route — join back to a GA property via registry serviceId
    return properties.find((property) => property.serviceId === projectId) ?? null;
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
  // sessions-service only understands "Nd" periods — it would silently
  // treat a custom range as all-time, so never hand it one
  const activePeriod = activeSource === "sessions" && isCustomPeriod(period) ? DEFAULT_PERIOD : period;

  const title = gaProperty?.label || sessionsProjectId || "Web Analytics";
  const subtitle = joinMeta(
    gaProperty && `GA4 ${gaProperty.measurementId || gaProperty.id}`,
    sessionsProjectId && `sessions-service ${sessionsProjectId}`,
  );

  const customRange = parseCustomPeriod(activePeriod);

  const switchSource = (value: string) => {
    const nextSource = value as AnalyticsSource;
    if (nextSource === "sessions" && isCustomPeriod(period)) setPeriod(DEFAULT_PERIOD);
    setSource(nextSource);
  };

  const applyCustomRange = (value: { from: string; to: string }) => {
    const nextPeriod = toCustomPeriod(value?.from ?? "", value?.to ?? "");
    if (nextPeriod) setPeriod(nextPeriod);
    // Cleared picker → back to the default preset
    else if (!value?.from && !value?.to) setPeriod(DEFAULT_PERIOD);
  };

  const backToProperties = () => router.push("/web-analytics");

  // ── Loading / not-found states ────────────────────────────

  if (registry.loading) {
    return (
      <div className={styles["dashboard"]}>
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
      <div className={styles["dashboard"]}>
        <PageHeaderComponent sticky={false} title="Web Analytics" subtitle="Property not found" />
        <div className={styles["empty-state"]} role={error ? "alert" : undefined}>
          <ChartColumn size={40} strokeWidth={1.5} className={styles["empty-icon"]} />
          <span className={styles["empty-title"]}>
            {error ? "Analytics Error" : "Unknown property"}
          </span>
          <span className={styles["empty-detail"]}>
            {error
              ? (readableErrorMessage(error) ?? "Could not load the GA4 property registry.")
              : `No GA4 property or tracked sessions project matches “${propertyId || projectId}”.`}
          </span>
          <ButtonComponent variant="text" size="small" icon={ArrowLeft} onClick={backToProperties}>
            All Properties
          </ButtonComponent>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className={`property-dashboard-component ${styles["dashboard"]}`}>
      <PageHeaderComponent sticky={false} title={title} subtitle={subtitle}>
        <div className={styles["header-controls"]}>
          <SegmentedControlComponent
            value={activePeriod}
            onChange={setPeriod}
            segments={PERIOD_SEGMENTS}
            compact
          />
          {activeSource === "ga" && (
            <DatePickerComponent
              from={customRange?.from ?? ""}
              to={customRange?.to ?? ""}
              onChange={applyCustomRange}
              presets={CUSTOM_RANGE_PRESETS}
              showTime={false}
              placeholder="Custom range"
            />
          )}
        </div>
      </PageHeaderComponent>

      {/* ── Back bar + source toggle ──────────────────────────── */}
      <div className={styles["back-bar"]}>
        <ButtonComponent variant="text" size="small" icon={ArrowLeft} onClick={backToProperties}>
          All Properties
        </ButtonComponent>
        <span className={styles["selected-label"]}>{title}</span>
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
      {isUnified && gaProperty && sessionsProjectId && !customRange && (
        <SourceComparisonPanel
          propertyId={gaProperty.id}
          projectId={sessionsProjectId}
          period={activePeriod}
        />
      )}

      {/* ── Active source report ──────────────────────────────── */}
      {activeSource === "ga" && gaProperty ? (
        <GAReportComponent property={gaProperty} period={activePeriod} />
      ) : sessionsProjectId ? (
        <SessionReportComponent projectId={sessionsProjectId} period={activePeriod} />
      ) : null}
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
  const comparison = useAsyncData(`${propertyId}|${projectId}|${period}`, async () => {
    const [gaOverview, sessionOverview] = await Promise.all([
      ApiService.getGAOverview(propertyId, period) as Promise<GAOverview>,
      ApiService.getSessionOverview(projectId, period).then(unwrapData<SessionOverview>),
    ]);
    return { gaOverview, sessionOverview };
  });

  // Supplementary panel: hidden while loading or when either side fails
  if (!comparison.data) return null;
  const { gaOverview, sessionOverview } = comparison.data;

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
    <Panel icon={Scale} title="GA4 vs First-Party" meta={period}>
      <div className={styles["compare-grid"]}>
        <span className={styles["compare-head"]}>Metric</span>
        <span className={styles["compare-head"]}>GA4</span>
        <span className={styles["compare-head"]}>First-Party</span>
        <span className={styles["compare-head"]}>Δ</span>
        {rows.map((row) => (
          <Fragment key={row.metric}>
            <span className={styles["compare-metric"]}>{row.metric}</span>
            <span className={styles["compare-value"]}>{formatNumber(row.ga)}</span>
            <span className={styles["compare-value"]}>{formatNumber(row.sessions)}</span>
            <span className={styles["compare-delta"]}>
              {/* null for a zero GA baseline — no Infinity% badge */}
              <DeltaBadge value={percentChange(row.sessions, row.ga)} />
            </span>
          </Fragment>
        ))}
      </div>
      <div className={styles["compare-note"]}>
        First-party counts are server-observed (unaffected by ad blockers or consent banners, bots
        excluded); GA4 counts only consenting, unblocked browsers.
      </div>
    </Panel>
  );
}
