"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { NavigationSidebarComponent as LibrarySidebar } from "@rodrigo-barraza/components";
import { useTheme } from "./ThemeProvider";
import { NAV_ITEMS } from "../constants";

export default function NavigationSidebarComponent() {
  const pathname = usePathname();
  const { theme, toggleTheme, mounted } = useTheme();

  // Resolve theme-dependent values only after hydration
  const currentTheme = !mounted ? "dark" : theme;

  return (
    <LibrarySidebar
      brandIcon="/brand-icon.png"
      brandLabel="Portal"
      items={NAV_ITEMS}
      activeItem={pathname}
      theme={currentTheme}
      onToggleTheme={toggleTheme}
      LinkComponent={Link}
      collapsible={false}
    />
  );
}
