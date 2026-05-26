"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LoadingIndicatorComponent,
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
  Smartphone,
  Laptop,
  FileText,
  Network,
  Hash,
} from "lucide-react";
import ApiService from "../services/ApiService";
import {
  formatElapsedTime,
  formatNumber,
} from "@rodrigo-barraza/utilities-library";
import styles from "./SessionExplorerComponent.module.css";

// ── Types ─────────────────────────────────────────────────────

interface IpUser {
  ip: string;
  visitorIds: string[];
  sessionIds: string[];
  sessionCount: number;
  totalDuration: number;
  firstSeen: string;
  lastSeen: string;
  projects: string[];
  lastBrowser: { name: string | null; version: string | null };
  lastOs: { name: string | null; version: string | null };
  lastDevice: { type: string; vendor: string | null };
  lastGeo: { country: string | null; city: string | null; countryCode: string | null };
  lastFingerprintId: string | null;
  lastReferrer: string | null;
  lastViewport: { width: number; height: number } | null;
}

interface IpDetail extends IpUser {
  timeline: TimelineEntry[];
  sessions: SessionRow[];
  pageViews: Array<{ sessionId: string; url: string; path: string; title: string; timestamp: string }>;
  events: Array<{ sessionId: string; category: string; action: string; label: string; timestamp: string }>;
}

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
  sessionId?: string;
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
  const parsedDate = new Date(dateStr);
  return parsedDate.toLocaleString("en-US", {
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
    case "tablet":
      return <Smartphone size={12} strokeWidth={2} />;
    default:
      return <Laptop size={12} strokeWidth={2} />;
  }
}

// ── Timeline Renderer (shared) ────────────────────────────────

function TimelineView({ timeline, label }: { timeline: TimelineEntry[]; label?: string }) {
  if (!timeline || timeline.length === 0) {
    return <div className={styles.emptyTimeline}>No activity recorded.</div>;
  }

  return (
    <div className={styles.timelineSection}>
      <div className={styles.timelineHeader}>
        <Clock size={14} strokeWidth={2.2} />
        <span>{label || "Activity Timeline"}</span>
        <span className={styles.timelineCount}>
          {timeline.length} events
        </span>
      </div>
      <div className={styles.timeline}>
        {timeline.map((entry, i) => (
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
                {entry.sessionId && (
                  <span className={styles.timelineSessionTag}>
                    {entry.sessionId.slice(0, 6)}
                  </span>
                )}
                <span className={styles.timelineTime}>
                  {formatTimestamp(entry.timestamp)}
                </span>
              </div>
              {entry.type === "pageview" ? (
                <span className={styles.timelineDetail}>
                  {entry.path || entry.url}
                  {entry.title && (
                    <span className={styles.timelineTitle}> — {entry.title}</span>
                  )}
                </span>
              ) : (
                <span className={styles.timelineDetail}>
                  <span className={styles.timelineCategory}>{entry.category}</span>
                  <ChevronRight size={10} strokeWidth={2.5} />
                  <span className={styles.timelineAction}>{entry.action}</span>
                  {entry.label && (
                    <span className={styles.timelineLabel}> · {entry.label}</span>
                  )}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function SessionExplorerComponent({
  projectId,
  period,
}: {
  projectId: string;
  period: string;
}) {
  type Tab = "ips" | "visitors" | "sessions";
  const [tab, setTab] = useState<Tab>("ips");

  // ── IPs state ──
  const [ipUsers, setIpUsers] = useState<IpUser[]>([]);
  const [ipsTotal, setIpsTotal] = useState(0);
  const [ipsLoading, setIpsLoading] = useState(true);
  const [ipsOffset, setIpsOffset] = useState(0);

  // ── IP detail ──
  const [selectedIp, setSelectedIp] = useState<IpDetail | null>(null);
  const [ipDetailLoading, setIpDetailLoading] = useState(false);

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

  // ── Loaders ───────────────────────────────────────────────

  const loadIps = useCallback(async (offset = 0) => {
    setIpsLoading(true);
    try {
      const res = await ApiService.getSessionIpUsers(projectId, period, 50, offset);
      const data = res?.data ?? res;
      setIpUsers(data?.ips || []);
      setIpsTotal(data?.total || 0);
      setIpsOffset(offset);
    } catch { /* silent */ } finally { setIpsLoading(false); }
  }, [projectId, period]);

  const loadIpDetail = useCallback(async (ip: string) => {
    setIpDetailLoading(true);
    try {
      const res = await ApiService.getSessionIpDetail(ip, projectId, period);
      setSelectedIp(res?.data ?? res);
    } catch { /* silent */ } finally { setIpDetailLoading(false); }
  }, [projectId, period]);

  const loadVisitors = useCallback(async (offset = 0) => {
    setVisitorsLoading(true);
    try {
      const res = await ApiService.getSessionVisitors(projectId, period, 50, offset);
      const data = res?.data ?? res;
      setVisitors(data?.visitors || []);
      setVisitorsTotal(data?.total || 0);
      setVisitorsOffset(offset);
    } catch { /* silent */ } finally { setVisitorsLoading(false); }
  }, [projectId, period]);

  const loadSessions = useCallback(async (offset = 0) => {
    setSessionsLoading(true);
    try {
      const res = await ApiService.getSessionsList(projectId, period, 50, offset);
      const data = res?.data ?? res;
      setSessions(data?.sessions || []);
      setSessionsTotal(data?.total || 0);
      setSessionsOffset(offset);
    } catch { /* silent */ } finally { setSessionsLoading(false); }
  }, [projectId, period]);

  const loadDetail = useCallback(async (sessionId: string) => {
    setDetailLoading(true);
    try {
      const res = await ApiService.getSessionDetail(sessionId);
      setSelectedSession(res?.data ?? res);
    } catch { /* silent */ } finally { setDetailLoading(false); }
  }, []);

  // ── Effects ───────────────────────────────────────────────

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadIps(0);
    loadVisitors(0);
    loadSessions(0);
  }, [loadIps, loadVisitors, loadSessions]);

  useEffect(() => {
    didFetch.current = false;
    loadIps(0);
    loadVisitors(0);
    loadSessions(0);
    setSelectedSession(null);
    setSelectedIp(null);
  }, [period, loadIps, loadVisitors, loadSessions]);

  // ── Back handler ──────────────────────────────────────────

  const handleBack = () => {
    setSelectedSession(null);
    setSelectedIp(null);
  };

  // ══════════════════════════════════════════════════════════
  // ── IP DETAIL VIEW ────────────────────────────────────────
  // ══════════════════════════════════════════════════════════

  if (selectedIp) {
    const ip = selectedIp;
    return (
      <div className={styles.explorer}>
        <div className={styles.detailHeader}>
          <button className={styles.backButton} onClick={handleBack}>
            <ArrowLeft size={14} strokeWidth={2.2} />
            Back to list
          </button>
          <span className={styles.detailSessionId}>
            <Network size={14} strokeWidth={2.2} />
            {ip.ip}
          </span>
        </div>

        {ipDetailLoading ? (
          <LoadingIndicatorComponent size="small" label="Loading IP profile…" />
        ) : (
          <>
            {/* ── IP Summary Stats ── */}
            <div className={styles.ipSummaryBar}>
              <div className={styles.ipSummaryStat}>
                <Hash size={12} strokeWidth={2} />
                <span>{ip.sessionCount} sessions</span>
              </div>
              <div className={styles.ipSummaryStat}>
                <Users size={12} strokeWidth={2} />
                <span>{ip.visitorIds?.length || 0} visitor IDs</span>
              </div>
              <div className={styles.ipSummaryStat}>
                <Clock size={12} strokeWidth={2} />
                <span>{formatElapsedTime(ip.totalDuration / 1000)} total</span>
              </div>
              {ip.projects && ip.projects.length > 1 && (
                <div className={styles.ipSummaryStat}>
                  <Globe size={12} strokeWidth={2} />
                  <span>{ip.projects.length} projects</span>
                </div>
              )}
            </div>

            {/* ── Metadata ── */}
            <div className={styles.metaGrid}>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>IP Address</span>
                <span className={styles.metaValue}>{ip.ip}</span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Browser</span>
                <span className={styles.metaValue}>
                  {ip.lastBrowser?.name || "Unknown"} {ip.lastBrowser?.version || ""}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>OS</span>
                <span className={styles.metaValue}>
                  {ip.lastOs?.name || "Unknown"} {ip.lastOs?.version || ""}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Device</span>
                <span className={styles.metaValue}>
                  <DeviceIcon type={ip.lastDevice?.type} />
                  {ip.lastDevice?.type || "desktop"}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Location</span>
                <span className={styles.metaValue}>
                  {ip.lastGeo?.city && ip.lastGeo.city !== "(not set)" ? `${ip.lastGeo.city}, ` : ""}
                  {ip.lastGeo?.country || "Unknown"}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>First Seen</span>
                <span className={styles.metaValue}>{ip.firstSeen ? formatTimestamp(ip.firstSeen) : "—"}</span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Last Seen</span>
                <span className={styles.metaValue}>{ip.lastSeen ? formatTimestamp(ip.lastSeen) : "—"}</span>
              </div>
              {ip.lastFingerprintId && (
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>Fingerprint</span>
                  <span className={styles.metaValue}>{ip.lastFingerprintId.slice(0, 16)}…</span>
                </div>
              )}
            </div>

            {/* ── Visitor IDs linked to this IP ── */}
            {ip.visitorIds && ip.visitorIds.length > 0 && (
              <div className={styles.linkedSection}>
                <div className={styles.linkedHeader}>
                  <Users size={13} strokeWidth={2.2} />
                  <span>Linked Visitor IDs</span>
                  <span className={styles.linkedCount}>{ip.visitorIds.length}</span>
                </div>
                <div className={styles.sessionPills}>
                  {ip.visitorIds.map((vid) => (
                    <span key={vid} className={styles.visitorPill} title={vid}>
                      {vid.slice(0, 12)}…
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Sessions under this IP ── */}
            {ip.sessions && ip.sessions.length > 0 && (
              <div className={styles.linkedSection}>
                <div className={styles.linkedHeader}>
                  <Clock size={13} strokeWidth={2.2} />
                  <span>Sessions</span>
                  <span className={styles.linkedCount}>{ip.sessions.length}</span>
                </div>
                <div className={styles.sessionPills}>
                  {ip.sessions.slice(0, 20).map((s) => (
                    <button
                      key={s.sessionId}
                      className={styles.sessionPill}
                      onClick={() => loadDetail(s.sessionId)}
                      title={`${s.sessionId} · ${formatElapsedTime(s.duration / 1000)} · ${s.browser?.name || "?"}`}
                    >
                      {s.sessionId.slice(0, 8)}…
                      <span className={styles.pillDuration}>
                        {formatElapsedTime(s.duration / 1000)}
                      </span>
                    </button>
                  ))}
                  {ip.sessions.length > 20 && (
                    <span className={styles.sessionPillMore}>+{ip.sessions.length - 20} more</span>
                  )}
                </div>
              </div>
            )}

            {/* ── Cross-session timeline ── */}
            <TimelineView timeline={ip.timeline} label="Cross-Session Timeline" />
          </>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // ── SESSION DETAIL VIEW ───────────────────────────────────
  // ══════════════════════════════════════════════════════════

  if (selectedSession) {
    const currentSession = selectedSession;
    return (
      <div className={styles.explorer}>
        <div className={styles.detailHeader}>
          <button className={styles.backButton} onClick={handleBack}>
            <ArrowLeft size={14} strokeWidth={2.2} />
            Back to list
          </button>
          <span className={styles.detailSessionId}>
            {currentSession.sessionId.slice(0, 8)}…
          </span>
        </div>

        {detailLoading ? (
          <LoadingIndicatorComponent size="small" label="Loading session…" />
        ) : (
          <>
            <div className={styles.metaGrid}>
              <div className={`${styles.metaCard} ${styles.metaCardHighlight}`}>
                <span className={styles.metaLabel}>IP Address</span>
                <button
                  className={styles.metaValueLink}
                  onClick={() => loadIpDetail(currentSession.ip)}
                >
                  {currentSession.ip}
                  <ChevronRight size={12} strokeWidth={2.2} />
                </button>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Visitor ID</span>
                <span className={styles.metaValue}>{currentSession.visitorId?.slice(0, 16)}…</span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Duration</span>
                <span className={styles.metaValue}>{formatElapsedTime(currentSession.duration / 1000)}</span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Browser</span>
                <span className={styles.metaValue}>{currentSession.browser?.name || "Unknown"} {currentSession.browser?.version || ""}</span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>OS</span>
                <span className={styles.metaValue}>{currentSession.os?.name || "Unknown"} {currentSession.os?.version || ""}</span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Device</span>
                <span className={styles.metaValue}>
                  <DeviceIcon type={currentSession.device?.type} />
                  {currentSession.device?.type || "desktop"}{currentSession.device?.vendor ? ` · ${currentSession.device.vendor}` : ""}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Location</span>
                <span className={styles.metaValue}>
                  {currentSession.geo?.city && currentSession.geo.city !== "(not set)" ? `${currentSession.geo.city}, ` : ""}
                  {currentSession.geo?.country || "Unknown"}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Viewport</span>
                <span className={styles.metaValue}>
                  {currentSession.viewport ? `${currentSession.viewport.width} × ${currentSession.viewport.height}` : "N/A"}
                </span>
              </div>
              {currentSession.referrer && (
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>Referrer</span>
                  <span className={styles.metaValue}>{currentSession.referrer}</span>
                </div>
              )}
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Started</span>
                <span className={styles.metaValue}>{formatTimestamp(currentSession.createdAt)}</span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Last Active</span>
                <span className={styles.metaValue}>{formatTimestamp(currentSession.updatedAt)}</span>
              </div>
              {currentSession.locale && (
                <div className={styles.metaCard}>
                  <span className={styles.metaLabel}>Locale</span>
                  <span className={styles.metaValue}>{currentSession.locale}</span>
                </div>
              )}
            </div>

            {currentSession.utm && Object.keys(currentSession.utm).length > 0 && (
              <div className={styles.utmBar}>
                {Object.entries(currentSession.utm).map(([key, value]) => (
                  <span key={key} className={styles.utmTag}>
                    <span className={styles.utmKey}>{key}</span>
                    <span className={styles.utmValue}>{value}</span>
                  </span>
                ))}
              </div>
            )}

            <TimelineView timeline={currentSession.timeline} />

            {currentSession.userAgent && (
              <div className={styles.userAgentBar}>
                <FileText size={12} strokeWidth={2} />
                <span>{currentSession.userAgent}</span>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // ── LIST VIEW ─────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════

  return (
    <div className={styles.explorer}>
      {/* ── Tab Bar ── */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${tab === "ips" ? styles.tabActive : ""}`}
          onClick={() => setTab("ips")}
        >
          <Network size={13} strokeWidth={2.2} />
          IPs
          {ipsTotal > 0 && (
            <span className={styles.tabBadge}>{formatNumber(ipsTotal)}</span>
          )}
        </button>
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

      {/* ── IPs Tab ── */}
      {tab === "ips" && (
        <>
          {ipsLoading ? (
            <LoadingIndicatorComponent size="small" label="Loading IPs…" className="loading-center" />
          ) : ipUsers.length === 0 ? (
            <div className={styles.emptyState}>No IP data available.</div>
          ) : (
            <>
              <div className={styles.cardList}>
                {ipUsers.map((u) => (
                  <button
                    key={u.ip}
                    className={styles.visitorCard}
                    onClick={() => loadIpDetail(u.ip)}
                  >
                    <div className={styles.visitorHeader}>
                      <div className={styles.visitorId}>
                        <Network size={12} strokeWidth={2.2} />
                        {u.ip}
                      </div>
                      <span className={styles.visitorSessionCount}>
                        {u.sessionCount} session{u.sessionCount !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className={styles.visitorMeta}>
                      {u.visitorIds.length > 0 && (
                        <span className={styles.visitorMetaItem}>
                          <Users size={11} strokeWidth={2} />
                          {u.visitorIds.length} visitor{u.visitorIds.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className={styles.visitorMetaItem}>
                        <Globe size={11} strokeWidth={2} />
                        {u.lastBrowser?.name || "Unknown"}
                      </span>
                      <span className={styles.visitorMetaItem}>
                        <Monitor size={11} strokeWidth={2} />
                        {u.lastOs?.name || "Unknown"}
                      </span>
                      <span className={styles.visitorMetaItem}>
                        <DeviceIcon type={u.lastDevice?.type} />
                        {u.lastDevice?.type || "desktop"}
                      </span>
                      {u.lastGeo?.country && (
                        <span className={styles.visitorMetaItem}>
                          <MapPin size={11} strokeWidth={2} />
                          {u.lastGeo.city && u.lastGeo.city !== "(not set)" ? `${u.lastGeo.city}, ` : ""}
                          {u.lastGeo.country}
                        </span>
                      )}
                    </div>

                    <div className={styles.visitorFooter}>
                      <span className={styles.visitorTime}>
                        <Clock size={11} strokeWidth={2} />
                        {formatElapsedTime(u.totalDuration / 1000)} total
                      </span>
                      <span className={styles.visitorSeen}>
                        Last seen {formatTimeAgo(u.lastSeen)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {ipsTotal > 50 && (
                <div className={styles.pagination}>
                  <button className={styles.pageButton} disabled={ipsOffset === 0} onClick={() => loadIps(Math.max(0, ipsOffset - 50))}>Previous</button>
                  <span className={styles.pageInfo}>{ipsOffset + 1}–{Math.min(ipsOffset + 50, ipsTotal)} of {formatNumber(ipsTotal)}</span>
                  <button className={styles.pageButton} disabled={ipsOffset + 50 >= ipsTotal} onClick={() => loadIps(ipsOffset + 50)}>Next</button>
                </div>
              )}
            </>
          )}
        </>
      )}

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
                      {v.lastIp && (
                        <button
                          className={`${styles.visitorMetaItem} ${styles.visitorMetaLink}`}
                          onClick={() => loadIpDetail(v.lastIp)}
                        >
                          <Network size={11} strokeWidth={2} />
                          {v.lastIp}
                        </button>
                      )}
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
                          {v.lastGeo.city && v.lastGeo.city !== "(not set)" ? `${v.lastGeo.city}, ` : ""}
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

                    <div className={styles.sessionPills}>
                      {v.sessionIds.slice(0, 5).map((sid) => (
                        <button key={sid} className={styles.sessionPill} onClick={() => loadDetail(sid)} title={sid}>
                          {sid.slice(0, 8)}…
                        </button>
                      ))}
                      {v.sessionIds.length > 5 && (
                        <span className={styles.sessionPillMore}>+{v.sessionIds.length - 5} more</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {visitorsTotal > 50 && (
                <div className={styles.pagination}>
                  <button className={styles.pageButton} disabled={visitorsOffset === 0} onClick={() => loadVisitors(Math.max(0, visitorsOffset - 50))}>Previous</button>
                  <span className={styles.pageInfo}>{visitorsOffset + 1}–{Math.min(visitorsOffset + 50, visitorsTotal)} of {formatNumber(visitorsTotal)}</span>
                  <button className={styles.pageButton} disabled={visitorsOffset + 50 >= visitorsTotal} onClick={() => loadVisitors(visitorsOffset + 50)}>Next</button>
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
                  <span>IP</span>
                  <span>Device</span>
                  <span>Location</span>
                  <span>Duration</span>
                  <span>Last Active</span>
                </div>
                {sessions.map((s) => (
                  <button key={s.sessionId} className={styles.sessionTableRow} onClick={() => loadDetail(s.sessionId)}>
                    <span className={styles.sessionTableId}>{s.sessionId.slice(0, 8)}…</span>
                    <span className={styles.sessionTableIp}>{s.ip}</span>
                    <span className={styles.sessionTableDevice}>
                      <DeviceIcon type={s.device?.type} />
                      {s.browser?.name || "?"} / {s.os?.name || "?"}
                    </span>
                    <span className={styles.sessionTableGeo}>
                      {s.geo?.city && s.geo.city !== "(not set)" ? `${s.geo.city}, ` : ""}
                      {s.geo?.country || "—"}
                    </span>
                    <span className={styles.sessionTableDuration}>{formatElapsedTime(s.duration / 1000)}</span>
                    <span className={styles.sessionTableTime}>{formatTimeAgo(s.updatedAt)}</span>
                  </button>
                ))}
              </div>

              {sessionsTotal > 50 && (
                <div className={styles.pagination}>
                  <button className={styles.pageButton} disabled={sessionsOffset === 0} onClick={() => loadSessions(Math.max(0, sessionsOffset - 50))}>Previous</button>
                  <span className={styles.pageInfo}>{sessionsOffset + 1}–{Math.min(sessionsOffset + 50, sessionsTotal)} of {formatNumber(sessionsTotal)}</span>
                  <button className={styles.pageButton} disabled={sessionsOffset + 50 >= sessionsTotal} onClick={() => loadSessions(sessionsOffset + 50)}>Next</button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
