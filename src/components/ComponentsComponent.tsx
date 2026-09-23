"use client";

import { useMemo, useState } from "react";
import {
  Blocks,
  Eye,
  EyeOff,
  FlaskConical,
  LayoutGrid,
  List,
  Package,
  Paintbrush,
} from "lucide-react";
import {
  ButtonComponent,
  IconButtonComponent,
  PageHeaderComponent,
  SearchInputComponent,
} from "@rodrigo-barraza/components-library";
import ComponentCatalogItemComponent from "./ComponentCatalogItemComponent";
import { formatSize } from "@/lib/format";
import {
  COMPONENT_CATEGORY_KEYS,
  getComponentCategory,
} from "@/lib/componentCategories";
import {
  matchesCatalogQuery,
  summarizeCatalog,
  type CatalogEntry,
} from "@/lib/libraryCatalog";
import styles from "./ComponentsComponent.module.css";

const ALL_CATEGORIES = "all";

type ViewMode = "grid" | "list";

function CategoryFilterButton({
  active,
  count,
  onSelect,
  emoji,
  label,
}: {
  active: boolean;
  count: number;
  onSelect: () => void;
  emoji?: string;
  label: string;
}) {
  return (
    <ButtonComponent
      size="small"
      variant={active ? "tonal" : "outlined"}
      aria-pressed={active}
      onClick={onSelect}
    >
      {emoji && <span className={styles["pill-emoji"]}>{emoji}</span>}
      {label}
      <span
        className={`${styles["pill-count"]}${active ? ` ${styles["pill-count-active"]}` : ""}`}
      >
        {count}
      </span>
    </ButtonComponent>
  );
}

/**
 * ComponentsComponent — catalog page for the components library, with
 * category filters, search, grid/list views and live previews.
 *
 * Receives the component entries of the catalog generated at prebuild.
 */
export default function ComponentsComponent({
  components,
}: {
  components: CatalogEntry[];
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showPreviews, setShowPreviews] = useState(true);

  const filtered = useMemo(
    () =>
      components.filter(
        (component) =>
          (activeCategory === ALL_CATEGORIES ||
            component.category === activeCategory) &&
          matchesCatalogQuery(component, search),
      ),
    [components, search, activeCategory],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const component of components) {
      counts[component.category] = (counts[component.category] ?? 0) + 1;
    }
    return counts;
  }, [components]);

  const { totalSizeKb, testedCount, m3Count } = useMemo(
    () => summarizeCatalog(components),
    [components],
  );

  const activeCategoryInfo = getComponentCategory(activeCategory);
  const isFiltering = Boolean(search) || activeCategory !== ALL_CATEGORIES;

  return (
    <div className={`components-component ${styles["components"]}`}>
      <PageHeaderComponent
        sticky={false}
        title="Components"
        subtitle={`${components.length} components · ${m3Count} M3 · ${testedCount} tested`}
      >
        <div className={styles["header-stats"]}>
          <div className={styles["stat-pill"]}>
            <Package size={13} />
            <span>{formatSize(totalSizeKb)}</span>
          </div>
          <div className={styles["stat-pill"]}>
            <FlaskConical size={13} />
            <span>{testedCount} tested</span>
          </div>
          <div className={styles["stat-pill"]}>
            <Paintbrush size={13} />
            <span>{m3Count} M3</span>
          </div>
        </div>
      </PageHeaderComponent>

      {/* ── Toolbar ── */}
      <div className={styles["toolbar"]}>
        <SearchInputComponent
          value={search}
          onChange={setSearch}
          placeholder="Search components…"
          compact
          id="component-search"
        />

        {/* Category filter buttons (M3 outlined → tonal when selected) */}
        <div className={styles["category-pills"]}>
          <CategoryFilterButton
            label="All"
            active={activeCategory === ALL_CATEGORIES}
            count={components.length}
            onSelect={() => setActiveCategory(ALL_CATEGORIES)}
          />
          {COMPONENT_CATEGORY_KEYS.map((key) => {
            const category = getComponentCategory(key);
            return (
              <CategoryFilterButton
                key={key}
                label={category?.label ?? key}
                emoji={category?.emoji}
                active={activeCategory === key}
                count={categoryCounts[key] ?? 0}
                onSelect={() => setActiveCategory(key)}
              />
            );
          })}
        </div>

        {/* View toggle */}
        <div className={styles["view-toggle"]}>
          <IconButtonComponent
            icon={showPreviews ? <Eye size={14} /> : <EyeOff size={14} />}
            onClick={() => setShowPreviews((visible) => !visible)}
            tooltip={showPreviews ? "Hide previews" : "Show previews"}
            aria-label={showPreviews ? "Hide previews" : "Show previews"}
            aria-pressed={showPreviews}
            active={showPreviews}
            className={styles["view-button"]}
          />
          <IconButtonComponent
            icon={<LayoutGrid size={14} />}
            onClick={() => setViewMode("grid")}
            tooltip="Grid view"
            aria-label="Grid view"
            aria-pressed={viewMode === "grid"}
            active={viewMode === "grid"}
            className={styles["view-button"]}
          />
          <IconButtonComponent
            icon={<List size={14} />}
            onClick={() => setViewMode("list")}
            tooltip="List view"
            aria-label="List view"
            aria-pressed={viewMode === "list"}
            active={viewMode === "list"}
            className={styles["view-button"]}
          />
        </div>
      </div>

      {/* ── Category header ── */}
      {activeCategoryInfo && (
        <div className={styles["category-header"]}>
          <span className={styles["category-emoji"]}>
            {activeCategoryInfo.emoji}
          </span>
          <div>
            <h2 className={styles["category-title"]}>
              {activeCategoryInfo.label}
            </h2>
            <p className={styles["category-desc"]}>
              {activeCategoryInfo.description}
            </p>
          </div>
        </div>
      )}

      {/* ── Results count ── */}
      {isFiltering && (
        <div className={styles["results-count"]} aria-live="polite">
          {filtered.length} component{filtered.length !== 1 ? "s" : ""}
          {search && ` matching "${search}"`}
        </div>
      )}

      {/* ── Grid / List ── */}
      <div className={styles[viewMode === "grid" ? "grid" : "list"]}>
        {filtered.map((component, index) => (
          <ComponentCatalogItemComponent
            key={component.name}
            component={component}
            variant={viewMode === "grid" ? "card" : "row"}
            index={index}
            showPreview={showPreviews}
          />
        ))}
      </div>

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div className={styles["empty-state"]}>
          <Blocks size={40} strokeWidth={1} />
          <p>No components match your search</p>
        </div>
      )}
    </div>
  );
}
