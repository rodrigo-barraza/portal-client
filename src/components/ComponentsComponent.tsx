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
import {
  PageHeaderComponent,
  SearchInputComponent,
  IconButtonComponent,
} from "@rodrigo-barraza/components-library";
import { getPreview } from "./ComponentPreviewRegistryComponent";
import styles from "./ComponentsComponent.module.css";

// ── Error boundary for individual preview isolation ─────────────
class PreviewErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className={styles['preview-error']}>
          <AlertTriangle size={14} />
          <span>Preview failed to render</span>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Category {
  label: string;
  description: string;
  icon: string;
}

// ── Category definitions (presentation only) ────────────────────
const CATEGORIES: Record<string, Category> = {
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
};

/** Human-readable name from component folder name. */
function humanize(name: string): string {
  return name.replace(/Component$/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** Format KB size. */
function formatSize(kb: number): string {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb.toFixed(1)} KB`;
}

interface CatalogItem {
  name: string;
  category: string;
  type?: string;
  m3?: boolean;
  hasTests?: boolean;
  files?: number;
  sizeKb: number;
  description: string;
}

/**
 * ComponentsComponent — catalog page for the components library.
 *
 * Receives `catalog` from the server component which scans the
 * installed @rodrigo-barraza/components-library package at render time.
 */
export default function ComponentsComponent({
  catalog = [],
}: {
  catalog?: CatalogItem[];
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [viewMode, setViewMode] = useState("grid");
  const [showPreviews, setShowPreviews] = useState(true);

  // ── Filter to components only ─────────────────────────────────
  const components = useMemo(
    () => catalog.filter((c) => c.type === "component" || !c.type),
    [catalog],
  );

  // ── Filter logic ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    let items = components;

    if (activeCategory !== "all") {
      items = items.filter((c) => c.category === activeCategory);
    }

    if (search.trim()) {
      const normalizedSearch = search.toLowerCase();
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(normalizedSearch) ||
          c.description.toLowerCase().includes(normalizedSearch) ||
          humanize(c.name).toLowerCase().includes(normalizedSearch),
      );
    }

    return items;
  }, [components, search, activeCategory]);

  // ── Category counts ──────────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: components.length };
    for (const catalogItem of components) {
      counts[catalogItem.category] = (counts[catalogItem.category] || 0) + 1;
    }
    return counts;
  }, [components]);

  // ── Stats ────────────────────────────────────────────────────
  const m3Count = components.filter((c) => c.m3).length;
  const testedCount = components.filter((c) => c.hasTests).length;
  const totalSize = components.reduce((sum, c) => sum + c.sizeKb, 0);

  return (
    <div className={`components-component ${styles['components']}`}>
      <PageHeaderComponent
        sticky={false}
        title="Components"
        subtitle={`${components.length} components · ${m3Count} M3 · ${testedCount} tested`}
      >
        <div className={styles['header-stats']}>
          <div className={styles['stat-pill']}>
            <Package size={13} />
            <span>{formatSize(totalSize)}</span>
          </div>
          <div className={styles['stat-pill']}>
            <FlaskConical size={13} />
            <span>{testedCount} tested</span>
          </div>
          <div className={styles['stat-pill']}>
            <Paintbrush size={13} />
            <span>{m3Count} M3</span>
          </div>
        </div>
      </PageHeaderComponent>

      {/* ── Toolbar ── */}
      <div className={styles['toolbar']}>
        {/* Search */}
        <SearchInputComponent
          value={search}
          onChange={(value: string) => setSearch(value)}
          placeholder="Search components…"
          compact
          id="component-search"
        />

        {/* Category pills */}
        <div className={styles['category-pills']}>
          <button
            className={`${styles['pill']} ${activeCategory === "all" ? styles['pill-active'] : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            All
            <span className={styles['pill-count']}>{categoryCounts.all}</span>
          </button>
          {Object.entries(CATEGORIES).map(([key, cat]) => (
            <button
              key={key}
              className={`${styles['pill']} ${activeCategory === key ? styles['pill-active'] : ""}`}
              onClick={() => setActiveCategory(key)}
            >
              <span className={styles['pill-emoji']}>{cat.icon}</span>
              {cat.label}
              <span className={styles['pill-count']}>
                {categoryCounts[key] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className={styles['view-toggle']}>
          <IconButtonComponent
            icon={showPreviews ? <Eye size={14} /> : <EyeOff size={14} />}
            onClick={() => setShowPreviews((v) => !v)}
            tooltip={showPreviews ? "Hide previews" : "Show previews"}
            active={showPreviews}
            className={styles['view-button']}
          />
          <IconButtonComponent
            icon={<LayoutGrid size={14} />}
            onClick={() => setViewMode("grid")}
            tooltip="Grid view"
            active={viewMode === "grid"}
            className={styles['view-button']}
          />
          <IconButtonComponent
            icon={<List size={14} />}
            onClick={() => setViewMode("list")}
            tooltip="List view"
            active={viewMode === "list"}
            className={styles['view-button']}
          />
        </div>
      </div>

      {/* ── Category header ── */}
      {activeCategory !== "all" && CATEGORIES[activeCategory] && (
        <div className={styles['category-header']}>
          <span className={styles['category-emoji']}>
            {CATEGORIES[activeCategory].icon}
          </span>
          <div>
            <h2 className={styles['category-title']}>
              {CATEGORIES[activeCategory].label}
            </h2>
            <p className={styles['category-desc']}>
              {CATEGORIES[activeCategory].description}
            </p>
          </div>
        </div>
      )}

      {/* ── Results count ── */}
      {(search || activeCategory !== "all") && (
        <div className={styles['results-count']}>
          {filtered.length} component{filtered.length !== 1 ? "s" : ""}
          {search && ` matching "${search}"`}
        </div>
      )}

      {/* ── Grid / List ── */}
      {viewMode === "grid" ? (
        <div className={styles['grid']}>
          {filtered.map((comp, i) => (
            <div
              key={comp.name}
              className={styles['card']}
              style={{ animationDelay: `${Math.min(i * 30, 600)}ms` }}
            >
              <div className={styles['card-header']}>
                <div className={styles['card-icon']}>
                  <Blocks size={18} />
                </div>
                <div className={styles['card-meta']}>
                  {comp.m3 && (
                    <span
                      className={styles['m3-badge']}
                      title="Material Design 3 compliant"
                    >
                      M3
                    </span>
                  )}
                  {comp.hasTests && (
                    <span className={styles['test-badge']} title="Has unit tests">
                      <FlaskConical size={10} />
                    </span>
                  )}
                </div>
              </div>

              <h3 className={styles['card-name']}>{humanize(comp.name)}</h3>
              <p className={styles['card-desc']}>{comp.description}</p>

              {/* ── Inline Preview ── */}
              {showPreviews && getPreview(comp.name) && (
                <div className={styles['preview-area']}>
                  <PreviewErrorBoundary key={comp.name}>
                    {getPreview(comp.name)()}
                  </PreviewErrorBoundary>
                </div>
              )}

              <div className={styles['card-footer']}>
                <span className={styles['card-stat']}>
                  <FileCode2 size={11} />
                  {comp.files} file{comp.files !== 1 ? "s" : ""}
                </span>
                <span className={styles['card-stat']}>
                  <Package size={11} />
                  {formatSize(comp.sizeKb)}
                </span>
                <span
                  className={`${styles['card-category']} ${styles[`component-category-${comp.category}`]}`}
                >
                  {CATEGORIES[comp.category]?.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles['list']}>
          {filtered.map((comp, i) => (
            <div
              key={comp.name}
              className={styles['list-row']}
              style={{ animationDelay: `${Math.min(i * 20, 400)}ms` }}
            >
              <div className={styles['list-icon']}>
                <Blocks size={16} />
              </div>
              <div className={styles['list-main']}>
                <div className={styles['list-name']}>
                  {humanize(comp.name)}
                  {comp.m3 && <span className={styles['m3-badge']}>M3</span>}
                  {comp.hasTests && (
                    <span className={styles['test-badge']}>
                      <FlaskConical size={10} />
                    </span>
                  )}
                </div>
                <div className={styles['list-desc']}>{comp.description}</div>
                {/* ── Inline Preview (list mode) ── */}
                {showPreviews && getPreview(comp.name) && (
                  <div className={styles['preview-area-list']}>
                    <PreviewErrorBoundary key={comp.name}>
                      {getPreview(comp.name)()}
                    </PreviewErrorBoundary>
                  </div>
                )}
              </div>
              <div className={styles['list-stats']}>
                <span
                  className={`${styles['card-category']} ${styles[`component-category-${comp.category}`]}`}
                >
                  {CATEGORIES[comp.category]?.label}
                </span>
                <span className={styles['card-stat']}>
                  <FileCode2 size={11} />
                  {comp.files}
                </span>
                <span className={styles['card-stat']}>
                  <Package size={11} />
                  {formatSize(comp.sizeKb)}
                </span>
              </div>
              <ChevronRight size={14} className={styles['list-chevron']} />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div className={styles['empty-state']}>
          <Blocks size={40} strokeWidth={1} />
          <p>No components match your search</p>
        </div>
      )}
    </div>
  );
}
