"use client";

import { useState, useRef, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import PageHeaderComponent from "./PageHeaderComponent";
import ServiceCardComponent from "./ServiceCardComponent";
import PortalApiService from "../services/PortalApiService";
import styles from "./ServicesComponent.module.css";

export default function ServicesComponent() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const didFetch = useRef(false);

  async function loadServices(refresh = false) {
    try {
      const res = await PortalApiService.getServices(refresh);
      setServices(res.services || []);
    } catch (err) {
      console.error("Services fetch failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadServices(true);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadServices(true);
  };

  const healthyCount = services.filter((s) => s.healthy).length;

  return (
    <div className={styles.services}>
      <PageHeaderComponent
        title="Services"
        subtitle={
          loading
            ? "Checking service health…"
            : `${healthyCount} of ${services.length} services healthy`
        }
      >
        <button
          className={styles.refreshBtn}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            size={15}
            strokeWidth={2}
            className={refreshing ? styles.spinning : ""}
          />
          Check All
        </button>
      </PageHeaderComponent>

      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.loadingDot} />
          <span>Polling services…</span>
        </div>
      ) : (
        <div className={styles.grid}>
          {services.map((service) => (
            <ServiceCardComponent key={service.id} service={service} />
          ))}
        </div>
      )}
    </div>
  );
}
