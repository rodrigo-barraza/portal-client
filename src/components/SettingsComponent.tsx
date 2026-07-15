"use client";

import { useState, useRef, useCallback } from "react";
import {
  Palette,
  RefreshCw,
  LayoutGrid,
  Shield,
  Gauge,
  Trash2,
  Table2,
  Check,
} from "lucide-react";
import * as Icons from "lucide-react";
import {
  PageHeaderComponent,
  useTheme,
  SwitchComponent,
  SelectComponent,
  InputComponent,
  SegmentedControlComponent,
  ButtonComponent,
  DialogComponent,
  THEME_CATALOG,
  getReadableTextColor,
  type ThemeCatalogEntry,
} from "@rodrigo-barraza/components-library";
import {
  usePortalSettings,
  updateSettings,
  resetSettings,
  LANDING_PAGES,
  type PortalSettings,
} from "@/lib/settings";
import styles from "./SettingsComponent.module.css";

// ── Section Definitions ──────────────────────────────────────────
const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "monitoring", label: "Monitoring", icon: Gauge },
  { id: "data", label: "Data & Privacy", icon: Shield },
];

const DEFAULT_THEME = "twilight";

// Fallback metadata for themes missing from THEME_CATALOG (e.g. custom themes)
const FALLBACK_THEME_META: ThemeCatalogEntry = {
  label: "Theme",
  icon: "Palette",
  backgroundBase: "#222",
  backgroundSurface: "#333",
  backgroundElevated: "#444",
  primary: "#888",
  secondary: "#aaa",
  tertiary: "#666",
  textPrimary: "#eee",
  textSecondary: "#aaa",
  textMuted: "#666",
  borderColor: "#888",
  success: "#10b981",
  danger: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

type LucideIconComponent = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

function themeIcon(name: string): LucideIconComponent {
  return (
    (Icons as unknown as Record<string, LucideIconComponent>)[name] || Palette
  );
}

export default function SettingsComponent() {
  const { theme, themes, setTheme } = useTheme();
  const settings = usePortalSettings();
  const [activeSection, setActiveSection] = useState("appearance");
  const [confirmAction, setConfirmAction] = useState<"reset" | "clear" | null>(
    null,
  );

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const updateSetting = useCallback(
    <K extends keyof PortalSettings>(key: K, value: PortalSettings[K]) => {
      updateSettings({ [key]: value });
    },
    [],
  );

  const scrollToSection = useCallback((sectionIdentifier: string) => {
    setActiveSection(sectionIdentifier);
    sectionRefs.current[sectionIdentifier]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const handleResetSettings = useCallback(() => {
    resetSettings();
    setConfirmAction(null);
  }, []);

  const handleClearLocalData = useCallback(() => {
    try {
      const portalKeys: string[] = [];
      for (let index = 0; index < window.localStorage.length; index++) {
        const key = window.localStorage.key(index);
        if (key && key.startsWith("portal:")) portalKeys.push(key);
      }
      portalKeys.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // localStorage unavailable — nothing to clear
    }
    resetSettings();
    setTheme(DEFAULT_THEME);
    setConfirmAction(null);
  }, [setTheme]);

  return (
    <div className={`settings-component ${styles['settings']}`}>
      <PageHeaderComponent
        sticky={false}
        title="Settings"
        subtitle="Customize your portal experience"
      />

      <div className={styles['settings-body']}>
        {/* ── Sidebar ── */}
        <nav className={styles['sidebar']}>
          {SECTIONS.map(({ id: sectionIdentifier, label, icon: Icon }) => (
            <button
              key={sectionIdentifier}
              className={`${styles['sidebar-link']} ${activeSection === sectionIdentifier ? styles['is-active-state'] : ""}`}
              onClick={() => scrollToSection(sectionIdentifier)}
            >
              <Icon size={15} strokeWidth={2} className={styles['sidebar-icon']} />
              {label}
            </button>
          ))}
        </nav>

        {/* ── Sections ── */}
        <div className={styles['sections-container']}>
          {/* ═══ Appearance ═══ */}
          <section
            ref={(element) => {
              sectionRefs.current.appearance = element;
            }}
            className={styles['section']}
            id="settings-appearance"
          >
            <div className={styles['section-header']}>
              <div className={styles['section-icon-wrap']}>
                <Palette size={17} strokeWidth={2} />
              </div>
              <div className={styles['section-title-group']}>
                <h2 className={styles['section-title']}>Appearance</h2>
                <p className={styles['section-description']}>
                  Pick a theme — each theme defines its own colors, accents,
                  and contrast
                </p>
              </div>
            </div>
            <div className={styles['section-body']}>
              <div className={styles['theme-grid']}>
                {themes.map((themeName) => {
                  const meta = THEME_CATALOG[themeName] || FALLBACK_THEME_META;
                  const ThemeIcon = themeIcon(meta.icon);
                  const isActive = themeName === theme;

                  return (
                    <button
                      key={themeName}
                      className={`${styles['theme-tile']} ${isActive ? styles['is-active-state'] : ""}`}
                      onClick={() => setTheme(themeName)}
                      title={`Switch to ${meta.label} theme`}
                      type="button"
                      style={{ "--tile-accent": meta.primary } as React.CSSProperties}
                    >
                      <span
                        className={styles['theme-preview']}
                        style={{
                          background: meta.backgroundBase,
                          borderColor: isActive
                            ? meta.primary
                            : meta.borderColor,
                        }}
                      >
                        <span
                          className={styles['theme-preview-header']}
                          style={{ background: meta.backgroundSurface }}
                        >
                          <span
                            className={styles['theme-preview-dot']}
                            style={{ background: meta.primary }}
                          />
                          <span
                            className={styles['theme-preview-line']}
                            style={{ background: meta.textMuted, width: 22 }}
                          />
                        </span>
                        <span className={styles['theme-preview-body']}>
                          <span
                            className={styles['theme-preview-line']}
                            style={{ background: meta.textPrimary, width: 34 }}
                          />
                          <span
                            className={styles['theme-preview-line']}
                            style={{ background: meta.textMuted, width: 26 }}
                          />
                          <span className={styles['theme-preview-accents']}>
                            <span style={{ background: meta.primary }} />
                            <span style={{ background: meta.secondary }} />
                            <span style={{ background: meta.tertiary }} />
                          </span>
                        </span>
                        {isActive && (
                          <span
                            className={styles['theme-active-badge']}
                            style={{
                              background: meta.primary,
                              color: getReadableTextColor(meta.primary),
                            }}
                          >
                            <Check size={9} strokeWidth={3.5} />
                          </span>
                        )}
                      </span>
                      <span className={styles['theme-tile-meta']}>
                        <ThemeIcon
                          size={13}
                          strokeWidth={1.8}
                          className={styles['theme-tile-icon']}
                        />
                        <span className={styles['theme-tile-label']}>
                          {meta.label}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ═══ Dashboard ═══ */}
          <section
            ref={(element) => {
              sectionRefs.current.dashboard = element;
            }}
            className={styles['section']}
            id="settings-dashboard"
          >
            <div className={styles['section-header']}>
              <div className={styles['section-icon-wrap']}>
                <LayoutGrid size={17} strokeWidth={2} />
              </div>
              <div className={styles['section-title-group']}>
                <h2 className={styles['section-title']}>Dashboard</h2>
                <p className={styles['section-description']}>
                  Default views, layout, and page preferences
                </p>
              </div>
            </div>
            <div className={styles['section-body']}>
              {/* Default View Mode */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>Default View</span>
                  <span className={styles['setting-hint']}>
                    Initial view mode for the projects page
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <SegmentedControlComponent
                    value={settings.defaultView}
                    onChange={(value: string) =>
                      updateSetting("defaultView", value as "card" | "table")
                    }
                    segments={[
                      { value: "card", label: "Cards", icon: <LayoutGrid size={12} strokeWidth={2.2} /> },
                      { value: "table", label: "Table", icon: <Table2 size={12} strokeWidth={2.2} /> },
                    ]}
                  />
                </div>
              </div>

              {/* Landing Page */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>Landing Page</span>
                  <span className={styles['setting-hint']}>
                    Page to show when opening the portal
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <SelectComponent
                    value={settings.defaultPage}
                    onChange={(value: string) => updateSetting("defaultPage", value)}
                    options={LANDING_PAGES.map((page) => ({ ...page }))}
                  />
                </div>
              </div>

              {/* Show System Summary */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>System Summary</span>
                  <span className={styles['setting-hint']}>
                    Show CPU, memory, and storage cards at the top of Projects
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <SwitchComponent
                    checked={settings.showSystemSummary}
                    onChange={(checked: boolean) => updateSetting("showSystemSummary", checked)}
                  />
                </div>
              </div>

              {/* Show Infrastructure */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>
                    Infrastructure Projects
                  </span>
                  <span className={styles['setting-hint']}>
                    Include databases and stores in project lists
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <SwitchComponent
                    checked={settings.showInfrastructure}
                    onChange={(checked: boolean) => updateSetting("showInfrastructure", checked)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ═══ Monitoring ═══ */}
          <section
            ref={(element) => {
              sectionRefs.current.monitoring = element;
            }}
            className={styles['section']}
            id="settings-monitoring"
          >
            <div className={styles['section-header']}>
              <div className={styles['section-icon-wrap']}>
                <Gauge size={17} strokeWidth={2} />
              </div>
              <div className={styles['section-title-group']}>
                <h2 className={styles['section-title']}>Monitoring</h2>
                <p className={styles['section-description']}>
                  Health check intervals, thresholds, and refresh behavior
                </p>
              </div>
            </div>
            <div className={styles['section-body']}>
              {/* Auto-Refresh */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>Auto-Refresh</span>
                  <span className={styles['setting-hint']}>
                    Periodically re-fetch project health status
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <SwitchComponent
                    checked={settings.autoRefreshEnabled}
                    onChange={(checked: boolean) => updateSetting("autoRefreshEnabled", checked)}
                  />
                </div>
              </div>

              {/* Health Check Interval */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>
                    Health Check Interval
                  </span>
                  <span className={styles['setting-hint']}>
                    How often to poll project health endpoints
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <div className={styles['unit-group']}>
                    <InputComponent
                      type="number"
                      value={settings.healthCheckInterval}
                      disabled={!settings.autoRefreshEnabled}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        updateSetting(
                          "healthCheckInterval",
                          Math.max(5, Number(event.target.value)),
                        )
                      }
                      min={5}
                      max={300}
                      size="sm"
                    />
                    <span className={styles['unit-label']}>sec</span>
                  </div>
                </div>
              </div>

              {/* Container Polling */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>
                    Container Stats Polling
                  </span>
                  <span className={styles['setting-hint']}>
                    Frequency of Docker container metrics updates
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <div className={styles['unit-group']}>
                    <InputComponent
                      type="number"
                      value={settings.containerPollingInterval}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        updateSetting(
                          "containerPollingInterval",
                          Math.max(1, Number(event.target.value)),
                        )
                      }
                      min={1}
                      max={60}
                      size="sm"
                    />
                    <span className={styles['unit-label']}>sec</span>
                  </div>
                </div>
              </div>

              {/* Show Response Times */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>Response Times</span>
                  <span className={styles['setting-hint']}>
                    Display latency in project tables and cards
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <SwitchComponent
                    checked={settings.showResponseTimes}
                    onChange={(checked: boolean) => updateSetting("showResponseTimes", checked)}
                  />
                </div>
              </div>

              {/* CPU Alert Threshold */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>
                    CPU Alert Threshold
                  </span>
                  <span className={styles['setting-hint']}>
                    Highlight containers above this CPU percentage
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <div className={styles['unit-group']}>
                    <InputComponent
                      type="number"
                      value={settings.alertThresholdCpu}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        updateSetting(
                          "alertThresholdCpu",
                          Math.max(10, Math.min(100, Number(event.target.value))),
                        )
                      }
                      min={10}
                      max={100}
                      size="sm"
                    />
                    <span className={styles['unit-label']}>%</span>
                  </div>
                </div>
              </div>

              {/* Memory Alert Threshold */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>
                    Memory Alert Threshold
                  </span>
                  <span className={styles['setting-hint']}>
                    Highlight containers above this memory percentage
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <div className={styles['unit-group']}>
                    <InputComponent
                      type="number"
                      value={settings.alertThresholdMemory}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        updateSetting(
                          "alertThresholdMemory",
                          Math.max(10, Math.min(100, Number(event.target.value))),
                        )
                      }
                      min={10}
                      max={100}
                      size="sm"
                    />
                    <span className={styles['unit-label']}>%</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══ Data & Privacy ═══ */}
          <section
            ref={(element) => {
              sectionRefs.current.data = element;
            }}
            className={`${styles['section']} ${styles['danger-section']}`}
            id="settings-data"
          >
            <div className={styles['section-header']}>
              <div className={styles['section-icon-wrap']}>
                <Shield size={17} strokeWidth={2} />
              </div>
              <div className={styles['section-title-group']}>
                <h2 className={styles['section-title']}>Data & Privacy</h2>
                <p className={styles['section-description']}>
                  Session tracking and local data management
                </p>
              </div>
            </div>
            <div className={styles['section-body']}>
              {/* Telemetry */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>Session Tracking</span>
                  <span className={styles['setting-hint']}>
                    Record page navigation for the session explorer
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <SwitchComponent
                    checked={settings.telemetryEnabled}
                    onChange={(checked: boolean) => updateSetting("telemetryEnabled", checked)}
                  />
                </div>
              </div>

              {/* Reset Settings */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>
                    Reset All Settings
                  </span>
                  <span className={styles['setting-hint']}>
                    Restore every setting to its default value
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <ButtonComponent
                    variant="outlined"
                    size="small"
                    icon={RefreshCw}
                    onClick={() => setConfirmAction("reset")}
                    className={styles['danger-button']}
                  >
                    Reset
                  </ButtonComponent>
                </div>
              </div>

              {/* Clear Local Data */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>Clear Local Data</span>
                  <span className={styles['setting-hint']}>
                    Wipe cached data and preferences from this browser
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <ButtonComponent
                    variant="outlined"
                    size="small"
                    icon={Trash2}
                    onClick={() => setConfirmAction("clear")}
                    className={styles['danger-button']}
                  >
                    Clear
                  </ButtonComponent>
                </div>
              </div>
            </div>
          </section>

          {/* ── Footer ── */}
          <div className={styles['footer']}>
            <span className={styles['footer-version']}>Portal v0.1.0</span>
          </div>
        </div>
      </div>

      {/* ── Destructive-action confirmation ── */}
      <DialogComponent
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        icon={confirmAction === "clear" ? <Trash2 size={22} /> : <RefreshCw size={22} />}
        headline={
          confirmAction === "clear" ? "Clear local data?" : "Reset all settings?"
        }
        onConfirm={
          confirmAction === "clear" ? handleClearLocalData : handleResetSettings
        }
        confirmLabel={confirmAction === "clear" ? "Clear data" : "Reset"}
        confirmVariant="destructive"
      >
        {confirmAction === "clear"
          ? "This wipes every portal preference stored in this browser — settings, theme, and cached table layouts — and restores the defaults."
          : "Every setting returns to its default value. Your theme choice is kept."}
      </DialogComponent>
    </div>
  );
}
