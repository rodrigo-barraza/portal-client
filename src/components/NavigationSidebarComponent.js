"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { NavigationSidebarComponent as LibrarySidebar, useTheme } from "@rodrigo-barraza/components-library";
import { NAV_SECTIONS } from "../constants";

export default function NavigationSidebarComponent() {
  const pathname = usePathname();
  const { theme, toggleTheme, mounted } = useTheme();

  // Resolve theme-dependent values only after hydration
  const currentTheme = !mounted ? "dark" : theme;

  return (
    <LibrarySidebar
      brandIcon="/brand-icon.png"
      brandLabel="Portal"
      sections={NAV_SECTIONS}
      activeItem={pathname}
      theme={currentTheme}
      onToggleTheme={toggleTheme}
      LinkComponent={Link}
      storageKey="portal-nav-collapsed"
    />
  );
}

