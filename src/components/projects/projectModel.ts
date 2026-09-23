import { formatElapsedTime } from "@rodrigo-barraza/utilities-library";
import type { LanguageBreakdown, PortalService, RepoSize } from "@/types/portal";

/**
 * Pure model behind the Projects page: health classification, filtering,
 * sorting and the metadata rows cards and drawers show.
 */

/** Project types that are published or run locally, never deployed. */
export const NON_DEPLOYED_TYPES: ReadonlySet<string> = new Set(["Library", "Kit", "Tool"]);

export function isDeployedProject(service: PortalService): boolean {
  return !NON_DEPLOYED_TYPES.has(service.projectType as string);
}

/**
 * - `not-deployed`: libraries/kits/tools have no health endpoint — their
 *   "No URL configured" failure is not an outage.
 * - `unknown`: registered but not probed yet (portal-service just booted,
 *   or an infrastructure type without a probe) — not "down".
 */
export type ProjectHealth = "healthy" | "down" | "unknown" | "not-deployed";

export function projectHealth(service: PortalService): ProjectHealth {
  if (!isDeployedProject(service)) return "not-deployed";
  if (service.checkedAt == null) return "unknown";
  return service.healthy ? "healthy" : "down";
}

/** `/services` → the projects to list; infrastructure is opt-in (Settings). */
export function projectsFromResponse(
  services: PortalService[],
  infrastructure: PortalService[],
  showInfrastructure: boolean,
): PortalService[] {
  if (!showInfrastructure) {
    return services.filter((service) => service.projectType !== "Infrastructure");
  }
  return [
    ...services,
    ...infrastructure.map((item) => ({ ...item, isInfrastructure: true })),
  ];
}

// ── Filters ─────────────────────────────────────────────────────────

export interface ProjectFilters {
  status: string[];
  visibility: string[];
  environment: string[];
  projectType: string[];
  device: string[];
}

export type FilterDimension = keyof ProjectFilters;

export const EMPTY_FILTERS: ProjectFilters = {
  status: [],
  visibility: [],
  environment: [],
  projectType: [],
  device: [],
};

export interface FilterOption {
  value: string;
  label: string;
}

const STATIC_FILTER_OPTIONS = {
  status: {
    label: "Status",
    values: [
      { value: "healthy", label: "Healthy" },
      { value: "unhealthy", label: "Down" },
    ],
  },
  visibility: {
    label: "Visibility",
    values: [
      { value: "external", label: "External" },
      { value: "internal", label: "Internal" },
    ],
  },
  environment: {
    label: "Environment",
    values: [
      { value: "Production", label: "Production" },
      { value: "Development", label: "Development" },
    ],
  },
};

function distinctSorted(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

/** Filter selects, in bar order; Type and Device options come from the data. */
export function buildFilterOptions(
  items: PortalService[],
): Record<FilterDimension, { label: string; values: FilterOption[] }> {
  const toOptions = (values: string[]) => values.map((value) => ({ value, label: value }));
  return {
    ...STATIC_FILTER_OPTIONS,
    projectType: {
      label: "Type",
      values: toOptions(distinctSorted(items.map((service) => service.projectType))),
    },
    device: {
      label: "Device",
      values: toOptions(distinctSorted(items.map((service) => service.device))),
    },
  };
}

const STATUS_FILTER_HEALTH: Record<string, ProjectHealth> = {
  healthy: "healthy",
  unhealthy: "down",
};

export function hasActiveFilters(filters: ProjectFilters, query: string): boolean {
  return query.trim().length > 0 || Object.values(filters).some((values) => values.length > 0);
}

export function filterProjects(
  items: PortalService[],
  filters: ProjectFilters,
  query: string,
): PortalService[] {
  const needle = query.trim().toLowerCase();
  const matches = (selected: string[], value: string | null | undefined) =>
    selected.length === 0 || (value != null && selected.includes(value));

  return items.filter((service) => {
    if (needle) {
      const haystack = [
        service.name,
        service.repo,
        service.domain,
        service.description,
        service.projectType,
      ];
      if (!haystack.some((field) => field?.toLowerCase().includes(needle))) return false;
    }
    if (
      filters.status.length > 0 &&
      !filters.status.some((status) => STATUS_FILTER_HEALTH[status] === projectHealth(service))
    ) {
      return false;
    }
    return (
      matches(filters.visibility, service.visibility) &&
      matches(filters.environment, service.environment) &&
      matches(filters.projectType, service.projectType) &&
      matches(filters.device, service.device)
    );
  });
}

// ── Sorting ─────────────────────────────────────────────────────────

/** A project's repository size (GET /services/sizes). */
export type ProjectSize = RepoSize;

/** A project's Linguist breakdown (GET /services/languages). */
export type ProjectLanguages = LanguageBreakdown;

export interface ProjectSortContext {
  sizes: Record<string, ProjectSize>;
  languages: Record<string, ProjectLanguages>;
}

export type SortDirection = "asc" | "desc";

const HEALTH_RANK: Record<ProjectHealth, number> = {
  healthy: 3,
  unknown: 2,
  down: 1,
  "not-deployed": 0,
};

/** Sort value per table column key (numbers and strings never mix per key). */
function sortValue(
  service: PortalService,
  key: string,
  context: ProjectSortContext,
): string | number {
  switch (key) {
    case "status":
      // Ascending lists healthy first, like the table's arrow suggests.
      return -HEALTH_RANK[projectHealth(service)];
    case "type":
      return service.projectType || "";
    case "tier":
      return typeof service.deployTier === "number" ? service.deployTier : 99;
    case "essential":
      return service.essential ? 0 : 1;
    case "domain":
      return service.domain || "";
    case "repo":
      return service.repo || "";
    case "language":
      return context.languages[service.id]?.primary || "";
    case "dependencies":
      return (service.dependsOn || []).length;
    case "database":
      return service.db || "";
    case "containers":
      return service.dockerProject ? 1 : 0;
    case "size":
      return context.sizes[service.id]?.sizeBytes ?? 0;
    default:
      return service.name || "";
  }
}

/** Sort by a table column; name breaks ties so the order never jitters. */
export function sortProjects(
  items: PortalService[],
  key: string,
  direction: SortDirection,
  context: ProjectSortContext,
): PortalService[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...items].sort((first, second) => {
    const firstValue = sortValue(first, key, context);
    const secondValue = sortValue(second, key, context);
    const order =
      typeof firstValue === "number" && typeof secondValue === "number"
        ? firstValue - secondValue
        : String(firstValue).localeCompare(String(secondValue));
    return sign * order || (first.name || "").localeCompare(second.name || "");
  });
}

// ── Summary ─────────────────────────────────────────────────────────

export function summarizeProjects(items: PortalService[]) {
  const deployed = items.filter(isDeployedProject);
  const count = (health: ProjectHealth) =>
    deployed.filter((service) => projectHealth(service) === health).length;
  return {
    total: items.length,
    deployed: deployed.length,
    nonDeployed: items.length - deployed.length,
    healthy: count("healthy"),
    down: count("down"),
    unknown: count("unknown"),
    devices: distinctSorted(deployed.map((service) => service.device)),
    types: distinctSorted(items.map((service) => service.projectType)),
  };
}

// ── Metadata rows ───────────────────────────────────────────────────

export interface MetadataField {
  label: string;
  value: string;
  mono?: boolean;
}

// Health endpoints return arbitrary JSON — only print scalars, never an
// object (which React cannot render) or a stray boolean.
function scalar(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** Metadata a health check reported, as label/value rows. */
export function describeServiceMetadata(service: PortalService): MetadataField[] {
  const metadata = service.metadata ?? {};
  const fields: MetadataField[] = [];
  const add = (label: string, value: string | null, mono = false) => {
    if (value !== null) fields.push({ label, value, mono });
  };

  add("Version", scalar(metadata.version), true);
  if (service.isInfrastructure) {
    const uptime = typeof metadata.uptime === "number" ? metadata.uptime : null;
    add("Uptime", uptime !== null ? formatElapsedTime(uptime) : null);
    add("Connections", scalar(metadata.connections));
    add("Databases", scalar(metadata.databases));
    add("Buckets", scalar(metadata.buckets));
    const bucketNames = Array.isArray(metadata.bucketNames)
      ? metadata.bucketNames.filter((name): name is string => typeof name === "string")
      : [];
    add("Bucket Names", bucketNames.length > 0 ? bucketNames.join(", ") : null, true);
  }
  add("Node", scalar(metadata.nodeVersion), true);
  add("Python", scalar(metadata.pythonVersion), true);
  return fields;
}
