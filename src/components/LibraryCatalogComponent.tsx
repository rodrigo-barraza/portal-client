"use client";

/**
 * LibraryCatalogComponent — searchable catalog page for non-component
 * library exports (hooks, providers, services, utilities).
 *
 * Renders an animated card grid showing each export's name, description,
 * size, file count, and test status.
 */

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { FlaskConical, Package, FileCode2 } from "lucide-react";
import {
  PageHeaderComponent,
  SearchInputComponent,
} from "@rodrigo-barraza/components-library";
import { formatSize } from "@/lib/format";
import {
  humanizeExportName,
  matchesCatalogQuery,
  summarizeCatalog,
  type CatalogEntry,
} from "@/lib/libraryCatalog";
import styles from "./LibraryCatalogComponent.module.css";

/** Singular/plural label of the entries shown ("utility"/"utilities"). */
export interface CatalogNoun {
  singular: string;
  plural: string;
}

export default function LibraryCatalogComponent({
  items,
  noun,
  title,
  subtitle,
  icon,
  accentColor = "var(--accent-primary)",
}: {
  /** Entries of a single type, pre-filtered by the page. */
  items: CatalogEntry[];
  noun: CatalogNoun;
  title: string;
  subtitle: string;
  icon: ReactNode;
  /** Card accent — any CSS color, including a design-token var() reference. */
  accentColor?: string;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => items.filter((item) => matchesCatalogQuery(item, search)),
    [items, search],
  );
  const { totalSizeKb, testedCount } = useMemo(
    () => summarizeCatalog(items),
    [items],
  );
  const cardStyle = { "--card-accent": accentColor } as CSSProperties;

  return (
    <div className={`library-catalog-component ${styles["catalog"]}`}>
      <PageHeaderComponent sticky={false} title={title} subtitle={subtitle}>
        <div className={styles["header-stats"]}>
          <div className={styles["stat-pill"]}>
            <Package size={13} />
            <span>{formatSize(totalSizeKb)}</span>
          </div>
          <div className={styles["stat-pill"]}>
            <FlaskConical size={13} />
            <span>{testedCount} tested</span>
          </div>
        </div>
      </PageHeaderComponent>

      {/* ── Toolbar ── */}
      <div className={styles["toolbar"]}>
        <SearchInputComponent
          value={search}
          onChange={setSearch}
          placeholder={`Search ${noun.plural}…`}
          compact
          id={`${noun.singular}-search`}
        />
        <div className={styles["count-label"]} aria-live="polite">
          {filtered.length}{" "}
          {filtered.length === 1 ? noun.singular : noun.plural}
          {search && ` matching "${search}"`}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className={styles["grid"]}>
        {filtered.map((item, index) => (
          <div
            key={item.name}
            className={styles["card"]}
            style={{
              ...cardStyle,
              animationDelay: `${Math.min(index * 30, 600)}ms`,
            }}
          >
            <div className={styles["card-header"]}>
              <div className={styles["card-icon"]}>{icon}</div>
              <div className={styles["card-meta"]}>
                {item.hasTests && (
                  <span className={styles["test-badge"]} title="Has unit tests">
                    <FlaskConical size={10} />
                  </span>
                )}
              </div>
            </div>

            <h3 className={styles["card-name"]}>
              {humanizeExportName(item.name)}
            </h3>
            <code className={styles["card-import"]}>{item.name}</code>
            {item.description && (
              <p className={styles["card-desc"]}>{item.description}</p>
            )}

            <div className={styles["card-footer"]}>
              <span className={styles["card-stat"]}>
                <FileCode2 size={11} />
                {item.files} file{item.files !== 1 ? "s" : ""}
              </span>
              <span className={styles["card-stat"]}>
                <Package size={11} />
                {formatSize(item.sizeKb)}
              </span>
              <span className={styles["type-badge"]}>{noun.singular}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div className={styles["empty-state"]}>
          {icon}
          <p>No {noun.plural} match your search</p>
        </div>
      )}
    </div>
  );
}
