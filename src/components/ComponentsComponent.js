"use client";

import { useState, useMemo, Component } from "react";
import {
  Search,
  Blocks,
  LayoutGrid,
  List,
  ChevronRight,
  FlaskConical,
  Package,
  Paintbrush,
  FileCode2,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { PageHeaderComponent } from "@rodrigo-barraza/components";
import { getPreview } from "./ComponentPreviewRegistry";
import styles from "./ComponentsComponent.module.css";

// ── Error boundary for individual preview isolation ─────────────
class PreviewErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.previewError}>
          <AlertTriangle size={14} />
          <span>Preview failed to render</span>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Category definitions (presentation only) ────────────────────
const CATEGORIES = {
  actions: {
    label: "Actions",
    description: "Buttons, FABs, and interactive triggers",
    icon: "⚡",
  },
  communication: {
    label: "Communication",
    description: "Snackbars, toasts, tooltips, and badges",
    icon: "💬",
  },
  containment: {
    label: "Containment",
    description: "Cards, dialogs, modals, and containers",
    icon: "📦",
  },
  inputs: {
    label: "Inputs",
    description: "Text fields, selectors, toggles, and form controls",
    icon: "✏️",
  },
  navigation: {
    label: "Navigation",
    description: "Sidebars, drawers, rails, tabs, and menus",
    icon: "🧭",
  },
  indicators: {
    label: "Indicators",
    description: "Progress, loading, and status feedback",
    icon: "📊",
  },
  layout: {
    label: "Layout",
    description: "Page structure, toolbars, dividers, and tables",
    icon: "📐",
  },
  providers: {
    label: "Providers",
    description: "Context providers and theme management",
    icon: "🔌",
  },
};

/** Human-readable name from component folder name. */
function humanize(name) {
  return name.replace(/Component$/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** Format KB size. */
function formatSize(kb) {
  if (kb >= 100) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb.toFixed(1)} KB`;
}

/**
 * ComponentsComponent — catalog page for the components library.
 *
 * Receives `catalog` from the server component which scans the
 * installed @rodrigo-barraza/components package at render time.
 *
 * @param {{ catalog: Array<{ name, category, m3, hasTests, files, sizeKb, description }> }} props
 */
export default function ComponentsComponent({ catalog = [] }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [viewMode, setViewMode] = useState("grid");
  const [showPreviews, setShowPreviews] = useState(true);

  // ── Filter logic ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    let items = catalog;

    if (activeCategory !== "all") {
      items = items.filter((c) => c.category === activeCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          humanize(c.name).toLowerCase().includes(q)
      );
    }

    return items;
  }, [catalog, search, activeCategory]);

  // ── Category counts ──────────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const counts = { all: catalog.length };
    for (const comp of catalog) {
      counts[comp.category] = (counts[comp.category] || 0) + 1;
    }
    return counts;
  }, [catalog]);

  // ── Stats ────────────────────────────────────────────────────
  const m3Count = catalog.filter((c) => c.m3).length;
  const testedCount = catalog.filter((c) => c.hasTests).length;
  const totalSize = catalog.reduce((sum, c) => sum + c.sizeKb, 0);

  return (
    <div className={styles.components}>
      <PageHeaderComponent sticky={false}
        title="Components"
        subtitle={`${catalog.length} components · ${m3Count} M3 · ${testedCount} tested`}
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
          <div className={styles.statPill}>
            <Paintbrush size={13} />
            <span>{m3Count} M3</span>
          </div>
        </div>
      </PageHeaderComponent>

      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        {/* Search */}
        <div className={styles.searchWrapper}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search components…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
            id="component-search"
          />
        </div>

        {/* Category pills */}
        <div className={styles.categoryPills}>
          <button
            className={`${styles.pill} ${activeCategory === "all" ? styles.pillActive : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            All
            <span className={styles.pillCount}>{categoryCounts.all}</span>
          </button>
          {Object.entries(CATEGORIES).map(([key, cat]) => (
            <button
              key={key}
              className={`${styles.pill} ${activeCategory === key ? styles.pillActive : ""}`}
              onClick={() => setActiveCategory(key)}
            >
              <span className={styles.pillEmoji}>{cat.icon}</span>
              {cat.label}
              <span className={styles.pillCount}>{categoryCounts[key] || 0}</span>
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${showPreviews ? styles.viewBtnActive : ""}`}
            onClick={() => setShowPreviews((v) => !v)}
            title={showPreviews ? "Hide previews" : "Show previews"}
          >
            {showPreviews ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewBtnActive : ""}`}
            onClick={() => setViewMode("grid")}
            title="Grid view"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewBtnActive : ""}`}
            onClick={() => setViewMode("list")}
            title="List view"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* ── Category header ── */}
      {activeCategory !== "all" && CATEGORIES[activeCategory] && (
        <div className={styles.categoryHeader}>
          <span className={styles.categoryEmoji}>{CATEGORIES[activeCategory].icon}</span>
          <div>
            <h2 className={styles.categoryTitle}>{CATEGORIES[activeCategory].label}</h2>
            <p className={styles.categoryDesc}>{CATEGORIES[activeCategory].description}</p>
          </div>
        </div>
      )}

      {/* ── Results count ── */}
      {(search || activeCategory !== "all") && (
        <div className={styles.resultsCount}>
          {filtered.length} component{filtered.length !== 1 ? "s" : ""}
          {search && ` matching "${search}"`}
        </div>
      )}

      {/* ── Grid / List ── */}
      {viewMode === "grid" ? (
        <div className={styles.grid}>
          {filtered.map((comp, i) => (
            <div
              key={comp.name}
              className={styles.card}
              style={{ animationDelay: `${Math.min(i * 30, 600)}ms` }}
            >
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>
                  <Blocks size={18} />
                </div>
                <div className={styles.cardMeta}>
                  {comp.m3 && (
                    <span className={styles.m3Badge} title="Material Design 3 compliant">M3</span>
                  )}
                  {comp.hasTests && (
                    <span className={styles.testBadge} title="Has unit tests">
                      <FlaskConical size={10} />
                    </span>
                  )}
                </div>
              </div>

              <h3 className={styles.cardName}>{humanize(comp.name)}</h3>
              <p className={styles.cardDesc}>{comp.description}</p>

              {/* ── Inline Preview ── */}
              {showPreviews && getPreview(comp.name) && (
                <div className={styles.previewArea}>
                  <PreviewErrorBoundary key={comp.name}>
                    {getPreview(comp.name)()}
                  </PreviewErrorBoundary>
                </div>
              )}

              <div className={styles.cardFooter}>
                <span className={styles.cardStat}>
                  <FileCode2 size={11} />
                  {comp.files} file{comp.files !== 1 ? "s" : ""}
                </span>
                <span className={styles.cardStat}>
                  <Package size={11} />
                  {formatSize(comp.sizeKb)}
                </span>
                <span className={`${styles.cardCategory} ${styles[`cat_${comp.category}`]}`}>
                  {CATEGORIES[comp.category]?.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((comp, i) => (
            <div
              key={comp.name}
              className={styles.listRow}
              style={{ animationDelay: `${Math.min(i * 20, 400)}ms` }}
            >
              <div className={styles.listIcon}>
                <Blocks size={16} />
              </div>
              <div className={styles.listMain}>
                <div className={styles.listName}>
                  {humanize(comp.name)}
                  {comp.m3 && <span className={styles.m3Badge}>M3</span>}
                  {comp.hasTests && (
                    <span className={styles.testBadge}>
                      <FlaskConical size={10} />
                    </span>
                  )}
                </div>
                <div className={styles.listDesc}>{comp.description}</div>
                {/* ── Inline Preview (list mode) ── */}
                {showPreviews && getPreview(comp.name) && (
                  <div className={styles.previewAreaList}>
                    <PreviewErrorBoundary key={comp.name}>
                      {getPreview(comp.name)()}
                    </PreviewErrorBoundary>
                  </div>
                )}
              </div>
              <div className={styles.listStats}>
                <span className={`${styles.cardCategory} ${styles[`cat_${comp.category}`]}`}>
                  {CATEGORIES[comp.category]?.label}
                </span>
                <span className={styles.cardStat}>
                  <FileCode2 size={11} />
                  {comp.files}
                </span>
                <span className={styles.cardStat}>
                  <Package size={11} />
                  {formatSize(comp.sizeKb)}
                </span>
              </div>
              <ChevronRight size={14} className={styles.listChevron} />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div className={styles.emptyState}>
          <Blocks size={40} strokeWidth={1} />
          <p>No components match your search</p>
        </div>
      )}
    </div>
  );
}
