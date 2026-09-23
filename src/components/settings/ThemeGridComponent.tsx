"use client";

import { createElement, type CSSProperties } from "react";
import * as LucideIcons from "lucide-react";
import { Check, Palette, type LucideIcon } from "lucide-react";
import {
  THEME_CATALOG,
  getReadableTextColor,
  useTheme,
  type ThemeCatalogEntry,
} from "@rodrigo-barraza/components-library";
import styles from "../SettingsComponent.module.css";

// Fallback metadata for themes missing from THEME_CATALOG (e.g. custom themes)
const FALLBACK_THEME_META: ThemeCatalogEntry = {
  label: "Theme",
  icon: "Palette",
  backgroundBase: "#222",
  backgroundSurface: "#333",
  backgroundElevated: "#444",
  primary: "#888",
  secondary: "#aaa",
  tertiary: "#666",
  textPrimary: "#eee",
  textSecondary: "#aaa",
  textMuted: "#666",
  borderColor: "#888",
  success: "#10b981",
  danger: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

/** THEME_CATALOG names its icons by lucide export name. (The library's
 *  sidebar already pulls in the full icon set, so this lookup adds no
 *  bundle weight.) */
function themeIcon(name: string): LucideIcon {
  const icon = (LucideIcons as unknown as Record<string, LucideIcon | undefined>)[
    name
  ];
  return icon ?? Palette;
}

function ThemeTile({
  meta,
  active,
  onSelect,
}: {
  meta: ThemeCatalogEntry;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles["theme-tile"]}${active ? ` ${styles["is-active-state"]}` : ""}`}
      onClick={onSelect}
      title={`Switch to ${meta.label} theme`}
      aria-pressed={active}
      style={{ "--tile-accent": meta.primary } as CSSProperties}
    >
      <span
        className={styles["theme-preview"]}
        style={{
          background: meta.backgroundBase,
          borderColor: active ? meta.primary : meta.borderColor,
        }}
      >
        <span
          className={styles["theme-preview-header"]}
          style={{ background: meta.backgroundSurface }}
        >
          <span
            className={styles["theme-preview-dot"]}
            style={{ background: meta.primary }}
          />
          <span
            className={styles["theme-preview-line"]}
            style={{ background: meta.textMuted, width: 22 }}
          />
        </span>
        <span className={styles["theme-preview-body"]}>
          <span
            className={styles["theme-preview-line"]}
            style={{ background: meta.textPrimary, width: 34 }}
          />
          <span
            className={styles["theme-preview-line"]}
            style={{ background: meta.textMuted, width: 26 }}
          />
          <span className={styles["theme-preview-accents"]}>
            <span style={{ background: meta.primary }} />
            <span style={{ background: meta.secondary }} />
            <span style={{ background: meta.tertiary }} />
          </span>
        </span>
        {active && (
          <span
            className={styles["theme-active-badge"]}
            style={{
              background: meta.primary,
              color: getReadableTextColor(meta.primary),
            }}
          >
            <Check size={9} strokeWidth={3.5} />
          </span>
        )}
      </span>
      <span className={styles["theme-tile-meta"]}>
        {createElement(themeIcon(meta.icon), {
          size: 13,
          strokeWidth: 1.8,
          className: styles["theme-tile-icon"],
        })}
        <span className={styles["theme-tile-label"]}>{meta.label}</span>
      </span>
    </button>
  );
}

/** Swatch grid of every available theme; the active one is marked. */
export default function ThemeGridComponent() {
  const { theme, themes, setTheme, mounted } = useTheme();

  return (
    <div className={styles["theme-grid"]}>
      {themes.map((themeName) => (
        <ThemeTile
          key={themeName}
          meta={THEME_CATALOG[themeName] ?? FALLBACK_THEME_META}
          // Until the provider has read storage it reports its default
          // theme; marking that would flash the wrong tile.
          active={mounted && themeName === theme}
          onSelect={() => setTheme(themeName)}
        />
      ))}
    </div>
  );
}
