"use client";

import { memo } from "react";
import { GitFork, Globe, Lock, Package, ScrollText, Server } from "lucide-react";
import { BadgeComponent, ButtonComponent } from "@rodrigo-barraza/components-library";
import { formatDuration } from "@rodrigo-barraza/utilities-library";
import { DEFAULT_SERVICE_TYPE_ICON, SERVICE_TYPE_ICONS } from "../constants";
import { usePortalSettings } from "@/lib/settings";
import type { PortalService } from "../types/portal";
import { logsHref } from "./containers/ContainerActionButtons";
import { ACTION_COPY, type ContainerAction } from "./monitoring/useActionRunner";
import { DeployTierBadge, ProjectTypeBadge } from "./projects/ProjectBadges";
import { ProjectHealthBadge } from "./projects/ProjectHealthBadge";
import { describeServiceMetadata, projectHealth, type ProjectHealth } from "./projects/projectModel";
import styles from "./ServiceCardComponent.module.css";

const HEALTH_CLASS: Record<ProjectHealth, string> = {
  healthy: styles['healthy'],
  down: styles['unhealthy'],
  unknown: styles['unknown'],
  "not-deployed": styles['non-deployed'],
};

const ACTION_CLASS: Partial<Record<ContainerAction, string>> = {
  stop: styles['stop-button'],
  start: styles['start-button'],
  rollback: styles['rollback-button'],
  restart: styles['restart-button'],
};

const BUSY_LABEL: Record<ContainerAction, string> = {
  start: "Starting…",
  stop: "Stopping…",
  restart: "Restarting…",
  rollback: "Rolling back…",
};

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles['detail']}>
      <span className={styles['detail-label']}>{label}</span>
      {children}
    </div>
  );
}

/** One project on the Projects page card view. */
function ServiceCardComponent({
  service,
  pending,
  rollbackAvailable = false,
  onAction,
}: {
  service: PortalService;
  /** Action running (or cooling down) on this service. */
  pending?: ContainerAction;
  rollbackAvailable?: boolean;
  onAction: (service: PortalService, action: ContainerAction) => void;
}) {
  const { showResponseTimes } = usePortalSettings();
  const health = projectHealth(service);
  const statusClass = HEALTH_CLASS[health];
  const TypeIcon =
    (service.projectType && SERVICE_TYPE_ICONS[service.projectType]) || DEFAULT_SERVICE_TYPE_ICON;
  const metadata = describeServiceMetadata(service);

  const renderAction = (action: ContainerAction) => {
    const copy = ACTION_COPY[action];
    return (
      <ButtonComponent
        key={action}
        variant="outlined"
        size="small"
        icon={copy.icon}
        loading={pending === action}
        disabled={pending !== undefined}
        onClick={() => onAction(service, action)}
        className={ACTION_CLASS[action]}
      >
        {pending === action ? BUSY_LABEL[action] : action === "rollback" ? "Rollback" : copy.verb}
      </ButtonComponent>
    );
  };

  return (
    <div className={`service-card-component ${styles['card']} ${statusClass}`}>
      <div className={styles['card-header']}>
        <div className={styles['name-row']}>
          <TypeIcon
            size={16}
            strokeWidth={2.6}
            className={`${styles['infra-icon']} ${statusClass}`}
            aria-hidden="true"
          />
          <span className={styles['name']}>{service.name}</span>
        </div>
      </div>

      <div className={styles['details']}>
        {/* ── Actions (containerized services only) ── */}
        {service.restartable && (
          <div className={styles['action-row']}>
            {renderAction(health === "down" ? "start" : "stop")}
            <ButtonComponent
              variant="outlined"
              size="small"
              icon={ScrollText}
              href={logsHref(service.dockerProject || service.id)}
            >
              Logs
            </ButtonComponent>
            {rollbackAvailable && renderAction("rollback")}
            {renderAction("restart")}
          </div>
        )}

        <Detail label="Status">
          <ProjectHealthBadge service={service} />
        </Detail>

        {service.npmPackage && (
          <Detail label="Package">
            <BadgeComponent variant="info">
              <Package size={11} strokeWidth={2.2} className={styles['badge-icon']} />
              {service.npmPackage}
            </BadgeComponent>
          </Detail>
        )}

        <Detail label="Environment">
          <BadgeComponent variant={service.environment === "Production" ? "success" : "info"}>
            {service.environment || "Unknown"}
          </BadgeComponent>
        </Detail>

        {service.projectType && (
          <Detail label="Type">
            <ProjectTypeBadge projectType={service.projectType} />
          </Detail>
        )}

        {typeof service.deployTier === "number" && (
          <Detail label="Tier">
            <DeployTierBadge tier={service.deployTier} />
          </Detail>
        )}

        {service.visibility && (
          <Detail label="Visibility">
            <BadgeComponent type="visibility" visibility={service.visibility} icons={{ Globe, Lock }} />
          </Detail>
        )}

        {showResponseTimes && service.responseTimeMs != null && (
          <Detail label="Response">
            <BadgeComponent type="responseTime" ms={service.responseTimeMs} formatter={formatDuration} />
          </Detail>
        )}

        {service.device && (
          <Detail label="Device">
            <BadgeComponent type="device" device={service.device} icons={{ Server }} />
          </Detail>
        )}

        {metadata.map((field) => (
          <Detail key={field.label} label={field.label}>
            <span className={`${styles['detail-value']} ${field.mono ? styles['mono'] : ""}`}>
              {field.value}
            </span>
          </Detail>
        ))}

        {service.port && (
          <Detail label="Port">
            <BadgeComponent type="port" port={service.port} />
          </Detail>
        )}

        {service.url && !service.isInfrastructure && (
          <Detail label="Address">
            <BadgeComponent type="address" address={service.url} link />
          </Detail>
        )}

        {service.domain && (
          <Detail label="Domain">
            <BadgeComponent type="domain" domain={service.domain} icons={{ Globe }} />
          </Detail>
        )}

        {service.repo && (
          <Detail label="Repository">
            <BadgeComponent type="repository" repo={service.repo} icons={{ Github: GitFork }} />
          </Detail>
        )}

        {service.checkedAt && (
          <Detail label="Checked">
            <BadgeComponent type="dateTime" date={service.checkedAt} highlightNew />
          </Detail>
        )}

        {service.lastHeartbeatAt && (
          <Detail label="Heartbeat">
            <BadgeComponent type="dateTime" date={service.lastHeartbeatAt} highlightNew />
          </Detail>
        )}

        {service.downSince && (
          <Detail label="Down since">
            <BadgeComponent type="dateTime" date={service.downSince} />
          </Detail>
        )}
      </div>

      {service.error && health === "down" && (
        <div className={styles['error-bar']}>{service.error}</div>
      )}
    </div>
  );
}

export default memo(ServiceCardComponent);
