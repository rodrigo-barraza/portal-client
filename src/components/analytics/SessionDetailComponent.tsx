"use client";

import dynamic from "next/dynamic";
import { ChevronRight, FileText } from "lucide-react";
import ApiService from "../../services/ApiService";
import useAsyncData, { unwrapData } from "./useAsyncData";
import {
  BotTag,
  DeviceIcon,
  ExplorerLoading,
  MetaCard,
  MetaValue,
  StateMessage,
} from "./ExplorerPrimitives";
import SessionTimelineComponent from "./SessionTimelineComponent";
import {
  formatDurationMs,
  formatLocation,
  formatTimestamp,
  readableErrorMessage,
  shortId,
} from "./analyticsFormat";
import type { SessionDetail } from "./explorerModel";
import styles from "../SessionExplorerComponent.module.css";

/**
 * rrweb-player (a ~485 KB unminified module, plus its stylesheet) only
 * matters for sessions with a recording — split it out of the analytics
 * bundle and load it when a recorded session is actually opened.
 */
const SessionReplayComponent = dynamic(() => import("../SessionReplayComponent"), {
  ssr: false,
  loading: () => <ExplorerLoading label="Loading replay player…" />,
});

/**
 * One session: client/geo metadata (IP opens that IP's profile), UTM tags,
 * the replay player when a recording exists, the timeline, and the raw UA.
 */
export default function SessionDetailComponent({
  sessionId,
  onOpenIp,
}: {
  sessionId: string;
  onOpenIp: (ip: string) => void;
}) {
  const detail = useAsyncData(sessionId, () =>
    ApiService.getSessionDetail(sessionId).then(unwrapData<SessionDetail>),
  );
  const session = detail.data;

  if (detail.loading) return <ExplorerLoading label="Loading session…" />;
  if (detail.error || !session) {
    const message = readableErrorMessage(detail.error);
    return (
      <StateMessage isError>
        Could not load this session{message ? `: ${message}` : "."}
      </StateMessage>
    );
  }

  const utmEntries = Object.entries(session.utm ?? {});

  return (
    <>
      <div className={styles["meta-grid"]}>
        <MetaCard label="IP Address" highlight>
          <button
            type="button"
            className={styles["meta-value-link"]}
            onClick={() => onOpenIp(session.ip)}
            aria-label={`Open IP ${session.ip}`}
          >
            {session.ip}
            <ChevronRight size={12} strokeWidth={2.2} aria-hidden />
          </button>
        </MetaCard>
        {session.userId && (
          <MetaCard label="User">
            <MetaValue>{session.userId}</MetaValue>
          </MetaCard>
        )}
        <MetaCard label="Visitor ID">
          <MetaValue>
            <span title={session.visitorId ?? undefined}>{shortId(session.visitorId, 16)}</span>
          </MetaValue>
        </MetaCard>
        <MetaCard label="Duration">
          <MetaValue>{formatDurationMs(session.duration)}</MetaValue>
        </MetaCard>
        <MetaCard label="Browser">
          <MetaValue>
            {session.browser?.name || "Unknown"} {session.browser?.version || ""}
          </MetaValue>
        </MetaCard>
        <MetaCard label="OS">
          <MetaValue>
            {session.os?.name || "Unknown"} {session.os?.version || ""}
          </MetaValue>
        </MetaCard>
        <MetaCard label="Device">
          <MetaValue>
            <DeviceIcon type={session.device?.type} />
            {session.device?.type || "desktop"}
            {session.device?.vendor ? ` · ${session.device.vendor}` : ""}
            {session.isBot && <BotTag />}
          </MetaValue>
        </MetaCard>
        <MetaCard label="Location">
          <MetaValue>{formatLocation(session.geo, "Unknown")}</MetaValue>
        </MetaCard>
        <MetaCard label="Viewport">
          <MetaValue>
            {session.viewport ? `${session.viewport.width} × ${session.viewport.height}` : "N/A"}
          </MetaValue>
        </MetaCard>
        {session.referrer && (
          <MetaCard label="Referrer">
            <MetaValue>{session.referrer}</MetaValue>
          </MetaCard>
        )}
        <MetaCard label="Started">
          <MetaValue>{formatTimestamp(session.createdAt)}</MetaValue>
        </MetaCard>
        <MetaCard label="Last Active">
          <MetaValue>{formatTimestamp(session.updatedAt)}</MetaValue>
        </MetaCard>
        {session.locale && (
          <MetaCard label="Locale">
            <MetaValue>{session.locale}</MetaValue>
          </MetaCard>
        )}
      </div>

      {utmEntries.length > 0 && (
        <div className={styles["utm-bar"]}>
          {utmEntries.map(([key, value]) => (
            <span key={key} className={styles["utm-tag"]}>
              <span className={styles["utm-key"]}>{key}</span>
              <span className={styles["utm-value"]}>{value}</span>
            </span>
          ))}
        </div>
      )}

      {session.hasReplay && <SessionReplayComponent sessionId={session.sessionId} />}

      <SessionTimelineComponent timeline={session.timeline} />

      {session.userAgent && (
        <div className={styles["user-agent-bar"]}>
          <FileText size={12} strokeWidth={2} aria-hidden />
          <span>{session.userAgent}</span>
        </div>
      )}
    </>
  );
}
