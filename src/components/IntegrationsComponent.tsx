"use client";

import { useState, useRef, useEffect } from "react";
import {
  RefreshCw,
  ExternalLink,
  Check,
  X,
  Key,
  Search,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Table2,
} from "lucide-react";
import {
  BadgeComponent,
  ButtonComponent,
  InputComponent,
  LoadingIndicatorComponent,
  PageHeaderComponent,
  TableComponent,
  SegmentedControlComponent,
  SearchInputComponent,
} from "@rodrigo-barraza/components-library";

import ApiService from "../services/ApiService";
import styles from "./IntegrationsComponent.module.css";

interface IntegrationItem {
  provider: string;
  envKey: string;
  category: string;
  configured: boolean;
  docs?: string;
  maskedKey?: string;
}

interface IntegrationCategory {
  category: string;
  integrations: IntegrationItem[];
  configuredCount?: number;
  totalCount?: number;
}

interface IntegrationsData {
  categories: IntegrationCategory[];
  totalCount: number;
  configuredCount: number;
}

export default function IntegrationsComponent() {
  const [data, setData] = useState<IntegrationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<string, boolean>
  >({});
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const didFetch = useRef(false);

  const columns = [
    {
      key: "provider",
      label: "Provider",
      sortable: true,
      sortValue: (row: IntegrationItem) => row.provider,
      render: (row: IntegrationItem) => (
        <div className={styles.tableProviderCell}>
          {row.configured ? (
            <div
              className={styles.statusDotConfigured}
              style={{ width: 16, height: 16 }}
            >
              <Check size={9} strokeWidth={3} />
            </div>
          ) : (
            <div
              className={styles.statusDotMissing}
              style={{ width: 16, height: 16 }}
            >
              <X size={9} strokeWidth={3} />
            </div>
          )}
          <span className={styles.tableProviderName}>{row.provider}</span>
        </div>
      ),
    },
    {
      key: "envKey",
      label: "Environment Key",
      sortable: true,
      sortValue: (row: IntegrationItem) => row.envKey,
      render: (row: IntegrationItem) => (
        <code className={styles.tableEnvKey}>{row.envKey}</code>
      ),
    },
    {
      key: "maskedKey",
      label: "Configured Value",
      sortable: true,
      sortValue: (row: IntegrationItem) => row.maskedKey || "",
      render: (row: IntegrationItem) =>
        row.maskedKey ? (
          <code className={styles.tableMaskedKey}>{row.maskedKey}</code>
        ) : (
          <span className={styles.tableNotConfigured}>Not configured</span>
        ),
    },
    {
      key: "docs",
      label: "Docs",
      align: "center" as const,
      render: (row: IntegrationItem) =>
        row.docs ? (
          <a
            href={row.docs}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.docsLink}
            title="Open provider docs"
            style={{ margin: "0 auto" }}
          >
            <ExternalLink size={13} strokeWidth={2} />
          </a>
        ) : (
          <span className={styles.tableNoDocs}>—</span>
        ),
    },
  ];

  async function loadIntegrations() {
    try {
      const integrationsResponse = await ApiService.getIntegrations();
      setData(integrationsResponse);
    } catch (error) {
      console.error("Integrations fetch failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadIntegrations();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadIntegrations();
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // ── Filter by search ────────────────────────────────────────
  const filteredCategories = data?.categories
    ?.map((cat: IntegrationCategory) => {
      const filtered = cat.integrations.filter((item: IntegrationItem) => {
        const normalizedSearch = searchQuery.toLowerCase();
        return (
          item.provider.toLowerCase().includes(normalizedSearch) ||
          item.envKey.toLowerCase().includes(normalizedSearch) ||
          item.category.toLowerCase().includes(normalizedSearch)
        );
      });
      return {
        ...cat,
        integrations: filtered,
        configuredCount: filtered.filter((i: IntegrationItem) => i.configured)
          .length,
        totalCount: filtered.length,
      };
    })
    .filter((cat: IntegrationCategory) => cat.integrations.length > 0);

  return (
    <div className={styles.integrations}>
      <PageHeaderComponent
        sticky={false}
        title="Integrations"
        subtitle={
          loading
            ? "Loading integrations…"
            : `${data?.configuredCount ?? 0} of ${data?.totalCount ?? 0} API keys configured`
        }
      >
        <div className={styles.headerControls}>
          {!loading && (
            <SegmentedControlComponent
              value={viewMode}
              onChange={(value: string) => setViewMode(value as "card" | "table")}
              segments={[
                { value: "card", icon: <LayoutGrid size={13} strokeWidth={2.2} /> },
                { value: "table", icon: <Table2 size={13} strokeWidth={2.2} /> },
              ]}
              compact
            />
          )}
          <ButtonComponent
            variant="secondary"
            icon={RefreshCw}
            loading={refreshing}
            onClick={handleRefresh}
          >
            Refresh
          </ButtonComponent>
        </div>
      </PageHeaderComponent>

      {/* ── Search Bar ── */}
      {!loading && (
        <div className={styles.searchBar}>
          <SearchInputComponent
            value={searchQuery}
            onChange={(value: string) => setSearchQuery(value)}
            placeholder="Search providers, keys…"
            compact
          />
        </div>
      )}

      {/* ── Stats Row ── */}
      {!loading && data && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{data.totalCount}</span>
            <span className={styles.statLabel}>Total Services</span>
          </div>
          <div className={`${styles.statCard} ${styles.statConfigured}`}>
            <span className={styles.statValue}>{data.configuredCount}</span>
            <span className={styles.statLabel}>Configured</span>
          </div>
          <div className={`${styles.statCard} ${styles.statMissing}`}>
            <span className={styles.statValue}>
              {data.totalCount - data.configuredCount}
            </span>
            <span className={styles.statLabel}>Missing</span>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingIndicatorComponent
          size="small"
          label="Loading integrations…"
          className="is-loading-centered-state"
        />
      ) : (
        <div className={styles.categoryList}>
          {filteredCategories?.map(
            (cat: IntegrationCategory, catIndex: number) => {
              const isCollapsed = collapsedCategories[cat.category];
              return (
                <div
                  key={cat.category}
                  className={styles.categoryGroup}
                  style={{ animationDelay: `${catIndex * 50}ms` }}
                >
                  {/* ── Category Header ── */}
                  <button
                    className={styles.categoryHeader}
                    onClick={() => toggleCategory(cat.category)}
                  >
                    <div className={styles.categoryLeft}>
                      {isCollapsed ? (
                        <ChevronRight size={14} strokeWidth={2.5} />
                      ) : (
                        <ChevronDown size={14} strokeWidth={2.5} />
                      )}
                      <span className={styles.categoryName}>
                        {cat.category}
                      </span>
                    </div>
                    <div className={styles.categoryBadges}>
                      <span className={styles.categoryCount}>
                        {cat.configuredCount}/{cat.totalCount}
                      </span>
                      {cat.configuredCount === cat.totalCount ? (
                        <BadgeComponent variant="success">
                          All Set
                        </BadgeComponent>
                      ) : cat.configuredCount === 0 ? (
                        <BadgeComponent variant="error">None</BadgeComponent>
                      ) : (
                        <BadgeComponent variant="warning">
                          Partial
                        </BadgeComponent>
                      )}
                    </div>
                  </button>

                  {/* ── Integration Cards or Table ── */}
                  {!isCollapsed &&
                    (viewMode === "table" ? (
                      <TableComponent<IntegrationItem>
                        columns={columns}
                        data={cat.integrations}
                        getRowKey={(row: IntegrationItem) => row.envKey}
                        emptyText="No integrations in this category"
                      />
                    ) : (
                      <div className={styles.integrationCards}>
                        {cat.integrations.map((item: IntegrationItem) => (
                          <div
                            key={item.envKey}
                            className={`${styles.integrationCard} ${item.configured ? styles.configured : styles.unconfigured}`}
                          >
                            <div className={styles.cardHeader}>
                              <div className={styles.cardStatus}>
                                {item.configured ? (
                                  <div className={styles.statusDotConfigured}>
                                    <Check size={10} strokeWidth={3} />
                                  </div>
                                ) : (
                                  <div className={styles.statusDotMissing}>
                                    <X size={10} strokeWidth={3} />
                                  </div>
                                )}
                                <span className={styles.providerName}>
                                  {item.provider}
                                </span>
                              </div>
                              {item.docs && (
                                <a
                                  href={item.docs}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.docsLink}
                                  title="Open provider dashboard"
                                >
                                  <ExternalLink size={13} strokeWidth={2} />
                                </a>
                              )}
                            </div>

                            <div className={styles.cardBody}>
                              <div className={styles.keyRow}>
                                <Key
                                  size={11}
                                  strokeWidth={2}
                                  className={styles.keyIcon}
                                />
                                <code className={styles.environmentKey}>
                                  {item.envKey}
                                </code>
                              </div>
                              {item.maskedKey ? (
                                <div className={styles.maskedKey}>
                                  <code>{item.maskedKey}</code>
                                </div>
                              ) : (
                                <div className={styles.notConfigured}>
                                  <span>Not configured</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              );
            },
          )}

          {filteredCategories?.length === 0 && (
            <div className={styles.emptyState}>
              No integrations match your search
            </div>
          )}
        </div>
      )}
    </div>
  );
}
