"use client";

import { useState } from "react";
import { useMediaQuery, MobileHeaderComponent } from "@rodrigo-barraza/components-library";
import NavigationSidebarComponent from "./NavigationSidebarComponent";
import styles from "./PageLayoutComponent.module.css";

/**
 * PageLayoutComponent — Unified page wrapper for all portal pages.
 *
 * Encapsulates the repeated pattern of NavigationSidebarComponent +
 * main content area, and manages the mobile drawer open/close state.
 * On mobile viewports, renders a MobileHeaderComponent with hamburger
 * button instead of the fixed sidebar.
 *
 * @param {React.ReactNode} children — Page content
 * @param {object}  [mainStyle]     — Optional inline style for the <main> element
 * @param {string}  [mainClassName] — Optional additional class for the <main> element
 */
export default function PageLayoutComponent({ children, mainStyle, mainClassName }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className={styles.mainArea}>
        {/* Mobile-only top header bar */}
        {isMobile && (
          <MobileHeaderComponent
            brandIcon="/brand-icon.png"
            brandLabel="Portal"
            onMenuClick={() => setMobileOpen(true)}
          />
        )}

        <main
          className={`page-content ${mainClassName || ""}`}
          style={mainStyle}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
