"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { PageLayoutComponent as LibraryPageLayout, useTheme } from "@rodrigo-barraza/components-library";
import { NAV_SECTIONS } from "../constants";

/**
 * PageLayoutComponent — Thin wrapper around the library PageLayoutComponent,
 * pre-configured for Portal with brand identity, nav sections, and theming.
 */
export default function PageLayoutComponent({ children, mainStyle, mainClassName }: { [key: string]: any }) {
  const pathname = usePathname();
  const { theme, themes, setTheme, mounted } = useTheme();
  const currentTheme = !mounted ? "dark" : theme;

  return (
    <LibraryPageLayout
      brandIcon="/brand-icon.png"
      brandLabel="Portal"
      sections={NAV_SECTIONS}
      activeItem={pathname}
      theme={currentTheme}
      themes={themes}
      setTheme={setTheme}
      LinkComponent={Link}
      storageKey="portal-nav-collapsed"
      mainStyle={mainStyle}
      mainClassName={mainClassName}
    >
      {children}
    </LibraryPageLayout>
  );
}
