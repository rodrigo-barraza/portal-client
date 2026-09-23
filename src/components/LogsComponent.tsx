"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, Pause, Play, RotateCw, ScrollText, Search, Trash2, X } from "lucide-react";
import {
  IconButtonComponent,
  PageHeaderComponent,
  SearchInputComponent,
  SelectComponent,
} from "@rodrigo-barraza/components-library";
import { getErrorMessage } from "@rodrigo-barraza/utilities-library";
import ApiService from "../services/ApiService";
import { usePortalSettings } from "@/lib/settings";
import useAsyncData from "./analytics/useAsyncData";
import { containerKey } from "./monitoring/containerHistory";
import { thresholdsFromSettings } from "./monitoring/severity";
import { useActionRunner } from "./monitoring/useActionRunner";
import LogLineRow from "./logs/LogLineRow";
import LogStatisticsPanel from "./logs/LogStatisticsPanel";
import {
  buildContainerOptions,
  findLinkedContainer,
  type LoggableContainer,
} from "./logs/logContainers";
import { filterLogLines } from "./logs/logLines";
import { useContainerStatistics } from "./logs/useContainerStatistics";
import { useLogStream } from "./logs/useLogStream";
import styles from "./LogsComponent.module.css";

/** Within this many pixels of the bottom counts as "following" the log. */
const FOLLOW_THRESHOLD_PIXELS = 60;
const NO_CONTAINERS: LoggableContainer[] = [];

export default function LogsComponent() {
  const { alertThresholdCpu, alertThresholdMemory, containerPollingInterval } =
    usePortalSettings();
  const thresholds = useMemo(
    () => thresholdsFromSettings({ alertThresholdCpu, alertThresholdMemory }),
    [alertThresholdCpu, alertThresholdMemory],
  );
  const searchParams = useSearchParams();

  const containerList = useAsyncData<LoggableContainer[]>(
    "loggable-containers",
    async (signal) => (await ApiService.getLoggableContainers({ signal })).containers,
  );
  const containers = containerList.data ?? NO_CONTAINERS;
  const listError = containerList.error ? getErrorMessage(containerList.error) : null;
  const [autoScroll, setAutoScroll] = useState(true);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autoConnectedRef = useRef(false);

  const stream = useLogStream();
  const { target, connect } = stream;
  const targetKey = target ? containerKey(target.device, target.container) : null;
  const statistics = useContainerStatistics(target, containerPollingInterval);

  const { pending, requestAction, actionUi } = useActionRunner({
    onSettled: (request, succeeded) => {
      // The restart ended the old log stream — follow the new container,
      // unless the user has moved on to another one meanwhile.
      if (succeeded && target && request.key === targetKey) connect(target);
    },
  });

  // ── Container list ──────────────────────────────────────────────
  const containerOptions = useMemo(() => buildContainerOptions(containers), [containers]);
  const selectOptions = useMemo(
    () =>
      containerOptions.map((option) => ({
        value: option.value,
        label: option.label,
        icon: (
          <span
            className={`${styles['status-dot']} ${
              option.container.state === "running"
                ? styles['status-dot-healthy']
                : styles['status-dot-unhealthy']
            }`}
          />
        ),
      })),
    [containerOptions],
  );

  const openContainer = useCallback(
    (container: LoggableContainer) => {
      connect({ container: container.name, device: container.device });
      setAutoScroll(true);
    },
    [connect],
  );

  // ── Deep link: /logs?container=<name>&device=<id> ───────────────
  useEffect(() => {
    if (autoConnectedRef.current || containers.length === 0) return;
    const name = searchParams.get("container") || searchParams.get("service");
    if (!name) return;
    const match = findLinkedContainer(containers, name, searchParams.get("device"));
    if (!match) return;
    autoConnectedRef.current = true;
    queueMicrotask(() => openContainer(match));
  }, [searchParams, containers, openContainer]);

  // ── Follow the tail ─────────────────────────────────────────────
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (autoScroll && !stream.paused && body) body.scrollTop = body.scrollHeight;
  }, [stream.lines, autoScroll, stream.paused]);

  const handleScroll = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    setAutoScroll(body.scrollHeight - body.scrollTop - body.clientHeight < FOLLOW_THRESHOLD_PIXELS);
  }, []);

  const scrollToBottom = () => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
    setAutoScroll(true);
  };

  const handleResume = () => {
    stream.resume();
    setAutoScroll(true);
  };

  const closeSearch = () => {
    setShowSearch(false);
    setSearch("");
  };

  // ── Ctrl/⌘+F opens the filter (only while a log is open) ────────
  useEffect(() => {
    if (!target) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setShowSearch(true);
        searchInputRef.current?.focus();
      } else if (event.key === "Escape" && showSearch) {
        setShowSearch(false);
        setSearch("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [target, showSearch]);

  const filteredLines = useMemo(
    () => filterLogLines(stream.lines, search),
    [stream.lines, search],
  );

  const restarting = targetKey !== null && pending[targetKey] !== undefined;
  const handleRestart = () => {
    if (!target || !targetKey) return;
    const { container, device } = target;
    requestAction({
      key: targetKey,
      name: container,
      action: "restart",
      run: () => ApiService.restartContainer(container, device),
    });
  };

  const renderBodyMessage = () => {
    if (filteredLines.length > 0) return null;
    let message: string | null = null;
    if (stream.lines.length > 0) message = `No lines match “${search.trim()}”`;
    else if (stream.ended) message = "Log stream ended";
    else if (stream.connected) message = "Waiting for log output…";
    else if (!stream.error) message = "Connecting…";
    if (!message) return null;
    return (
      <div className={styles['connecting']}>
        <span className={styles['connecting-dot']} />
        {message}
      </div>
    );
  };

  return (
    <div className={`logs-component ${styles['logs']}`}>
      <PageHeaderComponent
        sticky={false}
        title="Logs"
        subtitle={
          target
            ? `Streaming ${target.container} logs`
            : "Select a container to view live Docker logs"
        }
      />

      {/* ── Container Selector ── */}
      <div className={styles['container-select']}>
        <SelectComponent
          value={targetKey ?? ""}
          options={selectOptions}
          onChange={(value: string) => {
            const option = containerOptions.find((candidate) => candidate.value === value);
            if (option) openContainer(option.container);
          }}
          placeholder="Select a container…"
          searchable
          triggerClassName={styles['container-select-trigger']}
        />
      </div>

      {target ? (
        <>
          {statistics && <LogStatisticsPanel stats={statistics} thresholds={thresholds} />}

          <div className={styles['terminal']} data-theme="twilight">
            <div className={styles['terminal-header']}>
              <div className={styles['terminal-title']}>
                <span
                  className={`${styles['terminal-dot']} ${stream.connected ? styles['connected'] : ""}`}
                />
                {target.container}
                {stream.connected && <span className={styles['live-label']}>live</span>}
              </div>

              <div className={styles['terminal-actions']}>
                <span className={styles['line-count']}>
                  {filteredLines.length.toLocaleString()}
                </span>

                <span className={styles['separator']} />

                {showSearch && (
                  <SearchInputComponent
                    ref={searchInputRef}
                    value={search}
                    onChange={setSearch}
                    placeholder="Filter…"
                    autoFocus
                    className={styles['search-input']}
                  />
                )}

                <IconButtonComponent
                  icon={
                    showSearch ? (
                      <X size={13} strokeWidth={1.8} />
                    ) : (
                      <Search size={13} strokeWidth={1.8} />
                    )
                  }
                  active={showSearch}
                  tooltip="Search (Ctrl+F)"
                  aria-label={showSearch ? "Close search" : "Search logs"}
                  onClick={() => (showSearch ? closeSearch() : setShowSearch(true))}
                />

                <IconButtonComponent
                  icon={
                    stream.paused ? (
                      <Play size={13} strokeWidth={1.8} />
                    ) : (
                      <Pause size={13} strokeWidth={1.8} />
                    )
                  }
                  active={stream.paused}
                  tooltip={stream.paused ? "Resume" : "Pause"}
                  aria-label={stream.paused ? "Resume" : "Pause"}
                  onClick={() => (stream.paused ? handleResume() : stream.pause())}
                />

                <span className={styles['separator']} />

                <IconButtonComponent
                  icon={<ArrowDown size={13} strokeWidth={1.8} />}
                  tooltip="Scroll to bottom"
                  aria-label="Scroll to bottom"
                  onClick={scrollToBottom}
                />

                <IconButtonComponent
                  icon={<Trash2 size={13} strokeWidth={1.8} />}
                  tooltip="Clear"
                  aria-label="Clear"
                  onClick={stream.clear}
                />

                <span className={styles['separator']} />

                <IconButtonComponent
                  icon={<RotateCw size={13} strokeWidth={1.8} />}
                  tooltip="Restart container"
                  aria-label={`Restart ${target.container}`}
                  onClick={handleRestart}
                  disabled={restarting}
                  className={restarting ? styles['restart-spin'] : undefined}
                />
              </div>
            </div>

            {stream.error && <div className={styles['error-banner']}>✕ {stream.error}</div>}

            <div ref={bodyRef} className={styles['terminal-body']} onScroll={handleScroll}>
              {renderBodyMessage()}
              {filteredLines.map((line) => (
                <LogLineRow key={line.id} line={line} />
              ))}
            </div>

            {stream.paused && stream.bufferedCount > 0 && (
              <div className={styles['paused-banner']}>
                ⏸ Paused — {stream.bufferedCount.toLocaleString()} new lines buffered
                {stream.bufferedCount >= stream.maxLines ? " (newest kept)" : ""}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className={styles['empty-terminal']} data-theme="twilight">
          <ScrollText size={40} strokeWidth={1} />
          <span>
            {listError
              ? `Couldn't load containers: ${listError}`
              : "Select a container to start streaming logs"}
          </span>
        </div>
      )}

      {actionUi}
    </div>
  );
}
