"use client";

import dynamic from "next/dynamic";
import { ButtonComponent } from "@rodrigo-barraza/components-library";
import {
  Activity,
  Clock,
  Compass,
  Eye,
  FileText,
  Network,
  UserRound,
  Users,
} from "lucide-react";
import { timeAgo } from "@rodrigo-barraza/utilities-library";
import ApiService from "../../services/ApiService";
import useAsyncData, { unwrapData } from "./useAsyncData";
import {
  DeviceIcon,
  ExplorerLoading,
  MetaCard,
  MetaValue,
  StateMessage,
} from "./ExplorerPrimitives";
import SessionJourneyComponent from "./SessionJourneyComponent";
import {
  countryFlag,
  countryName,
  formatCount,
  formatDurationMs,
  formatTimestamp,
  joinMeta,
  readableErrorMessage,
  shortId,
} from "./analyticsFormat";
import type { SessionDetail, SessionFilters } from "@/types/portal";
import styles from "../SessionExplorerComponent.module.css";

/**
 * rrweb-player (a ~485 KB unminified module, plus its stylesheet) only
 * matters for sessions with a recording — split it out of the analytics
 * bundle and load it when a recorded session is actually opened.
 */
const SessionReplayComponent = dynamic(
  () => import("../SessionReplayComponent"),
  {
    ssr: false,
    loading: () => <ExplorerLoading label="Loading replay player…" />,
  },
);

/** "Chrome 140" — the version only when the name is known. */
function withVersion(name: string | null, version: string | null): string {
  if (!name) return "Unknown";
  return version ? `${name} ${version}` : name;
}

/**
 * One session: what it did (summary, journey, replay), who it was (IP,
 * user, visitor), how it arrived (source/medium/campaign) and on what
 * (device, browser, OS, screen). From here the explorer can list every
 * session of this visitor, IP or user.
 */
export default function SessionDetailComponent({
  sessionId,
  onShowSessions,
}: {
  sessionId: string;
  /** List every session matching these filters (all time). */
  onShowSessions: (filters: SessionFilters) => void;
}) {
  const detail = useAsyncData(sessionId, (signal) =>
    ApiService.getSessionDetail(sessionId, { signal }).then(unwrapData),
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

  return (
    <>
      <SessionSummaryBar session={session} />

      <div className={styles["detail-links"]}>
        <ButtonComponent
          variant="text"
          size="small"
          icon={Users}
          onClick={() => onShowSessions({ visitorId: session.visitorId })}
        >
          {`All sessions from this visitor (${session.visitor.sessions})`}
        </ButtonComponent>
        {session.ip && (
          <ButtonComponent
            variant="text"
            size="small"
            icon={Network}
            onClick={() => onShowSessions({ ip: session.ip! })}
          >
            All sessions from this IP
          </ButtonComponent>
        )}
        {session.userId && (
          <ButtonComponent
            variant="text"
            size="small"
            icon={UserRound}
            onClick={() => onShowSessions({ userId: session.userId! })}
          >
            All sessions from this user
          </ButtonComponent>
        )}
      </div>

      <SessionMetaGrid session={session} />

      {session.replay && (
        <SessionReplayComponent sessionId={session.sessionId} />
      )}

      <SessionJourneyComponent views={session.views} events={session.events} />

      <div className={styles["user-agent-bar"]}>
        <FileText size={12} strokeWidth={2} aria-hidden />
        <span>
          <span className={styles["meta-label"]}>User agent </span>
          {session.userAgent || "—"}
        </span>
      </div>
    </>
  );
}

function SessionSummaryBar({ session }: { session: SessionDetail }) {
  return (
    <div className={styles["detail-summary-bar"]}>
      <span className={styles["detail-summary-stat"]}>
        <Eye size={13} strokeWidth={2} aria-hidden />
        {formatCount(session.pageviews, "page")}
      </span>
      <span className={styles["detail-summary-stat"]}>
        <Clock size={13} strokeWidth={2} aria-hidden />
        {formatDurationMs(session.engagedMs)} engaged
      </span>
      <span className={styles["detail-summary-stat"]}>
        <Activity size={13} strokeWidth={2} aria-hidden />
        {session.isEngaged ? "Engaged session" : "Not engaged (bounce)"}
      </span>
      <span className={styles["detail-summary-stat"]}>
        <Compass size={13} strokeWidth={2} aria-hidden />
        {session.channel}
      </span>
    </div>
  );
}

function SessionMetaGrid({ session }: { session: SessionDetail }) {
  const place = [session.city, session.region, countryName(session.country)]
    .filter(Boolean)
    .join(", ");
  const hasCampaign = session.campaign || session.term || session.content;

  return (
    <div className={styles["meta-grid"]}>
      <MetaCard label="IP Address" highlight>
        <MetaValue>{session.ip ?? "Unknown"}</MetaValue>
      </MetaCard>
      {session.userId && (
        <MetaCard label="User" highlight>
          <MetaValue>{session.userId}</MetaValue>
        </MetaCard>
      )}
      <MetaCard
        label="Visitor"
        sub={joinMeta(
          session.sessionNumber > 1
            ? `returning · session #${session.sessionNumber} of ${session.visitor.sessions}`
            : `new · ${formatCount(session.visitor.sessions, "session")} so far`,
          `first seen ${formatTimestamp(session.visitor.firstSeenAt)}`,
        )}
      >
        <MetaValue>
          <span title={session.visitorId}>
            {shortId(session.visitorId, 16)}
          </span>
        </MetaValue>
      </MetaCard>
      <MetaCard label="Location">
        <MetaValue>
          {place
            ? `${countryFlag(session.country)} ${place}`.trim()
            : "Unknown"}
        </MetaValue>
      </MetaCard>
      <MetaCard label="Device">
        <MetaValue>
          <DeviceIcon type={session.device} />
          {session.device}
        </MetaValue>
      </MetaCard>
      <MetaCard label="Browser">
        <MetaValue>
          {withVersion(session.browser, session.browserVersion)}
        </MetaValue>
      </MetaCard>
      <MetaCard label="OS">
        <MetaValue>{withVersion(session.os, session.osVersion)}</MetaValue>
      </MetaCard>
      <MetaCard
        label="Screen / Viewport"
        sub={session.viewport ? `viewport ${session.viewport}` : undefined}
      >
        <MetaValue>{session.screen ?? "—"}</MetaValue>
      </MetaCard>
      <MetaCard label="Language">
        <MetaValue>{session.language ?? "—"}</MetaValue>
      </MetaCard>
      <MetaCard label="Timezone">
        <MetaValue>{session.timezone ?? "—"}</MetaValue>
      </MetaCard>
      <MetaCard
        label="Source / Medium"
        sub={joinMeta(
          session.channel,
          session.clickId && `via ${session.clickId}`,
        )}
      >
        <MetaValue>
          {`${session.source ?? "(direct)"} / ${session.medium ?? "(none)"}`}
        </MetaValue>
      </MetaCard>
      {hasCampaign && (
        <MetaCard
          label="Campaign"
          sub={joinMeta(
            session.term && `term ${session.term}`,
            session.content && `content ${session.content}`,
          )}
        >
          <MetaValue>{session.campaign ?? "—"}</MetaValue>
        </MetaCard>
      )}
      {session.referrer && (
        <MetaCard label="Referrer">
          <MetaValue>{session.referrer}</MetaValue>
        </MetaCard>
      )}
      <MetaCard label="Host">
        <MetaValue>{session.hostname}</MetaValue>
      </MetaCard>
      <MetaCard label="Started">
        <MetaValue>{formatTimestamp(session.startedAt)}</MetaValue>
      </MetaCard>
      <MetaCard label="Last Seen" sub={timeAgo(session.lastSeenAt)}>
        <MetaValue>{formatTimestamp(session.lastSeenAt)}</MetaValue>
      </MetaCard>
    </div>
  );
}
