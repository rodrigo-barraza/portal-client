"use client";

import { TrendingUp } from "lucide-react";
import { LoadingIndicatorComponent } from "@rodrigo-barraza/components-library";
import { formatElapsedTime, formatCompact } from "@rodrigo-barraza/utilities-library";
import ApiService from "@/services/ApiService";
import type { GAOverview, GAPageRow } from "@/types/portal";
import useAsyncData from "../analytics/useAsyncData";
import panelStyles from "../ExpandedProjectPanelComponent.module.css";
import styles from "./ProjectAnalyticsTab.module.css";

const PERIOD = "30d";

function formatSessionDuration(seconds: number | null | undefined): string {
  return seconds && seconds > 0 ? formatElapsedTime(seconds) : "0s";
}

/** GA reports engagement as a 0–1 ratio. */
function formatRatio(value: number | null | undefined): string {
  return value == null ? "0%" : `${(value * 100).toFixed(1)}%`;
}

interface AnalyticsSnapshot {
  overview: GAOverview | null;
  pages: GAPageRow[];
  activeUsers: number | null;
}

/** 30-day GA4 snapshot for a project (drawer's Web Analytics tab). */
export default function ProjectAnalyticsTab({ propertyId }: { propertyId: string }) {
  const { data: snapshot } = useAsyncData<AnalyticsSnapshot>(propertyId, async (signal) => {
    // Each report is independent — one failing must not blank the rest.
    const [overview, pages, realtime] = await Promise.all([
      ApiService.getGAOverview(propertyId, PERIOD, { signal }).catch(() => null),
      ApiService.getGAPages(propertyId, PERIOD, { signal }).catch(() => null),
      ApiService.getGARealtime(propertyId, { signal }).catch(() => null),
    ]);
    return {
      overview,
      pages: pages?.pages ?? [],
      activeUsers: realtime?.activeUsers ?? null,
    };
  });

  if (!snapshot) {
    return (
      <div className={panelStyles['empty-tab']}>
        <LoadingIndicatorComponent size="small" label="Loading analytics…" />
      </div>
    );
  }

  const { overview, pages, activeUsers } = snapshot;
  if (!overview && pages.length === 0 && activeUsers === null) {
    return (
      <div className={panelStyles['empty-tab']}>
        <TrendingUp size={24} strokeWidth={1.5} className={panelStyles['empty-tab-icon']} />
        <span>Analytics are unavailable right now</span>
      </div>
    );
  }

  const cards = overview
    ? [
        { label: "Users", value: formatCompact(overview.totalUsers) },
        { label: "Pageviews", value: formatCompact(overview.pageviews) },
        { label: "Sessions", value: formatCompact(overview.sessions) },
        { label: "Avg Duration", value: formatSessionDuration(overview.avgSessionDuration) },
        { label: "Engagement", value: formatRatio(overview.engagementRate) },
      ]
    : [];

  return (
    <div className={styles['web-analytics-tab']}>
      {activeUsers !== null && (
        <div className={styles['realtime-pill']}>
          <div className={styles['realtime-dot']} />
          <span className={styles['realtime-value']}>{formatCompact(activeUsers)}</span>
          <span className={styles['realtime-label']}>active now</span>
        </div>
      )}

      {cards.length > 0 && (
        <div className={styles['analytics-cards']}>
          {cards.map((card) => (
            <div key={card.label} className={styles['analytics-card']}>
              <span className={styles['analytics-card-value']}>{card.value}</span>
              <span className={styles['analytics-card-label']}>{card.label}</span>
            </div>
          ))}
        </div>
      )}

      {pages.length > 0 && (
        <div className={styles['analytics-section']}>
          <h4 className={panelStyles['section-title']}>Top Pages (30d)</h4>
          <div className={styles['analytics-page-list']}>
            {pages.slice(0, 5).map((page) => (
              <div key={page.pagePath} className={styles['analytics-page-row']}>
                <span className={styles['analytics-page-path']} title={page.pagePath}>
                  {page.pagePath}
                </span>
                <span className={styles['analytics-page-views']}>
                  {formatCompact(page.pageviews)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
