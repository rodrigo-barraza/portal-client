"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUp, Github, Globe, Lock, Play, RotateCcw, ScrollText, Square } from "lucide-react";
import { BadgeComponent, ResponseTimeBadgeComponent, VisibilityBadgeComponent } from "@rodrigo-barraza/components";
import { formatDuration, timeAgo, formatElapsedTime } from "@rodrigo-barraza/utilities";
import { SERVICE_TYPE_ICONS, SERVICE_TYPE_COLORS, DEFAULT_SERVICE_TYPE_ICON } from "../constants";
import styles from "./ServiceCardComponent.module.css";


export default function ServiceCardComponent({ service, onRestart, onStop, onStart }) {
  const [restarting, setRestarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [starting, setStarting] = useState(false);
  const isHealthy = service.healthy;
  const statusClass = isHealthy ? styles.healthy : styles.unhealthy;
  const isProduction = service.environment === "Production";
  const isInfra = service.isInfrastructure;

  const TypeIcon = SERVICE_TYPE_ICONS[service.serviceType] || DEFAULT_SERVICE_TYPE_ICON;

  return (
    <div className={`${styles.card} ${statusClass}`}>
      <div className={styles.cardHeader}>
        <div className={styles.nameRow}>
          <TypeIcon
            size={16}
            strokeWidth={2.6}
            className={`${styles.infraIcon} ${statusClass}`}
          />
          <span className={styles.name}>{service.name}</span>
        </div>
      </div>

      <div className={styles.details}>
        {/* ── Action Buttons (containerized services only) ── */}
        {service.restartable && (
          <div className={styles.actionRow}>
            {isHealthy ? (
              <button
                className={`${styles.actionButton} ${styles.stopButton} ${stopping ? styles.actionButtonLoading : ""}`}
                disabled={stopping || restarting}
                onClick={async () => {
                  setStopping(true);
                  try {
                    await onStop?.(service.id);
                  } finally {
                    setTimeout(() => setStopping(false), 5000);
                  }
                }}
              >
                <Square size={10} strokeWidth={2.6} className={stopping ? styles.pulse : ""} />
                {stopping ? "Stopping…" : "Stop"}
              </button>
            ) : (
              <button
                className={`${styles.actionButton} ${styles.startButton} ${starting ? styles.actionButtonLoading : ""}`}
                disabled={starting || restarting}
                onClick={async () => {
                  setStarting(true);
                  try {
                    await onStart?.(service.id);
                  } finally {
                    setTimeout(() => setStarting(false), 5000);
                  }
                }}
              >
                <Play size={10} strokeWidth={2.6} fill="currentColor" className={starting ? styles.pulse : ""} />
                {starting ? "Starting…" : "Start"}
              </button>
            )}

            <Link
              href={`/logs?service=${service.id}`}
              className={`${styles.actionButton} ${styles.logsButton}`}
            >
              <ScrollText size={10} strokeWidth={2.6} />
              Logs
            </Link>

            <button
              className={`${styles.actionButton} ${styles.restartButton} ${restarting ? styles.actionButtonLoading : ""}`}
              disabled={restarting || stopping || starting}
              onClick={async () => {
                setRestarting(true);
                try {
                  await onRestart?.(service.id);
                } finally {
                  setTimeout(() => setRestarting(false), 5000);
                }
              }}
            >
              <RotateCcw size={10} strokeWidth={2.6} className={restarting ? styles.spin : ""} />
              {restarting ? "Restarting…" : "Restart"}
            </button>
          </div>
        )}

        {/* ── Status ── */}
        <div className={styles.detail}>
          <span className={styles.detailLabel}>Status</span>
          <span className={styles.statusLabel}>
            {isHealthy ? "Healthy" : "Down"}
          </span>
        </div>

        {/* ── Stage / Visibility ── */}
        <div className={styles.detail}>
          <span className={styles.detailLabel}>Environment</span>
          <BadgeComponent
            variant={isProduction ? "success" : "info"}
          >
            {service.environment || "Unknown"}
          </BadgeComponent>
        </div>

        {service.serviceType && (() => {
          const colors = SERVICE_TYPE_COLORS[service.serviceType];
          return (
            <div className={styles.detail}>
              <span className={styles.detailLabel}>Type</span>
              <BadgeComponent
                variant="info"
                style={colors ? {
                  color: colors.color,
                  background: colors.subtle,
                  borderColor: `color-mix(in srgb, ${colors.color} 25%, transparent)`,
                } : undefined}
              >
                {service.serviceType}
              </BadgeComponent>
            </div>
          );
        })()}

        {service.visibility && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Visibility</span>
            <VisibilityBadgeComponent visibility={service.visibility} icons={{ Globe, Lock }} />
          </div>
        )}



        {service.responseTimeMs != null && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Response</span>
            <ResponseTimeBadgeComponent ms={service.responseTimeMs} formatter={formatDuration} />
          </div>
        )}

        {service.device && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Device</span>
            <span className={styles.detailValue}>{service.device}</span>
          </div>
        )}

        {/* ── Infrastructure-specific metadata ── */}
        {isInfra && service.metadata && (
          <>
            {service.metadata.version && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Version</span>
                <span className={`${styles.detailValue} ${styles.mono}`}>
                  {service.metadata.version}
                </span>
              </div>
            )}
            {service.metadata.uptime != null && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Uptime</span>
                <span className={styles.detailValue}>
                  {formatElapsedTime(service.metadata.uptime)}
                </span>
              </div>
            )}
            {service.metadata.connections != null && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Connections</span>
                <span className={styles.detailValue}>
                  {service.metadata.connections}
                </span>
              </div>
            )}
            {service.metadata.databases != null && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Databases</span>
                <span className={styles.detailValue}>
                  {service.metadata.databases}
                </span>
              </div>
            )}
            {service.metadata.buckets != null && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Buckets</span>
                <span className={styles.detailValue}>
                  {service.metadata.buckets}
                </span>
              </div>
            )}
            {service.metadata.bucketNames?.length > 0 && (
              <div className={styles.detail}>
                <span className={styles.detailLabel}>Bucket Names</span>
                <span className={`${styles.detailValue} ${styles.mono}`}>
                  {service.metadata.bucketNames.join(", ")}
                </span>
              </div>
            )}
          </>
        )}

        {/* ── Standard service metadata ── */}
        {!isInfra && service.metadata?.version && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Version</span>
            <span className={styles.detailValue}>
              {service.metadata.version}
            </span>
          </div>
        )}

        {service.port && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Port</span>
            <code className={`${styles.detailValue} ${styles.mono}`}>
              :{service.port}
            </code>
          </div>
        )}

        {service.url && !isInfra && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Address</span>
            <a
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.detailValue} ${styles.mono} ${styles.endpointLink}`}
            >
              {service.url.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}

        {service.domain && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Domain</span>
            <a
              href={`https://${service.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.detailValue} ${styles.mono} ${styles.endpointLink}`}
            >
              <Globe size={12} strokeWidth={2} />
              {service.domain}
            </a>
          </div>
        )}

        {service.repo && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Repository</span>
            <a
              href={service.repo}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.detailValue} ${styles.mono} ${styles.repoLink}`}
            >
              <Github size={12} strokeWidth={2} />
              {service.repo.replace("https://github.com/", "")}
            </a>
          </div>
        )}

        {service.checkedAt && (
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Checked</span>
            <span className={styles.detailValue}>
              {timeAgo(service.checkedAt)}
            </span>
          </div>
        )}
      </div>

      {service.error && !isHealthy && (
        <div className={styles.errorBar}>
          {service.error}
        </div>
      )}

      {/* ── Connections (dependency graph) ── */}
      {service.dependsOn?.length > 0 && (() => {
        const required = service.dependsOn.filter((d) => d.criticality !== "optional");
        const optional = service.dependsOn.filter((d) => d.criticality === "optional");
        return (
          <div className={styles.connections}>
            {required.length > 0 && (
              <>
                <span className={styles.connectionLabel}>
                  <ArrowUp size={10} strokeWidth={2.4} />
                  Requires
                </span>
                <div className={styles.connectionTags}>
                  {required.map((dep, i) => (
                    <span key={`req-${i}-${dep.name || dep.id || ''}`} className={styles.connectionTag}>
                      {dep.name}
                    </span>
                  ))}
                </div>
              </>
            )}
            {optional.length > 0 && (
              <>
                <span className={`${styles.connectionLabel} ${styles.connectionLabelOptional}`}>
                  <ArrowUp size={10} strokeWidth={2.4} />
                  Optional
                </span>
                <div className={styles.connectionTags}>
                  {optional.map((dep, i) => (
                    <span key={`opt-${i}-${dep.name || dep.id || ''}`} className={`${styles.connectionTag} ${styles.connectionTagOptional}`}>
                      {dep.name}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

