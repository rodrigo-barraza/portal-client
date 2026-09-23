"use client";

import { AlertTriangle, Blocks, ChevronRight, FileCode2, FlaskConical, Package } from "lucide-react";
import { ErrorBoundaryComponent } from "@rodrigo-barraza/components-library";
import {
  ComponentPreviewDemo,
  hasPreview,
} from "./ComponentPreviewRegistryComponent";
import { formatSize } from "@/lib/format";
import { getComponentCategory } from "@/lib/componentCategories";
import { humanizeExportName, type CatalogEntry } from "@/lib/libraryCatalog";
import styles from "./ComponentsComponent.module.css";

const PREVIEW_ERROR_FALLBACK = (
  <div className={styles["preview-error"]}>
    <AlertTriangle size={14} />
    <span>Preview failed to render</span>
  </div>
);

/** A component's live demo, isolated so one broken demo can't take the
 *  catalog down. */
function ComponentPreview({ name, className }: { name: string; className: string }) {
  if (!hasPreview(name)) return null;
  return (
    <div className={className}>
      <ErrorBoundaryComponent fallback={PREVIEW_ERROR_FALLBACK}>
        <ComponentPreviewDemo name={name} />
      </ErrorBoundaryComponent>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className={`${styles["card-category"]} ${styles[`component-category-${category}`] ?? ""}`}
    >
      {getComponentCategory(category)?.label}
    </span>
  );
}

function TestBadge({ withTitle }: { withTitle?: boolean }) {
  return (
    <span
      className={styles["test-badge"]}
      title={withTitle ? "Has unit tests" : undefined}
    >
      <FlaskConical size={10} />
    </span>
  );
}

/**
 * One components-library component in the catalog — a grid card or a list
 * row, with its live preview when previews are on.
 */
export default function ComponentCatalogItemComponent({
  component,
  variant,
  index,
  showPreview,
}: {
  component: CatalogEntry;
  variant: "card" | "row";
  /** Position in the list — staggers the entrance animation. */
  index: number;
  showPreview: boolean;
}) {
  const { name, description, m3, hasTests, files, sizeKb, category } = component;

  if (variant === "card") {
    return (
      <div
        className={styles["card"]}
        style={{ animationDelay: `${Math.min(index * 30, 600)}ms` }}
      >
        <div className={styles["card-header"]}>
          <div className={styles["card-icon"]}>
            <Blocks size={18} />
          </div>
          <div className={styles["card-meta"]}>
            {m3 && (
              <span className={styles["m3-badge"]} title="Material Design 3 compliant">
                M3
              </span>
            )}
            {hasTests && <TestBadge withTitle />}
          </div>
        </div>

        <h3 className={styles["card-name"]}>{humanizeExportName(name)}</h3>
        <p className={styles["card-desc"]}>{description}</p>

        {showPreview && (
          <ComponentPreview name={name} className={styles["preview-area"]} />
        )}

        <div className={styles["card-footer"]}>
          <span className={styles["card-stat"]}>
            <FileCode2 size={11} />
            {files} file{files !== 1 ? "s" : ""}
          </span>
          <span className={styles["card-stat"]}>
            <Package size={11} />
            {formatSize(sizeKb)}
          </span>
          <CategoryBadge category={category} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles["list-row"]}
      style={{ animationDelay: `${Math.min(index * 20, 400)}ms` }}
    >
      <div className={styles["list-icon"]}>
        <Blocks size={16} />
      </div>
      <div className={styles["list-main"]}>
        <div className={styles["list-name"]}>
          {humanizeExportName(name)}
          {m3 && <span className={styles["m3-badge"]}>M3</span>}
          {hasTests && <TestBadge />}
        </div>
        <div className={styles["list-desc"]}>{description}</div>
        {showPreview && (
          <ComponentPreview name={name} className={styles["preview-area-list"]} />
        )}
      </div>
      <div className={styles["list-stats"]}>
        <CategoryBadge category={category} />
        <span className={styles["card-stat"]}>
          <FileCode2 size={11} />
          {files}
        </span>
        <span className={styles["card-stat"]}>
          <Package size={11} />
          {formatSize(sizeKb)}
        </span>
      </div>
      <ChevronRight size={14} className={styles["list-chevron"]} />
    </div>
  );
}
