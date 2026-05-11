"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { NavigationSidebarComponent as LibrarySidebar, useTheme } from "@rodrigo-barraza/components-library";
import { NAV_SECTIONS } from "../constants";

export default function NavigationSidebarComponent({ mobileOpen, onMobileClose }) {
  const pathname = usePathname();
  const { theme, themes, setTheme, mounted } = useTheme();

  // Resolve theme-dependent values only after hydration
  const currentTheme = !mounted ? "dark" : theme;

  return (
    <LibrarySidebar
      brandIcon="/brand-icon.png"
      brandLabel="Portal"
      sections={NAV_SECTIONS}
      activeItem={pathname}
      theme={currentTheme}
      themes={themes}
      setTheme={setTheme}
      LinkComponent={Link}
      storageKey="portal-nav-collapsed"
      mobileOpen={mobileOpen}
      onMobileClose={onMobileClose}
    />
  );
}
