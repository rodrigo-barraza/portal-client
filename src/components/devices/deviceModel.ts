/**
 * Pure shaping for the Devices page — containers grouped per host and a
 * device's overall container status.
 */

import type { Device, DockerContainerStats } from "../../types/portal";

/** Whether a /stats/containers entry is running (stopped ones carry zeroed stats). */
export function isRunning(
  container: Pick<DockerContainerStats, "state">,
): boolean {
  return container.state === "running";
}

/** Containers keyed by device id, each list sorted by name. */
export function groupContainersByDevice(
  containers: DockerContainerStats[],
): Record<string, DockerContainerStats[]> {
  const groups: Record<string, DockerContainerStats[]> = {};
  for (const container of containers) {
    (groups[container.device || "unknown"] ??= []).push(container);
  }
  for (const list of Object.values(groups))
    list.sort((first, second) => first.name.localeCompare(second.name));
  return groups;
}

/** Busiest devices first; ties keep the registry order. */
export function sortDevicesByContainerCount<D extends Pick<Device, "id">>(
  devices: D[],
  containersByDevice: Record<string, DockerContainerStats[]>,
): D[] {
  return [...devices].sort(
    (first, second) =>
      (containersByDevice[second.id]?.length ?? 0) -
      (containersByDevice[first.id]?.length ?? 0),
  );
}

export type DeviceStatusVariant = "healthy" | "unhealthy" | "inactive";

/**
 * All containers running → healthy; any stopped → unhealthy; a device with
 * no containers reported (no Docker API, or none deployed) → inactive,
 * rather than being painted as down.
 */
export function deviceStatus(containers: DockerContainerStats[]): {
  variant: DeviceStatusVariant;
  running: number;
  total: number;
} {
  const running = containers.filter(isRunning).length;
  const total = containers.length;
  const variant =
    total === 0 ? "inactive" : running === total ? "healthy" : "unhealthy";
  return { variant, running, total };
}
