"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { LoadingIndicatorComponent, SearchInputComponent, TableComponent } from "@rodrigo-barraza/components-library";
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
  LayoutGrid,
  Table2,
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
  lastGeo: {
    country: string | null;
    city: string | null;
    countryCode: string | null;
  };
  lastFingerprintId: string | null;
  lastReferrer: string | null;
  lastViewport: { width: number; height: number } | null;
}

interface IpDetail extends IpUser {
  timeline: TimelineEntry[];
  sessions: SessionRow[];
  pageViews: Array<{
    sessionId: string;
    url: string;
    path: string;
    title: string;
    timestamp: string;
  }>;
  events: Array<{
    sessionId: string;
    category: string;
    action: string;
    label: string;
    timestamp: string;
  }>;
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
  lastGeo: {
    country: string | null;
    city: string | null;
    countryCode: string | null;
  };
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
  geo: {
    country: string | null;
    city: string | null;
    countryCode: string | null;
  };
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
  pageViews: Array<{
    url: string;
    path: string;
    title: string;
    timestamp: string;
  }>;
  events: Array<{
    category: string;
    action: string;
    label: string;
    timestamp: string;
  }>;
  timeline: TimelineEntry[];
}

// ── Helpers ───────────────────────────────────────────────────

function formatTimeAgo(dateString: string): string {
  const delta = Date.now() - new Date(dateString).getTime();
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTimestamp(dateString: string): string {
  const parsedDate = new Date(dateString);
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

function TimelineView({
  timeline,
  label,
}: {
  timeline: TimelineEntry[];
  label?: string;
}) {
  if (!timeline || timeline.length === 0) {
    return <div className={styles['empty-timeline']}>No activity recorded.</div>;
  }

  return (
    <div className={styles['timeline-section']}>
      <div className={styles['timeline-header']}>
        <Clock size={14} strokeWidth={2.2} />
        <span>{label || "Activity Timeline"}</span>
        <span className={styles['timeline-count']}>{timeline.length} events</span>
      </div>
      <div className={styles['timeline']}>
        {timeline.map((entry, i) => (
          <div
            key={i}
            className={`${styles['timeline-item']} ${entry.type === "pageview" ? styles['timeline-pageview'] : styles['timeline-event']}`}
          >
            <div className={styles['timeline-dot']}>
              {entry.type === "pageview" ? (
                <Eye size={10} strokeWidth={2.5} />
              ) : (
                <Zap size={10} strokeWidth={2.5} />
              )}
            </div>
            <div className={styles['timeline-connector']} />
            <div className={styles['timeline-content']}>
              <div className={styles['timeline-row']}>
                <span className={styles['timeline-type']}>
                  {entry.type === "pageview" ? "Page View" : "Event"}
                </span>
                {entry.sessionId && (
                  <span className={styles['timeline-session-tag']}>
                    {entry.sessionId.slice(0, 6)}
                  </span>
                )}
                <span className={styles['timeline-time']}>
                  {formatTimestamp(entry.timestamp)}
                </span>
              </div>
              {entry.type === "pageview" ? (
                <span className={styles['timeline-detail']}>
                  {entry.path || entry.url}
                  {entry.title && (
                    <span className={styles['timeline-title']}>
                      {" "}
                      — {entry.title}
                    </span>
                  )}
                </span>
              ) : (
                <span className={styles['timeline-detail']}>
                  <span className={styles['timeline-category']}>
                    {entry.category}
                  </span>
                  <ChevronRight size={10} strokeWidth={2.5} />
                  <span className={styles['timeline-action']}>{entry.action}</span>
                  {entry.label && (
                    <span className={styles['timeline-label']}>
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
  type ViewMode = "cards" | "table";
  const [tab, setTab] = useState<Tab>("ips");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [searchQuery, setSearchQuery] = useState("");

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
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);

  const didFetch = useRef(false);

  // ── Loaders ───────────────────────────────────────────────

  const loadIps = useCallback(
    async (offset = 0) => {
      setIpsLoading(true);
      try {
        const ipUsersResponse = await ApiService.getSessionIpUsers(
          projectId,
          period,
          50,
          offset,
        );
        const data = ipUsersResponse?.data ?? ipUsersResponse;
        setIpUsers(data?.ips || []);
        setIpsTotal(data?.total || 0);
        setIpsOffset(offset);
      } catch {
        /* silent */
      } finally {
        setIpsLoading(false);
      }
    },
    [projectId, period],
  );

  const loadIpDetail = useCallback(
    async (ip: string) => {
      setIpDetailLoading(true);
      try {
        const ipDetailResponse = await ApiService.getSessionIpDetail(ip, projectId, period);
        setSelectedIp(ipDetailResponse?.data ?? ipDetailResponse);
      } catch {
        /* silent */
      } finally {
        setIpDetailLoading(false);
      }
    },
    [projectId, period],
  );

  const loadVisitors = useCallback(
    async (offset = 0) => {
      setVisitorsLoading(true);
      try {
        const visitorsResponse = await ApiService.getSessionVisitors(
          projectId,
          period,
          50,
          offset,
        );
        const data = visitorsResponse?.data ?? visitorsResponse;
        setVisitors(data?.visitors || []);
        setVisitorsTotal(data?.total || 0);
        setVisitorsOffset(offset);
      } catch {
        /* silent */
      } finally {
        setVisitorsLoading(false);
      }
    },
    [projectId, period],
  );

  const loadSessions = useCallback(
    async (offset = 0) => {
      setSessionsLoading(true);
      try {
        const sessionsResponse = await ApiService.getSessionsList(
          projectId,
          period,
          50,
          offset,
        );
        const data = sessionsResponse?.data ?? sessionsResponse;
        setSessions(data?.sessions || []);
        setSessionsTotal(data?.total || 0);
        setSessionsOffset(offset);
      } catch {
        /* silent */
      } finally {
        setSessionsLoading(false);
      }
    },
    [projectId, period],
  );

  const loadDetail = useCallback(async (sessionId: string) => {
    setDetailLoading(true);
    try {
      const sessionDetailResponse = await ApiService.getSessionDetail(sessionId);
      setSelectedSession(sessionDetailResponse?.data ?? sessionDetailResponse);
    } catch {
      /* silent */
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ── Column Definitions for TableComponent ──

  const ipColumns = useMemo(() => [
    {
      key: "ip",
      label: "IP Address",
      width: "15%",
      sortable: true,
      render: (ipUserRecord: IpUser) => (
        <span className={styles['session-table-id']}>
          <Network size={11} strokeWidth={2} />
          {ipUserRecord.ip}
        </span>
      ),
      sortValue: (ipUserRecord: IpUser) => ipUserRecord.ip,
    },
    {
      key: "visitorCount",
      label: "Visitors",
      width: "15%",
      sortable: true,
      render: (ipUserRecord: IpUser) => (
        <span className={styles['session-table-ip']}>
          {ipUserRecord.visitorIds.length} visitor{ipUserRecord.visitorIds.length !== 1 ? "s" : ""}
          {" · "}
          {ipUserRecord.sessionCount} session{ipUserRecord.sessionCount !== 1 ? "s" : ""}
        </span>
      ),
      sortValue: (ipUserRecord: IpUser) => ipUserRecord.sessionCount,
    },
    {
      key: "browser",
      label: "Browser / OS",
      width: "23%",
      sortable: true,
      render: (ipUserRecord: IpUser) => (
        <span className={styles['session-table-device']}>
          <DeviceIcon type={ipUserRecord.lastDevice?.type} />
          {ipUserRecord.lastBrowser?.name || "?"} / {ipUserRecord.lastOs?.name || "?"}
        </span>
      ),
      sortValue: (ipUserRecord: IpUser) => ipUserRecord.lastBrowser?.name || "",
    },
    {
      key: "location",
      label: "Location",
      width: "23%",
      sortable: true,
      render: (ipUserRecord: IpUser) => (
        <span className={styles['session-table-geo']}>
          {ipUserRecord.lastGeo?.city && ipUserRecord.lastGeo.city !== "(not set)"
            ? `${ipUserRecord.lastGeo.city}, `
            : ""}
          {ipUserRecord.lastGeo?.country || "—"}
        </span>
      ),
      sortValue: (ipUserRecord: IpUser) => ipUserRecord.lastGeo?.country || "",
    },
    {
      key: "duration",
      label: "Duration",
      width: "12%",
      sortable: true,
      render: (ipUserRecord: IpUser) => (
        <span className={styles['session-table-duration']}>
          {formatElapsedTime(ipUserRecord.totalDuration / 1000)}
        </span>
      ),
      sortValue: (ipUserRecord: IpUser) => ipUserRecord.totalDuration,
    },
    {
      key: "lastSeen",
      label: "Last Seen",
      width: "12%",
      sortable: true,
      render: (ipUserRecord: IpUser) => (
        <span className={styles['session-table-time']}>
          {formatTimeAgo(ipUserRecord.lastSeen)}
        </span>
      ),
      sortValue: (ipUserRecord: IpUser) => new Date(ipUserRecord.lastSeen).getTime(),
    },
  ], []);

  const visitorColumns = useMemo(() => [
    {
      key: "visitorId",
      label: "Visitor ID",
      width: "15%",
      sortable: true,
      render: (visitorRecord: Visitor) => (
        <span className={styles['session-table-id']}>
          <Users size={11} strokeWidth={2} />
          {visitorRecord.visitorId.slice(0, 12)}…
        </span>
      ),
      sortValue: (visitorRecord: Visitor) => visitorRecord.visitorId,
    },
    {
      key: "lastIp",
      label: "IP",
      width: "15%",
      sortable: true,
      render: (visitorRecord: Visitor) => (
        <button
          className={`${styles['session-table-ip']} ${styles['visitor-meta-link']}`}
          onClick={(event: React.MouseEvent) => {
            event.stopPropagation();
            loadIpDetail(visitorRecord.lastIp);
          }}
        >
          {visitorRecord.lastIp}
        </button>
      ),
      sortValue: (visitorRecord: Visitor) => visitorRecord.lastIp,
    },
    {
      key: "browser",
      label: "Browser / OS",
      width: "23%",
      sortable: true,
      render: (visitorRecord: Visitor) => (
        <span className={styles['session-table-device']}>
          <DeviceIcon type={visitorRecord.lastDevice?.type} />
          {visitorRecord.lastBrowser?.name || "?"} / {visitorRecord.lastOs?.name || "?"}
        </span>
      ),
      sortValue: (visitorRecord: Visitor) => visitorRecord.lastBrowser?.name || "",
    },
    {
      key: "location",
      label: "Location",
      width: "23%",
      sortable: true,
      render: (visitorRecord: Visitor) => (
        <span className={styles['session-table-geo']}>
          {visitorRecord.lastGeo?.city && visitorRecord.lastGeo.city !== "(not set)"
            ? `${visitorRecord.lastGeo.city}, `
            : ""}
          {visitorRecord.lastGeo?.country || "—"}
        </span>
      ),
      sortValue: (visitorRecord: Visitor) => visitorRecord.lastGeo?.country || "",
    },
    {
      key: "sessionCount",
      label: "Sessions",
      width: "12%",
      sortable: true,
      render: (visitorRecord: Visitor) => (
        <span className={styles['session-table-duration']}>
          {visitorRecord.sessionCount} session{visitorRecord.sessionCount !== 1 ? "s" : ""}
        </span>
      ),
      sortValue: (visitorRecord: Visitor) => visitorRecord.sessionCount,
    },
    {
      key: "lastSeen",
      label: "Last Seen",
      width: "12%",
      sortable: true,
      render: (visitorRecord: Visitor) => (
        <span className={styles['session-table-time']}>
          {formatTimeAgo(visitorRecord.lastSeen)}
        </span>
      ),
      sortValue: (visitorRecord: Visitor) => new Date(visitorRecord.lastSeen).getTime(),
    },
  ], [loadIpDetail]);

  const sessionColumns = useMemo(() => [
    {
      key: "sessionId",
      label: "Session",
      width: "15%",
      sortable: true,
      render: (sessionRecord: SessionRow) => (
        <span className={styles['session-table-id']}>
          {sessionRecord.sessionId.slice(0, 8)}…
        </span>
      ),
      sortValue: (sessionRecord: SessionRow) => sessionRecord.sessionId,
    },
    {
      key: "ip",
      label: "IP",
      width: "15%",
      sortable: true,
      render: (sessionRecord: SessionRow) => (
        <span className={styles['session-table-ip']}>{sessionRecord.ip}</span>
      ),
      sortValue: (sessionRecord: SessionRow) => sessionRecord.ip,
    },
    {
      key: "device",
      label: "Device",
      width: "23%",
      sortable: true,
      render: (sessionRecord: SessionRow) => (
        <span className={styles['session-table-device']}>
          <DeviceIcon type={sessionRecord.device?.type} />
          {sessionRecord.browser?.name || "?"} / {sessionRecord.os?.name || "?"}
        </span>
      ),
      sortValue: (sessionRecord: SessionRow) => sessionRecord.browser?.name || "",
    },
    {
      key: "location",
      label: "Location",
      width: "23%",
      sortable: true,
      render: (sessionRecord: SessionRow) => (
        <span className={styles['session-table-geo']}>
          {sessionRecord.geo?.city && sessionRecord.geo.city !== "(not set)"
            ? `${sessionRecord.geo.city}, `
            : ""}
          {sessionRecord.geo?.country || "—"}
        </span>
      ),
      sortValue: (sessionRecord: SessionRow) => sessionRecord.geo?.country || "",
    },
    {
      key: "duration",
      label: "Duration",
      width: "12%",
      sortable: true,
      render: (sessionRecord: SessionRow) => (
        <span className={styles['session-table-duration']}>
          {formatElapsedTime(sessionRecord.duration / 1000)}
        </span>
      ),
      sortValue: (sessionRecord: SessionRow) => sessionRecord.duration,
    },
    {
      key: "lastActive",
      label: "Last Active",
      width: "12%",
      sortable: true,
      render: (sessionRecord: SessionRow) => (
        <span className={styles['session-table-time']}>
          {formatTimeAgo(sessionRecord.updatedAt)}
        </span>
      ),
      sortValue: (sessionRecord: SessionRow) => new Date(sessionRecord.updatedAt).getTime(),
    },
  ], []);

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
    setSearchQuery("");
  }, [period, loadIps, loadVisitors, loadSessions]);

  // ── Back handler ──────────────────────────────────────────

  const handleBack = () => {
    setSelectedSession(null);
    setSelectedIp(null);
  };

  // ── Search Filters ─────────────────────────────────────────

  const filteredIpUsers = ipUsers.filter((ipUser) => {
    if (!searchQuery.trim()) {
      return true;
    }
    const normalizedQuery = searchQuery.toLowerCase();
    const searchableFields = [
      ipUser.ip,
      ...(ipUser.visitorIds || []),
      ipUser.lastBrowser?.name,
      ipUser.lastBrowser?.version,
      ipUser.lastOs?.name,
      ipUser.lastOs?.version,
      ipUser.lastDevice?.type,
      ipUser.lastDevice?.vendor,
      ipUser.lastGeo?.country,
      ipUser.lastGeo?.city,
    ].filter((field): field is string => !!field).map((field) => field.toLowerCase());

    return searchableFields.some((field) => field.includes(normalizedQuery));
  });

  const filteredVisitors = visitors.filter((visitor) => {
    if (!searchQuery.trim()) {
      return true;
    }
    const normalizedQuery = searchQuery.toLowerCase();
    const searchableFields = [
      visitor.visitorId,
      visitor.lastIp,
      visitor.lastBrowser?.name,
      visitor.lastBrowser?.version,
      visitor.lastOs?.name,
      visitor.lastOs?.version,
      visitor.lastDevice?.type,
      visitor.lastDevice?.vendor,
      visitor.lastGeo?.country,
      visitor.lastGeo?.city,
    ].filter((field): field is string => !!field).map((field) => field.toLowerCase());

    return searchableFields.some((field) => field.includes(normalizedQuery));
  });

  const filteredSessions = sessions.filter((session) => {
    if (!searchQuery.trim()) {
      return true;
    }
    const normalizedQuery = searchQuery.toLowerCase();
    const searchableFields = [
      session.sessionId,
      session.ip,
      session.browser?.name,
      session.browser?.version,
      session.os?.name,
      session.os?.version,
      session.device?.type,
      session.device?.vendor,
      session.geo?.country,
      session.geo?.city,
    ].filter((field): field is string => !!field).map((field) => field.toLowerCase());

    return searchableFields.some((field) => field.includes(normalizedQuery));
  });

  // ══════════════════════════════════════════════════════════
  // ── IP DETAIL VIEW ────────────────────────────────────────
  // ══════════════════════════════════════════════════════════

  if (selectedIp) {
    const ip = selectedIp;
    return (
      <div className={styles['explorer']}>
        <div className={styles['detail-header']}>
          <button className={styles['back-button']} onClick={handleBack}>
            <ArrowLeft size={14} strokeWidth={2.2} />
            Back to list
          </button>
          <span className={styles['detail-session-id']}>
            <Network size={14} strokeWidth={2.2} />
            {ip.ip}
          </span>
        </div>

        {ipDetailLoading ? (
          <LoadingIndicatorComponent size="small" label="Loading IP profile…" />
        ) : (
          <>
            {/* ── IP Summary Stats ── */}
            <div className={styles['ip-address-summary-bar']}>
              <div className={styles['ip-address-summary-stat']}>
                <Hash size={12} strokeWidth={2} />
                <span>{ip.sessionCount} sessions</span>
              </div>
              <div className={styles['ip-address-summary-stat']}>
                <Users size={12} strokeWidth={2} />
                <span>{ip.visitorIds?.length || 0} visitor IDs</span>
              </div>
              <div className={styles['ip-address-summary-stat']}>
                <Clock size={12} strokeWidth={2} />
                <span>{formatElapsedTime(ip.totalDuration / 1000)} total</span>
              </div>
              {ip.projects && ip.projects.length > 1 && (
                <div className={styles['ip-address-summary-stat']}>
                  <Globe size={12} strokeWidth={2} />
                  <span>{ip.projects.length} projects</span>
                </div>
              )}
            </div>

            {/* ── Metadata ── */}
            <div className={styles['meta-grid']}>
              <div className={styles['meta-card']}>
                <span className={styles['meta-label']}>IP Address</span>
                <span className={styles['meta-value']}>{ip.ip}</span>
              </div>
              <div className={styles['meta-card']}>
                <span className={styles['meta-label']}>Browser</span>
                <span className={styles['meta-value']}>
                  {ip.lastBrowser?.name || "Unknown"}{" "}
                  {ip.lastBrowser?.version || ""}
                </span>
              </div>
              <div className={styles['meta-card']}>
                <span className={styles['meta-label']}>OS</span>
                <span className={styles['meta-value']}>
                  {ip.lastOs?.name || "Unknown"} {ip.lastOs?.version || ""}
                </span>
              </div>
              <div className={styles['meta-card']}>
                <span className={styles['meta-label']}>Device</span>
                <span className={styles['meta-value']}>
                  <DeviceIcon type={ip.lastDevice?.type} />
                  {ip.lastDevice?.type || "desktop"}
                </span>
              </div>
              <div className={styles['meta-card']}>
                <span className={styles['meta-label']}>Location</span>
                <span className={styles['meta-value']}>
                  {ip.lastGeo?.city && ip.lastGeo.city !== "(not set)"
                    ? `${ip.lastGeo.city}, `
                    : ""}
                  {ip.lastGeo?.country || "Unknown"}
                </span>
              </div>
              <div className={styles['meta-card']}>
                <span className={styles['meta-label']}>First Seen</span>
                <span className={styles['meta-value']}>
                  {ip.firstSeen ? formatTimestamp(ip.firstSeen) : "—"}
                </span>
              </div>
              <div className={styles['meta-card']}>
                <span className={styles['meta-label']}>Last Seen</span>
                <span className={styles['meta-value']}>
                  {ip.lastSeen ? formatTimestamp(ip.lastSeen) : "—"}
                </span>
              </div>
              {ip.lastFingerprintId && (
                <div className={styles['meta-card']}>
                  <span className={styles['meta-label']}>Fingerprint</span>
                  <span className={styles['meta-value']}>
                    {ip.lastFingerprintId.slice(0, 16)}…
                  </span>
                </div>
              )}
            </div>

            {/* ── Visitor IDs linked to this IP ── */}
            {ip.visitorIds && ip.visitorIds.length > 0 && (
              <div className={styles['linked-section']}>
                <div className={styles['linked-header']}>
                  <Users size={13} strokeWidth={2.2} />
                  <span>Linked Visitor IDs</span>
                  <span className={styles['linked-count']}>
                    {ip.visitorIds.length}
                  </span>
                </div>
                <div className={styles['session-pills']}>
                  {ip.visitorIds.map((vid) => (
                    <span key={vid} className={styles['visitor-pill']} title={vid}>
                      {vid.slice(0, 12)}…
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Sessions under this IP ── */}
            {ip.sessions && ip.sessions.length > 0 && (
              <div className={styles['linked-section']}>
                <div className={styles['linked-header']}>
                  <Clock size={13} strokeWidth={2.2} />
                  <span>Sessions</span>
                  <span className={styles['linked-count']}>
                    {ip.sessions.length}
                  </span>
                </div>
                <div className={styles['session-pills']}>
                  {ip.sessions.slice(0, 20).map((s) => (
                    <button
                      key={s.sessionId}
                      className={styles['session-pill']}
                      onClick={() => loadDetail(s.sessionId)}
                      title={`${s.sessionId} · ${formatElapsedTime(s.duration / 1000)} · ${s.browser?.name || "?"}`}
                    >
                      {s.sessionId.slice(0, 8)}…
                      <span className={styles['pill-duration']}>
                        {formatElapsedTime(s.duration / 1000)}
                      </span>
                    </button>
                  ))}
                  {ip.sessions.length > 20 && (
                    <span className={styles['session-pill-more']}>
                      +{ip.sessions.length - 20} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ── Cross-session timeline ── */}
            <TimelineView
              timeline={ip.timeline}
              label="Cross-Session Timeline"
            />
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
      <div className={styles['explorer']}>
        <div className={styles['detail-header']}>
          <button className={styles['back-button']} onClick={handleBack}>
            <ArrowLeft size={14} strokeWidth={2.2} />
            Back to list
          </button>
          <span className={styles['detail-session-id']}>
            {currentSession.sessionId.slice(0, 8)}…
          </span>
        </div>

        {detailLoading ? (
          <LoadingIndicatorComponent size="small" label="Loading session…" />
        ) : (
          <>
            <div className={styles['meta-grid']}>
              <div className={`${styles['meta-card']} ${styles['meta-card-highlight']}`}>
                <span className={styles['meta-label']}>IP Address</span>
                <button
                  className={styles['meta-value-link']}
                  onClick={() => loadIpDetail(currentSession.ip)}
                >
                  {currentSession.ip}
                  <ChevronRight size={12} strokeWidth={2.2} />
                </button>
              </div>
              <div className={styles['meta-card']}>
                <span className={styles['meta-label']}>Visitor ID</span>
                <span className={styles['meta-value']}>
                  {currentSession.visitorId?.slice(0, 16)}…
                </span>
              </div>
              <div className={styles['meta-card']}>
                <span className={styles['meta-label']}>Duration</span>
                <span className={styles['meta-value']}>
                  {formatElapsedTime(currentSession.duration / 1000)}
                </span>
              </div>
              <div className={styles['meta-card']}>
                <span className={styles['meta-label']}>Browser</span>
                <span className={styles['meta-value']}>
                  {currentSession.browser?.name || "Unknown"}{" "}
                  {currentSession.browser?.version || ""}
                </span>
              </div>
              <div className={styles['meta-card']}>
                <span className={styles['meta-label']}>OS</span>
                <span className={styles['meta-value']}>
                  {currentSession.os?.name || "Unknown"}{" "}
                  {currentSession.os?.version || ""}
                </span>
              </div>
              <div className={styles['meta-card']}>
                <span className={styles['meta-label']}>Device</span>
                <span className={styles['meta-value']}>
                  <DeviceIcon type={currentSession.device?.type} />
                  {currentSession.device?.type || "desktop"}
                  {currentSession.device?.vendor
                    ? ` · ${currentSession.device.vendor}`
                    : ""}
                </span>
              </div>
              <div className={styles['meta-card']}>
                <span className={styles['meta-label']}>Location</span>
                <span className={styles['meta-value']}>
                  {currentSession.geo?.city &&
                  currentSession.geo.city !== "(not set)"
                    ? `${currentSession.geo.city}, `
                    : ""}
                  {currentSession.geo?.country || "Unknown"}
                </span>
              </div>
              <div className={styles['meta-card']}>
                <span className={styles['meta-label']}>Viewport</span>
                <span className={styles['meta-value']}>
                  {currentSession.viewport
                    ? `${currentSession.viewport.width} × ${currentSession.viewport.height}`
                    : "N/A"}
                </span>
              </div>
              {currentSession.referrer && (
                <div className={styles['meta-card']}>
                  <span className={styles['meta-label']}>Referrer</span>
                  <span className={styles['meta-value']}>
                    {currentSession.referrer}
                  </span>
                </div>
              )}
              <div className={styles['meta-card']}>
                <span className={styles['meta-label']}>Started</span>
                <span className={styles['meta-value']}>
                  {formatTimestamp(currentSession.createdAt)}
                </span>
              </div>
              <div className={styles['meta-card']}>
                <span className={styles['meta-label']}>Last Active</span>
                <span className={styles['meta-value']}>
                  {formatTimestamp(currentSession.updatedAt)}
                </span>
              </div>
              {currentSession.locale && (
                <div className={styles['meta-card']}>
                  <span className={styles['meta-label']}>Locale</span>
                  <span className={styles['meta-value']}>
                    {currentSession.locale}
                  </span>
                </div>
              )}
            </div>

            {currentSession.utm &&
              Object.keys(currentSession.utm).length > 0 && (
                <div className={styles['utm-bar']}>
                  {Object.entries(currentSession.utm).map(([key, value]) => (
                    <span key={key} className={styles['utm-tag']}>
                      <span className={styles['utm-key']}>{key}</span>
                      <span className={styles['utm-value']}>{value}</span>
                    </span>
                  ))}
                </div>
              )}

            <TimelineView timeline={currentSession.timeline} />

            {currentSession.userAgent && (
              <div className={styles['user-agent-bar']}>
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
    <div className={`session-explorer-component ${styles['explorer']}`}>
      {/* ── Controls Section ── */}
      <section className={styles["controls-container"]}>
        {/* ── Tab Bar Navigation ── */}
        <nav className={styles['tab-bar']}>
          <button
            className={`${styles['tab']} ${tab === "ips" ? styles['tab-active'] : ""}`}
            onClick={() => setTab("ips")}
          >
            <Network size={13} strokeWidth={2.2} />
            IPs
            {ipsTotal > 0 && (
              <span className={styles['tab-badge']}>{formatNumber(ipsTotal)}</span>
            )}
          </button>
          <button
            className={`${styles['tab']} ${tab === "visitors" ? styles['tab-active'] : ""}`}
            onClick={() => setTab("visitors")}
          >
            <Users size={13} strokeWidth={2.2} />
            Visitors
            {visitorsTotal > 0 && (
              <span className={styles['tab-badge']}>
                {formatNumber(visitorsTotal)}
              </span>
            )}
          </button>
          <button
            className={`${styles['tab']} ${tab === "sessions" ? styles['tab-active'] : ""}`}
            onClick={() => setTab("sessions")}
          >
            <Clock size={13} strokeWidth={2.2} />
            Sessions
            {sessionsTotal > 0 && (
              <span className={styles['tab-badge']}>
                {formatNumber(sessionsTotal)}
              </span>
            )}
          </button>
        </nav>

        <div className={styles["controls-right"]}>
          {/* ── View Mode Toggle ── */}
          <div className={styles["view-mode-toggle"]} role="group" aria-label="View mode">
            <button
              className={`${styles["view-mode-button"]} ${viewMode === "cards" ? styles["view-mode-button-is-active-state"] : ""}`}
              onClick={() => setViewMode("cards")}
              aria-label="Card view"
              title="Card view"
            >
              <LayoutGrid size={14} strokeWidth={2.2} />
            </button>
            <button
              className={`${styles["view-mode-button"]} ${viewMode === "table" ? styles["view-mode-button-is-active-state"] : ""}`}
              onClick={() => setViewMode("table")}
              aria-label="Table view"
              title="Table view"
            >
              <Table2 size={14} strokeWidth={2.2} />
            </button>
          </div>

          {/* ── Search Input ── */}
          <SearchInputComponent
            value={searchQuery}
            onChange={(value: string) => setSearchQuery(value)}
            placeholder={`Search ${tab === "ips" ? "IPs" : tab === "visitors" ? "visitors" : "sessions"}…`}
            compact
            id="session-explorer-search-input"
          />
        </div>
      </section>

      {/* ── IPs Tab ── */}
      {tab === "ips" && (
        <>
          {ipsLoading ? (
            <LoadingIndicatorComponent
              size="small"
              label="Loading IPs…"
              className="is-loading-centered-state"
            />
          ) : ipUsers.length === 0 ? (
            <div className={styles['empty-state']}>No IP data available.</div>
          ) : filteredIpUsers.length === 0 ? (
            <div className={styles['empty-state']}>No IPs match your search query.</div>
          ) : (
            <>
              {viewMode === "cards" ? (
                <div className={styles['card-list']}>
                  {filteredIpUsers.map((ipUser) => (
                    <button
                      key={ipUser.ip}
                      className={styles['visitor-card']}
                      onClick={() => loadIpDetail(ipUser.ip)}
                    >
                      <div className={styles['visitor-header']}>
                        <div className={styles['visitor-id']}>
                          <Network size={12} strokeWidth={2.2} />
                          {ipUser.ip}
                        </div>
                        <span className={styles['visitor-session-count']}>
                          {ipUser.sessionCount} session
                          {ipUser.sessionCount !== 1 ? "s" : ""}
                        </span>
                      </div>

                      <div className={styles['visitor-meta']}>
                        {ipUser.visitorIds.length > 0 && (
                          <span className={styles['visitor-meta-item']}>
                            <Users size={11} strokeWidth={2} />
                            {ipUser.visitorIds.length} visitor
                            {ipUser.visitorIds.length !== 1 ? "s" : ""}
                          </span>
                        )}
                        <span className={styles['visitor-meta-item']}>
                          <Globe size={11} strokeWidth={2} />
                          {ipUser.lastBrowser?.name || "Unknown"}
                        </span>
                        <span className={styles['visitor-meta-item']}>
                          <Monitor size={11} strokeWidth={2} />
                          {ipUser.lastOs?.name || "Unknown"}
                        </span>
                        <span className={styles['visitor-meta-item']}>
                          <DeviceIcon type={ipUser.lastDevice?.type} />
                          {ipUser.lastDevice?.type || "desktop"}
                        </span>
                        {ipUser.lastGeo?.country && (
                          <span className={styles['visitor-meta-item']}>
                            <MapPin size={11} strokeWidth={2} />
                            {ipUser.lastGeo.city && ipUser.lastGeo.city !== "(not set)"
                              ? `${ipUser.lastGeo.city}, `
                              : ""}
                            {ipUser.lastGeo.country}
                          </span>
                        )}
                      </div>

                      <div className={styles['visitor-footer']}>
                        <span className={styles['visitor-time']}>
                          <Clock size={11} strokeWidth={2} />
                          {formatElapsedTime(ipUser.totalDuration / 1000)} total
                        </span>
                        <span className={styles['visitor-seen']}>
                          Last seen {formatTimeAgo(ipUser.lastSeen)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <TableComponent<IpUser>
                  columns={ipColumns}
                  data={filteredIpUsers}
                  getRowKey={(ipUserRecord: IpUser) => ipUserRecord.ip}
                  onRowClick={(ipUserRecord: IpUser) => loadIpDetail(ipUserRecord.ip)}
                  emptyText="No IPs match your search query."
                  mini
                  storageKey="session-explorer-ips"
                />
              )}

              {ipsTotal > 50 && (
                <div className={styles['pagination']}>
                  <button
                    className={styles['page-button']}
                    disabled={ipsOffset === 0}
                    onClick={() => loadIps(Math.max(0, ipsOffset - 50))}
                  >
                    Previous
                  </button>
                  <span className={styles['page-info']}>
                    {ipsOffset + 1}–{Math.min(ipsOffset + 50, ipsTotal)} of{" "}
                    {formatNumber(ipsTotal)}
                  </span>
                  <button
                    className={styles['page-button']}
                    disabled={ipsOffset + 50 >= ipsTotal}
                    onClick={() => loadIps(ipsOffset + 50)}
                  >
                    Next
                  </button>
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
            <LoadingIndicatorComponent
              size="small"
              label="Loading visitors…"
              className="is-loading-centered-state"
            />
          ) : visitors.length === 0 ? (
            <div className={styles['empty-state']}>No visitor data available.</div>
          ) : filteredVisitors.length === 0 ? (
            <div className={styles['empty-state']}>No visitors match your search query.</div>
          ) : (
            <>
              {viewMode === "cards" ? (
                <div className={styles['card-list']}>
                  {filteredVisitors.map((visitor) => (
                    <div key={visitor.visitorId} className={styles['visitor-card']}>
                      <div className={styles['visitor-header']}>
                        <div className={styles['visitor-id']}>
                          <Users size={12} strokeWidth={2.2} />
                          {visitor.visitorId.slice(0, 12)}…
                        </div>
                        <span className={styles['visitor-session-count']}>
                          {visitor.sessionCount} session
                          {visitor.sessionCount !== 1 ? "s" : ""}
                        </span>
                      </div>

                      <div className={styles['visitor-meta']}>
                        {visitor.lastIp && (
                          <button
                            className={`${styles['visitor-meta-item']} ${styles['visitor-meta-link']}`}
                            onClick={() => loadIpDetail(visitor.lastIp)}
                          >
                            <Network size={11} strokeWidth={2} />
                            {visitor.lastIp}
                          </button>
                        )}
                        <span className={styles['visitor-meta-item']}>
                          <Globe size={11} strokeWidth={2} />
                          {visitor.lastBrowser?.name || "Unknown"}
                        </span>
                        <span className={styles['visitor-meta-item']}>
                          <Monitor size={11} strokeWidth={2} />
                          {visitor.lastOs?.name || "Unknown"}
                        </span>
                        <span className={styles['visitor-meta-item']}>
                          <DeviceIcon type={visitor.lastDevice?.type} />
                          {visitor.lastDevice?.type || "desktop"}
                        </span>
                        {visitor.lastGeo?.country && (
                          <span className={styles['visitor-meta-item']}>
                            <MapPin size={11} strokeWidth={2} />
                            {visitor.lastGeo.city && visitor.lastGeo.city !== "(not set)"
                              ? `${visitor.lastGeo.city}, `
                              : ""}
                            {visitor.lastGeo.country}
                          </span>
                        )}
                      </div>

                      <div className={styles['visitor-footer']}>
                        <span className={styles['visitor-time']}>
                          <Clock size={11} strokeWidth={2} />
                          {formatElapsedTime(visitor.totalDuration / 1000)} total
                        </span>
                        <span className={styles['visitor-seen']}>
                          Last seen {formatTimeAgo(visitor.lastSeen)}
                        </span>
                      </div>

                      <div className={styles['session-pills']}>
                        {visitor.sessionIds.slice(0, 5).map((sessionId) => (
                          <button
                            key={sessionId}
                            className={styles['session-pill']}
                            onClick={() => loadDetail(sessionId)}
                            title={sessionId}
                          >
                            {sessionId.slice(0, 8)}…
                          </button>
                        ))}
                        {visitor.sessionIds.length > 5 && (
                          <span className={styles['session-pill-more']}>
                            +{visitor.sessionIds.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <TableComponent<Visitor>
                  columns={visitorColumns}
                  data={filteredVisitors}
                  getRowKey={(visitorRecord: Visitor) => visitorRecord.visitorId}
                  emptyText="No visitors match your search query."
                  mini
                  storageKey="session-explorer-visitors"
                />
              )}

              {visitorsTotal > 50 && (
                <div className={styles['pagination']}>
                  <button
                    className={styles['page-button']}
                    disabled={visitorsOffset === 0}
                    onClick={() =>
                      loadVisitors(Math.max(0, visitorsOffset - 50))
                    }
                  >
                    Previous
                  </button>
                  <span className={styles['page-info']}>
                    {visitorsOffset + 1}–
                    {Math.min(visitorsOffset + 50, visitorsTotal)} of{" "}
                    {formatNumber(visitorsTotal)}
                  </span>
                  <button
                    className={styles['page-button']}
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
            <LoadingIndicatorComponent
              size="small"
              label="Loading sessions…"
              className="is-loading-centered-state"
            />
          ) : sessions.length === 0 ? (
            <div className={styles['empty-state']}>No session data available.</div>
          ) : filteredSessions.length === 0 ? (
            <div className={styles['empty-state']}>No sessions match your search query.</div>
          ) : (
            <>
              {viewMode === "table" ? (
                <TableComponent<SessionRow>
                  columns={sessionColumns}
                  data={filteredSessions}
                  getRowKey={(sessionRecord: SessionRow) => sessionRecord.sessionId}
                  onRowClick={(sessionRecord: SessionRow) => loadDetail(sessionRecord.sessionId)}
                  emptyText="No sessions match your search query."
                  mini
                  storageKey="session-explorer-sessions"
                />
              ) : (
                <div className={styles['card-list']}>
                  {filteredSessions.map((session) => (
                    <button
                      key={session.sessionId}
                      className={styles['visitor-card']}
                      onClick={() => loadDetail(session.sessionId)}
                    >
                      <div className={styles['visitor-header']}>
                        <div className={styles['visitor-id']}>
                          <Hash size={12} strokeWidth={2.2} />
                          {session.sessionId.slice(0, 12)}…
                        </div>
                        <span className={styles['visitor-session-count']}>
                          {formatElapsedTime(session.duration / 1000)}
                        </span>
                      </div>

                      <div className={styles['visitor-meta']}>
                        <span className={styles['visitor-meta-item']}>
                          <Network size={11} strokeWidth={2} />
                          {session.ip}
                        </span>
                        <span className={styles['visitor-meta-item']}>
                          <Globe size={11} strokeWidth={2} />
                          {session.browser?.name || "Unknown"}
                        </span>
                        <span className={styles['visitor-meta-item']}>
                          <Monitor size={11} strokeWidth={2} />
                          {session.os?.name || "Unknown"}
                        </span>
                        <span className={styles['visitor-meta-item']}>
                          <DeviceIcon type={session.device?.type} />
                          {session.device?.type || "desktop"}
                        </span>
                        {session.geo?.country && (
                          <span className={styles['visitor-meta-item']}>
                            <MapPin size={11} strokeWidth={2} />
                            {session.geo.city && session.geo.city !== "(not set)"
                              ? `${session.geo.city}, `
                              : ""}
                            {session.geo.country}
                          </span>
                        )}
                      </div>

                      <div className={styles['visitor-footer']}>
                        <span className={styles['visitor-time']}>
                          <Clock size={11} strokeWidth={2} />
                          {formatTimestamp(session.createdAt)}
                        </span>
                        <span className={styles['visitor-seen']}>
                          Active {formatTimeAgo(session.updatedAt)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {sessionsTotal > 50 && (
                <div className={styles['pagination']}>
                  <button
                    className={styles['page-button']}
                    disabled={sessionsOffset === 0}
                    onClick={() =>
                      loadSessions(Math.max(0, sessionsOffset - 50))
                    }
                  >
                    Previous
                  </button>
                  <span className={styles['page-info']}>
                    {sessionsOffset + 1}–
                    {Math.min(sessionsOffset + 50, sessionsTotal)} of{" "}
                    {formatNumber(sessionsTotal)}
                  </span>
                  <button
                    className={styles['page-button']}
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
