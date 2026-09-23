"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Fingerprint,
  Key,
  LayoutGrid,
  RefreshCw,
  Table2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  BadgeComponent,
  ButtonComponent,
  EmptyStateComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  SearchInputComponent,
  SegmentedControlComponent,
  TableComponent,
} from "@rodrigo-barraza/components-library";
import { getErrorMessage, isUrl } from "@rodrigo-barraza/utilities-library";

import ApiService from "../services/ApiService";
import {
  categoryStatus,
  filterCategories,
  type CategoryStatus,
  type IntegrationItem,
  type IntegrationsData,
} from "./integrations/integrationsModel";
import styles from "./IntegrationsComponent.module.css";

type ViewMode = "card" | "table";

const VIEW_SEGMENTS = [
  { value: "card", icon: <LayoutGrid size={13} strokeWidth={2.2} /> },
  { value: "table", icon: <Table2 size={13} strokeWidth={2.2} /> },
];

const STATUS_BADGES: Record<CategoryStatus, { variant: string; label: string }> = {
  complete: { variant: "success", label: "All Set" },
  partial: { variant: "warning", label: "Partial" },
  none: { variant: "error", label: "None" },
};

const FINGERPRINT_TITLE = "First 8 hex characters of the key's SHA-256 — identifies the key without revealing it";

function StatusDot({ configured, size, iconSize }: { configured: boolean; size: number; iconSize: number }) {
  return (
    <span
      className={configured ? styles["status-dot-configured"] : styles["status-dot-missing"]}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {configured ? <Check size={iconSize} strokeWidth={3} /> : <X size={iconSize} strokeWidth={3} />}
    </span>
  );
}

function DocsLink({ item, className }: { item: IntegrationItem; className: string }) {
  if (!isUrl(item.docs)) return null;
  return (
    <a
      href={item.docs}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={`Open ${item.provider} dashboard`}
      aria-label={`Open ${item.provider} dashboard`}
    >
      <ExternalLink size={13} strokeWidth={2} />
    </a>
  );
}

const TABLE_COLUMNS = [
  {
    key: "provider",
    label: "Provider",
    sortable: true,
    sortValue: (row: IntegrationItem) => row.provider,
    render: (row: IntegrationItem) => (
      <div className={styles["table-provider-cell"]}>
        <StatusDot configured={row.configured} size={16} iconSize={9} />
        <span className={styles["table-provider-name"]}>{row.provider}</span>
      </div>
    ),
  },
  {
    key: "envKey",
    label: "Environment Key",
    sortable: true,
    sortValue: (row: IntegrationItem) => row.envKey,
    render: (row: IntegrationItem) => <code className={styles["table-env-key"]}>{row.envKey}</code>,
  },
  {
    key: "fingerprint",
    label: "Key Fingerprint",
    sortable: true,
    sortValue: (row: IntegrationItem) => (row.configured ? row.fingerprint || "" : "~"),
    render: (row: IntegrationItem) =>
      row.configured ? (
        <code className={styles["table-fingerprint"]} title={FINGERPRINT_TITLE}>
          {row.fingerprint ? `sha256:${row.fingerprint}` : "Configured"}
        </code>
      ) : (
        <span className={styles["table-not-configured"]}>Not configured</span>
      ),
  },
  {
    key: "docs",
    label: "Docs",
    align: "center" as const,
    render: (row: IntegrationItem) =>
      isUrl(row.docs) ? (
        <DocsLink item={row} className={`${styles["docs-link"]} ${styles["docs-link-centered"]}`} />
      ) : (
        <span className={styles["table-no-docs"]}>—</span>
      ),
  },
];

function IntegrationCard({ item }: { item: IntegrationItem }) {
  return (
    <div
      className={`${styles["integration-card"]} ${item.configured ? styles["configured"] : styles["unconfigured"]}`}
    >
      <div className={styles["card-header"]}>
        <div className={styles["card-status"]}>
          <StatusDot configured={item.configured} size={18} iconSize={10} />
          <span className={styles["provider-name"]}>{item.provider}</span>
        </div>
        <DocsLink item={item} className={styles["docs-link"]} />
      </div>

      <div className={styles["card-body"]}>
        <div className={styles["key-row"]}>
          <Key size={11} strokeWidth={2} className={styles["key-icon"]} />
          <code className={styles["environment-key"]}>{item.envKey}</code>
        </div>
        {item.configured ? (
          <div className={styles["fingerprint"]} title={FINGERPRINT_TITLE}>
            <Fingerprint size={11} strokeWidth={2} aria-hidden="true" />
            <code>{item.fingerprint ? `sha256:${item.fingerprint}` : "Configured"}</code>
          </div>
        ) : (
          <div className={styles["not-configured"]}>
            <span>Not configured</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsComponent() {
  const [result, setResult] = useState<{ data: IntegrationsData | null; error: string | null } | null>(
    null,
  );
  const [reloadToken, setReloadToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("card");

  useEffect(() => {
    let active = true;
    (ApiService.getIntegrations() as Promise<IntegrationsData>)
      .then((data) => active && setResult({ data, error: null }))
      .catch(
        (error: unknown) =>
          // A failed refresh keeps the last good list
          active && setResult((previous) => ({ data: previous?.data ?? null, error: getErrorMessage(error) })),
      )
      .finally(() => active && setRefreshing(false));
    return () => {
      active = false;
    };
  }, [reloadToken]);

  const handleRefresh = () => {
    setRefreshing(true);
    setReloadToken((token) => token + 1);
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories((previous) => ({ ...previous, [category]: !previous[category] }));
  };

  const loading = result === null;
  const data = result?.data ?? null;
  const filteredCategories = useMemo(
    () => filterCategories(data?.categories ?? [], searchQuery),
    [data, searchQuery],
  );

  return (
    <div className={`integrations-component ${styles["integrations"]}`}>
      <PageHeaderComponent
        sticky={false}
        title="Integrations"
        subtitle={
          loading
            ? "Loading integrations…"
            : data
              ? `${data.configuredCount} of ${data.totalCount} API keys configured`
              : "Couldn't load integrations"
        }
      >
        <div className={styles["header-controls"]}>
          {data && (
            <SegmentedControlComponent
              value={viewMode}
              onChange={(value: string) => setViewMode(value as ViewMode)}
              segments={VIEW_SEGMENTS}
              compact
            />
          )}
          <ButtonComponent variant="secondary" icon={RefreshCw} loading={refreshing} onClick={handleRefresh}>
            Refresh
          </ButtonComponent>
        </div>
      </PageHeaderComponent>

      {loading ? (
        <LoadingIndicatorComponent size="small" label="Loading integrations…" className="is-loading-centered-state" />
      ) : !data ? (
        <EmptyStateComponent
          icon={<TriangleAlert size={40} strokeWidth={1.5} />}
          title="Couldn't load integrations"
          subtitle={result.error ?? undefined}
        >
          <ButtonComponent variant="secondary" icon={RefreshCw} loading={refreshing} onClick={handleRefresh}>
            Retry
          </ButtonComponent>
        </EmptyStateComponent>
      ) : (
        <>
          {result.error && (
            <p className={styles["refresh-error"]} role="alert">
              <TriangleAlert size={14} /> Refresh failed — showing the previous list. {result.error}
            </p>
          )}

          <div className={styles["search-bar"]}>
            <SearchInputComponent
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search providers, keys…"
              compact
            />
          </div>

          <div className={styles["stats-row"]}>
            <div className={styles["stat-card"]}>
              <span className={styles["stat-value"]}>{data.totalCount}</span>
              <span className={styles["stat-label"]}>Total Services</span>
            </div>
            <div className={`${styles["stat-card"]} ${styles["stat-configured"]}`}>
              <span className={styles["stat-value"]}>{data.configuredCount}</span>
              <span className={styles["stat-label"]}>Configured</span>
            </div>
            <div className={`${styles["stat-card"]} ${styles["stat-missing"]}`}>
              <span className={styles["stat-value"]}>{data.totalCount - data.configuredCount}</span>
              <span className={styles["stat-label"]}>Missing</span>
            </div>
          </div>

          <div className={styles["category-list"]}>
            {filteredCategories.map((category, index) => {
              const isCollapsed = Boolean(collapsedCategories[category.category]);
              const badge = STATUS_BADGES[categoryStatus(category)];
              const panelId = `integrations-${category.category.replace(/\W+/g, "-")}`;
              return (
                <div
                  key={category.category}
                  className={styles["category-group"]}
                  style={{ animationDelay: `${Math.min(index, 20) * 50}ms` }}
                >
                  <button
                    type="button"
                    className={styles["category-header"]}
                    onClick={() => toggleCategory(category.category)}
                    aria-expanded={!isCollapsed}
                    aria-controls={panelId}
                  >
                    <span className={styles["category-left"]}>
                      {isCollapsed ? (
                        <ChevronRight size={14} strokeWidth={2.5} />
                      ) : (
                        <ChevronDown size={14} strokeWidth={2.5} />
                      )}
                      <span className={styles["category-name"]}>{category.category}</span>
                    </span>
                    <span className={styles["category-badges"]}>
                      <span className={styles["category-count"]}>
                        {category.configuredCount}/{category.totalCount}
                      </span>
                      <BadgeComponent variant={badge.variant}>{badge.label}</BadgeComponent>
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div id={panelId}>
                      {viewMode === "table" ? (
                        <TableComponent<IntegrationItem>
                          columns={TABLE_COLUMNS}
                          data={category.integrations}
                          getRowKey={(row: IntegrationItem) => row.envKey}
                          emptyText="No integrations in this category"
                        />
                      ) : (
                        <div className={styles["integration-cards"]}>
                          {category.integrations.map((item) => (
                            <IntegrationCard key={item.envKey} item={item} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredCategories.length === 0 && (
              <div className={styles["empty-state"]}>
                {searchQuery.trim() ? "No integrations match your search" : "No integrations are defined"}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
