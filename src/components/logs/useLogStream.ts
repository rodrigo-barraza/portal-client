"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ApiService from "@/services/ApiService";
import {
  MAX_LOG_LINES,
  appendCapped,
  parseLogFrame,
  parseLogLine,
  type LogLine,
} from "./logLines";

const TAIL_LINES = 200;

export interface LogStreamTarget {
  container: string;
  device: string;
}

/**
 * One live `docker logs -f` stream over SSE.
 *
 * - Incoming lines are batched and committed once per animation frame, so
 *   a chatty container re-renders the viewer ~60×/s at most, not per line.
 * - The viewer and the pause buffer both keep the newest MAX_LOG_LINES.
 * - EventSource reconnects on its own after a network drop, and the server
 *   answers every (re)connect with the last 200 lines again. Lines at or
 *   before the newest timestamp already shown are dropped, so a reconnect
 *   resumes the log instead of duplicating its tail.
 * - A server-sent `error` or `end` closes the stream for good: the server
 *   has already ended the response, and letting EventSource reconnect
 *   would replay the tail every few seconds forever.
 */
export function useLogStream() {
  const [target, setTarget] = useState<LogStreamTarget | null>(null);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [bufferedCount, setBufferedCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const nextIdRef = useRef(1);
  const pendingRef = useRef<LogLine[]>([]);
  const frameRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const pauseBufferRef = useRef<LogLine[]>([]);
  const newestSortKeyRef = useRef<string | null>(null);
  const replayFloorRef = useRef<string | null>(null);

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const flush = useCallback(() => {
    frameRef.current = null;
    const batch = pendingRef.current;
    if (batch.length === 0) return;
    pendingRef.current = [];
    setLines((previous) => appendCapped(previous, batch));
  }, []);

  const close = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  const receive = useCallback(
    (data: string) => {
      const line = parseLogLine(parseLogFrame(data), 0);
      if (line.sortKey) {
        const floor = replayFloorRef.current;
        if (floor !== null) {
          if (line.sortKey <= floor) return; // replayed after a reconnect
          replayFloorRef.current = null;
        }
        if (!newestSortKeyRef.current || line.sortKey > newestSortKeyRef.current) {
          newestSortKeyRef.current = line.sortKey;
        }
      }
      // Numbered only once kept, so line numbers never skip.
      line.id = nextIdRef.current++;
      if (pausedRef.current) {
        pauseBufferRef.current = appendCapped(pauseBufferRef.current, [line]);
        setBufferedCount(pauseBufferRef.current.length);
        return;
      }
      pendingRef.current.push(line);
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  const connect = useCallback(
    (next: LogStreamTarget) => {
      close();
      cancelFrame();
      pendingRef.current = [];
      pauseBufferRef.current = [];
      pausedRef.current = false;
      nextIdRef.current = 1;
      newestSortKeyRef.current = null;
      replayFloorRef.current = null;
      setTarget(next);
      setLines([]);
      setConnected(false);
      setEnded(false);
      setError(null);
      setPaused(false);
      setBufferedCount(0);

      const eventSource = new EventSource(
        ApiService.buildLogStreamUrl(next.container, {
          tail: TAIL_LINES,
          follow: true,
          device: next.device,
        }),
      );
      eventSourceRef.current = eventSource;
      let hasConnected = false;

      eventSource.addEventListener("connected", () => {
        // A second `connected` is EventSource's automatic reconnect:
        // skip the replayed tail up to what is already on screen.
        if (hasConnected) replayFloorRef.current = newestSortKeyRef.current;
        hasConnected = true;
        setConnected(true);
        setError(null);
      });

      // Server-sent `event: error` carries JSON; native connection errors
      // also land here but without data — those go to onerror below.
      eventSource.addEventListener("error", (event: Event) => {
        const data = (event as MessageEvent).data;
        if (!data) return;
        let message = String(data);
        try {
          message = JSON.parse(data).error || "Log stream error";
        } catch {
          // Plain-text error payload
        }
        eventSource.close();
        if (eventSourceRef.current === eventSource) eventSourceRef.current = null;
        setError(message);
        setConnected(false);
      });

      eventSource.addEventListener("end", () => {
        eventSource.close();
        if (eventSourceRef.current === eventSource) eventSourceRef.current = null;
        setConnected(false);
        setEnded(true);
      });

      eventSource.onmessage = (event: MessageEvent) => receive(event.data);

      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          setConnected(false);
          setError((current) => current ?? "Connection lost");
        } else {
          // CONNECTING — EventSource is retrying on its own.
          setConnected(false);
        }
      };
    },
    [close, cancelFrame, receive],
  );

  useEffect(
    () => () => {
      close();
      cancelFrame();
    },
    [close, cancelFrame],
  );

  const pause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
    // Lines queued just before the pause come first, then the buffer.
    cancelFrame();
    const buffered = pendingRef.current.concat(pauseBufferRef.current);
    pendingRef.current = [];
    pauseBufferRef.current = [];
    setBufferedCount(0);
    if (buffered.length > 0) setLines((previous) => appendCapped(previous, buffered));
  }, [cancelFrame]);

  const clear = useCallback(() => {
    cancelFrame();
    pendingRef.current = [];
    pauseBufferRef.current = [];
    setLines([]);
    setBufferedCount(0);
  }, [cancelFrame]);

  return {
    target,
    lines,
    connected,
    ended,
    error,
    paused,
    bufferedCount,
    maxLines: MAX_LOG_LINES,
    connect,
    pause,
    resume,
    clear,
  };
}
