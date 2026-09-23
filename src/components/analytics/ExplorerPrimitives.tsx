"use client";

import type { ReactNode } from "react";
import { LoadingIndicatorComponent } from "@rodrigo-barraza/components-library";
import { Bot, Laptop, Smartphone } from "lucide-react";
import styles from "../SessionExplorerComponent.module.css";

/**
 * Small shared pieces of the session explorer: device icon, bot tag,
 * metadata card, linked-list section, and the list/detail state messages.
 */

export function DeviceIcon({ type }: { type: string | null | undefined }) {
  switch (type?.toLowerCase()) {
    case "mobile":
    case "tablet":
      return <Smartphone size={12} strokeWidth={2} aria-hidden />;
    default:
      return <Laptop size={12} strokeWidth={2} aria-hidden />;
  }
}

/**
 * sessions-service keeps crawler sessions in the explorer lists (flagged
 * `isBot`) so they can be inspected — this makes the flag visible, since
 * aggregate reports already exclude them.
 */
export function BotTag() {
  return (
    <span className={styles["bot-tag"]} title="Flagged as crawler/bot traffic">
      <Bot size={10} strokeWidth={2.2} aria-hidden />
      bot
    </span>
  );
}

export function MetaCard({
  label,
  children,
  highlight = false,
}: {
  label: string;
  children: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`${styles["meta-card"]} ${highlight ? styles["meta-card-highlight"] : ""}`}>
      <span className={styles["meta-label"]}>{label}</span>
      {children}
    </div>
  );
}

/** A metadata value cell — the common case of MetaCard's body. */
export function MetaValue({ children }: { children: ReactNode }) {
  return <span className={styles["meta-value"]}>{children}</span>;
}

export function LinkedSection({
  icon,
  title,
  count,
  children,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className={styles["linked-section"]} aria-label={title}>
      <div className={styles["linked-header"]}>
        {icon}
        <span>{title}</span>
        <span className={styles["linked-count"]}>{count}</span>
      </div>
      <div className={styles["session-pills"]}>{children}</div>
    </section>
  );
}

export function ExplorerLoading({ label }: { label: string }) {
  return (
    <LoadingIndicatorComponent size="small" label={label} className="is-loading-centered-state" />
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
