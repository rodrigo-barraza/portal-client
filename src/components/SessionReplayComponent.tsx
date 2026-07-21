"use client";

// ============================================================
// SessionReplayComponent — rrweb session-replay player
// ============================================================
// Fetches the ordered rrweb event stream for one session and mounts the
// rrweb-player (scrubber + play/pause) into a ref'd container. Both the player
// module and its styles load only when a session with a recording is opened.
// ============================================================

import { useEffect, useRef, useState } from "react";
import "rrweb-player/dist/style.css";
import { LoadingIndicatorComponent } from "@rodrigo-barraza/components-library";
import { Film } from "lucide-react";
import ApiService from "../services/ApiService";
import styles from "./SessionReplayComponent.module.css";

interface ReplayResponse {
  success?: boolean;
  data?: { sessionId: string; eventCount: number; events: unknown[] };
}

// Minimal shape of the rrweb-player default export (a Svelte component ctor).
interface RrwebPlayerInstance {
  $destroy?: () => void;
}
type RrwebPlayerConstructor = new (options: {
  target: HTMLElement;
  props: {
    events: unknown[];
    width?: number;
    height?: number;
    autoPlay?: boolean;
    showController?: boolean;
    skipInactive?: boolean;
  };
}) => RrwebPlayerInstance;

type ReplayStatus = "loading" | "ready" | "empty" | "error";

export default function SessionReplayComponent({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<ReplayStatus>("loading");
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    let destroyed = false;
    let player: RrwebPlayerInstance | null = null;

    async function load() {
      setStatus("loading");
      try {
        const response = (await ApiService.getSessionReplay(sessionId)) as ReplayResponse;
        const events = response?.data?.events ?? [];
        if (destroyed) return;

        // rrweb needs at least a full snapshot plus one incremental event.
        if (events.length < 2) {
          setStatus("empty");
          return;
        }

        const target = containerRef.current;
        if (!target) return;
        target.innerHTML = "";

        const playerModule = await import("rrweb-player");
        if (destroyed) return;
        const RrwebPlayer = (playerModule.default ??
          playerModule) as unknown as RrwebPlayerConstructor;

        player = new RrwebPlayer({
          target,
          props: {
            events,
            width: target.clientWidth || 900,
            autoPlay: false,
            showController: true,
            skipInactive: true,
          },
        });
        setEventCount(events.length);
        setStatus("ready");
      } catch {
        if (!destroyed) setStatus("error");
      }
    }

    void load();

    return () => {
      destroyed = true;
      try {
        player?.$destroy?.();
      } catch {
        // Player teardown is best-effort.
      }
    };
  }, [sessionId]);

  return (
    <div className={styles["replay-section"]}>
      <div className={styles["replay-header"]}>
        <Film size={14} strokeWidth={2.2} />
        <span>Session Replay</span>
        {status === "ready" && (
          <span className={styles["replay-count"]}>{eventCount} events</span>
        )}
      </div>

      {status === "loading" && (
        <LoadingIndicatorComponent size="small" label="Loading recording…" />
      )}
      {status === "empty" && (
        <div className={styles["replay-message"]}>
          No recording was captured for this session.
        </div>
      )}
      {status === "error" && (
        <div className={styles["replay-message"]}>Could not load the recording.</div>
      )}

      <div
        ref={containerRef}
        className={styles["replay-canvas"]}
        data-active={status === "ready"}
      />
    </div>
  );
}
