"use client";

import {
  LoadingIndicatorComponent,
  PageHeaderComponent,
} from "@rodrigo-barraza/components-library";
import { ChartColumn } from "lucide-react";
import ApiService from "../services/ApiService";
import PropertyListingComponent from "./PropertyListingComponent";
import useAsyncData from "./analytics/useAsyncData";
import { readableErrorMessage } from "./analytics/analyticsFormat";
import styles from "./WebAnalytics.module.css";
import type { GAProperty } from "../types/portal";

const NO_PROPERTIES: GAProperty[] = [];

/**
 * WebAnalyticsComponent — the /web-analytics landing page.
 * Loads the GA4 property registry and hands off to the unified
 * PropertyListingComponent (which merges in sessions-service projects).
 */
export default function WebAnalyticsComponent() {
  const registry = useAsyncData("ga-properties", () =>
    ApiService.getGAProperties() as Promise<{ properties?: GAProperty[] } | null>,
  );
  // GA registry failing shouldn't hide first-party projects
  const properties = registry.data?.properties ?? NO_PROPERTIES;

  return (
    <div className={`web-analytics-component ${styles["dashboard"]}`}>
      <PageHeaderComponent
        sticky={false}
        title="Web Analytics"
        subtitle="Unified Google Analytics (GA4) and first-party session tracking per property"
      />

      {registry.loading ? (
        <LoadingIndicatorComponent
          size="small"
          label="Loading properties…"
          className="is-loading-centered-state"
        />
      ) : (
        <>
          {registry.error && (
            <div className={`${styles["empty-state"]} ${styles["empty-state-compact"]}`} role="alert">
              <ChartColumn size={28} strokeWidth={1.5} className={styles["empty-icon"]} />
              <span className={styles["empty-title"]}>Google Analytics unavailable</span>
              <span className={styles["empty-detail"]}>
                {readableErrorMessage(registry.error) ?? "Could not load the GA4 property registry."}
              </span>
            </div>
          )}
          <PropertyListingComponent properties={properties} />
        </>
      )}
    </div>
  );
}
