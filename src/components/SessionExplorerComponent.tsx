"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  ButtonComponent,
  PaginationComponent,
  SearchInputComponent,
  TabBarComponent,
  TableComponent,
} from "@rodrigo-barraza/components-library";
import { ArrowLeft, Clock, LayoutGrid, Network, Table2, Users } from "lucide-react";
import { formatNumber } from "@rodrigo-barraza/utilities-library";
import ApiService from "../services/ApiService";
import useAsyncData, { unwrapData } from "./analytics/useAsyncData";
import { ExplorerLoading, StateMessage } from "./analytics/ExplorerPrimitives";
import { IpCard, SessionCard, VisitorCard } from "./analytics/ExplorerCards";
import { ipColumns, sessionColumns, visitorColumns } from "./analytics/explorerColumns";
import IpDetailComponent from "./analytics/IpDetailComponent";
import SessionDetailComponent from "./analytics/SessionDetailComponent";
import IconSegmentedControlComponent from "./analytics/IconSegmentedControlComponent";
import { readableErrorMessage, shortId } from "./analytics/analyticsFormat";
import {
  filterIpUsers,
  filterSessions,
  filterVisitors,
  type ExplorerSession,
  type IpUser,
  type IpUsersPage,
  type SessionsPage,
  type Visitor,
  type VisitorsPage,
} from "./analytics/explorerModel";
import styles from "./SessionExplorerComponent.module.css";

/**
 * SessionExplorerComponent — the first-party explorer under a project's
 * report: IPs, visitors and sessions (cards or table, paginated), drilling
 * into an IP profile or a single session.
 *
 * Detail views form a stack — list → IP → session → IP … — and "Back" pops
 * one level, so a session opened from an IP profile returns to that IP.
 * The parent keys this component by project + period, so a period change
 * remounts it with fresh state.
 */

const PAGE_SIZE = 50;

type Tab = "ips" | "visitors" | "sessions";
type ViewMode = "cards" | "table";
type ExplorerView = { kind: "ip"; ip: string } | { kind: "session"; sessionId: string };

const TAB_NOUNS: Record<Tab, string> = { ips: "IPs", visitors: "visitors", sessions: "sessions" };

function sameView(first: ExplorerView | undefined, second: ExplorerView): boolean {
  if (!first || first.kind !== second.kind) return false;
  return first.kind === "ip"
    ? first.ip === (second as { ip: string }).ip
    : first.sessionId === (second as { sessionId: string }).sessionId;
}

function backLabel(previous: ExplorerView | undefined): string {
  if (!previous) return "Back to list";
  return previous.kind === "ip"
    ? `Back to ${previous.ip}`
    : `Back to session ${shortId(previous.sessionId, 8)}`;
}

export default function SessionExplorerComponent({
  projectId,
  period,
}: {
  projectId: string;
  period: string;
}) {
  const [tab, setTab] = useState<Tab>("ips");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [offsets, setOffsets] = useState<Record<Tab, number>>({ ips: 0, visitors: 0, sessions: 0 });
  const [viewStack, setViewStack] = useState<ExplorerView[]>([]);

  // ── Paged lists (all three load up front: the tab badges show totals) ──

  const listOptions = { keepPreviousData: true };
  const ips = useAsyncData(
    `ips|${projectId}|${period}|${offsets.ips}`,
    () =>
      ApiService.getSessionIpUsers(projectId, period, PAGE_SIZE, offsets.ips).then(
        unwrapData<IpUsersPage>,
      ),
    listOptions,
  );
  const visitors = useAsyncData(
    `visitors|${projectId}|${period}|${offsets.visitors}`,
    () =>
      ApiService.getSessionVisitors(projectId, period, PAGE_SIZE, offsets.visitors).then(
        unwrapData<VisitorsPage>,
      ),
    listOptions,
  );
  const sessions = useAsyncData(
    `sessions|${projectId}|${period}|${offsets.sessions}`,
    () =>
      ApiService.getSessionsList(projectId, period, PAGE_SIZE, offsets.sessions).then(
        unwrapData<SessionsPage>,
      ),
    listOptions,
  );

  const ipItems = ips.data?.ips;
  const visitorItems = visitors.data?.visitors;
  const sessionItems = sessions.data?.sessions;
  const filteredIps = useMemo(() => filterIpUsers(ipItems ?? [], searchQuery), [ipItems, searchQuery]);
  const filteredVisitors = useMemo(
    () => filterVisitors(visitorItems ?? [], searchQuery),
    [visitorItems, searchQuery],
  );
  const filteredSessions = useMemo(
    () => filterSessions(sessionItems ?? [], searchQuery),
    [sessionItems, searchQuery],
  );

  // ── Navigation ────────────────────────────────────────────

  const openView = useCallback((view: ExplorerView) => {
    setViewStack((stack) => (sameView(stack.at(-1), view) ? stack : [...stack, view]));
  }, []);
  const openIp = useCallback((ip: string) => openView({ kind: "ip", ip }), [openView]);
  const openSession = useCallback(
    (sessionId: string) => openView({ kind: "session", sessionId }),
    [openView],
  );
  const goBack = () => setViewStack((stack) => stack.slice(0, -1));

  const ipTableColumns = useMemo(() => ipColumns(openIp), [openIp]);
  const visitorTableColumns = useMemo(() => visitorColumns(openIp), [openIp]);
  const sessionTableColumns = useMemo(() => sessionColumns(openSession), [openSession]);

  // ══ Detail views ════════════════════════════════════════

  const currentView = viewStack.at(-1);
  if (currentView) {
    return (
      <div className={styles["explorer"]}>
        <div className={styles["detail-header"]}>
          <ButtonComponent variant="text" size="small" icon={ArrowLeft} onClick={goBack}>
            {backLabel(viewStack.at(-2))}
          </ButtonComponent>
          <h3 className={styles["detail-session-id"]}>
            {currentView.kind === "ip" ? (
              <>
                <Network size={14} strokeWidth={2.2} aria-hidden />
                {currentView.ip}
              </>
            ) : (
              <span title={currentView.sessionId}>{shortId(currentView.sessionId, 8)}</span>
            )}
          </h3>
        </div>

        {currentView.kind === "ip" ? (
          <IpDetailComponent
            key={currentView.ip}
            ip={currentView.ip}
            projectId={projectId}
            period={period}
            onOpenSession={openSession}
          />
        ) : (
          <SessionDetailComponent
            key={currentView.sessionId}
            sessionId={currentView.sessionId}
            onOpenIp={openIp}
          />
        )}
      </div>
    );
  }

  // ══ List view ═══════════════════════════════════════════

  const pagination = (current: Tab, total: number) => (
    <PaginationComponent
      page={Math.floor(offsets[current] / PAGE_SIZE) + 1}
      totalPages={Math.ceil(total / PAGE_SIZE)}
      totalItems={total}
      limit={PAGE_SIZE}
      onPageChange={(page) =>
        setOffsets((previous) => ({ ...previous, [current]: (page - 1) * PAGE_SIZE }))
      }
    />
  );

  return (
    <div className={`session-explorer-component ${styles["explorer"]}`}>
      <section className={styles["controls-container"]}>
        <TabBarComponent
          ariaLabel="Session explorer views"
          tabs={[
            {
              key: "ips",
              label: "IPs",
              icon: <Network size={13} strokeWidth={2.2} />,
              badge: ips.data?.total ? formatNumber(ips.data.total) : undefined,
            },
            {
              key: "visitors",
              label: "Visitors",
              icon: <Users size={13} strokeWidth={2.2} />,
              badge: visitors.data?.total ? formatNumber(visitors.data.total) : undefined,
            },
            {
              key: "sessions",
              label: "Sessions",
              icon: <Clock size={13} strokeWidth={2.2} />,
              badge: sessions.data?.total ? formatNumber(sessions.data.total) : undefined,
            },
          ]}
          activeTab={tab}
          onChange={(key) => setTab(key as Tab)}
        />

        <div className={styles["controls-right"]}>
          <IconSegmentedControlComponent<ViewMode>
            value={viewMode}
            onChange={setViewMode}
            ariaLabel="View mode"
            segments={[
              { value: "cards", icon: <LayoutGrid size={14} strokeWidth={2.2} />, label: "Card view" },
              { value: "table", icon: <Table2 size={14} strokeWidth={2.2} />, label: "Table view" },
            ]}
          />
          {/* The APIs have no search — this filters the loaded page only */}
          <SearchInputComponent
            value={searchQuery}
            onChange={(value: string) => setSearchQuery(value)}
            placeholder={`Filter ${TAB_NOUNS[tab]} on this page…`}
            compact
            id="session-explorer-search-input"
          />
        </div>
      </section>

      {tab === "ips" && (
        <ExplorerList<IpUser>
          noun="IPs"
          loading={ips.loading}
          error={ips.error}
          items={ipItems}
          filtered={filteredIps}
          pagination={pagination("ips", ips.data?.total ?? 0)}
          cards={filteredIps.map((ipUser) => (
            <IpCard key={ipUser.ip} ipUser={ipUser} onOpen={openIp} />
          ))}
          table={
            <TableComponent<IpUser>
              columns={ipTableColumns}
              data={filteredIps}
              getRowKey={(row: IpUser) => row.ip}
              onRowClick={(row: IpUser) => openIp(row.ip)}
              emptyText="No IPs match your filter."
              mini
              storageKey="session-explorer-ips"
            />
          }
          viewMode={viewMode}
        />
      )}

      {tab === "visitors" && (
        <ExplorerList<Visitor>
          noun="visitors"
          loading={visitors.loading}
          error={visitors.error}
          items={visitorItems}
          filtered={filteredVisitors}
          pagination={pagination("visitors", visitors.data?.total ?? 0)}
          cards={filteredVisitors.map((visitor) => (
            <VisitorCard
              key={visitor.visitorId}
              visitor={visitor}
              onOpenIp={openIp}
              onOpenSession={openSession}
            />
          ))}
          table={
            <TableComponent<Visitor>
              columns={visitorTableColumns}
              data={filteredVisitors}
              getRowKey={(row: Visitor) => row.visitorId}
              emptyText="No visitors match your filter."
              mini
              storageKey="session-explorer-visitors"
            />
          }
          viewMode={viewMode}
        />
      )}

      {tab === "sessions" && (
        <ExplorerList<ExplorerSession>
          noun="sessions"
          loading={sessions.loading}
          error={sessions.error}
          items={sessionItems}
          filtered={filteredSessions}
          pagination={pagination("sessions", sessions.data?.total ?? 0)}
          cards={filteredSessions.map((session) => (
            <SessionCard key={session.sessionId} session={session} onOpen={openSession} />
          ))}
          table={
            <TableComponent<ExplorerSession>
              columns={sessionTableColumns}
              data={filteredSessions}
              getRowKey={(row: ExplorerSession) => row.sessionId}
              onRowClick={(row: ExplorerSession) => openSession(row.sessionId)}
              emptyText="No sessions match your filter."
              mini
              storageKey="session-explorer-sessions"
            />
          }
          viewMode={viewMode}
        />
      )}
    </div>
  );
}

/** One tab's body: loading → error → empty → no matches → cards/table + pages. */
function ExplorerList<T>({
  noun,
  loading,
  error,
  items,
  filtered,
  cards,
  table,
  viewMode,
  pagination,
}: {
  noun: string;
  loading: boolean;
  error: Error | null;
  items: T[] | undefined;
  filtered: T[];
  cards: ReactNode;
  table: ReactNode;
  viewMode: ViewMode;
  pagination: ReactNode;
}) {
  if (loading) return <ExplorerLoading label={`Loading ${noun}…`} />;
  if (error) {
    const message = readableErrorMessage(error);
    return (
      <StateMessage isError>
        Could not load {noun}
        {message ? `: ${message}` : "."}
      </StateMessage>
    );
  }
  if (!items || items.length === 0) return <StateMessage>No {noun} in this period.</StateMessage>;
  return (
    <>
      {filtered.length === 0 ? (
        // Keep the pager: the filter only sees this page, so the match may be on the next
        <StateMessage>No {noun} on this page match your filter.</StateMessage>
      ) : viewMode === "cards" ? (
        <div className={styles["card-list"]}>{cards}</div>
      ) : (
        table
      )}
      {pagination}
    </>
  );
}
