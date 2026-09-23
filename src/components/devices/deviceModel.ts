/**
 * Pure shaping for the Devices page — containers grouped per host and a
 * device's overall container status.
 */

import type { Device, DockerContainerStats } from "../../types/portal";

/** A container from /stats/containers (stopped ones carry zeroed stats). */
export type DeviceContainer = DockerContainerStats;

export function isRunning(container: Pick<DeviceContainer, "state">): boolean {
  return container.state === "running";
}

/** Containers keyed by device id, each list sorted by name. */
export function groupContainersByDevice(containers: DeviceContainer[]): Record<string, DeviceContainer[]> {
  const groups: Record<string, DeviceContainer[]> = {};
  for (const container of containers) {
    (groups[container.device || "unknown"] ??= []).push(container);
  }
  for (const list of Object.values(groups)) list.sort((first, second) => first.name.localeCompare(second.name));
  return groups;
}

/** Busiest devices first; ties keep the registry order. */
export function sortDevicesByContainerCount<D extends Pick<Device, "id">>(
  devices: D[],
  containersByDevice: Record<string, DeviceContainer[]>,
): D[] {
  return [...devices].sort(
    (first, second) =>
      (containersByDevice[second.id]?.length ?? 0) - (containersByDevice[first.id]?.length ?? 0),
  );
}

export type DeviceStatusVariant = "healthy" | "unhealthy" | "inactive";

/**
 * All containers running → healthy; any stopped → unhealthy; a device with
 * no containers reported (no Docker API, or none deployed) → inactive,
 * rather than being painted as down.
 */
export function deviceStatus(containers: DeviceContainer[]): {
  variant: DeviceStatusVariant;
  running: number;
  total: number;
} {
  const running = containers.filter(isRunning).length;
  const total = containers.length;
  const variant = total === 0 ? "inactive" : running === total ? "healthy" : "unhealthy";
  return { variant, running, total };
}
