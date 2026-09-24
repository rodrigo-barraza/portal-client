"use client";

import { useMemo } from "react";
import { ArrowDownToLine, Clock, Eye, Route, Zap } from "lucide-react";
import {
  formatCount,
  formatDurationMs,
  formatScrollDepth,
  formatTimestamp,
  joinMeta,
} from "./analyticsFormat";
import { buildJourney, eventProps, journeyKey } from "./explorerModel";
import type { SessionEvent, SessionView } from "@/types/portal";
import styles from "../SessionExplorerComponent.module.css";

/** Props shown on an event row before the rest are cut. */
const EVENT_PROP_LIMIT = 8;

/**
 * One session's journey: its pageviews in order — each with its engaged
 * time and how far it was scrolled — with events interleaved by time.
 */
export default function SessionJourneyComponent({
  views,
  events,
}: {
  views: SessionView[];
  events: SessionEvent[];
}) {
  const journey = useMemo(() => buildJourney(views, events), [views, events]);

  if (journey.length === 0) {
    return (
      <div className={styles["empty-timeline"]}>No pageviews recorded.</div>
    );
  }

  return (
    <section className={styles["timeline-section"]} aria-label="Journey">
      <div className={styles["timeline-header"]}>
        <Route size={14} strokeWidth={2.2} aria-hidden />
        <span>Journey</span>
        <span className={styles["timeline-count"]}>
          {joinMeta(
            formatCount(views.length, "page"),
            events.length > 0 && formatCount(events.length, "event"),
          )}
        </span>
      </div>
      <ol className={styles["timeline"]}>
        {journey.map((entry, index) => {
          const isView = entry.kind === "view";
          return (
            <li
              key={journeyKey(entry, index)}
              className={`${styles["timeline-item"]} ${isView ? styles["timeline-pageview"] : styles["timeline-event"]}`}
            >
              <div className={styles["timeline-dot"]} aria-hidden>
                {isView ? (
                  <Eye size={10} strokeWidth={2.5} />
                ) : (
                  <Zap size={10} strokeWidth={2.5} />
                )}
              </div>
              <div className={styles["timeline-connector"]} aria-hidden />
              <div className={styles["timeline-content"]}>
                <div className={styles["timeline-row"]}>
                  <span className={styles["timeline-type"]}>
                    {isView ? `Page ${entry.step}` : "Event"}
                  </span>
                  <time className={styles["timeline-time"]} dateTime={entry.at}>
                    {formatTimestamp(entry.at)}
                  </time>
                </div>
                {entry.kind === "view" ? (
                  <>
                    <span className={styles["timeline-detail"]}>
                      {entry.view.path}
                      {entry.view.title && (
                        <span className={styles["timeline-title"]}>
                          {" "}
                          — {entry.view.title}
                        </span>
                      )}
                    </span>
                    <span className={styles["timeline-stats"]}>
                      <span
                        className={styles["timeline-stat"]}
                        title="Engaged time on this page"
                      >
                        <Clock size={11} strokeWidth={2} aria-hidden />
                        {formatDurationMs(entry.view.engagedMs)} engaged
                      </span>
                      <span
                        className={styles["timeline-stat"]}
                        title="Deepest scroll on this page"
                      >
                        <ArrowDownToLine
                          size={11}
                          strokeWidth={2}
                          aria-hidden
                        />
                        {formatScrollDepth(entry.view.scroll)} scrolled
                      </span>
                    </span>
                  </>
                ) : (
                  <EventDetail event={entry.event} />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function EventDetail({ event }: { event: SessionEvent }) {
  const props = eventProps(event);
  return (
    <>
      <span className={styles["timeline-detail"]}>
        {event.name}
        {event.path && (
          <span className={styles["timeline-title"]}> on {event.path}</span>
        )}
      </span>
      {props.length > 0 && (
        <span className={styles["timeline-props"]}>
          {props.slice(0, EVENT_PROP_LIMIT).map(([key, value]) => (
            <span key={key} className={styles["prop-tag"]}>
              <span className={styles["prop-key"]}>{key}</span>
              <span className={styles["prop-value"]}>{value}</span>
            </span>
          ))}
          {props.length > EVENT_PROP_LIMIT && (
            <span className={styles["timeline-title"]}>
              +{props.length - EVENT_PROP_LIMIT} more
            </span>
          )}
        </span>
      )}
    </>
  );
}
