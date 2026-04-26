"use client";

import { useState, useRef, useEffect } from "react";
import {
  Activity,
  Server,
  DollarSign,
  Zap,
  RefreshCw,
} from "lucide-react";
import PageHeaderComponent from "./PageHeaderComponent";
import StatsCardComponent from "./StatsCardComponent";
import ServiceCardComponent from "./ServiceCardComponent";
import PortalApiService from "../services/PortalApiService";
import { formatCompact, formatCost } from "../utils/utilities";
import styles from "./DashboardComponent.module.css";

export default function DashboardComponent() {
  const [services, setServices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const didFetch = useRef(false);

  async function loadData(refresh = false) {
    try {
      const [svcRes, statsRes] = await Promise.all([
        PortalApiService.getServices(refresh),
        PortalApiService.getStats(),
      ]);
      setServices(svcRes.services || []);
      setStats(statsRes);
    } catch (err) {
      console.error("Dashboard fetch failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const healthyCount = services.filter((s) => s.healthy).length;
  const totalServices = services.length;
  const overview = stats?.stats || {};
  const totalRequests = overview.totalRequests || 0;
  const totalCost = overview.totalCost || 0;
  const avgResponseTime = overview.avgResponseTime || 0;

  return (
    <div className={styles.dashboard}>
      <PageHeaderComponent title="Dashboard" subtitle="Sun ecosystem overview">
        <button
          className={styles.refreshBtn}
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh all data"
        >
          <RefreshCw
            size={15}
            strokeWidth={2}
            className={refreshing ? styles.spinning : ""}
          />
          Refresh
        </button>
      </PageHeaderComponent>

      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.loadingDot} />
          <span>Loading ecosystem data…</span>
        </div>
      ) : (
        <>
          <div className={styles.statsGrid}>
            <StatsCardComponent
              label="Services"
              value={`${healthyCount}/${totalServices}`}
              subtitle="healthy"
              icon={Server}
              color="var(--success)"
              delay={0}
            />
            <StatsCardComponent
              label="Total Requests"
              value={formatCompact(totalRequests)}
              subtitle="all time"
              icon={Activity}
              color="var(--accent-color)"
              delay={80}
            />
            <StatsCardComponent
              label="Total Cost"
              value={formatCost(totalCost)}
              subtitle="all time"
              icon={DollarSign}
              color="var(--warning)"
              delay={160}
            />
            <StatsCardComponent
              label="Avg Response"
              value={avgResponseTime ? `${avgResponseTime.toFixed(0)}ms` : "—"}
              subtitle="across all models"
              icon={Zap}
              color="var(--info)"
              delay={240}
            />
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Service Health</h2>
            <div className={styles.servicesGrid}>
              {services.map((service) => (
                <ServiceCardComponent key={service.id} service={service} />
              ))}
              {services.length === 0 && (
                <div className={styles.emptyState}>No services configured</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
