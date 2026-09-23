"use client";

import { useMemo } from "react";
import { Clock, Globe, Hash, Users } from "lucide-react";
import ApiService from "../../services/ApiService";
import useAsyncData, { unwrapData } from "./useAsyncData";
import {
  DeviceIcon,
  ExplorerLoading,
  LinkedSection,
  MetaCard,
  MetaValue,
  StateMessage,
} from "./ExplorerPrimitives";
import SessionTimelineComponent from "./SessionTimelineComponent";
import {
  formatCount,
  formatDurationMs,
  formatLocation,
  formatTimestamp,
  readableErrorMessage,
  shortId,
} from "./analyticsFormat";
import { ipFingerprint, ipLastSeen, ipTimeline, type IpDetail } from "./explorerModel";
import styles from "../SessionExplorerComponent.module.css";

/** Session pills listed on an IP profile before "+N more". */
const IP_SESSION_PILLS = 20;

/**
 * One IP's profile: summary, last-seen client, linked visitor ids, its
 * sessions (click to open), and the cross-session timeline.
 */
export default function IpDetailComponent({
  ip,
  projectId,
  period,
  onOpenSession,
}: {
  ip: string;
  projectId: string;
  period: string;
  onOpenSession: (sessionId: string) => void;
}) {
  const detail = useAsyncData(`${ip}|${projectId}|${period}`, () =>
    ApiService.getSessionIpDetail(ip, projectId, period).then(unwrapData<IpDetail>),
  );
  const profile = detail.data;
  const timeline = useMemo(() => (profile ? ipTimeline(profile) : []), [profile]);

  if (detail.loading) return <ExplorerLoading label="Loading IP profile…" />;
  if (detail.error || !profile) {
    const message = readableErrorMessage(detail.error);
    return (
      <StateMessage isError>
        Could not load this IP profile{message ? `: ${message}` : "."}
      </StateMessage>
    );
  }

  const fingerprint = ipFingerprint(profile);
  const sessions = profile.sessions ?? [];
  const visitorIds = profile.visitorIds ?? [];

  return (
    <>
      <div className={styles["ip-address-summary-bar"]}>
        <div className={styles["ip-address-summary-stat"]}>
          <Hash size={12} strokeWidth={2} aria-hidden />
          <span>{formatCount(profile.sessionCount, "session")}</span>
        </div>
        <div className={styles["ip-address-summary-stat"]}>
          <Users size={12} strokeWidth={2} aria-hidden />
          <span>{formatCount(visitorIds.length, "visitor ID")}</span>
        </div>
        <div className={styles["ip-address-summary-stat"]}>
          <Clock size={12} strokeWidth={2} aria-hidden />
          <span>{formatDurationMs(profile.totalDuration)} total</span>
        </div>
        {profile.projects && profile.projects.length > 1 && (
          <div className={styles["ip-address-summary-stat"]}>
            <Globe size={12} strokeWidth={2} aria-hidden />
            <span>{formatCount(profile.projects.length, "project")}</span>
          </div>
        )}
      </div>

      <div className={styles["meta-grid"]}>
        <MetaCard label="IP Address">
          <MetaValue>{profile.ip}</MetaValue>
        </MetaCard>
        <MetaCard label="Browser">
          <MetaValue>
            {profile.lastBrowser?.name || "Unknown"} {profile.lastBrowser?.version || ""}
          </MetaValue>
        </MetaCard>
        <MetaCard label="OS">
          <MetaValue>
            {profile.lastOs?.name || "Unknown"} {profile.lastOs?.version || ""}
          </MetaValue>
        </MetaCard>
        <MetaCard label="Device">
          <MetaValue>
            <DeviceIcon type={profile.lastDevice?.type} />
            {profile.lastDevice?.type || "desktop"}
          </MetaValue>
        </MetaCard>
        <MetaCard label="Location">
          <MetaValue>{formatLocation(profile.lastGeo, "Unknown")}</MetaValue>
        </MetaCard>
        <MetaCard label="First Seen">
          <MetaValue>{formatTimestamp(profile.firstSeen)}</MetaValue>
        </MetaCard>
        <MetaCard label="Last Seen">
          <MetaValue>{formatTimestamp(ipLastSeen(profile))}</MetaValue>
        </MetaCard>
        {fingerprint && (
          <MetaCard label="Fingerprint">
            <MetaValue>
              <span title={fingerprint}>{shortId(fingerprint, 16)}</span>
            </MetaValue>
          </MetaCard>
        )}
      </div>

      {visitorIds.length > 0 && (
        <LinkedSection
          icon={<Users size={13} strokeWidth={2.2} aria-hidden />}
          title="Linked Visitor IDs"
          count={visitorIds.length}
        >
          {visitorIds.map((visitorId) => (
            <span key={visitorId} className={styles["visitor-pill"]} title={visitorId}>
              {shortId(visitorId, 12)}
            </span>
          ))}
        </LinkedSection>
      )}

      {sessions.length > 0 && (
        <LinkedSection
          icon={<Clock size={13} strokeWidth={2.2} aria-hidden />}
          title="Sessions"
          count={sessions.length}
        >
          {sessions.slice(0, IP_SESSION_PILLS).map((session) => (
            <button
              type="button"
              key={session.sessionId}
              className={styles["session-pill"]}
              onClick={() => onOpenSession(session.sessionId)}
              title={`${session.sessionId} · ${formatDurationMs(session.duration)} · ${session.browser?.name || "?"}`}
              aria-label={`Open session ${session.sessionId}`}
            >
              {shortId(session.sessionId, 8)}
              <span className={styles["pill-duration"]}>{formatDurationMs(session.duration)}</span>
            </button>
          ))}
          {sessions.length > IP_SESSION_PILLS && (
            <span className={styles["session-pill-more"]}>
              +{sessions.length - IP_SESSION_PILLS} more
            </span>
          )}
        </LinkedSection>
      )}

      <SessionTimelineComponent timeline={timeline} label="Cross-Session Timeline" />
    </>
  );
}
