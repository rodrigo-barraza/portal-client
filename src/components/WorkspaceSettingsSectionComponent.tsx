"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Terminal,
  Box,
  MonitorSmartphone,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  HardDrive,
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
  const [expandedSetupCard, setExpandedSetupCard] = useState<string | null>(
    null,
  );
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

  const toggleSetupCard = useCallback(
    (cardId: string) => {
      setExpandedSetupCard((previous) =>
        previous === cardId ? null : cardId,
      );
    },
    [],
  );

  const generatedCommand = [
    "npx workspace-service",
    "--backend ws://YOUR_SERVER:5590",
    workspacePath
      ? `--workspace ${workspacePath}`
      : "--workspace /path/to/your/project",
    "--secret YOUR_API_SECRET",
  ].join(" \\\n  ");

  const handleCopyCommand = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedCommand);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [generatedCommand]);

  const deepLinkUrl = `vscode://rodrigo-barraza.workspace-remote/open?backend=ws://YOUR_SERVER:5590&workspace=${encodeURIComponent(workspacePath || "/path/to/your/project")}&label=My+Workspace`;

  return (
    <div className={styles["workspace-section-content"]}>
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
            The Workspace Agent bridges your local files to Portal&apos;s AI
            tools over WebSocket. Nothing is uploaded — all file access stays on
            your device. Install the agent on any machine (WSL, macOS, Linux,
            Docker) to let Portal read, search, and edit your project files
            directly.
          </span>
        </div>
      </div>

      {/* ── Connected Agents ── */}
      <div className={styles["agents-panel"]}>
        <div className={styles["agents-header-row"]}>
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
              <WifiOff size={20} strokeWidth={2} />
            </div>
            <span className={styles["agents-empty-message-text"]}>
              No workspace agents connected.
              <br />
              Follow the setup instructions below to connect your first machine.
            </span>
          </div>
        )}
      </div>

      {/* ── Setup Cards ── */}
      <div className={styles["setup-cards-panel"]}>
        <span className={styles["setup-cards-title"]}>Setup</span>

        <div className={styles["setup-cards-grid"]}>
          {/* Node.js Agent */}
          <div
            className={`${styles["setup-card-element"]} ${expandedSetupCard === "nodejs" ? styles["is-expanded-state"] : ""}`}
            onClick={() => toggleSetupCard("nodejs")}
          >
            <div className={styles["setup-card-header-row"]}>
              <div className={styles["setup-card-icon-container"]}>
                <Terminal size={16} strokeWidth={2} />
              </div>
              <span className={styles["setup-card-title-text"]}>Node.js</span>
              <ChevronDown
                size={13}
                strokeWidth={2}
                style={{
                  marginInlineStart: "auto",
                  color: "var(--text-muted)",
                  transform:
                    expandedSetupCard === "nodejs"
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </div>
            <span className={styles["setup-card-description-text"]}>
              Run directly with Node.js — fastest option for local development
              on WSL, macOS, or Linux.
            </span>

            <div className={styles["setup-card-expanded-content"]}>
              <div className={styles["setup-step-item"]}>
                <span className={styles["setup-step-number-badge"]}>1</span>
                <span className={styles["setup-step-text-content"]}>
                  Install Node.js 22+ from{" "}
                  <strong>nodejs.org</strong>
                </span>
              </div>
              <div className={styles["setup-step-item"]}>
                <span className={styles["setup-step-number-badge"]}>2</span>
                <span className={styles["setup-step-text-content"]}>
                  Clone the workspace-service repo:{" "}
                  <code>git clone</code> and <code>npm install</code>
                </span>
              </div>
              <div className={styles["setup-step-item"]}>
                <span className={styles["setup-step-number-badge"]}>3</span>
                <span className={styles["setup-step-text-content"]}>
                  Use the command generator below to build your launch command,
                  then paste it into your terminal.
                </span>
              </div>
            </div>
          </div>

          {/* Docker Agent */}
          <div
            className={`${styles["setup-card-element"]} ${expandedSetupCard === "docker" ? styles["is-expanded-state"] : ""}`}
            onClick={() => toggleSetupCard("docker")}
          >
            <div className={styles["setup-card-header-row"]}>
              <div className={styles["setup-card-icon-container"]}>
                <Box size={16} strokeWidth={2} />
              </div>
              <span className={styles["setup-card-title-text"]}>Docker</span>
              <ChevronDown
                size={13}
                strokeWidth={2}
                style={{
                  marginInlineStart: "auto",
                  color: "var(--text-muted)",
                  transform:
                    expandedSetupCard === "docker"
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </div>
            <span className={styles["setup-card-description-text"]}>
              Run as a Docker container — ideal for headless servers, Synology
              NAS, or always-on environments.
            </span>

            <div className={styles["setup-card-expanded-content"]}>
              <div className={styles["setup-step-item"]}>
                <span className={styles["setup-step-number-badge"]}>1</span>
                <span className={styles["setup-step-text-content"]}>
                  Install Docker Desktop or Docker Engine on your machine.
                </span>
              </div>
              <div className={styles["setup-step-item"]}>
                <span className={styles["setup-step-number-badge"]}>2</span>
                <span className={styles["setup-step-text-content"]}>
                  Create a <code>docker-compose.yml</code> with the
                  workspace-service image, mapping your project directory as a
                  volume.
                </span>
              </div>
              <div className={styles["setup-step-item"]}>
                <span className={styles["setup-step-number-badge"]}>3</span>
                <span className={styles["setup-step-text-content"]}>
                  Set <code>WORKSPACE_BACKEND</code>,{" "}
                  <code>WORKSPACE_ROOTS</code>, and{" "}
                  <code>WORKSPACE_SERVICE_SECRET</code> environment variables,
                  then run <code>docker compose up -d</code>.
                </span>
              </div>
            </div>
          </div>

          {/* VS Code Extension */}
          <div
            className={`${styles["setup-card-element"]} ${expandedSetupCard === "vscode" ? styles["is-expanded-state"] : ""}`}
            onClick={() => toggleSetupCard("vscode")}
          >
            <div className={styles["setup-card-header-row"]}>
              <div className={styles["setup-card-icon-container"]}>
                <MonitorSmartphone size={16} strokeWidth={2} />
              </div>
              <span className={styles["setup-card-title-text"]}>
                VS Code Extension
              </span>
              <ChevronDown
                size={13}
                strokeWidth={2}
                style={{
                  marginInlineStart: "auto",
                  color: "var(--text-muted)",
                  transform:
                    expandedSetupCard === "vscode"
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </div>
            <span className={styles["setup-card-description-text"]}>
              Browse and edit remote workspace files directly in VS Code or
              Antigravity — no agent install needed on the editor machine.
            </span>

            <div className={styles["setup-card-expanded-content"]}>
              <div className={styles["setup-step-item"]}>
                <span className={styles["setup-step-number-badge"]}>1</span>
                <span className={styles["setup-step-text-content"]}>
                  Build the extension: <code>cd vscode-extension && npm install && npm run package</code>
                </span>
              </div>
              <div className={styles["setup-step-item"]}>
                <span className={styles["setup-step-number-badge"]}>2</span>
                <span className={styles["setup-step-text-content"]}>
                  Install the <code>.vsix</code> file:{" "}
                  <code>code --install-extension workspace-remote-0.1.0.vsix</code>
                </span>
              </div>
              <div className={styles["setup-step-item"]}>
                <span className={styles["setup-step-number-badge"]}>3</span>
                <span className={styles["setup-step-text-content"]}>
                  Open the Command Palette (<code>Ctrl+Shift+P</code>) →{" "}
                  <strong>Workspace Remote: Connect</strong>, enter the backend
                  URL and secret, then pick your workspace.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Command Generator ── */}
      <div className={styles["command-generator-panel"]}>
        <span className={styles["command-generator-title"]}>
          Quick Connect
        </span>

        <div className={styles["command-generator-form"]}>
          <div className={styles["command-input-group"]}>
            <label
              className={styles["command-input-label"]}
              htmlFor="workspace-path-input"
            >
              Workspace Path
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

          {/* VS Code Deep Link */}
          <div className={styles["deep-link-row"]}>
            <a
              className={styles["deep-link-button"]}
              href={deepLinkUrl}
              title="Open in VS Code"
            >
              <ExternalLink size={13} strokeWidth={2.5} />
              Open in VS Code
            </a>
            <span className={styles["deep-link-hint-text"]}>
              Launches VS Code and auto-connects to this workspace (requires the
              extension)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
