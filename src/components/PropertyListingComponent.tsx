"use client";

import { useState, useEffect, useRef } from "react";
import {
  LayoutGrid,
  Table2,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { LoadingIndicatorComponent } from "@rodrigo-barraza/components-library";
import { formatNumber } from "@rodrigo-barraza/utilities-library";
import ApiService from "../services/ApiService";
import styles from "./GoogleAnalyticsComponent.module.css";

/**
 * PropertyListingComponent — multi-property landing page.
 * Shows all GA4 properties in a card grid or list/table view.
 * Each card/row shows a quick overview summary fetched in parallel.
 */
export default function PropertyListingComponent({ properties, onSelect }: { [key: string]: any }) {
  const [viewMode, setViewMode] = useState("card");
  const [summaries, setSummaries] = useState<any>({});
  const didFetch = useRef(false);

  // Fetch overview + realtime for each property in parallel
  useEffect(() => {
    if (didFetch.current || !properties.length) return;
    didFetch.current = true;

    for (const prop of properties) {
      Promise.all([
        ApiService.getGAOverview(prop.id, "30d").catch(() => null),
        ApiService.getGARealtime(prop.id).catch(() => null),
      ]).then(([overview, realtime]) => {
        // @ts-ignore
        setSummaries((prev) => ({
          ...prev,
          [prop.id]: { overview, realtime, loaded: true },
        }));
      });
    }
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
          {properties.length} {properties.length === 1 ? "property" : "properties"}
        </span>
      </div>

      {/* ── Card View ── */}
      {viewMode === "card" && (
        <div className={styles.propertyGrid}>
{/* @ts-ignore */}
{properties.map((prop: any) => {
            const s = summaries[prop.id];
            return (
              <div
                key={prop.id}
                className={styles.propertyCard}
                onClick={() => onSelect(prop)}
              >
                <div className={styles.propertyCardHeader}>
                  <div className={styles.propertyCardIcon}>
                    <TrendingUp size={18} strokeWidth={2} />
                  </div>
                  <div className={styles.propertyCardInfo}>
                    <span className={styles.propertyCardName}>{prop.label}</span>
                    <span className={styles.propertyCardMeta}>
                      {prop.measurementId || prop.id}
                    </span>
                  </div>
                  <ArrowRight size={14} strokeWidth={2} className={styles.propertyCardArrow} />
                </div>

                {s?.loaded ? (
                  <>
                    {s.overview && (
                      <div className={styles.propertyCardStats}>
                        <div className={styles.propertyCardStat}>
                          <span className={styles.propertyCardStatValue}>
                            {formatNumber(s.overview.totalUsers)}
                          </span>
                          <span className={styles.propertyCardStatLabel}>Users</span>
                        </div>
                        <div className={styles.propertyCardStat}>
                          <span className={styles.propertyCardStatValue}>
                            {formatNumber(s.overview.pageviews)}
                          </span>
                          <span className={styles.propertyCardStatLabel}>Pageviews</span>
                        </div>
                        <div className={styles.propertyCardStat}>
                          <span className={styles.propertyCardStatValue}>
                            {formatNumber(s.overview.sessions)}
                          </span>
                          <span className={styles.propertyCardStatLabel}>Sessions</span>
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
              </div>
            );
          })}
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
{/* @ts-ignore */}
{properties.map((prop: any) => {
            const s = summaries[prop.id];
            return (
              <div
                key={prop.id}
                className={styles.propertyListRow}
                onClick={() => onSelect(prop)}
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
                <div className={`${styles.propertyListValue} ${styles.propertyListRealtime}`}>
                  {s?.realtime ? (
                    <>
                      <div className={styles.propertyListRealtimeDot} />
                      {formatNumber(s.realtime.activeUsers)}
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
