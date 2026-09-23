"use client";

import { useMemo } from "react";
import { BarChart3, Box, Globe, HardDrive, Lock, Server } from "lucide-react";
import {
  BadgeComponent,
  LoadingIndicatorComponent,
} from "@rodrigo-barraza/components-library";
import {
  formatBytes,
  formatDuration,
} from "@rodrigo-barraza/utilities-library";
import { usePortalSettings } from "@/lib/settings";
import type { ContainerStats, PortalService } from "@/types/portal";
import {
  CpuMetricCard,
  MemoryMetricCard,
  MetricCard,
  MetricDim,
  MetricRow,
  TransferStat,
  TransferStats,
} from "../monitoring/ContainerMetricCards";
import { thresholdsFromSettings } from "../monitoring/severity";
import { ProjectHealthBadge } from "./ProjectHealthBadge";
import { useProjectContainer } from "./useProjectContainer";
import panelStyles from "../ExpandedProjectPanelComponent.module.css";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={panelStyles["field"]}>
      <span className={panelStyles["field-label"]}>{label}</span>
      {children}
    </div>
  );
}

function ContainerMetrics({ dockerProject }: { dockerProject: string }) {
  const { alertThresholdCpu, alertThresholdMemory, containerPollingInterval } =
    usePortalSettings();
  const thresholds = useMemo(
    () => thresholdsFromSettings({ alertThresholdCpu, alertThresholdMemory }),
    [alertThresholdCpu, alertThresholdMemory],
  );
  const { loaded, stats, history } = useProjectContainer(
    dockerProject,
    containerPollingInterval,
  );

  if (!stats) {
    return (
      <div className={panelStyles["container-metrics-empty"]}>
        {loaded ? (
          <>
            <BarChart3
              size={18}
              strokeWidth={1.5}
              className={panelStyles["empty-tab-icon"]}
            />
            <span>No container named {dockerProject}</span>
          </>
        ) : (
          <LoadingIndicatorComponent size="small" label="Loading metrics…" />
        )}
      </div>
    );
  }

  const { network, blockIO, pids } = stats as Partial<ContainerStats>;
  return (
    <div className={panelStyles["container-metrics"]}>
      {stats.cpu && (
        <CpuMetricCard
          cpu={stats.cpu}
          history={history?.cpu}
          bounds={thresholds.cpu}
        />
      )}
      {stats.memory && (
        <MemoryMetricCard
          memory={stats.memory}
          history={history?.mem}
          bounds={thresholds.memory}
        />
      )}
      <MetricRow>
        {network && (network.rx > 0 || network.tx > 0) && (
          <MetricCard icon={Globe} title="Network">
            <TransferStats>
              <TransferStat label="RX" value={formatBytes(network.rx)} />
              <TransferStat label="TX" value={formatBytes(network.tx)} />
            </TransferStats>
          </MetricCard>
        )}
        {blockIO && (blockIO.read > 0 || blockIO.write > 0) && (
          <MetricCard icon={HardDrive} title="Block I/O">
            <TransferStats>
              <TransferStat label="Read" value={formatBytes(blockIO.read)} />
              <TransferStat label="Write" value={formatBytes(blockIO.write)} />
            </TransferStats>
          </MetricCard>
        )}
        {(pids ?? 0) > 0 && (
          <MetricCard title="PIDs" header={<MetricDim>{pids}</MetricDim>} />
        )}
      </MetricRow>
    </div>
  );
}

/** Drawer's Container tab: registry status on the left, live metrics on the right. */
export default function ProjectContainerTab({
  service,
}: {
  service: PortalService;
}) {
  const { showResponseTimes } = usePortalSettings();
  return (
    <div className={panelStyles["container-tab"]}>
      <div className={panelStyles["container-info"]}>
        <div className={panelStyles["section"]}>
          <h4 className={panelStyles["section-title"]}>
            Status &amp; Environment
          </h4>
          <div className={panelStyles["field-grid"]}>
            <Field label="Status">
              <ProjectHealthBadge service={service} />
            </Field>
            <Field label="Environment">
              <BadgeComponent
                variant={
                  service.environment === "Production" ? "success" : "info"
                }
              >
                {service.environment || "Unknown"}
              </BadgeComponent>
            </Field>
            {service.visibility && (
              <Field label="Visibility">
                <BadgeComponent
                  type="visibility"
                  visibility={service.visibility}
                  icons={{ Globe, Lock }}
                />
              </Field>
            )}
            {showResponseTimes && service.responseTimeMs != null && (
              <Field label="Response">
                <BadgeComponent
                  type="responseTime"
                  ms={service.responseTimeMs}
                  formatter={formatDuration}
                />
              </Field>
            )}
            {service.device && (
              <Field label="Device">
                <BadgeComponent
                  type="device"
                  device={service.device}
                  icons={{ Server }}
                />
              </Field>
            )}
          </div>
        </div>

        {(service.port || service.url) && (
          <div className={panelStyles["section"]}>
            <h4 className={panelStyles["section-title"]}>Network</h4>
            <div className={panelStyles["field-grid"]}>
              {service.port && (
                <Field label="Port">
                  <BadgeComponent type="port" port={service.port} />
                </Field>
              )}
              {service.url && (
                <Field label="Address">
                  <BadgeComponent type="address" address={service.url} link />
                </Field>
              )}
            </div>
          </div>
        )}
      </div>

      {service.dockerProject ? (
        <ContainerMetrics dockerProject={service.dockerProject} />
      ) : (
        <div className={panelStyles["container-metrics-empty"]}>
          <Box
            size={18}
            strokeWidth={1.5}
            className={panelStyles["empty-tab-icon"]}
          />
          <span>Not containerized</span>
        </div>
      )}
    </div>
  );
}
