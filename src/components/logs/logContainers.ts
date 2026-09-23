import type { LoggableContainer } from "@/types/portal";
import { containerKey } from "../monitoring/containerHistory";

export interface LoggableContainerOption {
  value: string;
  label: string;
  container: LoggableContainer;
}

/**
 * Selector options: grouped by host, running containers first, then by
 * name. A name that exists on several hosts is labelled with its host.
 */
export function buildContainerOptions(
  containers: LoggableContainer[],
): LoggableContainerOption[] {
  const sorted = [...containers].sort((first, second) => {
    if (first.device !== second.device)
      return first.device.localeCompare(second.device);
    const firstRunning = first.state === "running";
    const secondRunning = second.state === "running";
    if (firstRunning !== secondRunning) return firstRunning ? -1 : 1;
    return first.name.localeCompare(second.name);
  });

  const nameCounts = new Map<string, number>();
  for (const container of sorted) {
    nameCounts.set(container.name, (nameCounts.get(container.name) ?? 0) + 1);
  }

  return sorted.map((container) => ({
    value: containerKey(container.device, container.name),
    label:
      (nameCounts.get(container.name) ?? 0) > 1
        ? `${container.name} (${container.deviceName || container.device})`
        : container.name,
    container,
  }));
}

/**
 * Resolve a `?container=` deep link. `device` (sent by the Containers and
 * Projects pages) picks the right host when the name exists on several;
 * without it, a running container wins over a stopped one.
 */
export function findLinkedContainer(
  containers: LoggableContainer[],
  name: string,
  device?: string | null,
): LoggableContainer | null {
  const named = containers.filter((container) => container.name === name);
  if (device) {
    const onDevice = named.find((container) => container.device === device);
    if (onDevice) return onDevice;
  }
  return (
    named.find((container) => container.state === "running") ?? named[0] ?? null
  );
}
