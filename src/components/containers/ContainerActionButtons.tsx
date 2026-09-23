import type { MouseEvent } from "react";
import { ScrollText } from "lucide-react";
import { ButtonComponent } from "@rodrigo-barraza/components-library";
import type { ContainerRow } from "@/types/portal";
import {
  ACTION_COPY,
  type ContainerAction,
} from "../monitoring/useActionRunner";
import styles from "./ContainerActionButtons.module.css";

const ACTION_VARIANT: Record<ContainerAction, string> = {
  stop: "destructive",
  start: "tonal",
  rollback: "secondary",
  restart: "secondary",
};

/** Logs page deep link — the device disambiguates same-named containers. */
export function logsHref(
  containerName: string,
  device?: string | null,
): string {
  const params = new URLSearchParams({ container: containerName });
  if (device) params.set("device", device);
  return `/logs?${params.toString()}`;
}

const stopPropagation = (event: MouseEvent<HTMLElement>) =>
  event.stopPropagation();

/**
 * Icon-only action row for a container (table cell, card footer, drawer
 * header). Every button disables while any action on this container is
 * running; the running one shows the spinner.
 */
export default function ContainerActionButtons({
  row,
  pending,
  rollbackAvailable,
  onAction,
}: {
  row: ContainerRow;
  pending?: ContainerAction;
  rollbackAvailable: boolean;
  onAction: (row: ContainerRow, action: ContainerAction) => void;
}) {
  const isRunning = row._stats?.state === "running";

  const renderAction = (action: ContainerAction) => {
    const copy = ACTION_COPY[action];
    const label =
      action === "rollback" ? "Roll back to previous build" : copy.verb;
    return (
      <ButtonComponent
        key={action}
        variant={ACTION_VARIANT[action]}
        size="small"
        icon={copy.icon}
        iconSize={9}
        loading={pending === action}
        disabled={pending !== undefined}
        title={label}
        aria-label={`${label} ${row.containerName}`}
        className={styles["action-button"]}
        onClick={(event: MouseEvent<HTMLElement>) => {
          event.stopPropagation();
          onAction(row, action);
        }}
      />
    );
  };

  return (
    <div className={styles["action-row"]}>
      {renderAction(isRunning ? "stop" : "start")}
      <ButtonComponent
        variant="secondary"
        size="small"
        icon={ScrollText}
        iconSize={9}
        href={logsHref(row.containerName, row.device)}
        title="Logs"
        aria-label={`Logs for ${row.containerName}`}
        className={styles["action-button"]}
        onClick={stopPropagation}
      />
      {rollbackAvailable && renderAction("rollback")}
      {renderAction("restart")}
    </div>
  );
}
