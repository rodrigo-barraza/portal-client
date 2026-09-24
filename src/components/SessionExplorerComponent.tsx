"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ButtonComponent,
  PaginationComponent,
  SegmentedControlComponent,
  TableComponent,
} from "@rodrigo-barraza/components-library";
import {
  Activity,
  ArrowLeft,
  Film,
  ListFilter,
  Plus,
  Search,
  X,
} from "lucide-react";
import ApiService from "../services/ApiService";
import useAsyncData, { unwrapData } from "./analytics/useAsyncData";
import { ExplorerLoading, StateMessage } from "./analytics/ExplorerPrimitives";
import { SORTABLE_COLUMNS, sessionColumns } from "./analytics/explorerColumns";
import SessionDetailComponent from "./analytics/SessionDetailComponent";
import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  TEXT_FILTERS,
  filterChips,
  filtersKey,
  hasFilters,
  parseSortValue,
  removeFilter,
  setTextFilter,
  sortValue,
  type ExplorerState,
  type TextFilterKey,
} from "./analytics/explorerModel";
import {
  formatCount,
  readableErrorMessage,
  shortId,
} from "./analytics/analyticsFormat";
import { describePeriod, toSessionRange } from "./analytics/analyticsSeries";
import type {
  SessionFilters,
  SessionRange,
  SessionSort,
  SessionSortKey,
  SessionSummary,
} from "@/types/portal";
import styles from "./SessionExplorerComponent.module.css";

/**
 * SessionExplorerComponent — every session of a project, one server-side
 * paginated table (50 a page) filtered and sorted by sessions-service, and
 * one session's detail in its place.
 *
 * What it shows — filters, all-time scope, the open session — is owned by
 * the report around it (`state` / `onStateChange`), so the report's panels
 * can drill in ("sessions from Canada"). Paging and sort are its own, and
 * a new query starts again at page one.
 */

const PAGE_SIZE = 50;

type Scope = "range" | "all";

export default function SessionExplorerComponent({
  projectId,
  period,
  state,
  onStateChange,
}: {
  projectId: string;
  /** The dashboard's period; the "All time" scope ignores it. */
  period: string;
  state: ExplorerState;
  onStateChange: (state: ExplorerState) => void;
}) {
  const [sort, setSort] = useState<SessionSort>(DEFAULT_SORT);
  const range: SessionRange = state.allTime
    ? { period: "all" }
    : toSessionRange(period);

  // Page 1 whenever the query changes — derived, so no reset effect
  const queryKey = JSON.stringify([
    projectId,
    range,
    filtersKey(state.filters),
    sort,
  ]);
  const [paging, setPaging] = useState({ key: queryKey, offset: 0 });
  const offset = paging.key === queryKey ? paging.offset : 0;

  const sessions = useAsyncData(
    `${queryKey}|${offset}`,
    (signal) =>
      ApiService.getSessionsList(
        projectId,
        range,
        state.filters,
        { limit: PAGE_SIZE, offset },
        sort,
        { signal },
      ).then(unwrapData),
    { keepPreviousData: true },
  );

  const update = (patch: Partial<ExplorerState>) =>
    onStateChange({ ...state, ...patch });
  const setFilters = (filters: SessionFilters) =>
    update({ filters, sessionId: null });
  const openSession = (sessionId: string) => update({ sessionId });

  const columns = useMemo(
    () => sessionColumns((sessionId) => onStateChange({ ...state, sessionId })),
    [onStateChange, state],
  );

  // ══ Detail view ═════════════════════════════════════════

  if (state.sessionId) {
    return (
      <section
        className={`session-explorer-component ${styles["explorer"]}`}
        aria-label="Session explorer"
      >
        <SessionDetailHeader
          sessionId={state.sessionId}
          onBack={() => update({ sessionId: null })}
        />
        <SessionDetailComponent
          key={state.sessionId}
          sessionId={state.sessionId}
          onShowSessions={(filters) =>
            onStateChange({ filters, allTime: true, sessionId: null })
          }
        />
      </section>
    );
  }

  // ══ List view ═══════════════════════════════════════════

  const page = sessions.data;
  const rows = page?.sessions ?? [];
  const total = page?.total ?? 0;
  const filtered = hasFilters(state.filters);

  const changeSort = (key: string, direction: "asc" | "desc") => {
    if (!SORTABLE_COLUMNS.includes(key as SessionSortKey)) return;
    // A new column starts at its most useful end: newest, most, longest
    setSort({
      sort: key as SessionSortKey,
      order: key === sort.sort ? direction : "desc",
    });
  };

  let body;
  if (sessions.loading && !page) {
    body = <ExplorerLoading label="Loading sessions…" />;
  } else if (sessions.error && !sessions.loading) {
    const message = readableErrorMessage(sessions.error);
    body = (
      <StateMessage isError>
        Could not load sessions{message ? `: ${message}` : "."}
      </StateMessage>
    );
  } else if (rows.length === 0 && !sessions.loading) {
    body = (
      <StateMessage>
        {filtered
          ? "No sessions match these filters."
          : state.allTime
            ? "No sessions recorded yet — they appear here as soon as the tracker sends its first pageview."
            : "No sessions in this range yet."}
        {(filtered || !state.allTime) && (
          <span className={styles["empty-actions"]}>
            {filtered && (
              <ButtonComponent
                variant="text"
                size="small"
                icon={X}
                onClick={() => setFilters({})}
              >
                Clear filters
              </ButtonComponent>
            )}
            {!state.allTime && (
              <ButtonComponent
                variant="text"
                size="small"
                icon={Search}
                onClick={() => update({ allTime: true })}
              >
                Search all time
              </ButtonComponent>
            )}
          </span>
        )}
      </StateMessage>
    );
  } else {
    body = (
      <div
        className={sessions.loading ? styles["list-updating"] : undefined}
        aria-busy={sessions.loading || undefined}
      >
        <TableComponent<SessionSummary>
          columns={columns}
          data={rows}
          getRowKey={(row: SessionSummary) => row.sessionId}
          onRowClick={(row: SessionSummary) => openSession(row.sessionId)}
          sortKey={sort.sort}
          sortDir={sort.order}
          onSort={changeSort}
          emptyText="No sessions."
          mini
          storageKey="web-analytics-sessions"
        />
        <PaginationComponent
          page={Math.floor(offset / PAGE_SIZE) + 1}
          totalPages={Math.ceil(total / PAGE_SIZE)}
          totalItems={total}
          limit={PAGE_SIZE}
          onPageChange={(nextPage) =>
            setPaging({ key: queryKey, offset: (nextPage - 1) * PAGE_SIZE })
          }
        />
      </div>
    );
  }

  return (
    <section
      className={`session-explorer-component ${styles["explorer"]}`}
      aria-label="Session explorer"
    >
      <div className={styles["explorer-header"]}>
        <h3 className={styles["explorer-title"]}>
          <Activity size={15} strokeWidth={2.2} aria-hidden />
          Sessions
        </h3>
        {page && (
          <span className={styles["explorer-count"]} aria-live="polite">
            {formatCount(total, "session")}
          </span>
        )}
        <div className={styles["controls-right"]}>
          <div role="group" aria-label="Sessions to search">
            <SegmentedControlComponent
              value={state.allTime ? "all" : "range"}
              onChange={(value: string) =>
                update({ allTime: (value as Scope) === "all" })
              }
              segments={[
                { value: "range", label: describePeriod(period) },
                { value: "all", label: "All time" },
              ]}
              compact
            />
          </div>
          <select
            className={styles["select"]}
            aria-label="Sort sessions"
            value={sortValue(sort)}
            onChange={(event) => setSort(parseSortValue(event.target.value))}
          >
            {SORT_OPTIONS.map((option) => (
              <option
                key={sortValue(option.sort)}
                value={sortValue(option.sort)}
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <FilterBar filters={state.filters} onChange={setFilters} />

      {body}
    </section>
  );
}

// ── Detail header (back + id) ─────────────────────────────────

function SessionDetailHeader({
  sessionId,
  onBack,
}: {
  sessionId: string;
  onBack: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  // Move focus to the detail it opened, so keyboard and screen-reader
  // users land on it rather than on a row that no longer exists
  useEffect(() => {
    headingRef.current?.focus();
  }, [sessionId]);

  return (
    <div className={styles["detail-header"]}>
      <ButtonComponent
        variant="text"
        size="small"
        icon={ArrowLeft}
        onClick={onBack}
      >
        Back to sessions
      </ButtonComponent>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className={styles["detail-session-id"]}
        title={sessionId}
      >
        Session {shortId(sessionId, 12)}
      </h3>
    </div>
  );
}

// ── Filters ───────────────────────────────────────────────────

function FilterBar({
  filters,
  onChange,
}: {
  filters: SessionFilters;
  onChange: (filters: SessionFilters) => void;
}) {
  const [field, setField] = useState<TextFilterKey>(TEXT_FILTERS[0].key);
  const [value, setValue] = useState("");
  const chips = filterChips(filters);
  const placeholder =
    TEXT_FILTERS.find((filter) => filter.key === field)?.placeholder ?? "";

  const addFilter = (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    onChange(setTextFilter(filters, field, value));
    setValue("");
  };

  return (
    <>
      <div className={styles["filter-bar"]}>
        <button
          type="button"
          className={styles["toggle-chip"]}
          aria-pressed={!!filters.replay}
          onClick={() =>
            onChange(
              filters.replay
                ? removeFilter(filters, "replay")
                : { ...filters, replay: true },
            )
          }
        >
          <Film size={12} strokeWidth={2.2} aria-hidden />
          With replay
        </button>
        <button
          type="button"
          className={styles["toggle-chip"]}
          aria-pressed={!!filters.engaged}
          onClick={() =>
            onChange(
              filters.engaged
                ? removeFilter(filters, "engaged")
                : { ...filters, engaged: true },
            )
          }
        >
          <Activity size={12} strokeWidth={2.2} aria-hidden />
          Engaged only
        </button>

        <form
          className={styles["filter-form"]}
          onSubmit={addFilter}
          aria-label="Add a filter"
        >
          <ListFilter size={14} strokeWidth={2.2} aria-hidden />
          <select
            className={styles["select"]}
            aria-label="Filter by"
            value={field}
            onChange={(event) => setField(event.target.value as TextFilterKey)}
          >
            {TEXT_FILTERS.map((filter) => (
              <option key={filter.key} value={filter.key}>
                {filter.label}
              </option>
            ))}
          </select>
          <input
            className={styles["filter-input"]}
            aria-label="Filter value"
            placeholder={placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <button
            type="submit"
            className={styles["toggle-chip"]}
            disabled={!value.trim()}
          >
            <Plus size={12} strokeWidth={2.2} aria-hidden />
            Add filter
          </button>
        </form>
      </div>

      {chips.length > 0 && (
        <ul className={styles["filter-chips"]} aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.key} className={styles["filter-chip"]}>
              <span className={styles["filter-chip-label"]}>{chip.label}</span>
              <span className={styles["filter-chip-value"]} title={chip.value}>
                {chip.display}
              </span>
              <button
                type="button"
                className={styles["filter-chip-remove"]}
                aria-label={`Remove filter ${chip.label}: ${chip.value}`}
                onClick={() => onChange(removeFilter(filters, chip.key))}
              >
                <X size={12} strokeWidth={2.4} aria-hidden />
              </button>
            </li>
          ))}
          {chips.length > 1 && (
            <li>
              <ButtonComponent
                variant="text"
                size="small"
                onClick={() =>
                  onChange({
                    replay: filters.replay,
                    engaged: filters.engaged,
                  })
                }
              >
                Clear all
              </ButtonComponent>
            </li>
          )}
        </ul>
      )}
    </>
  );
}
