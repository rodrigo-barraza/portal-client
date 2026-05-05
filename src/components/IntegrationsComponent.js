"use client";

import { useState, useRef, useEffect } from "react";
import { RefreshCw, ExternalLink, Check, X, Key, Search, ChevronDown, ChevronRight } from "lucide-react";
import { BadgeComponent, ButtonComponent, InputComponent, LoadingStateComponent, PageHeaderComponent } from "@rodrigo-barraza/components";

import ApiService from "../services/ApiService";
import styles from "./IntegrationsComponent.module.css";

export default function IntegrationsComponent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const didFetch = useRef(false);

  async function loadIntegrations() {
    try {
      const res = await ApiService.getIntegrations();
      setData(res);
    } catch (err) {
      console.error("Integrations fetch failed:", err);
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

  const toggleCategory = (category) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // ── Filter by search ────────────────────────────────────────
  const filteredCategories = data?.categories
    ?.map((cat) => {
      const filtered = cat.integrations.filter((item) => {
        const q = searchQuery.toLowerCase();
        return (
          item.provider.toLowerCase().includes(q) ||
          item.envKey.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      });
      return { ...cat, integrations: filtered, configuredCount: filtered.filter((i) => i.configured).length, totalCount: filtered.length };
    })
    .filter((cat) => cat.integrations.length > 0);

  return (
    <div className={styles.integrations}>
      <PageHeaderComponent sticky={false}
        title="Integrations"
        subtitle={
          loading
            ? "Loading integrations…"
            : `${data?.configuredCount ?? 0} of ${data?.totalCount ?? 0} API keys configured`
        }
      >
        <ButtonComponent
          variant="secondary"
          icon={RefreshCw}
          loading={refreshing}
          onClick={handleRefresh}
        >
          Refresh
        </ButtonComponent>
      </PageHeaderComponent>

      {/* ── Search Bar ── */}
      {!loading && (
        <div className={styles.searchBar}>
          <InputComponent
            icon={Search}
            size="sm"
            placeholder="Search providers, keys…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className={styles.clearSearch} onClick={() => setSearchQuery("")}>
              <X size={12} strokeWidth={2.5} />
            </button>
          )}
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
            <span className={styles.statValue}>{data.totalCount - data.configuredCount}</span>
            <span className={styles.statLabel}>Missing</span>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingStateComponent message="Loading integrations…" />
      ) : (
        <div className={styles.categoryList}>
          {filteredCategories?.map((cat, catIndex) => {
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
                    <span className={styles.categoryName}>{cat.category}</span>
                  </div>
                  <div className={styles.categoryBadges}>
                    <span className={styles.categoryCount}>
                      {cat.configuredCount}/{cat.totalCount}
                    </span>
                    {cat.configuredCount === cat.totalCount ? (
                      <BadgeComponent variant="success">All Set</BadgeComponent>
                    ) : cat.configuredCount === 0 ? (
                      <BadgeComponent variant="error">None</BadgeComponent>
                    ) : (
                      <BadgeComponent variant="warning">Partial</BadgeComponent>
                    )}
                  </div>
                </button>

                {/* ── Integration Cards ── */}
                {!isCollapsed && (
                  <div className={styles.integrationCards}>
                    {cat.integrations.map((item) => (
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
                            <span className={styles.providerName}>{item.provider}</span>
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
                            <Key size={11} strokeWidth={2} className={styles.keyIcon} />
                            <code className={styles.envKey}>{item.envKey}</code>
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
                )}
              </div>
            );
          })}

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
