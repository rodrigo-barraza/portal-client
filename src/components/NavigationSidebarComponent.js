"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Server,
  BarChart3,
  Briefcase,
  Cpu,
  Waypoints,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { NAV_ITEMS } from "../constants";
import styles from "./NavigationSidebarComponent.module.css";

const ICON_MAP = {
  LayoutDashboard,
  Server,
  BarChart3,
  Briefcase,
  Cpu,
  Waypoints,
};

export default function NavigationSidebarComponent() {
  const pathname = usePathname();
  const { theme, toggleTheme, mounted } = useTheme();

  // Resolve theme-dependent values only after hydration
  const isDark = !mounted || theme === "dark";

  return (
    <nav className={styles.sidebar}>
      {/* ── Brand ── */}
      <div className={styles.brand}>
        <Image className={styles.brandIcon} src="/brand-icon.png" alt="Portal" width={32} height={32} />
        <span className={styles.brandLabel}>Portal</span>
      </div>

      {/* ── Nav Items ── */}
      <div className={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const Icon = ICON_MAP[item.icon];
          const isActive = pathname?.startsWith(item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ""}`}
            >
              {Icon && <Icon size={18} strokeWidth={1.8} />}
              <span className={styles.navLabel}>{item.label}</span>
              {isActive && <div className={styles.activeIndicator} />}
            </Link>
          );
        })}
      </div>

      {/* ── Bottom Actions ── */}
      <div className={styles.bottomActions}>
        <button
          className={styles.themeToggle}
          onClick={toggleTheme}
          title={`Switch to ${isDark ? "light" : "dark"} mode`}
        >
          {isDark ? (
            <Sun size={16} strokeWidth={1.8} />
          ) : (
            <Moon size={16} strokeWidth={1.8} />
          )}
          <span>{isDark ? "Light" : "Dark"}</span>
        </button>
      </div>
    </nav>
  );
}
