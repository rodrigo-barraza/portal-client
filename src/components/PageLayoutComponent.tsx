"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  PageLayoutComponent as LibraryPageLayout,
  useTheme,
} from "@rodrigo-barraza/components-library";
import { NAV_SECTIONS } from "@/constants";
import { NAV_COLLAPSED_STORAGE_KEY } from "@/lib/storageKeys";
import SidebarAuthControlComponent from "./SidebarAuthControlComponent";

/** Pages whose content fills the main area edge to edge (no padding). */
const FULL_BLEED_PATHS = new Set(["/topology"]);

const FULL_BLEED_MAIN_STYLE: CSSProperties = {
  padding: 0,
  display: "flex",
  flexDirection: "column",
};

/**
 * PageLayoutComponent — the library PageLayoutComponent pre-configured for
 * Portal: brand identity, nav sections, theming and the sidebar account
 * control. Mounted once by the (portal) route-group layout.
 */
export default function PageLayoutComponent({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  // ThemeProvider renders its default theme until it has read storage, on
  // the server and the client alike, so `theme` is hydration-safe as is.
  const { theme, themes, setTheme } = useTheme();

  return (
    <LibraryPageLayout
      brandIcon="/brand-icon.png"
      brandLabel="Portal"
      sections={NAV_SECTIONS}
      activeItem={pathname}
      theme={theme}
      themes={themes}
      setTheme={setTheme}
      LinkComponent={Link}
      bottomActions={<SidebarAuthControlComponent />}
      storageKey={NAV_COLLAPSED_STORAGE_KEY}
      mainStyle={
        FULL_BLEED_PATHS.has(pathname) ? FULL_BLEED_MAIN_STYLE : undefined
      }
    >
      {children}
    </LibraryPageLayout>
  );
}
