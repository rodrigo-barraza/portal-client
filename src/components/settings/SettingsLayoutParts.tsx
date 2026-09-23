"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import styles from "../SettingsComponent.module.css";

/** A settings card: icon, title and description over a list of rows. */
export function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  danger = false,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Destructive-actions styling (red border and title). */
  danger?: boolean;
  children: ReactNode;
}) {
  const headingId = `settings-${id}-title`;
  return (
    <section
      id={`settings-${id}`}
      data-section-id={id}
      aria-labelledby={headingId}
      className={`${styles["section"]}${danger ? ` ${styles["danger-section"]}` : ""}`}
    >
      <div className={styles["section-header"]}>
        <div className={styles["section-icon-wrap"]}>
          <Icon size={17} strokeWidth={2} />
        </div>
        <div className={styles["section-title-group"]}>
          <h2 id={headingId} className={styles["section-title"]}>
            {title}
          </h2>
          <p className={styles["section-description"]}>{description}</p>
        </div>
      </div>
      <div className={styles["section-body"]}>{children}</div>
    </section>
  );
}

/**
 * One setting: label + hint on the left, its control on the right. Pass
 * `controlId` when the control is a native input so the label targets it.
 */
export function SettingRow({
  label,
  hint,
  controlId,
  children,
}: {
  label: string;
  hint: string;
  controlId?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles["setting-row"]}>
      <div className={styles["setting-info"]}>
        {controlId ? (
          <label htmlFor={controlId} className={styles["setting-label"]}>
            {label}
          </label>
        ) : (
          <span className={styles["setting-label"]}>{label}</span>
        )}
        <span className={styles["setting-hint"]}>{hint}</span>
      </div>
      <div className={styles["setting-control"]}>{children}</div>
    </div>
  );
}
