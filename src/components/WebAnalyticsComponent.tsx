"use client";

import { useState, useEffect, useRef } from "react";
import {
  LoadingIndicatorComponent,
  PageHeaderComponent,
} from "@rodrigo-barraza/components-library";
import { BarChart3 } from "lucide-react";
import ApiService from "../services/ApiService";
import PropertyListingComponent from "./PropertyListingComponent";
import styles from "./WebAnalytics.module.css";
import type { GAProperty } from "../types/portal";

/**
 * WebAnalyticsComponent — the /web-analytics landing page.
 * Loads the GA4 property registry and hands off to the unified
 * PropertyListingComponent (which merges in sessions-service projects).
 */
export default function WebAnalyticsComponent() {
  const [properties, setProperties] = useState<GAProperty[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    ApiService.getGAProperties()
      .then((propertiesResponse) => {
        setProperties(propertiesResponse.properties || []);
      })
      .catch((error: unknown) => {
        // GA registry failing shouldn't hide first-party projects
        setError(error instanceof Error ? error.message : String(error));
        setProperties([]);
      });
  }, []);

  return (
    <div className={`web-analytics-component ${styles['dashboard']}`}>
      <PageHeaderComponent
        sticky={false}
        title="Web Analytics"
        subtitle="Unified Google Analytics (GA4) and first-party session tracking per property"
      />

      {properties === null ? (
        <LoadingIndicatorComponent
          size="small"
          label="Loading properties…"
          className="is-loading-centered-state"
        />
      ) : (
        <>
          {error && (
            <div className={styles['empty-state']} style={{ minHeight: "auto" }}>
              <BarChart3 size={28} strokeWidth={1.5} className={styles['empty-icon']} />
              <span className={styles['empty-title']}>Google Analytics unavailable</span>
              <span className={styles['empty-detail']}>{error}</span>
            </div>
          )}
          <PropertyListingComponent properties={properties} />
        </>
      )}
    </div>
  );
}
