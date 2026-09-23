"use client";

import { Clock, Globe, Hash, MapPin, Monitor, Network, Users } from "lucide-react";
import { timeAgo } from "@rodrigo-barraza/utilities-library";
import { BotTag, DeviceIcon } from "./ExplorerPrimitives";
import {
  formatCount,
  formatDurationMs,
  formatLocation,
  formatTimestamp,
  shortId,
} from "./analyticsFormat";
import type { DeviceInfo, ExplorerSession, GeoInfo, IpUser, NamedVersion, Visitor } from "./explorerModel";
import styles from "../SessionExplorerComponent.module.css";

/**
 * Card-view rows of the session explorer. IP and session cards are single
 * buttons (their whole surface opens the detail), so their insides are
 * spans — block elements aren't valid inside a <button>. A visitor has no
 * detail view, so its card is a plain container holding its own buttons.
 */

/** Session pills shown on a visitor card before "+N more". */
const VISITOR_SESSION_PILLS = 5;

function ClientMeta({
  browser,
  os,
  device,
  geo,
}: {
  browser: NamedVersion | null | undefined;
  os: NamedVersion | null | undefined;
  device: DeviceInfo | null | undefined;
  geo: GeoInfo | null | undefined;
}) {
  return (
    <>
      <span className={styles["visitor-meta-item"]}>
        <Globe size={11} strokeWidth={2} aria-hidden />
        {browser?.name || "Unknown"}
      </span>
      <span className={styles["visitor-meta-item"]}>
        <Monitor size={11} strokeWidth={2} aria-hidden />
        {os?.name || "Unknown"}
      </span>
      <span className={styles["visitor-meta-item"]}>
        <DeviceIcon type={device?.type} />
        {device?.type || "desktop"}
      </span>
      {geo?.country && (
        <span className={styles["visitor-meta-item"]}>
          <MapPin size={11} strokeWidth={2} aria-hidden />
          {formatLocation(geo)}
        </span>
      )}
    </>
  );
}

export function IpCard({ ipUser, onOpen }: { ipUser: IpUser; onOpen: (ip: string) => void }) {
  return (
    <button type="button" className={styles["visitor-card"]} onClick={() => onOpen(ipUser.ip)}>
      <span className={styles["visitor-header"]}>
        <span className={styles["visitor-id"]}>
          <Network size={12} strokeWidth={2.2} aria-hidden />
          {ipUser.ip}
        </span>
        <span className={styles["visitor-session-count"]}>
          {formatCount(ipUser.sessionCount, "session")}
        </span>
      </span>

      <span className={styles["visitor-meta"]}>
        {ipUser.visitorIds.length > 0 && (
          <span className={styles["visitor-meta-item"]}>
            <Users size={11} strokeWidth={2} aria-hidden />
            {formatCount(ipUser.visitorIds.length, "visitor")}
          </span>
        )}
        <ClientMeta
          browser={ipUser.lastBrowser}
          os={ipUser.lastOs}
          device={ipUser.lastDevice}
          geo={ipUser.lastGeo}
        />
      </span>

      <span className={styles["visitor-footer"]}>
        <span className={styles["visitor-time"]}>
          <Clock size={11} strokeWidth={2} aria-hidden />
          {formatDurationMs(ipUser.totalDuration)} total
        </span>
        <span className={styles["visitor-seen"]}>Last seen {timeAgo(ipUser.lastSeen)}</span>
      </span>
    </button>
  );
}

export function VisitorCard({
  visitor,
  onOpenIp,
  onOpenSession,
}: {
  visitor: Visitor;
  onOpenIp: (ip: string) => void;
  onOpenSession: (sessionId: string) => void;
}) {
  const shownSessionIds = visitor.sessionIds.slice(0, VISITOR_SESSION_PILLS);
  // sessionIds is capped server-side (newest 20); sessionCount is the total
  const hiddenSessions = Math.max(visitor.sessionCount - shownSessionIds.length, 0);

  return (
    <div className={styles["visitor-card"]}>
      <div className={styles["visitor-header"]}>
        <div className={styles["visitor-id"]} title={visitor.visitorId}>
          <Users size={12} strokeWidth={2.2} aria-hidden />
          {shortId(visitor.visitorId, 12)}
        </div>
        <span className={styles["visitor-session-count"]}>
          {formatCount(visitor.sessionCount, "session")}
        </span>
      </div>

      <div className={styles["visitor-meta"]}>
        {visitor.lastIp && (
          <button
            type="button"
            className={`${styles["visitor-meta-item"]} ${styles["visitor-meta-link"]}`}
            onClick={() => onOpenIp(visitor.lastIp!)}
            aria-label={`Open IP ${visitor.lastIp}`}
          >
            <Network size={11} strokeWidth={2} aria-hidden />
            {visitor.lastIp}
          </button>
        )}
        <ClientMeta
          browser={visitor.lastBrowser}
          os={visitor.lastOs}
          device={visitor.lastDevice}
          geo={visitor.lastGeo}
        />
      </div>

      <div className={styles["visitor-footer"]}>
        <span className={styles["visitor-time"]}>
          <Clock size={11} strokeWidth={2} aria-hidden />
          {formatDurationMs(visitor.totalDuration)} total
        </span>
        <span className={styles["visitor-seen"]}>Last seen {timeAgo(visitor.lastSeen)}</span>
      </div>

      <div className={styles["session-pills"]}>
        {shownSessionIds.map((sessionId) => (
          <button
            type="button"
            key={sessionId}
            className={styles["session-pill"]}
            onClick={() => onOpenSession(sessionId)}
            title={sessionId}
            aria-label={`Open session ${sessionId}`}
          >
            {shortId(sessionId, 8)}
          </button>
        ))}
        {hiddenSessions > 0 && (
          <span className={styles["session-pill-more"]}>+{hiddenSessions} more</span>
        )}
      </div>
    </div>
  );
}

export function SessionCard({
  session,
  onOpen,
}: {
  session: ExplorerSession;
  onOpen: (sessionId: string) => void;
}) {
  return (
    <button
      type="button"
      className={styles["visitor-card"]}
      onClick={() => onOpen(session.sessionId)}
    >
      <span className={styles["visitor-header"]}>
        <span className={styles["visitor-id"]} title={session.sessionId}>
          <Hash size={12} strokeWidth={2.2} aria-hidden />
          {shortId(session.sessionId, 12)}
          {session.isBot && <BotTag />}
        </span>
        <span className={styles["visitor-session-count"]}>
          {formatDurationMs(session.duration)}
        </span>
      </span>

      <span className={styles["visitor-meta"]}>
        <span className={styles["visitor-meta-item"]}>
          <Network size={11} strokeWidth={2} aria-hidden />
          {session.ip}
        </span>
        <ClientMeta
          browser={session.browser}
          os={session.os}
          device={session.device}
          geo={session.geo}
        />
      </span>

      <span className={styles["visitor-footer"]}>
        <span className={styles["visitor-time"]}>
          <Clock size={11} strokeWidth={2} aria-hidden />
          {formatTimestamp(session.createdAt)}
        </span>
        <span className={styles["visitor-seen"]}>Active {timeAgo(session.updatedAt)}</span>
      </span>
    </button>
  );
}
