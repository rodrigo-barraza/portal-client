"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  Copy,
  Check,
  HardDrive,
  Terminal,
} from "lucide-react";
import ApiService from "@/services/ApiService";
import styles from "./WorkspaceSettingsSectionComponent.module.css";

interface WorkspaceAgent {
  id: string;
  name: string;
  roots: string[];
  capabilities: string[];
  version: string;
  clientIp?: string;
  connectedAt: string;
  lastPong: string;
  pendingRpcs: number;
}

interface WorkspaceAgentsResponse {
  count: number;
  agents: WorkspaceAgent[];
}

const POLLING_INTERVAL_MS = 15_000;

function formatRelativeTimestamp(isoString: string): string {
  const secondsAgo = Math.floor(
    (Date.now() - new Date(isoString).getTime()) / 1000,
  );
  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
  return `${Math.floor(secondsAgo / 86400)}d ago`;
}

export default function WorkspaceSettingsSectionComponent() {
  const [agents, setAgents] = useState<WorkspaceAgent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [workspacePath, setWorkspacePath] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const fetchAgents = useCallback(async () => {
    setIsLoadingAgents(true);
    try {
      const response =
        (await ApiService.getWorkspaceAgents()) as WorkspaceAgentsResponse;
      setAgents(response?.agents || []);
    } catch {
      setAgents([]);
    } finally {
      setIsLoadingAgents(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const pollingTimer = setInterval(fetchAgents, POLLING_INTERVAL_MS);
    return () => clearInterval(pollingTimer);
  }, [fetchAgents]);

  const generatedCommand = [
    "node workspace-agent.mjs",
    "  --backend ws://YOUR_SERVER:5590",
    workspacePath
      ? `  --workspace ${workspacePath}`
      : "  --workspace /path/to/your/project",
    "  --secret YOUR_API_SECRET",
  ].join(" \\\n");

  const handleCopyCommand = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedCommand);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [generatedCommand]);

  const downloadUrl = ApiService.getWorkspaceAgentDownloadUrl();

  return (
    <div className={`workspace-settings-section-component ${styles["workspace-section-content"]}`}>
      {/* ── Explainer Banner ── */}
      <div className={styles["explainer-banner"]}>
        <div className={styles["explainer-icon-container"]}>
          <HardDrive size={20} strokeWidth={2} />
        </div>
        <div className={styles["explainer-text-container"]}>
          <span className={styles["explainer-headline"]}>
            Connect your local machine to Portal
          </span>
          <span className={styles["explainer-description"]}>
            The Workspace Agent is a single file that bridges your local
            project files to Portal&apos;s AI tools over WebSocket. Nothing is
            uploaded — all file access stays on your device. Works on Windows,
            macOS, and Linux. Requires Node.js 22+.
          </span>
        </div>
      </div>

      {/* ── Download + Run ── */}
      <div className={styles["setup-panel"]}>
        <div className={styles["setup-steps-container"]}>
          {/* Step 1: Download */}
          <div className={styles["setup-step-item"]}>
            <span className={styles["setup-step-number-badge"]}>1</span>
            <div className={styles["setup-step-content"]}>
              <span className={styles["setup-step-label"]}>
                Download the agent
              </span>
              <a
                className={styles["download-button"]}
                href={downloadUrl}
                download="workspace-agent.mjs"
              >
                <Download size={14} strokeWidth={2.5} />
                workspace-agent.mjs
              </a>
            </div>
          </div>

          {/* Step 2: Configure + Run */}
          <div className={styles["setup-step-item"]}>
            <span className={styles["setup-step-number-badge"]}>2</span>
            <div className={styles["setup-step-content"]}>
              <span className={styles["setup-step-label"]}>
                Run it from your terminal
              </span>

              <div className={styles["command-input-group"]}>
                <label
                  className={styles["command-input-label"]}
                  htmlFor="workspace-path-input"
                >
                  Your workspace path
                </label>
                <input
                  id="workspace-path-input"
                  type="text"
                  className={styles["command-text-input"]}
                  value={workspacePath}
                  onChange={(event) => setWorkspacePath(event.target.value)}
                  placeholder="/home/you/development"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className={styles["command-output-container"]}>
                <code className={styles["command-output-code-block"]}>
                  {generatedCommand}
                </code>
                <button
                  className={`${styles["command-copy-button"]} ${isCopied ? styles["is-copied-state"] : ""}`}
                  onClick={handleCopyCommand}
                  title="Copy command"
                >
                  {isCopied ? (
                    <Check size={14} strokeWidth={2.5} />
                  ) : (
                    <Copy size={14} strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Step 3: Verify */}
          <div className={styles["setup-step-item"]}>
            <span className={styles["setup-step-number-badge"]}>3</span>
            <div className={styles["setup-step-content"]}>
              <span className={styles["setup-step-label"]}>
                Your agent appears below once connected
              </span>
              <span className={styles["setup-step-hint"]}>
                Leave the terminal running — the agent reconnects automatically
                if interrupted.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Connected Agents ── */}
      <div className={styles["agents-panel"]}>
        <div className={styles["agents-header-layout-row"]}>
          <span className={styles["agents-title"]}>
            Connected Agents ({agents.length})
          </span>
          <button
            className={`${styles["agents-refresh-button"]} ${isLoadingAgents ? styles["is-spinning-state"] : ""}`}
            onClick={fetchAgents}
          >
            <RefreshCw size={11} strokeWidth={2.5} />
            Refresh
          </button>
        </div>

        {agents.length > 0 ? (
          <div className={styles["agents-list-container"]}>
            {agents.map((agent) => (
              <div key={agent.id} className={styles["agent-card"]}>
                <div className={styles["agent-status-indicator"]} />
                <div className={styles["agent-details-container"]}>
                  <span className={styles["agent-name-text"]}>
                    {agent.name}
                  </span>
                  <span className={styles["agent-metadata-text"]}>
                    {agent.roots.join(", ")}
                    {agent.clientIp ? ` · ${agent.clientIp}` : ""}
                    {` · v${agent.version}`}
                  </span>
                </div>
                <span className={styles["agent-connection-timestamp"]}>
                  Connected {formatRelativeTimestamp(agent.connectedAt)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles["agents-empty-state"]}>
            <div className={styles["agents-empty-icon-container"]}>
              <Terminal size={20} strokeWidth={2} />
            </div>
            <span className={styles["agents-empty-message-text"]}>
              No workspace agents connected.
              <br />
              Download the agent file above and run it to connect your first
              machine.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
