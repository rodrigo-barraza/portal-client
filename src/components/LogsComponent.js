"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  ScrollText,
  ArrowDown,
  Trash2,
  Pause,
  Play,
  Search,
  X,
} from "lucide-react";
import { PageHeaderComponent, SearchInputComponent } from "@rodrigo-barraza/components-library";

import ApiService from "../services/ApiService";
import styles from "./LogsComponent.module.css";

// ── Constants ──────────────────────────────────────────────────
const MAX_LINES = 5000;
const TIMESTAMP_REGEX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\s*/;

// ── ANSI escape-code → React span parser ──────────────────────
const ANSI_RE = /\x1b\[([0-9;]*)m/g;

const ANSI_COLORS = [
  null,           // 0 – default (inherit)
  "#ef4444",      // 1 – red
  "#22c55e",      // 2 – green
  "#eab308",      // 3 – yellow
  "#3b82f6",      // 4 – blue
  "#a855f7",      // 5 – magenta
  "#06b6d4",      // 6 – cyan
  "#d4d4d8",      // 7 – white
];

const ANSI_BRIGHT_COLORS = [
  "#71717a",      // 0 – bright black (gray)
  "#f87171",      // 1 – bright red
  "#4ade80",      // 2 – bright green
  "#fde047",      // 3 – bright yellow
  "#60a5fa",      // 4 – bright blue
  "#c084fc",      // 5 – bright magenta
  "#22d3ee",      // 6 – bright cyan
  "#ffffff",      // 7 – bright white
];

/**
 * Convert a 256-color index to a hex color string.
 */
function ansi256ToHex(n) {
  if (n < 8) return ANSI_COLORS[n];
  if (n < 16) return ANSI_BRIGHT_COLORS[n - 8];
  if (n < 232) {
    const idx = n - 16;
    const r = Math.floor(idx / 36) * 51;
    const g = (Math.floor(idx / 6) % 6) * 51;
    const b = (idx % 6) * 51;
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  // Grayscale 232-255
  const v = (n - 232) * 10 + 8;
  return `#${v.toString(16).padStart(2, "0")}${v.toString(16).padStart(2, "0")}${v.toString(16).padStart(2, "0")}`;
}

/**
 * Strip ANSI escape codes from a string.
 */
function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Parse ANSI-coded text into an array of React elements.
 * Supports SGR codes: reset, bold, dim, italic, underline,
 * strikethrough, standard 8 colors, bright colors, and 256-color.
 */
function parseAnsi(text) {
  // Fast path — no escape codes present
  if (!text.includes("\x1b")) return text;

  const parts = [];
  let lastIndex = 0;
  let key = 0;

  // Active style state
  let color = null;
  let bgColor = null;
  let bold = false;
  let dim = false;
  let italic = false;
  let underline = false;
  let strikethrough = false;

  let match;
  ANSI_RE.lastIndex = 0;

  while ((match = ANSI_RE.exec(text)) !== null) {
    // Push text before this escape
    if (match.index > lastIndex) {
      const chunk = text.slice(lastIndex, match.index);
      if (color || bgColor || bold || dim || italic || underline || strikethrough) {
        const style = {};
        if (color) style.color = color;
        if (bgColor) style.backgroundColor = bgColor;
        if (bold) style.fontWeight = 700;
        if (dim) style.opacity = 0.6;
        if (italic) style.fontStyle = "italic";
        if (underline) style.textDecoration = "underline";
        if (strikethrough) style.textDecoration = (style.textDecoration ? style.textDecoration + " line-through" : "line-through");
        parts.push(<span key={key++} style={style}>{chunk}</span>);
      } else {
        parts.push(chunk);
      }
    }
    lastIndex = match.index + match[0].length;

    // Parse SGR parameters
    const codes = match[1] ? match[1].split(";").map(Number) : [0];
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) {
        color = null; bgColor = null; bold = false; dim = false;
        italic = false; underline = false; strikethrough = false;
      } else if (c === 1) bold = true;
      else if (c === 2) dim = true;
      else if (c === 3) italic = true;
      else if (c === 4) underline = true;
      else if (c === 9) strikethrough = true;
      else if (c === 22) { bold = false; dim = false; }
      else if (c === 23) italic = false;
      else if (c === 24) underline = false;
      else if (c === 29) strikethrough = false;
      else if (c === 39) color = null;
      else if (c === 49) bgColor = null;
      else if (c >= 30 && c <= 37) color = ANSI_COLORS[c - 30];
      else if (c >= 40 && c <= 47) bgColor = ANSI_COLORS[c - 40];
      else if (c >= 90 && c <= 97) color = ANSI_BRIGHT_COLORS[c - 90];
      else if (c >= 100 && c <= 107) bgColor = ANSI_BRIGHT_COLORS[c - 100];
      else if (c === 38 && codes[i + 1] === 5 && codes[i + 2] != null) {
        color = ansi256ToHex(codes[i + 2]); i += 2;
      } else if (c === 48 && codes[i + 1] === 5 && codes[i + 2] != null) {
        bgColor = ansi256ToHex(codes[i + 2]); i += 2;
      }
    }
  }

  // Push remaining text after last escape
  if (lastIndex < text.length) {
    const chunk = text.slice(lastIndex);
    if (color || bgColor || bold || dim || italic || underline || strikethrough) {
      const style = {};
      if (color) style.color = color;
      if (bgColor) style.backgroundColor = bgColor;
      if (bold) style.fontWeight = 700;
      if (dim) style.opacity = 0.6;
      if (italic) style.fontStyle = "italic";
      if (underline) style.textDecoration = "underline";
      if (strikethrough) style.textDecoration = (style.textDecoration ? style.textDecoration + " line-through" : "line-through");
      parts.push(<span key={key++} style={style}>{chunk}</span>);
    } else {
      parts.push(chunk);
    }
  }

  return parts.length === 1 ? parts[0] : parts;
}

/**
 * Detect the log level from a line of text.
 */
function detectLevel(text) {
  const clean = stripAnsi(text);
  if (/\bERR(?:OR)?\b/i.test(clean)) return "error";
  if (/\bWARN(?:ING)?\b/i.test(clean)) return "warn";
  if (/\bINFO\b/i.test(clean)) return "info";
  if (/\b(?:OK|SUCCESS)\b/i.test(clean)) return "success";
  if (/\bDBG|DEBUG\b/i.test(clean)) return "debug";
  return null;
}

const LEVEL_CLASS = {
  error: styles.levelError,
  warn: styles.levelWarn,
  info: styles.levelInfo,
  success: styles.levelSuccess,
  debug: styles.levelDebug,
};

const LINE_LEVEL_CLASS = {
  error: styles.logLineError,
  warn: styles.logLineWarn,
  success: styles.logLineSuccess,
};

/**
 * Parse a raw log line into { timestamp, content, level }.
 */
function parseLine(raw) {
  const match = raw.match(TIMESTAMP_REGEX);
  if (match) {
    const ts = match[1];
    const content = raw.slice(match[0].length);
    return { timestamp: ts.slice(11, 23), content, level: detectLevel(content) };
  }
  return { timestamp: null, content: raw, level: detectLevel(raw) };
}

export default function LogsComponent() {
  const [containers, setContainers] = useState([]);
  const [activeContainer, setActiveContainer] = useState(null);
  const [lines, setLines] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [bufferedCount, setBufferedCount] = useState(0);

  const eventSourceRef = useRef(null);
  const bodyRef = useRef(null);
  const pauseBufferRef = useRef([]);
  const didFetch = useRef(false);
  const searchInputRef = useRef(null);
  const didAutoConnect = useRef(false);
  const searchParams = useSearchParams();

  // ── Fetch containers on mount ────────────────────────────────
  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    ApiService.getLoggableContainers()
      .then((res) => {
        setContainers(res.containers || []);
      })
      .catch((err) => console.error("Failed to fetch containers:", err));
  }, []);

  // ── Auto-scroll to bottom ────────────────────────────────────
  useEffect(() => {
    if (autoScroll && bodyRef.current && !paused) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines, autoScroll, paused]);

  // ── Detect user scroll position ──────────────────────────────
  const handleScroll = useCallback(() => {
    if (!bodyRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = bodyRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setAutoScroll(isAtBottom);
  }, []);

  // ── Connect to SSE stream ────────────────────────────────────
  const connectToContainer = useCallback(
    (containerName, device) => {
      // Disconnect existing stream
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      setActiveContainer(containerName);
      setLines([]);
      setConnected(false);
      setError(null);
      setAutoScroll(true);
      setPaused(false);
      pauseBufferRef.current = [];

      const url = ApiService.buildLogStreamUrl(containerName, {
        tail: 200,
        follow: true,
        device,
      });

      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener("connected", (_e) => {
        setConnected(true);
        setError(null);
      });

      // Server-sent `event: error` — these carry JSON in e.data
      es.addEventListener("error", (e) => {
        // Only handle custom SSE error events (which have .data).
        // Native EventSource errors also fire on this listener but
        // have no .data — those are handled by es.onerror below.
        if (!e.data) return;
        try {
          const data = JSON.parse(e.data);
          setError(data.error || "Connection error");
        } catch {
          setError(e.data);
        }
        setConnected(false);
      });

      es.addEventListener("end", () => {
        setConnected(false);
      });

      es.onmessage = (e) => {
        const raw = e.data;
        const parsed = parseLine(raw);

        if (paused) {
          pauseBufferRef.current.push(parsed);
          setBufferedCount(pauseBufferRef.current.length);
          return;
        }

        setLines((prev) => {
          const next = [...prev, parsed];
          return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
        });
      };

      // Native EventSource error — fires on connection loss AND
      // during auto-reconnect attempts. Only show "Connection lost"
      // if the EventSource has given up (readyState === CLOSED).
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          setConnected(false);
          setError("Connection lost");
        } else if (es.readyState === EventSource.CONNECTING) {
          // EventSource is auto-reconnecting — mark disconnected
          // but don't set an error since it's transient
          setConnected(false);
        }
      };
    },
    [paused],
  );

  // ── Auto-connect when ?container= is in the URL ─────────────
  useEffect(() => {
    if (didAutoConnect.current) return;
    const containerParam = searchParams.get("container") || searchParams.get("service");
    if (!containerParam || containers.length === 0) return;

    const match = containers.find((c) => c.name === containerParam);
    if (match) {
      didAutoConnect.current = true;
      queueMicrotask(() => connectToContainer(match.name, match.device));
    }
  }, [searchParams, containers, connectToContainer]);

  // ── Cleanup on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // ── Re-wire the onmessage handler when `paused` changes ─────
  useEffect(() => {
    const es = eventSourceRef.current;
    if (!es) return;

    es.onmessage = (e) => {
      const raw = e.data;
      const parsed = parseLine(raw);

      if (paused) {
        pauseBufferRef.current.push(parsed);
        setBufferedCount(pauseBufferRef.current.length);
        return;
      }

      setLines((prev) => {
        const next = [...prev, parsed];
        return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
      });
    };
  }, [paused]);

  // ── Resume: flush buffer ─────────────────────────────────────
  const handleResume = () => {
    setPaused(false);
    const buffered = pauseBufferRef.current;
    if (buffered.length > 0) {
      setLines((prev) => {
        const next = [...prev, ...buffered];
        return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
      });
      pauseBufferRef.current = [];
      setBufferedCount(0);
    }
    setAutoScroll(true);
  };

  // ── Clear ────────────────────────────────────────────────────
  const handleClear = () => {
    setLines([]);
    pauseBufferRef.current = [];
    setBufferedCount(0);
  };

  // ── Scroll to bottom ────────────────────────────────────────
  const scrollToBottom = () => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
    setAutoScroll(true);
  };

  // ── Search filter ────────────────────────────────────────────
  const filteredLines = search
    ? lines.filter(
        (l) =>
          stripAnsi(l.content).toLowerCase().includes(search.toLowerCase()) ||
          (l.timestamp && l.timestamp.includes(search)),
      )
    : lines;

  // ── Keyboard shortcut for search ────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
        setSearch("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSearch]);

  const activeContainerName = activeContainer || "";

  return (
    <div className={styles.logs}>
      <PageHeaderComponent sticky={false}
        title="Logs"
        subtitle={
          activeContainer
            ? `Streaming ${activeContainerName} logs`
            : "Select a container to view live Docker logs"
        }
      />

      {/* ── Container Chips ── */}
      <div className={styles.serviceList}>
        {(() => {
          // Group by device, running containers first
          const sorted = [...containers].sort((a, b) => {
            if (a.device !== b.device) return a.device.localeCompare(b.device);
            // Running containers first within each device
            if (a.state === "running" && b.state !== "running") return -1;
            if (a.state !== "running" && b.state === "running") return 1;
            return a.name.localeCompare(b.name);
          });

          const groups = [];
          let lastDevice = null;
          for (const container of sorted) {
            if (container.device !== lastDevice) {
              groups.push(
                <span key={`device-${container.device}`} className={styles.deviceLabel}>
                  {container.deviceName || container.device}
                </span>
              );
              lastDevice = container.device;
            }
            const isRunning = container.state === "running";
            const dotClass = [
              styles.chipDot,
              isRunning ? styles.chipDotHealthy : styles.chipDotUnhealthy,
            ].filter(Boolean).join(" ");

            const chipClass = [
              styles.serviceChip,
              activeContainer === container.name ? styles.active : "",
              !isRunning ? styles.chipStateStopped : "",
            ].filter(Boolean).join(" ");

            groups.push(
              <button
                key={`${container.device}-${container.name}`}
                className={chipClass}
                onClick={() => connectToContainer(container.name, container.device)}
              >
                <span className={dotClass} />
                {container.name}
                <span className={styles.chipDevice}>{container.deviceName}</span>
              </button>
            );
          }
          return groups;
        })()}
      </div>

      {/* ── Terminal Viewer ── */}
      {activeContainer ? (
        <div className={styles.terminal}>
          {/* Header */}
          <div className={styles.terminalHeader}>
            <div className={styles.terminalTitle}>
              <span
                className={`${styles.terminalDot} ${connected ? styles.connected : ""}`}
              />
              {activeContainerName}
              {connected && <span style={{ opacity: 0.5, marginLeft: 2 }}>live</span>}
            </div>

            <div className={styles.terminalActions}>
              <span className={styles.lineCount}>
                {filteredLines.length.toLocaleString()}
              </span>

              <span className={styles.separator} />

              {/* Search */}
              {showSearch && (
                <SearchInputComponent
                  value={search}
                  onChange={setSearch}
                  placeholder="Filter…"
                  autoFocus
                  className={styles.searchInput}
                />
              )}

              <button
                className={`${styles.terminalBtn} ${showSearch ? styles.active : ""}`}
                onClick={() => {
                  setShowSearch((v) => !v);
                  if (showSearch) setSearch("");
                  else setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                title="Search (Ctrl+F)"
              >
                {showSearch ? <X size={13} strokeWidth={1.8} /> : <Search size={13} strokeWidth={1.8} />}
              </button>

              <button
                className={`${styles.terminalBtn} ${paused ? styles.active : ""}`}
                onClick={() => (paused ? handleResume() : setPaused(true))}
                title={paused ? "Resume" : "Pause"}
              >
                {paused ? (
                  <Play size={13} strokeWidth={1.8} />
                ) : (
                  <Pause size={13} strokeWidth={1.8} />
                )}
              </button>

              <span className={styles.separator} />

              <button
                className={styles.terminalBtn}
                onClick={scrollToBottom}
                title="Scroll to bottom"
              >
                <ArrowDown size={13} strokeWidth={1.8} />
              </button>

              <button
                className={styles.terminalBtn}
                onClick={handleClear}
                title="Clear"
              >
                <Trash2 size={13} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className={styles.errorBanner}>
              ✕ {error}
            </div>
          )}

          {/* Log body */}
          <div
            ref={bodyRef}
            className={styles.terminalBody}
            onScroll={handleScroll}
          >
            {filteredLines.length === 0 && connected && (
              <div className={styles.connecting}>
                <span className={styles.connectingDot} />
                Waiting for log output…
              </div>
            )}

            {filteredLines.length === 0 && !connected && !error && (
              <div className={styles.connecting}>
                <span className={styles.connectingDot} />
                Connecting…
              </div>
            )}

            {filteredLines.map((line, i) => (
              <div key={i} className={`${styles.logLine} ${LINE_LEVEL_CLASS[line.level] || ""}`}>
                <span className={styles.lineNumber}>{i + 1}</span>
                {line.timestamp && (
                  <span className={styles.lineTimestamp}>{line.timestamp}</span>
                )}
                <span
                  className={`${styles.lineContent} ${line.level ? LEVEL_CLASS[line.level] || "" : ""}`}
                >
                  {parseAnsi(line.content)}
                </span>
              </div>
            ))}
          </div>

          {/* Paused indicator */}
          {paused && bufferedCount > 0 && (
            <div className={styles.pausedBanner}>
              ⏸ Paused — {bufferedCount} new lines buffered
            </div>
          )}
        </div>
      ) : (
        <div className={styles.emptyTerminal}>
          <ScrollText size={40} strokeWidth={1} />
          <span>Select a container to start streaming logs</span>
        </div>
      )}
    </div>
  );
}
