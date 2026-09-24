"use client";

// ============================================================
// SessionReplayComponent — rrweb session-replay player
// ============================================================
// Fetches the ordered rrweb event stream for one session and mounts the
// rrweb-player (scrubber + play/pause) into a ref'd container.
//
// SessionDetailComponent loads this module through next/dynamic, so the
// player stylesheet imported here — and the player itself, imported on
// demand below — ship in a separate chunk fetched only when a session
// with a recording is opened.
// ============================================================

import { useEffect, useRef, useState } from "react";
import "rrweb-player/dist/style.css";
import { LoadingIndicatorComponent } from "@rodrigo-barraza/components-library";
import { Film } from "lucide-react";
import ApiService from "../services/ApiService";
import { unwrapData } from "./analytics/useAsyncData";
import { formatCount } from "./analytics/analyticsFormat";
import styles from "./SessionReplayComponent.module.css";

/** The slice of rrweb-player's Svelte component this component drives. */
interface ReplayPlayer {
  $destroy: () => void;
  getReplayer: () => { destroy: () => void };
}

type ReplayStatus = "loading" | "ready" | "empty" | "error";

const FALLBACK_PLAYER_WIDTH = 900;

/**
 * Tear down a player completely. The Svelte `$destroy` only pauses the
 * replayer via its controller; `Replayer.destroy()` also resets its
 * mirrors and removes the replay iframe and listeners.
 */
function destroyPlayer(player: ReplayPlayer | null) {
  if (!player) return;
  try {
    player.getReplayer().destroy();
  } catch {
    // Already torn down
  }
  try {
    player.$destroy();
  } catch {
    // Teardown is best-effort
  }
}

export default function SessionReplayComponent({
  sessionId,
}: {
  sessionId: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<{
    sessionId: string;
    state: ReplayStatus;
  } | null>(null);
  const [recording, setRecording] = useState<{
    eventCount: number;
    returnedChunks: number;
    totalChunks: number;
    truncated: boolean;
  } | null>(null);

  // Derived, so a new sessionId reads as loading in the same render
  const replayStatus: ReplayStatus =
    status?.sessionId === sessionId ? status.state : "loading";

  useEffect(() => {
    let cancelled = false;
    let player: ReplayPlayer | null = null;
    // A new session (or leaving) cancels the replay download, which can be large
    const controller = new AbortController();
    const settle = (state: ReplayStatus) => {
      if (!cancelled) setStatus({ sessionId, state });
    };

    (async () => {
      try {
        const replay = unwrapData(
          await ApiService.getSessionReplay(sessionId, {
            signal: controller.signal,
          }),
        );
        if (cancelled) return;
        const { events } = replay;

        // rrweb needs at least a full snapshot plus one incremental event.
        if (events.length < 2) return settle("empty");

        const { default: RrwebPlayer } = await import("rrweb-player");
        const target = containerRef.current;
        if (cancelled) return;
        if (!target) return settle("error");
        target.replaceChildren();

        player = new RrwebPlayer({
          target,
          props: {
            // Recorded by @rrweb/record; the service stores them verbatim
            events: events as ConstructorParameters<
              typeof RrwebPlayer
            >[0]["props"]["events"],
            width: target.clientWidth || FALLBACK_PLAYER_WIDTH,
            autoPlay: false,
            showController: true,
            skipInactive: true,
          },
        }) as unknown as ReplayPlayer;
        setRecording({
          eventCount: events.length,
          returnedChunks: replay.returnedChunks,
          totalChunks: replay.totalChunks,
          truncated: replay.truncated,
        });
        settle("ready");
      } catch {
        settle("error");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      destroyPlayer(player);
      player = null;
    };
  }, [sessionId]);

  return (
    <section className={styles["replay-section"]} aria-label="Session replay">
      <div className={styles["replay-header"]}>
        <Film size={14} strokeWidth={2.2} aria-hidden />
        <span>Session Replay</span>
        {replayStatus === "ready" && recording && (
          <span className={styles["replay-count"]}>
            {formatCount(recording.eventCount, "event")}
          </span>
        )}
      </div>

      {replayStatus === "ready" && recording?.truncated && (
        <div className={styles["replay-note"]} role="note">
          Recording cut short at the per-session storage budget — playing the
          first {formatCount(recording.returnedChunks, "chunk")} of{" "}
          {recording.totalChunks}.
        </div>
      )}

      {replayStatus === "loading" && (
        <LoadingIndicatorComponent size="small" label="Loading recording…" />
      )}
      {replayStatus === "empty" && (
        <div className={styles["replay-message"]}>
          No recording was captured for this session.
        </div>
      )}
      {replayStatus === "error" && (
        <div className={styles["replay-message"]} role="alert">
          Could not load the recording.
        </div>
      )}

      <div
        ref={containerRef}
        className={styles["replay-canvas"]}
        data-active={replayStatus === "ready"}
      />
    </section>
  );
}
