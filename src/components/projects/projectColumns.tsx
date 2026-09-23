import { Container, Database, ExternalLink, GitBranch, Globe, HardDrive, Link2, ShieldCheck } from "lucide-react";
import { BadgeComponent } from "@rodrigo-barraza/components-library";
import { formatBytes } from "@rodrigo-barraza/utilities-library";
import { DEFAULT_SERVICE_TYPE_ICON, SERVICE_TYPE_ICONS } from "@/constants";
import type { LanguageBreakdown, PortalService, RepoSize } from "@/types/portal";
import { DEFAULT_LANGUAGE_COLOR, LANGUAGE_COLORS } from "./languageColors";
import { DeployTierBadge, ProjectTypeBadge } from "./ProjectBadges";
import { projectHealth, type ProjectHealth } from "./projectModel";
import styles from "../ProjectTableComponent.module.css";

const ICON_CLASS: Record<ProjectHealth, string> = {
  healthy: styles['icon-healthy'],
  down: styles['icon-unhealthy'],
  unknown: styles['icon-unknown'],
  "not-deployed": styles['icon-neutral'],
};

const ROW_CLASS: Record<ProjectHealth, string> = {
  healthy: styles['status-row-healthy'],
  down: styles['status-row-unhealthy'],
  unknown: styles['status-row-unknown'],
  "not-deployed": styles['status-row-neutral'],
};

export const getProjectRowClassName = (service: PortalService) => ROW_CLASS[projectHealth(service)];

const dash = <span className={styles['muted-cell']}>—</span>;

/** "https://github.com/owner/repo(.git)" → "repo". */
export function repoName(repo: string): string {
  const slug = repo.match(/github\.com\/(.+?)(?:\.git)?$/)?.[1] ?? repo;
  return slug.split("/").pop() || slug;
}

/**
 * Column definitions for the Projects table. The page sorts (both tables
 * share one sort), so `sortable` only drives the header affordance.
 */
export function buildProjectColumns(
  projectSizes: Record<string, RepoSize>,
  projectLanguages: Record<string, LanguageBreakdown>,
  excludeColumns: ReadonlySet<string>,
) {
  return [
    {
      key: "name",
      label: "Project",
      sortable: true,
      render: (service: PortalService) => {
        const TypeIcon =
          (service.projectType && SERVICE_TYPE_ICONS[service.projectType]) ||
          DEFAULT_SERVICE_TYPE_ICON;
        return (
          <div className={styles['name-cell']}>
            <TypeIcon
              size={14}
              strokeWidth={2.6}
              className={`${styles['type-icon']} ${ICON_CLASS[projectHealth(service)]}`}
              aria-hidden="true"
            />
            {/* Keyboard entry point: its click bubbles to the row handler. */}
            <button
              type="button"
              className={styles['service-name']}
              aria-label={`Show details for ${service.name}`}
            >
              {service.name}
            </button>
          </div>
        );
      },
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      render: (service: PortalService) =>
        service.projectType ? <ProjectTypeBadge projectType={service.projectType} /> : null,
    },
    {
      key: "essential",
      label: "Essential",
      sortable: true,
      description: "Core scaffolding required to build & deploy new projects",
      render: (service: PortalService) =>
        service.essential ? (
          <BadgeComponent
            variant="info"
            style={{
              color: "var(--color-warning)",
              background: "var(--calculated-color-warning-subtle)",
              borderColor: "color-mix(in srgb, var(--color-warning) 25%, transparent)",
            }}
          >
            <ShieldCheck size={11} strokeWidth={2.4} className={styles['badge-icon']} />
            Core
          </BadgeComponent>
        ) : (
          dash
        ),
    },
    {
      key: "tier",
      label: "Tier",
      sortable: true,
      render: (service: PortalService) =>
        typeof service.deployTier === "number" ? (
          <DeployTierBadge tier={service.deployTier}>{service.deployTier}</DeployTierBadge>
        ) : null,
    },
    {
      key: "description",
      label: "Description",
      sortable: false,
      render: (service: PortalService) =>
        service.description ? (
          <span className={styles['description-cell']} title={service.description}>
            {service.description}
          </span>
        ) : (
          dash
        ),
    },
    {
      key: "domain",
      label: "Domain",
      sortable: true,
      render: (service: PortalService) =>
        service.domain ? (
          <BadgeComponent type="domain" domain={service.domain} icons={{ Globe }} />
        ) : (
          dash
        ),
    },
    {
      key: "repo",
      label: "Repo",
      sortable: true,
      render: (service: PortalService) =>
        service.repo ? (
          <a
            href={service.repo}
            target="_blank"
            rel="noopener noreferrer"
            className={styles['repo-link']}
            onClick={(event) => event.stopPropagation()}
          >
            <GitBranch size={12} strokeWidth={2.2} />
            <span>{repoName(service.repo)}</span>
            <ExternalLink size={10} strokeWidth={2} className={styles['external-icon']} />
          </a>
        ) : (
          dash
        ),
    },
    {
      key: "language",
      label: "Language",
      sortable: true,
      description: "Primary language detected by GitHub Linguist",
      render: (service: PortalService) => {
        const languages = projectLanguages[service.id];
        if (!languages?.primary) return dash;
        const topLanguages = languages.breakdown
          .slice(0, 3)
          .map((entry) => `${entry.language} ${entry.percent}%`)
          .join(", ");
        return (
          <span className={styles['language-cell']} title={topLanguages}>
            <span
              className={styles['language-dot']}
              style={{ background: LANGUAGE_COLORS[languages.primary] || DEFAULT_LANGUAGE_COLOR }}
            />
            <span className={styles['language-name']}>{languages.primary}</span>
          </span>
        );
      },
    },
    {
      key: "dependencies",
      label: "Deps",
      sortable: true,
      description: "Number of upstream dependencies",
      render: (service: PortalService) => {
        const count = (service.dependsOn || []).length;
        if (count === 0) return dash;
        return (
          <BadgeComponent variant="info">
            <Link2 size={11} strokeWidth={2.2} className={styles['badge-icon']} />
            {count}
          </BadgeComponent>
        );
      },
    },
    {
      key: "database",
      label: "Database",
      sortable: true,
      render: (service: PortalService) =>
        service.db ? (
          <BadgeComponent variant="info">
            <Database size={11} strokeWidth={2.2} className={styles['badge-icon']} />
            {service.db}
          </BadgeComponent>
        ) : (
          dash
        ),
    },
    {
      key: "containers",
      label: "Containers",
      sortable: true,
      description: "Number of Docker containers for this project",
      render: (service: PortalService) =>
        service.dockerProject ? (
          <BadgeComponent variant="info">
            <Container size={11} strokeWidth={2.2} className={styles['badge-icon']} />1
          </BadgeComponent>
        ) : (
          dash
        ),
    },
    {
      key: "size",
      label: "Size",
      sortable: true,
      description: "GitHub repository size",
      render: (service: PortalService) => {
        const size = projectSizes[service.id];
        if (!size) return dash;
        return (
          <BadgeComponent variant="info">
            <HardDrive size={11} strokeWidth={2.2} className={styles['badge-icon']} />
            {formatBytes(size.sizeBytes)}
          </BadgeComponent>
        );
      },
    },
  ].filter((column) => !excludeColumns.has(column.key));
}
