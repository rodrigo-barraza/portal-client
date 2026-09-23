"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import type { ReactNode, CSSProperties } from "react";
import {
  PageLayoutComponent as LibraryPageLayout,
  useTheme,
} from "@rodrigo-barraza/components-library";
import { NAV_SECTIONS } from "@/constants";
import { NAV_COLLAPSED_STORAGE_KEY } from "@/lib/storageKeys";
import SidebarAuthControlComponent from "./SidebarAuthControlComponent";

/**
 * PageLayoutComponent — Thin wrapper around the library PageLayoutComponent,
 * pre-configured for Portal with brand identity, nav sections, and theming.
 */
export default function PageLayoutComponent({
  children,
  mainStyle,
  mainClassName,
  title,
  onBack,
}: {
  children: ReactNode;
  mainStyle?: CSSProperties;
  mainClassName?: string;
  title?: string | ReactNode;
  onBack?: () => void;
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
      mainStyle={mainStyle}
      mainClassName={mainClassName}
      title={title}
      onBack={onBack}
    >
      {children}
    </LibraryPageLayout>
  );
}
