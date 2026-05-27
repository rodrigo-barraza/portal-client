"use client";

/**
 * LibraryCatalogComponent — reusable catalog page for non-component
 * library entries (hooks, providers, services, utilities).
 *
 * Renders a searchable, animated card grid showing each item's name,
 * description, size, file count, and test status.
 */

import { useState, useMemo } from "react";
import { Search, FlaskConical, Package, FileCode2 } from "lucide-react";
import { PageHeaderComponent } from "@rodrigo-barraza/components-library";
import styles from "./LibraryCatalogComponent.module.css";

/** Human-readable name from export name. */
function humanize(name: string) {
  return name
    .replace(/Component$/, "")
    .replace(/Service$/, "")
    .replace(/^use/, "use\u200B") // zero-width space for visual break after "use"
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** Format KB size. */
function formatSize(kb: number) {
  if (kb >= 100) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb.toFixed(1)} KB`;
}

/**
 * }} props
 */
export interface CatalogItem {
  name: string;
  type: string;
  category?: string;
  m3?: boolean;
  hasTests?: boolean;
  files?: number;
  sizeKb: number;
  description?: string;
}

export default function LibraryCatalogComponent({
  catalog = [],
  type,
  title,
  subtitle,
  icon,
  accentColor = "#6366f1",
  accentSubtle = "rgba(99, 102, 241, 0.1)",
}: {
  catalog?: CatalogItem[];
  type: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor?: string;
  accentSubtle?: string;
}) {
  const [search, setSearch] = useState("");

  // Filter to this type only
  const items = useMemo(
    () => catalog.filter((c) => c.type === type),
    [catalog, type],
  );

  // Search filtering
  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const normalizedSearch = search.toLowerCase();
    return items.filter(
      (c) =>
        c.name.toLowerCase().includes(normalizedSearch) ||
        c.description?.toLowerCase().includes(normalizedSearch) ||
        humanize(c.name).toLowerCase().includes(normalizedSearch),
    );
  }, [items, search]);

  const testedCount = items.filter((c) => c.hasTests).length;
  const totalSize = items.reduce(
    (sum: number, c: CatalogItem) => sum + c.sizeKb,
    0,
  );

  return (
    <div className={styles.catalog}>
      <PageHeaderComponent
        sticky={false}
        title={title}
        subtitle={
          subtitle || `${items.length} ${type}s · ${testedCount} tested`
        }
      >
        <div className={styles.headerStats}>
          <div className={styles.statPill}>
            <Package size={13} />
            <span>{formatSize(totalSize)}</span>
          </div>
          <div className={styles.statPill}>
            <FlaskConical size={13} />
            <span>{testedCount} tested</span>
          </div>
        </div>
      </PageHeaderComponent>

      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="text"
            placeholder={`Search ${type}s…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
            id={`${type}-search`}
          />
        </div>
        <div className={styles.countLabel}>
          {filtered.length} {type}
          {filtered.length !== 1 ? "s" : ""}
          {search && ` matching "${search}"`}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className={styles.grid}>
        {filtered.map((item: CatalogItem, i: number) => (
          <div
            key={item.name}
            className={styles.card}
            style={
              {
                animationDelay: `${Math.min(i * 30, 600)}ms`,
                "--card-accent": accentColor,
                "--card-accent-subtle": accentSubtle,
              } as React.CSSProperties
            }
          >
            <div className={styles.cardHeader}>
              <div
                className={styles.cardIcon}
                style={{ background: accentSubtle, color: accentColor }}
              >
                {icon}
              </div>
              <div className={styles.cardMeta}>
                {item.hasTests && (
                  <span className={styles.testBadge} title="Has unit tests">
                    <FlaskConical size={10} />
                  </span>
                )}
              </div>
            </div>

            <h3 className={styles.cardName}>{humanize(item.name)}</h3>
            <code className={styles.cardImport}>{item.name}</code>
            {item.description && (
              <p className={styles.cardDesc}>{item.description}</p>
            )}

            <div className={styles.cardFooter}>
              <span className={styles.cardStat}>
                <FileCode2 size={11} />
                {item.files} file{item.files !== 1 ? "s" : ""}
              </span>
              <span className={styles.cardStat}>
                <Package size={11} />
                {formatSize(item.sizeKb)}
              </span>
              <span
                className={styles.typeBadge}
                style={{ color: accentColor, background: accentSubtle }}
              >
                {type}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div className={styles.emptyState}>
          {icon}
          <p>No {type}s match your search</p>
        </div>
      )}
    </div>
  );
}
