"use client";

import { ChevronRight, Clock, Eye, Zap } from "lucide-react";
import { formatCount, formatTimestamp, shortId } from "./analyticsFormat";
import { timelineKey, type TimelineEntry } from "./explorerModel";
import styles from "../SessionExplorerComponent.module.css";

/**
 * Chronological page views + events for one session, or across every
 * session of an IP (then each row carries its session's tag).
 */
export default function SessionTimelineComponent({
  timeline,
  label = "Activity Timeline",
}: {
  timeline: TimelineEntry[] | null | undefined;
  label?: string;
}) {
  if (!timeline || timeline.length === 0) {
    return <div className={styles["empty-timeline"]}>No activity recorded.</div>;
  }

  return (
    <section className={styles["timeline-section"]} aria-label={label}>
      <div className={styles["timeline-header"]}>
        <Clock size={14} strokeWidth={2.2} aria-hidden />
        <span>{label}</span>
        <span className={styles["timeline-count"]}>{formatCount(timeline.length, "event")}</span>
      </div>
      <ol className={styles["timeline"]}>
        {timeline.map((entry, index) => {
          const isPageView = entry.type === "pageview";
          return (
            <li
              key={timelineKey(entry, index)}
              className={`${styles["timeline-item"]} ${isPageView ? styles["timeline-pageview"] : styles["timeline-event"]}`}
            >
              <div className={styles["timeline-dot"]} aria-hidden>
                {isPageView ? (
                  <Eye size={10} strokeWidth={2.5} />
                ) : (
                  <Zap size={10} strokeWidth={2.5} />
                )}
              </div>
              <div className={styles["timeline-connector"]} aria-hidden />
              <div className={styles["timeline-content"]}>
                <div className={styles["timeline-row"]}>
                  <span className={styles["timeline-type"]}>
                    {isPageView ? "Page View" : "Event"}
                  </span>
                  {entry.sessionId && (
                    <span className={styles["timeline-session-tag"]} title={entry.sessionId}>
                      {shortId(entry.sessionId, 6)}
                    </span>
                  )}
                  <time className={styles["timeline-time"]} dateTime={entry.timestamp}>
                    {formatTimestamp(entry.timestamp)}
                  </time>
                </div>
                {isPageView ? (
                  <span className={styles["timeline-detail"]}>
                    {entry.path || entry.url}
                    {entry.title && (
                      <span className={styles["timeline-title"]}> — {entry.title}</span>
                    )}
                  </span>
                ) : (
                  <span className={styles["timeline-detail"]}>
                    <span className={styles["timeline-category"]}>{entry.category}</span>
                    <ChevronRight size={10} strokeWidth={2.5} aria-hidden />
                    <span className={styles["timeline-action"]}>{entry.action}</span>
                    {entry.label && (
                      <span className={styles["timeline-label"]}> · {entry.label}</span>
                    )}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
