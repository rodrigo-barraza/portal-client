"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  ScrollText,
  ArrowDown,
  Trash2,
  Pause,
  Play,
  Search,
  X,
  RotateCw,
  ChevronDown,
  Check,
  Cpu,
  MemoryStick,
  Globe,
} from "lucide-react";
import {
  PageHeaderComponent,
  SearchInputComponent,
} from "@rodrigo-barraza/components-library";
import {
  formatBytes,
  formatPercent,
} from "@rodrigo-barraza/utilities-library";

import ApiService from "../services/ApiService";
import styles from "./LogsComponent.module.css";

// ── Constants ──────────────────────────────────────────────────
const MAX_LINES = 5000;
const TIMESTAMP_REGEX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\s*/;

// ── ANSI escape-code → React span parser ──────────────────────
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[([0-9;]*)m/g;

const ANSI_COLORS = [
  null, // 0 – default (inherit)
  "#ef4444", // 1 – red
  "#22c55e", // 2 – green
  "#eab308", // 3 – yellow
  "#3b82f6", // 4 – blue
  "#a855f7", // 5 – magenta
  "#06b6d4", // 6 – cyan
  "#d4d4d8", // 7 – white
];

const ANSI_BRIGHT_COLORS = [
  "#71717a", // 0 – bright black (gray)
  "#f87171", // 1 – bright red
  "#4ade80", // 2 – bright green
  "#fde047", // 3 – bright yellow
  "#60a5fa", // 4 – bright blue
  "#c084fc", // 5 – bright magenta
  "#22d3ee", // 6 – bright cyan
  "#ffffff", // 7 – bright white
];

/**
 * Convert a 256-color index to a hex color string.
 */
function ansi256ToHex(n: number) {
  if (n < 8) return ANSI_COLORS[n];
  if (n < 16) return ANSI_BRIGHT_COLORS[n - 8];
  if (n < 232) {
    const index = n - 16;
    const r = Math.floor(index / 36) * 51;
    const g = (Math.floor(index / 6) % 6) * 51;
    const b = (index % 6) * 51;
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  // Grayscale 232-255
  const grayscaleValue = (n - 232) * 10 + 8;
  return `#${grayscaleValue.toString(16).padStart(2, "0")}${grayscaleValue.toString(16).padStart(2, "0")}${grayscaleValue.toString(16).padStart(2, "0")}`;
}

/**
 * Strip ANSI escape codes from a string.
 */
function stripAnsi(text: string) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Parse ANSI-coded text into an array of React elements.
 * Supports SGR codes: reset, bold, dim, italic, underline,
 * strikethrough, standard 8 colors, bright colors, and 256-color.
 */
function parseAnsi(text: string) {
  // Fast path — no escape codes present
  if (!text.includes("\x1b")) return text;

  const parts = [];
  let lastIndex = 0;
  let key = 0;

  // Active style state
  let color = null;
  let bgColor = null;
  let bold = false;
  let isDimmed = false;
  let italic = false;
  let underline = false;
  let strikethrough = false;

  let match;
  ANSI_RE.lastIndex = 0;

  while ((match = ANSI_RE.exec(text)) !== null) {
    // Push text before this escape
    if (match.index > lastIndex) {
      const chunk = text.slice(lastIndex, match.index);
      if (
        color ||
        bgColor ||
        bold ||
        isDimmed ||
        italic ||
        underline ||
        strikethrough
      ) {
        const style: Record<string, string | number> = {};
        if (color) style.color = color;
        if (bgColor) style.backgroundColor = bgColor;
        if (bold) style.fontWeight = 700;
        if (isDimmed) style.opacity = 0.6;
        if (italic) style.fontStyle = "italic";
        if (underline) style.textDecoration = "underline";
        if (strikethrough)
          style.textDecoration = style.textDecoration
            ? style.textDecoration + " line-through"
            : "line-through";
        parts.push(
          <span key={key++} style={style}>
            {chunk}
          </span>,
        );
      } else {
        parts.push(chunk);
      }
    }
    lastIndex = match.index + match[0].length;

    // Parse SGR parameters
    const codes = match[1] ? match[1].split(";").map(Number) : [0];
    for (let i = 0; i < codes.length; i++) {
      const colorCode = codes[i];
      if (colorCode === 0) {
        color = null;
        bgColor = null;
        bold = false;
        isDimmed = false;
        italic = false;
        underline = false;
        strikethrough = false;
      } else if (colorCode === 1) bold = true;
      else if (colorCode === 2) isDimmed = true;
      else if (colorCode === 3) italic = true;
      else if (colorCode === 4) underline = true;
      else if (colorCode === 9) strikethrough = true;
      else if (colorCode === 22) {
        bold = false;
        isDimmed = false;
      } else if (colorCode === 23) italic = false;
      else if (colorCode === 24) underline = false;
      else if (colorCode === 29) strikethrough = false;
      else if (colorCode === 39) color = null;
      else if (colorCode === 49) bgColor = null;
      else if (colorCode >= 30 && colorCode <= 37)
        color = ANSI_COLORS[colorCode - 30];
      else if (colorCode >= 40 && colorCode <= 47)
        bgColor = ANSI_COLORS[colorCode - 40];
      else if (colorCode >= 90 && colorCode <= 97)
        color = ANSI_BRIGHT_COLORS[colorCode - 90];
      else if (colorCode >= 100 && colorCode <= 107)
        bgColor = ANSI_BRIGHT_COLORS[colorCode - 100];
      else if (colorCode === 38 && codes[i + 1] === 5 && codes[i + 2] != null) {
        color = ansi256ToHex(codes[i + 2]);
        i += 2;
      } else if (
        colorCode === 48 &&
        codes[i + 1] === 5 &&
        codes[i + 2] != null
      ) {
        bgColor = ansi256ToHex(codes[i + 2]);
        i += 2;
      }
    }
  }

  // Push remaining text after last escape
  if (lastIndex < text.length) {
    const chunk = text.slice(lastIndex);
    if (
      color ||
      bgColor ||
      bold ||
      isDimmed ||
      italic ||
      underline ||
      strikethrough
    ) {
      const style: Record<string, string | number> = {};
      if (color) style.color = color;
      if (bgColor) style.backgroundColor = bgColor;
      if (bold) style.fontWeight = 700;
      if (isDimmed) style.opacity = 0.6;
      if (italic) style.fontStyle = "italic";
      if (underline) style.textDecoration = "underline";
      if (strikethrough)
        style.textDecoration = style.textDecoration
          ? style.textDecoration + " line-through"
          : "line-through";
      parts.push(
        <span key={key} style={style}>
          {chunk}
        </span>,
      );
    } else {
      parts.push(chunk);
    }
  }

  return parts.length === 1 ? parts[0] : parts;
}

/**
 * Detect the log level from a line of text.
 */
function detectLevel(text: string) {
  const clean = stripAnsi(text);
  if (/\bERR(?:OR)?\b/i.test(clean)) return "error";
  if (/\bWARN(?:ING)?\b/i.test(clean)) return "warn";
  if (/\bINFO\b/i.test(clean)) return "info";
  if (/\b(?:OK|SUCCESS)\b/i.test(clean)) return "success";
  if (/\bDBG|DEBUG\b/i.test(clean)) return "debug";
  return null;
}

const LEVEL_CLASS: Record<string, string> = {
  error: styles['level-error'],
  warn: styles['level-warn'],
  info: styles['level-info'],
  success: styles['level-success'],
  debug: styles['level-debug'],
};

const LINE_LEVEL_CLASS: Record<string, string> = {
  error: styles['log-line-error'],
  warn: styles['log-line-warn'],
  success: styles['log-line-success'],
};

/**
 * Parse a raw log line into { timestamp, content, level }.
 */
function parseLine(raw: string) {
  const match = raw.match(TIMESTAMP_REGEX);
  if (match) {
    const ts = match[1];
    const content = raw.slice(match[0].length);
    return {
      timestamp: ts.slice(11, 23),
      content,
      level: detectLevel(content),
    };
  }
  return { timestamp: null, content: raw, level: detectLevel(raw) };
}

function getSeverityState(
  percentage: number,
  thresholds: [number, number] = [40, 80],
): string {
  if (percentage > thresholds[1]) return styles['state-danger'];
  if (percentage > thresholds[0]) return styles['state-warning'];
  return styles['state-success'];
}

interface LogLine {
  timestamp: string | null;
  content: string;
  level: string | null;
}

interface LoggableContainer {
  name: string;
  device: string;
  deviceName?: string;
  state?: string;
}

export default function LogsComponent() {
  const [containers, setContainers] = useState<LoggableContainer[]>([]);
  const [activeContainer, setActiveContainer] = useState<string | null>(null);
  const [activeDevice, setActiveDevice] = useState<string | null>(null);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [bufferedCount, setBufferedCount] = useState(0);
  const [restarting, setRestarting] = useState(false);
  const [containerDropdownOpen, setContainerDropdownOpen] = useState(false);
  const [containerSearchQuery, setContainerSearchQuery] = useState("");
  const [activeContainerStatistics, setActiveContainerStatistics] = useState<any | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pauseBufferRef = useRef<LogLine[]>([]);
  const didFetch = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const didAutoConnect = useRef(false);
  const containerDropdownRef = useRef<HTMLDivElement>(null);
  const containerSearchInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();

  // ── Fetch containers on mount ────────────────────────────────
  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    ApiService.getLoggableContainers()
      .then((res) => {
        setContainers(res.containers || []);
      })
      .catch((error) => console.error("Failed to fetch containers:", error));
  }, []);

  // ── Poll statistics for the active container ─────────────────
  useEffect(() => {
    if (!activeContainer || !activeDevice) {
      setActiveContainerStatistics(null);
      return;
    }

    const fetchContainerStatistics = async () => {
      try {
        const containerStatisticsResponse = await ApiService.getContainerStats(activeDevice);
        const matchedContainerStatistics = containerStatisticsResponse?.containers?.find(
          (container: any) => container.name === activeContainer,
        );
        if (matchedContainerStatistics) {
          setActiveContainerStatistics(matchedContainerStatistics);
        }
      } catch (error) {
        console.error("Failed to fetch container statistics:", error);
      }
    };

    fetchContainerStatistics();
    const statisticsPollingInterval = setInterval(fetchContainerStatistics, 5000);

    return () => {
      clearInterval(statisticsPollingInterval);
    };
  }, [activeContainer, activeDevice]);

  // ── Auto-scroll to bottom ────────────────────────────────────
  useEffect(() => {
    if (autoScroll && bodyRef.current && !paused) {
      if (bodyRef.current) {
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
      }
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
    (containerName: string, device: string) => {
      // Disconnect existing stream
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      setActiveContainer(containerName);
      setActiveDevice(device);
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
      es.addEventListener("error", (e: Event) => {
        // Only handle custom SSE error events (which have .data).
        // Native EventSource errors also fire on this listener but
        // have no .data — those are handled by es.onerror below.
        const me = e as MessageEvent;
        if (!me.data) return;
        try {
          const data = JSON.parse(me.data);
          setError(data.error || "Connection error");
        } catch {
          setError(me.data);
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
    const containerParam =
      searchParams.get("container") || searchParams.get("service");
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

  // ── Close container dropdown on outside click ───────────────
  useEffect(() => {
    if (!containerDropdownOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerDropdownRef.current &&
        !containerDropdownRef.current.contains(event.target as Node)
      ) {
        setContainerDropdownOpen(false);
        setContainerSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [containerDropdownOpen]);

  // ── Close container dropdown on Escape ──────────────────────
  useEffect(() => {
    if (!containerDropdownOpen) return;
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContainerDropdownOpen(false);
        setContainerSearchQuery("");
      }
    };
    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, [containerDropdownOpen]);

  // ── Auto-focus search input when dropdown opens ─────────────
  useEffect(() => {
    if (containerDropdownOpen) {
      setTimeout(() => containerSearchInputRef.current?.focus(), 50);
    }
  }, [containerDropdownOpen]);

  // ── Filtered + grouped container list for dropdown ──────────
  const filteredContainerGroups = useMemo(() => {
    const normalizedQuery = containerSearchQuery.toLowerCase().trim();
    const matchingContainers = normalizedQuery
      ? containers.filter((container) =>
          container.name.toLowerCase().includes(normalizedQuery),
        )
      : containers;

    const sortedContainers = [...matchingContainers].sort(
      (a: LoggableContainer, b: LoggableContainer) => {
        if (a.device !== b.device) return a.device.localeCompare(b.device);
        if (a.state === "running" && b.state !== "running") return -1;
        if (a.state !== "running" && b.state === "running") return 1;
        return a.name.localeCompare(b.name);
      },
    );

    const groups: { device: string; deviceName: string; containers: LoggableContainer[] }[] = [];
    let currentGroup: (typeof groups)[number] | null = null;

    for (const container of sortedContainers) {
      if (!currentGroup || currentGroup.device !== container.device) {
        currentGroup = {
          device: container.device,
          deviceName: container.deviceName || container.device,
          containers: [],
        };
        groups.push(currentGroup);
      }
      currentGroup.containers.push(container);
    }

    return groups;
  }, [containers, containerSearchQuery]);

  // ── Re-wire the onmessage handler when `paused` changes ─────
  useEffect(() => {
    const es = eventSourceRef.current;
    if (!es) return;

    es.onmessage = (e: MessageEvent) => {
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

  // ── Restart container ───────────────────────────────────────
  const handleRestart = async () => {
    if (!activeContainer || !activeDevice || restarting) return;
    setRestarting(true);
    try {
      await ApiService.restartContainer(activeContainer, activeDevice);
      // Reconnect to the log stream after restart
      connectToContainer(activeContainer, activeDevice);
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to restart container");
    } finally {
      setRestarting(false);
    }
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
    const handler = (e: KeyboardEvent) => {
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
    <div className={`logs-component ${styles['logs']}`}>
      <PageHeaderComponent
        sticky={false}
        title="Logs"
        subtitle={
          activeContainer
            ? `Streaming ${activeContainerName} logs`
            : "Select a container to view live Docker logs"
        }
      />

      {/* ── Container Selector Dropdown ── */}
      <div className={styles['container-dropdown']} ref={containerDropdownRef}>
        <button
          type="button"
          className={`${styles['container-dropdown-trigger']} ${containerDropdownOpen ? styles['container-dropdown-trigger-open'] : ""}`}
          onClick={() => setContainerDropdownOpen((previous) => !previous)}
        >
          <span className={styles['container-dropdown-trigger-content']}>
            {activeContainer ? (
              <>
                <span
                  className={`${styles['container-dropdown-status-dot']} ${
                    containers.find((c) => c.name === activeContainer)?.state === "running"
                      ? styles['container-dropdown-status-dot-healthy']
                      : styles['container-dropdown-status-dot-unhealthy']
                  }`}
                />
                <span className={styles['container-dropdown-trigger-label']}>
                  {activeContainer}
                </span>
              </>
            ) : (
              <span className={styles['container-dropdown-trigger-placeholder']}>
                Select a container…
              </span>
            )}
          </span>
          <ChevronDown
            size={14}
            className={`${styles['container-dropdown-chevron']} ${containerDropdownOpen ? styles['container-dropdown-chevron-open'] : ""}`}
          />
        </button>

        {containerDropdownOpen && (
          <div className={styles['container-dropdown-menu']}>
            <div className={styles['container-dropdown-search-wrapper']}>
              <Search size={13} className={styles['container-dropdown-search-icon']} />
              <input
                ref={containerSearchInputRef}
                type="text"
                className={styles['container-dropdown-search-input']}
                placeholder="Search containers…"
                value={containerSearchQuery}
                onChange={(event) => setContainerSearchQuery(event.target.value)}
              />
              {containerSearchQuery && (
                <button
                  type="button"
                  className={styles['container-dropdown-search-clear']}
                  onClick={() => setContainerSearchQuery("")}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className={styles['container-dropdown-options-list']}>
              {filteredContainerGroups.length === 0 && (
                <div className={styles['container-dropdown-empty-state']}>
                  No containers match &ldquo;{containerSearchQuery}&rdquo;
                </div>
              )}

              {filteredContainerGroups.map((group) => (
                <div key={group.device}>
                  <span className={styles['container-dropdown-device-label']}>
                    {group.deviceName}
                  </span>
                  {group.containers.map((container) => {
                    const isRunning = container.state === "running";
                    const isSelected = activeContainer === container.name;
                    return (
                      <button
                        key={`${container.device}-${container.name}`}
                        type="button"
                        className={`${styles['container-dropdown-option']} ${isSelected ? styles['container-dropdown-option-selected'] : ""} ${!isRunning ? styles['container-dropdown-option-stopped'] : ""}`}
                        onClick={() => {
                          connectToContainer(container.name, container.device);
                          setContainerDropdownOpen(false);
                          setContainerSearchQuery("");
                        }}
                      >
                        <span
                          className={`${styles['container-dropdown-status-dot']} ${
                            isRunning
                              ? styles['container-dropdown-status-dot-healthy']
                              : styles['container-dropdown-status-dot-unhealthy']
                          }`}
                        />
                        <span className={styles['container-dropdown-option-label']}>
                          {container.name}
                        </span>
                        {container.deviceName && (
                          <span className={styles['container-dropdown-option-device']}>
                            {container.deviceName}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Terminal Viewer ── */}
      {activeContainer ? (
        <>
          {/* ── Container Statistics Panel ── */}
          {activeContainerStatistics && (
            <div className={styles['container-statistics-panel']}>
              {/* Status Card */}
              <div className={styles['statistics-card']}>
                <div
                  className={`${styles['statistics-card-icon']} ${
                    activeContainerStatistics.state === "running"
                      ? styles['state-success']
                      : styles['state-danger']
                  }`}
                >
                  {activeContainerStatistics.state === "running" ? (
                    <Check size={16} strokeWidth={2.5} />
                  ) : (
                    <X size={16} strokeWidth={2.5} />
                  )}
                </div>
                <div className={styles['statistics-card-content']}>
                  <span className={styles['statistics-card-value']}>
                    {activeContainerStatistics.state || "unknown"}
                  </span>
                  <span className={styles['statistics-card-label']}>Status</span>
                  <span
                    className={styles['statistics-card-description']}
                    title={activeContainerStatistics.status || ""}
                  >
                    {activeContainerStatistics.status || "No status"}
                  </span>
                </div>
              </div>

              {/* CPU Usage Card */}
              <div className={styles['statistics-card']}>
                <div
                  className={`${styles['statistics-card-icon']} ${getSeverityState(
                    activeContainerStatistics.cpu?.percent || 0,
                  )}`}
                >
                  <Cpu size={16} strokeWidth={2.5} />
                </div>
                <div className={styles['statistics-card-content']}>
                  <span className={styles['statistics-card-value']}>
                    {formatPercent(activeContainerStatistics.cpu?.percent || 0, "adaptive")}
                  </span>
                  <span className={styles['statistics-card-label']}>CPU Usage</span>
                  <span className={styles['statistics-card-description']}>
                    {activeContainerStatistics.cpu?.cores || 0} core
                    {activeContainerStatistics.cpu?.cores !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Memory Card */}
              <div className={styles['statistics-card']}>
                <div
                  className={`${styles['statistics-card-icon']} ${getSeverityState(
                    activeContainerStatistics.memory?.percent || 0,
                    [60, 85],
                  )}`}
                >
                  <MemoryStick size={16} strokeWidth={2.5} />
                </div>
                <div className={styles['statistics-card-content']}>
                  <span className={styles['statistics-card-value']}>
                    {formatBytes(activeContainerStatistics.memory?.used || 0)}
                  </span>
                  <span className={styles['statistics-card-label']}>Memory Used</span>
                  <span className={styles['statistics-card-description']}>
                    {activeContainerStatistics.memory?.limit
                      ? `Limit: ${formatBytes(activeContainerStatistics.memory.limit)}`
                      : "No limit"}
                  </span>
                </div>
              </div>

              {/* Network I/O Card */}
              <div className={styles['statistics-card']}>
                <div className={`${styles['statistics-card-icon']} ${styles['state-accent']}`}>
                  <Globe size={16} strokeWidth={2.5} />
                </div>
                <div className={styles['statistics-card-content']}>
                  <span className={styles['statistics-card-value']}>
                    {formatBytes(
                      (activeContainerStatistics.network?.rx || 0) +
                        (activeContainerStatistics.network?.tx || 0),
                    )}
                  </span>
                  <span className={styles['statistics-card-label']}>Network I/O</span>
                  <span className={styles['statistics-card-description']}>
                    ↓ {formatBytes(activeContainerStatistics.network?.rx || 0)} · ↑{" "}
                    {formatBytes(activeContainerStatistics.network?.tx || 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className={styles['terminal']} data-theme="twilight">
          {/* Header */}
          <div className={styles['terminal-header']}>
            <div className={styles['terminal-title']}>
              <span
                className={`${styles['terminal-dot']} ${connected ? styles['connected'] : ""}`}
              />
              {activeContainerName}
              {connected && (
                <span style={{ opacity: 0.5, marginLeft: 2 }}>live</span>
              )}
            </div>

            <div className={styles['terminal-actions']}>
              <span className={styles['line-count']}>
                {filteredLines.length.toLocaleString()}
              </span>

              <span className={styles['separator']} />

              {/* Search */}
              {showSearch && (
                <SearchInputComponent
                  value={search}
                  onChange={setSearch}
                  placeholder="Filter…"
                  autoFocus
                  className={styles['search-input']}
                />
              )}

              <button
                className={`${styles['terminal-button']} ${showSearch ? styles['is-active-state'] : ""}`}
                onClick={() => {
                  setShowSearch((v) => !v);
                  if (showSearch) setSearch("");
                  else setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                title="Search (Ctrl+F)"
              >
                {showSearch ? (
                  <X size={13} strokeWidth={1.8} />
                ) : (
                  <Search size={13} strokeWidth={1.8} />
                )}
              </button>

              <button
                className={`${styles['terminal-button']} ${paused ? styles['is-active-state'] : ""}`}
                onClick={() => (paused ? handleResume() : setPaused(true))}
                title={paused ? "Resume" : "Pause"}
              >
                {paused ? (
                  <Play size={13} strokeWidth={1.8} />
                ) : (
                  <Pause size={13} strokeWidth={1.8} />
                )}
              </button>

              <span className={styles['separator']} />

              <button
                className={styles['terminal-button']}
                onClick={scrollToBottom}
                title="Scroll to bottom"
              >
                <ArrowDown size={13} strokeWidth={1.8} />
              </button>

              <button
                className={styles['terminal-button']}
                onClick={handleClear}
                title="Clear"
              >
                <Trash2 size={13} strokeWidth={1.8} />
              </button>

              <span className={styles['separator']} />

              <button
                className={`${styles['terminal-button']} ${restarting ? styles['restart-spin'] : ""}`}
                onClick={handleRestart}
                disabled={restarting}
                title="Restart container"
              >
                <RotateCw size={13} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {/* Error banner */}
          {error && <div className={styles['error-banner']}>✕ {error}</div>}

          {/* Log body */}
          <div
            ref={bodyRef}
            className={styles['terminal-body']}
            onScroll={handleScroll}
          >
            {filteredLines.length === 0 && connected && (
              <div className={styles['connecting']}>
                <span className={styles['connecting-dot']} />
                Waiting for log output…
              </div>
            )}

            {filteredLines.length === 0 && !connected && !error && (
              <div className={styles['connecting']}>
                <span className={styles['connecting-dot']} />
                Connecting…
              </div>
            )}

            {filteredLines.map((line, i) => (
              <div
                key={i}
                className={`${styles['log-line']} ${LINE_LEVEL_CLASS[line.level || ""] || ""}`}
              >
                <span className={styles['line-number']}>{i + 1}</span>
                {line.timestamp && (
                  <span className={styles['line-timestamp']}>{line.timestamp}</span>
                )}
                <span
                  className={`${styles['line-content']} ${line.level ? LEVEL_CLASS[line.level] || "" : ""}`}
                >
                  {parseAnsi(line.content)}
                </span>
              </div>
            ))}
          </div>

          {/* Paused indicator */}
          {paused && bufferedCount > 0 && (
            <div className={styles['paused-banner']}>
              ⏸ Paused — {bufferedCount} new lines buffered
            </div>
          )}
        </div>
      </>
      ) : (
        <div className={styles['empty-terminal']} data-theme="twilight">
          <ScrollText size={40} strokeWidth={1} />
          <span>Select a container to start streaming logs</span>
        </div>
      )}
    </div>
  );
}
