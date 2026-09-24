"use client";

import type { ReactNode } from "react";
import { LoadingIndicatorComponent } from "@rodrigo-barraza/components-library";
import { Laptop, Smartphone, Tablet } from "lucide-react";
import styles from "../SessionExplorerComponent.module.css";

/**
 * Small shared pieces of the session explorer: device icon, metadata
 * card, and the list/detail loading and state messages.
 */

export function DeviceIcon({ type }: { type: string | null | undefined }) {
  switch (type?.toLowerCase()) {
    case "mobile":
      return <Smartphone size={12} strokeWidth={2} aria-hidden />;
    case "tablet":
      return <Tablet size={12} strokeWidth={2} aria-hidden />;
    default:
      return <Laptop size={12} strokeWidth={2} aria-hidden />;
  }
}

export function MetaCard({
  label,
  children,
  sub,
  highlight = false,
}: {
  label: string;
  children: ReactNode;
  /** A muted second line under the value. */
  sub?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`${styles["meta-card"]} ${highlight ? styles["meta-card-highlight"] : ""}`}
    >
      <span className={styles["meta-label"]}>{label}</span>
      {children}
      {sub && <span className={styles["meta-sub"]}>{sub}</span>}
    </div>
  );
}

/** A metadata value cell — the common case of MetaCard's body. */
export function MetaValue({ children }: { children: ReactNode }) {
  return <span className={styles["meta-value"]}>{children}</span>;
}

export function ExplorerLoading({ label }: { label: string }) {
  return (
    <LoadingIndicatorComponent
      size="small"
      label={label}
      className="is-loading-centered-state"
    />
  );
}

/** Empty or error message in the list/detail body. Errors are announced. */
export function StateMessage({
  children,
  isError = false,
}: {
  children: ReactNode;
  isError?: boolean;
}) {
  return (
    <div
      className={`${styles["empty-state"]} ${isError ? styles["empty-state-error"] : ""}`}
      role={isError ? "alert" : undefined}
    >
      {children}
    </div>
  );
}
