"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LoadingIndicatorComponent,
  TableComponent,
} from "@rodrigo-barraza/components-library";
import {
  Users,
  Clock,
  Eye,
  Globe,
  Monitor,
  MapPin,
  ChevronRight,
  Zap,
  ArrowLeft,
  MousePointerClick,
  Smartphone,
  Laptop,
  FileText,
} from "lucide-react";
import ApiService from "../services/ApiService";
import {
  formatElapsedTime,
  formatNumber,
} from "@rodrigo-barraza/utilities-library";
import styles from "./SessionExplorerComponent.module.css";

// ── Types ─────────────────────────────────────────────────────

interface Visitor {
  visitorId: string;
  sessionCount: number;
  totalDuration: number;
  firstSeen: string;
  lastSeen: string;
  lastIp: string;
  lastBrowser: { name: string | null; version: string | null };
  lastOs: { name: string | null; version: string | null };
  lastDevice: { type: string; vendor: string | null };
  lastGeo: { country: string | null; city: string | null; countryCode: string | null };
  lastReferrer: string | null;
  lastViewport: { width: number; height: number } | null;
  sessionIds: string[];
}

interface SessionRow {
  sessionId: string;
  visitorId: string;
  projectId: string;
  ip: string;
  fingerprintId: string;
  browser: { name: string | null; version: string | null };
  os: { name: string | null; version: string | null };
  device: { type: string; vendor: string | null };
  geo: { country: string | null; city: string | null; countryCode: string | null };
  viewport: { width: number; height: number } | null;
  referrer: string | null;
  duration: number;
  createdAt: string;
  updatedAt: string;
}

interface TimelineEntry {
  type: "pageview" | "event";
  timestamp: string;
  path?: string;
  title?: string;
  url?: string;
  category?: string;
  action?: string;
  label?: string;
  value?: string;
}

interface SessionDetail extends SessionRow {
  userAgent: string;
  locale: string | null;
  utm: Record<string, string> | null;
  pageViews: Array<{ url: string; path: string; title: string; timestamp: string }>;
  events: Array<{ category: string; action: string; label: string; timestamp: string }>;
  timeline: TimelineEntry[];
}

// ── Helpers ───────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const delta = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function DeviceIcon({ type }: { type: string }) {
  switch (type?.toLowerCase()) {
    case "mobile":
      return <Smartphone size={12} strokeWidth={2} />;
    case "tablet":
      return <Smartphone size={12} strokeWidth={2} />;
    default:
      return <Laptop size={12} strokeWidth={2} />;
  }
}

// ── Main Component ────────────────────────────────────────────

export default function SessionExplorerComponent({
  projectId,
  period,
}: {
  projectId: string;
  period: string;
}) {
  type Tab = "visitors" | "sessions";
  const [tab, setTab] = useState<Tab>("visitors");

  // ── Visitors state ──
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [visitorsTotal, setVisitorsTotal] = useState(0);
  const [visitorsLoading, setVisitorsLoading] = useState(true);
  const [visitorsOffset, setVisitorsOffset] = useState(0);

  // ── Sessions state ──
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsOffset, setSessionsOffset] = useState(0);

  // ── Session detail ──
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const didFetch = useRef(false);

  // ── Load visitors ─────────────────────────────────────────

  const loadVisitors = useCallback(async (offset = 0) => {
    setVisitorsLoading(true);
    try {
      const res = await ApiService.getSessionVisitors(projectId, period, 50, offset);
      const data = res?.data ?? res;
      setVisitors(data?.visitors || []);
      setVisitorsTotal(data?.total || 0);
      setVisitorsOffset(offset);
    } catch {
      /* silent */
    } finally {
      setVisitorsLoading(false);
    }
  }, [projectId, period]);

  // ── Load sessions ─────────────────────────────────────────

  const loadSessions = useCallback(async (offset = 0) => {
    setSessionsLoading(true);
    try {
      const res = await ApiService.getSessionsList(projectId, period, 50, offset);
      const data = res?.data ?? res;
      setSessions(data?.sessions || []);
      setSessionsTotal(data?.total || 0);
      setSessionsOffset(offset);
    } catch {
      /* silent */
    } finally {
      setSessionsLoading(false);
    }
  }, [projectId, period]);

  // ── Load session detail ───────────────────────────────────

  const loadDetail = useCallback(async (sessionId: string) => {
    setDetailLoading(true);
    try {
      const res = await ApiService.getSessionDetail(sessionId);
      setSelectedSession(res?.data ?? res);
    } catch {
      /* silent */
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ── Initial fetch ─────────────────────────────────────────

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadVisitors(0);
    loadSessions(0);
  }, [loadVisitors, loadSessions]);

  // ── Refetch on period change ──────────────────────────────

  useEffect(() => {
    didFetch.current = false;
    loadVisitors(0);
    loadSessions(0);
    setSelectedSession(null);
  }, [period, loadVisitors, loadSessions]);

  // ── Session Detail Panel ──────────────────────────────────

  if (selectedSession) {
    const s = selectedSession;
    return (
      <div className={styles.explorer}>
        <div className={styles.detailHeader}>
          <button
            className={styles.backBtn}
            onClick={() => setSelectedSession(null)}
          >
            <ArrowLeft size={14} strokeWidth={2.2} />
            Back to list
          </button>
          <span className={styles.detailSessionId}>
            {s.sessionId.slice(0, 8)}…
          </span>
        </div>

        {detailLoading ? (
          <LoadingIndicatorComponent size="small" label="Loading session…" />
        ) : (
          <>
            {/* ── Session Metadata ── */}
            <div className={styles.metaGrid}>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Visitor ID</span>
                <span className={styles.metaValue}>
                  {s.visitorId?.slice(0, 12)}…
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>IP Address</span>
                <span className={styles.metaValue}>{s.ip}</span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Duration</span>
                <span className={styles.metaValue}>
                  {formatElapsedTime(s.duration / 1000)}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Browser</span>
                <span className={styles.metaValue}>
                  {s.browser?.name || "Unknown"} {s.browser?.version || ""}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>OS</span>
                <span className={styles.metaValue}>
                  {s.os?.name || "Unknown"} {s.os?.version || ""}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Device</span>
                <span className={styles.metaValue}>
                  <DeviceIcon type={s.device?.type} />
                  {s.device?.type || "desktop"}
                  {s.device?.vendor ? ` · ${s.device.vendor}` : ""}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Location</span>
                <span className={styles.metaValue}>
                  {s.geo?.city && s.geo.city !== "(not set)"
                    ? `${s.geo.city}, `
                    : ""}
                  {s.geo?.country || "Unknown"}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Viewport</span>
                <span className={styles.metaValue}>
                  {s.viewport
                    ? `${s.viewport.width} × ${s.viewport.height}`
                    : "N/A"}
                </span>
              </div>
              {s.referrer && (
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>Referrer</span>
                  <span className={styles.metaValue}>{s.referrer}</span>
                </div>
              )}
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Started</span>
                <span className={styles.metaValue}>
                  {formatTimestamp(s.createdAt)}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Last Active</span>
                <span className={styles.metaValue}>
                  {formatTimestamp(s.updatedAt)}
                </span>
              </div>
              {s.locale && (
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>Locale</span>
                  <span className={styles.metaValue}>{s.locale}</span>
                </div>
              )}
            </div>

            {/* ── UTM Parameters ── */}
            {s.utm && Object.keys(s.utm).length > 0 && (
              <div className={styles.utmBar}>
                {Object.entries(s.utm).map(([key, value]) => (
                  <span key={key} className={styles.utmTag}>
                    <span className={styles.utmKey}>{key}</span>
                    <span className={styles.utmValue}>{value}</span>
                  </span>
                ))}
              </div>
            )}

            {/* ── Timeline ── */}
            <div className={styles.timelineSection}>
              <div className={styles.timelineHeader}>
                <Clock size={14} strokeWidth={2.2} />
                <span>Activity Timeline</span>
                <span className={styles.timelineCount}>
                  {s.timeline?.length || 0} events
                </span>
              </div>

              {s.timeline && s.timeline.length > 0 ? (
                <div className={styles.timeline}>
                  {s.timeline.map((entry, i) => (
                    <div
                      key={i}
                      className={`${styles.timelineItem} ${entry.type === "pageview" ? styles.timelinePageview : styles.timelineEvent}`}
                    >
                      <div className={styles.timelineDot}>
                        {entry.type === "pageview" ? (
                          <Eye size={10} strokeWidth={2.5} />
                        ) : (
                          <Zap size={10} strokeWidth={2.5} />
                        )}
                      </div>
                      <div className={styles.timelineConnector} />
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineRow}>
                          <span className={styles.timelineType}>
                            {entry.type === "pageview" ? "Page View" : "Event"}
                          </span>
                          <span className={styles.timelineTime}>
                            {formatTimestamp(entry.timestamp)}
                          </span>
                        </div>
                        {entry.type === "pageview" ? (
                          <span className={styles.timelineDetail}>
                            {entry.path || entry.url}
                            {entry.title && (
                              <span className={styles.timelineTitle}>
                                {" "}
                                — {entry.title}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className={styles.timelineDetail}>
                            <span className={styles.timelineCategory}>
                              {entry.category}
                            </span>
                            <ChevronRight size={10} strokeWidth={2.5} />
                            <span className={styles.timelineAction}>
                              {entry.action}
                            </span>
                            {entry.label && (
                              <span className={styles.timelineLabel}>
                                {" "}
                                · {entry.label}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyTimeline}>
                  No activity recorded for this session.
                </div>
              )}
            </div>

            {/* ── User Agent ── */}
            {s.userAgent && (
              <div className={styles.userAgentBar}>
                <FileText size={12} strokeWidth={2} />
                <span>{s.userAgent}</span>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── List View ─────────────────────────────────────────────

  return (
    <div className={styles.explorer}>
      {/* ── Tab Bar ── */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${tab === "visitors" ? styles.tabActive : ""}`}
          onClick={() => setTab("visitors")}
        >
          <Users size={13} strokeWidth={2.2} />
          Visitors
          {visitorsTotal > 0 && (
            <span className={styles.tabBadge}>{formatNumber(visitorsTotal)}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${tab === "sessions" ? styles.tabActive : ""}`}
          onClick={() => setTab("sessions")}
        >
          <Clock size={13} strokeWidth={2.2} />
          Sessions
          {sessionsTotal > 0 && (
            <span className={styles.tabBadge}>{formatNumber(sessionsTotal)}</span>
          )}
        </button>
      </div>

      {/* ── Visitors Tab ── */}
      {tab === "visitors" && (
        <>
          {visitorsLoading ? (
            <LoadingIndicatorComponent size="small" label="Loading visitors…" className="loading-center" />
          ) : visitors.length === 0 ? (
            <div className={styles.emptyState}>No visitor data available.</div>
          ) : (
            <>
              <div className={styles.cardList}>
                {visitors.map((v) => (
                  <div key={v.visitorId} className={styles.visitorCard}>
                    <div className={styles.visitorHeader}>
                      <div className={styles.visitorId}>
                        <Users size={12} strokeWidth={2.2} />
                        {v.visitorId.slice(0, 12)}…
                      </div>
                      <span className={styles.visitorSessionCount}>
                        {v.sessionCount} session{v.sessionCount !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className={styles.visitorMeta}>
                      <span className={styles.visitorMetaItem}>
                        <Globe size={11} strokeWidth={2} />
                        {v.lastBrowser?.name || "Unknown"}
                      </span>
                      <span className={styles.visitorMetaItem}>
                        <Monitor size={11} strokeWidth={2} />
                        {v.lastOs?.name || "Unknown"}
                      </span>
                      <span className={styles.visitorMetaItem}>
                        <DeviceIcon type={v.lastDevice?.type} />
                        {v.lastDevice?.type || "desktop"}
                      </span>
                      {v.lastGeo?.country && (
                        <span className={styles.visitorMetaItem}>
                          <MapPin size={11} strokeWidth={2} />
                          {v.lastGeo.city && v.lastGeo.city !== "(not set)"
                            ? `${v.lastGeo.city}, `
                            : ""}
                          {v.lastGeo.country}
                        </span>
                      )}
                    </div>

                    <div className={styles.visitorFooter}>
                      <span className={styles.visitorTime}>
                        <Clock size={11} strokeWidth={2} />
                        {formatElapsedTime(v.totalDuration / 1000)} total
                      </span>
                      <span className={styles.visitorSeen}>
                        Last seen {formatTimeAgo(v.lastSeen)}
                      </span>
                    </div>

                    {/* ── Session pills ── */}
                    <div className={styles.sessionPills}>
                      {v.sessionIds.slice(0, 5).map((sid) => (
                        <button
                          key={sid}
                          className={styles.sessionPill}
                          onClick={() => loadDetail(sid)}
                          title={sid}
                        >
                          {sid.slice(0, 8)}…
                        </button>
                      ))}
                      {v.sessionIds.length > 5 && (
                        <span className={styles.sessionPillMore}>
                          +{v.sessionIds.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {visitorsTotal > 50 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    disabled={visitorsOffset === 0}
                    onClick={() => loadVisitors(Math.max(0, visitorsOffset - 50))}
                  >
                    Previous
                  </button>
                  <span className={styles.pageInfo}>
                    {visitorsOffset + 1}–{Math.min(visitorsOffset + 50, visitorsTotal)} of {formatNumber(visitorsTotal)}
                  </span>
                  <button
                    className={styles.pageBtn}
                    disabled={visitorsOffset + 50 >= visitorsTotal}
                    onClick={() => loadVisitors(visitorsOffset + 50)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Sessions Tab ── */}
      {tab === "sessions" && (
        <>
          {sessionsLoading ? (
            <LoadingIndicatorComponent size="small" label="Loading sessions…" className="loading-center" />
          ) : sessions.length === 0 ? (
            <div className={styles.emptyState}>No session data available.</div>
          ) : (
            <>
              <div className={styles.sessionTable}>
                <div className={styles.sessionTableHeader}>
                  <span>Session</span>
                  <span>Visitor</span>
                  <span>Device</span>
                  <span>Location</span>
                  <span>Duration</span>
                  <span>Last Active</span>
                </div>
                {sessions.map((s) => (
                  <button
                    key={s.sessionId}
                    className={styles.sessionTableRow}
                    onClick={() => loadDetail(s.sessionId)}
                  >
                    <span className={styles.sessionTableId}>
                      {s.sessionId.slice(0, 8)}…
                    </span>
                    <span className={styles.sessionTableVisitor}>
                      {s.visitorId?.slice(0, 8) || "—"}…
                    </span>
                    <span className={styles.sessionTableDevice}>
                      <DeviceIcon type={s.device?.type} />
                      {s.browser?.name || "?"} / {s.os?.name || "?"}
                    </span>
                    <span className={styles.sessionTableGeo}>
                      {s.geo?.city && s.geo.city !== "(not set)"
                        ? `${s.geo.city}, `
                        : ""}
                      {s.geo?.country || "—"}
                    </span>
                    <span className={styles.sessionTableDuration}>
                      {formatElapsedTime(s.duration / 1000)}
                    </span>
                    <span className={styles.sessionTableTime}>
                      {formatTimeAgo(s.updatedAt)}
                    </span>
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {sessionsTotal > 50 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    disabled={sessionsOffset === 0}
                    onClick={() => loadSessions(Math.max(0, sessionsOffset - 50))}
                  >
                    Previous
                  </button>
                  <span className={styles.pageInfo}>
                    {sessionsOffset + 1}–{Math.min(sessionsOffset + 50, sessionsTotal)} of {formatNumber(sessionsTotal)}
                  </span>
                  <button
                    className={styles.pageBtn}
                    disabled={sessionsOffset + 50 >= sessionsTotal}
                    onClick={() => loadSessions(sessionsOffset + 50)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
