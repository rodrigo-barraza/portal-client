import { Check, Container, Minus, X } from "lucide-react";
import type { ContainerStatusKind } from "@/types/portal";
import styles from "./ContainerStatus.module.css";

export const STATUS_LABEL: Record<ContainerStatusKind, string> = {
  healthy: "Healthy",
  down: "Down",
  unknown: "Not yet checked",
};

const INDICATOR_CLASS: Record<ContainerStatusKind, string> = {
  healthy: styles['status-healthy'],
  down: styles['status-down'],
  unknown: styles['status-unknown'],
};

const ICON_CLASS: Record<ContainerStatusKind, string> = {
  healthy: styles['icon-healthy'],
  down: styles['icon-unhealthy'],
  unknown: styles['icon-unknown'],
};

const INDICATOR_GLYPH = { healthy: Check, down: X, unknown: Minus } as const;

/** Round status chip for the table's Status column. */
export function StatusIndicator({ statusKind }: { statusKind: ContainerStatusKind }) {
  const Glyph = INDICATOR_GLYPH[statusKind];
  return (
    <span
      className={`${styles['status-indicator']} ${INDICATOR_CLASS[statusKind]}`}
      title={STATUS_LABEL[statusKind]}
      role="img"
      aria-label={STATUS_LABEL[statusKind]}
    >
      <Glyph size={12} strokeWidth={3} />
    </span>
  );
}

/** Container glyph tinted by status (table name cell, card title). */
export function ContainerStatusIcon({ statusKind }: { statusKind: ContainerStatusKind }) {
  return (
    <Container
      size={14}
      strokeWidth={2.6}
      className={`${styles['type-icon']} ${ICON_CLASS[statusKind]}`}
      aria-hidden="true"
    />
  );
}

/** Gray stand-in for the status badge while health is unknown. */
export function CheckingPill({
  label = "Checking…",
  title = STATUS_LABEL.unknown,
}: {
  label?: string;
  title?: string;
}) {
  return (
    <span className={styles['checking-pill']} title={title}>
      {label}
    </span>
  );
}
