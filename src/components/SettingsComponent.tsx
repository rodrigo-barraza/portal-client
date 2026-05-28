"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Palette,
  Bell,
  RefreshCw,
  LayoutGrid,
  Shield,
  Gauge,
  Trash2,
  Table2,
  HardDrive,
} from "lucide-react";
import {
  PageHeaderComponent,
  useTheme,
  SwitchComponent,
  SelectComponent,
  InputComponent,
  SegmentedControlComponent,
  ButtonComponent,
} from "@rodrigo-barraza/components-library";
import styles from "./SettingsComponent.module.css";
import WorkspaceSettingsSectionComponent from "./WorkspaceSettingsSectionComponent";

// ── Section Definitions ──────────────────────────────────────────
const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "monitoring", label: "Monitoring", icon: Gauge },
  { id: "workspaces", label: "Workspaces", icon: HardDrive },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "data", label: "Data & Privacy", icon: Shield },
];

// ── Accent Color Options ─────────────────────────────────────────
const ACCENT_COLORS = [
  { id: "indigo", value: "#6366f1" },
  { id: "violet", value: "#8b5cf6" },
  { id: "fuchsia", value: "#d946ef" },
  { id: "rose", value: "#f43f5e" },
  { id: "orange", value: "#f97316" },
  { id: "amber", value: "#f59e0b" },
  { id: "emerald", value: "#10b981" },
  { id: "cyan", value: "#06b6d4" },
  { id: "blue", value: "#3b82f6" },
];

// ── Default Settings ─────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  // Appearance
  accentColor: "indigo",
  fontScale: "default",
  sidebarCollapsed: false,
  animationsEnabled: true,
  reducedMotion: false,

  // Dashboard
  defaultView: "table",
  defaultPage: "/projects",
  cardDensity: "comfortable",
  showSystemSummary: true,
  showInfrastructure: true,

  // Monitoring
  healthCheckInterval: 30,
  autoRefreshEnabled: true,
  containerPollingInterval: 5,
  showResponseTimes: true,
  alertThresholdCpu: 80,
  alertThresholdMemory: 85,

  // Notifications
  browserNotifications: false,
  downAlerts: true,
  performanceAlerts: false,
  notificationSound: false,

  // Data
  telemetryEnabled: true,
  retainLogs: "30d",
};

const STORAGE_KEY = "portal:settings";

export default function SettingsComponent() {
  const { theme, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState("appearance");
  const [settings, setSettings] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
        : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Persist settings to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Silently ignore — localStorage quota exceeded
    }
  }, [settings]);

  const updateSetting = useCallback(
    (key: string, value: string | number | boolean) => {
      setSettings((prev: typeof DEFAULT_SETTINGS) => ({
        ...prev,
        [key]: value,
      }));
    },
    [],
  );

  const scrollToSection = useCallback((id: string) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const clearLocalData = useCallback(() => {
    // In a real impl this would clear caches, localStorage, etc.
    localStorage.removeItem(STORAGE_KEY);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <div className={styles.settings}>
      <PageHeaderComponent
        sticky={false}
        title="Settings"
        subtitle="Customize your portal experience"
      />

      <div className={styles.settingsBody}>
        {/* ── Sidebar ── */}
        <nav className={styles.sidebar}>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`${styles.sidebarLink} ${activeSection === id ? styles.isActiveState : ""}`}
              onClick={() => scrollToSection(id)}
            >
              <Icon size={15} strokeWidth={2} className={styles.sidebarIcon} />
              {label}
            </button>
          ))}
        </nav>

        {/* ── Sections ── */}
        <div className={styles.sectionsContainer}>
          {/* ═══ Appearance ═══ */}
          <section
            ref={(element) => {
              sectionRefs.current.appearance = element;
            }}
            className={styles.section}
            id="settings-appearance"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIconWrap}>
                <Palette size={17} strokeWidth={2} />
              </div>
              <div className={styles.sectionTitleGroup}>
                <h2 className={styles.sectionTitle}>Appearance</h2>
                <p className={styles.sectionDescription}>
                  Theme, colors, and visual preferences
                </p>
              </div>
            </div>
            <div className={styles.sectionBody}>
              {/* Theme */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Theme</span>
                  <span className={styles.settingHint}>
                    Switch between color schemes
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <SelectComponent
                    value={theme}
                    onChange={(selectedValue: string) => {
                      let current = theme;
                      const themes = ["dark", "light", "tropical", "oceanic"];
                      while (current !== selectedValue) {
                        toggleTheme();
                        const index = themes.indexOf(current);
                        current = themes[(index + 1) % themes.length];
                      }
                    }}
                    options={[
                      { value: "dark", label: "Dark" },
                      { value: "light", label: "Light" },
                      { value: "tropical", label: "Tropical" },
                      { value: "oceanic", label: "Oceanic" },
                    ]}
                  />
                </div>
              </div>

              {/* Accent Color */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Accent Color</span>
                  <span className={styles.settingHint}>
                    Primary highlight and interactive element color
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <div className={styles.colorSwatches}>
                    {ACCENT_COLORS.map((c) => (
                      <button
                        key={c.id}
                        className={`${styles.colorSwatch} ${settings.accentColor === c.id ? styles.isActiveState : ""}`}
                        style={
                          {
                            background: c.value,
                            "--swatch-color": c.value,
                          } as React.CSSProperties
                        }
                        onClick={() => updateSetting("accentColor", c.id)}
                        title={c.id}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Font Scale */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Font Scale</span>
                  <span className={styles.settingHint}>
                    Adjust interface text size
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <SegmentedControlComponent
                    value={settings.fontScale}
                    onChange={(value: string) => updateSetting("fontScale", value)}
                    segments={[
                      { value: "compact", label: "Compact" },
                      { value: "default", label: "Default" },
                      { value: "large", label: "Large" },
                    ]}
                  />
                </div>
              </div>

              {/* Animations */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Animations</span>
                  <span className={styles.settingHint}>
                    Enable micro-animations and transitions
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <SwitchComponent
                    checked={settings.animationsEnabled}
                    onChange={(checked: boolean) => updateSetting("animationsEnabled", checked)}
                  />
                </div>
              </div>

              {/* Reduced Motion */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Reduced Motion</span>
                  <span className={styles.settingHint}>
                    Respect prefers-reduced-motion accessibility setting
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <SwitchComponent
                    checked={settings.reducedMotion}
                    onChange={(checked: boolean) => updateSetting("reducedMotion", checked)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ═══ Dashboard ═══ */}
          <section
            ref={(element) => {
              sectionRefs.current.dashboard = element;
            }}
            className={styles.section}
            id="settings-dashboard"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIconWrap}>
                <LayoutGrid size={17} strokeWidth={2} />
              </div>
              <div className={styles.sectionTitleGroup}>
                <h2 className={styles.sectionTitle}>Dashboard</h2>
                <p className={styles.sectionDescription}>
                  Default views, layout, and page preferences
                </p>
              </div>
            </div>
            <div className={styles.sectionBody}>
              {/* Default View Mode */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Default View</span>
                  <span className={styles.settingHint}>
                    Initial view mode for the projects page
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <SegmentedControlComponent
                    value={settings.defaultView}
                    onChange={(value: string) => updateSetting("defaultView", value)}
                    segments={[
                      { value: "card", label: "Cards", icon: <LayoutGrid size={12} strokeWidth={2.2} /> },
                      { value: "table", label: "Table", icon: <Table2 size={12} strokeWidth={2.2} /> },
                    ]}
                  />
                </div>
              </div>

              {/* Landing Page */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Landing Page</span>
                  <span className={styles.settingHint}>
                    Page to show when opening the portal
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <SelectComponent
                    value={settings.defaultPage}
                    onChange={(value: string) => updateSetting("defaultPage", value)}
                    options={[
                      { value: "/projects", label: "Projects" },
                      { value: "/containers", label: "Containers" },
                      { value: "/devices", label: "Devices" },
                      { value: "/topology", label: "Topology" },
                      { value: "/logs", label: "Logs" },
                      { value: "/object-store", label: "Object Store" },
                    ]}
                  />
                </div>
              </div>

              {/* Card Density */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Card Density</span>
                  <span className={styles.settingHint}>
                    Spacing between card elements in grid views
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <SegmentedControlComponent
                    value={settings.cardDensity}
                    onChange={(value: string) => updateSetting("cardDensity", value)}
                    segments={[
                      { value: "compact", label: "Compact" },
                      { value: "comfortable", label: "Comfortable" },
                      { value: "spacious", label: "Spacious" },
                    ]}
                  />
                </div>
              </div>

              {/* Show System Summary */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>System Summary</span>
                  <span className={styles.settingHint}>
                    Show CPU, memory, and storage cards at the top of Projects
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <SwitchComponent
                    checked={settings.showSystemSummary}
                    onChange={(checked: boolean) => updateSetting("showSystemSummary", checked)}
                  />
                </div>
              </div>

              {/* Show Infrastructure */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>
                    Infrastructure Projects
                  </span>
                  <span className={styles.settingHint}>
                    Include databases and stores in project lists
                  </span>
                </div>
                <div className={styles.settingControl}>
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
            className={styles.section}
            id="settings-monitoring"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIconWrap}>
                <Gauge size={17} strokeWidth={2} />
              </div>
              <div className={styles.sectionTitleGroup}>
                <h2 className={styles.sectionTitle}>Monitoring</h2>
                <p className={styles.sectionDescription}>
                  Health check intervals, thresholds, and refresh behavior
                </p>
              </div>
            </div>
            <div className={styles.sectionBody}>
              {/* Auto-Refresh */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Auto-Refresh</span>
                  <span className={styles.settingHint}>
                    Periodically re-fetch project health status
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <SwitchComponent
                    checked={settings.autoRefreshEnabled}
                    onChange={(checked: boolean) => updateSetting("autoRefreshEnabled", checked)}
                  />
                </div>
              </div>

              {/* Health Check Interval */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>
                    Health Check Interval
                  </span>
                  <span className={styles.settingHint}>
                    How often to poll project health endpoints
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <div className={styles.unitGroup}>
                    <InputComponent
                      type="number"
                      value={settings.healthCheckInterval}
                      onChange={(event) =>
                        updateSetting(
                          "healthCheckInterval",
                          Math.max(5, Number((event.target as HTMLInputElement).value)),
                        )
                      }
                      min={5}
                      max={300}
                      size="sm"
                    />
                    <span className={styles.unitLabel}>sec</span>
                  </div>
                </div>
              </div>

              {/* Container Polling */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>
                    Container Stats Polling
                  </span>
                  <span className={styles.settingHint}>
                    Frequency of Docker container metrics updates
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <div className={styles.unitGroup}>
                    <InputComponent
                      type="number"
                      value={settings.containerPollingInterval}
                      onChange={(event) =>
                        updateSetting(
                          "containerPollingInterval",
                          Math.max(1, Number((event.target as HTMLInputElement).value)),
                        )
                      }
                      min={1}
                      max={60}
                      size="sm"
                    />
                    <span className={styles.unitLabel}>sec</span>
                  </div>
                </div>
              </div>

              {/* Show Response Times */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Response Times</span>
                  <span className={styles.settingHint}>
                    Display latency in project tables and cards
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <SwitchComponent
                    checked={settings.showResponseTimes}
                    onChange={(checked) => updateSetting("showResponseTimes", checked)}
                  />
                </div>
              </div>

              {/* CPU Alert Threshold */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>
                    CPU Alert Threshold
                  </span>
                  <span className={styles.settingHint}>
                    Highlight containers above this CPU percentage
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <div className={styles.unitGroup}>
                    <InputComponent
                      type="number"
                      value={settings.alertThresholdCpu}
                      onChange={(event) =>
                        updateSetting(
                          "alertThresholdCpu",
                          Math.max(10, Math.min(100, Number((event.target as HTMLInputElement).value))),
                        )
                      }
                      min={10}
                      max={100}
                      size="sm"
                    />
                    <span className={styles.unitLabel}>%</span>
                  </div>
                </div>
              </div>

              {/* Memory Alert Threshold */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>
                    Memory Alert Threshold
                  </span>
                  <span className={styles.settingHint}>
                    Highlight containers above this memory percentage
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <div className={styles.unitGroup}>
                    <InputComponent
                      type="number"
                      value={settings.alertThresholdMemory}
                      onChange={(event) =>
                        updateSetting(
                          "alertThresholdMemory",
                          Math.max(10, Math.min(100, Number((event.target as HTMLInputElement).value))),
                        )
                      }
                      min={10}
                      max={100}
                      size="sm"
                    />
                    <span className={styles.unitLabel}>%</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══ Workspaces ═══ */}
          <section
            ref={(element) => {
              sectionRefs.current.workspaces = element;
            }}
            className={styles.section}
            id="settings-workspaces"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIconWrap}>
                <HardDrive size={17} strokeWidth={2} />
              </div>
              <div className={styles.sectionTitleGroup}>
                <h2 className={styles.sectionTitle}>Workspaces</h2>
                <p className={styles.sectionDescription}>
                  Connect local machines and manage workspace agents
                </p>
              </div>
            </div>
            <div className={styles.sectionBody}>
              <WorkspaceSettingsSectionComponent />
            </div>
          </section>

          {/* ═══ Notifications ═══ */}
          <section
            ref={(element) => {
              sectionRefs.current.notifications = element;
            }}
            className={styles.section}
            id="settings-notifications"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIconWrap}>
                <Bell size={17} strokeWidth={2} />
              </div>
              <div className={styles.sectionTitleGroup}>
                <h2 className={styles.sectionTitle}>Notifications</h2>
                <p className={styles.sectionDescription}>
                  Alert preferences and notification channels
                </p>
              </div>
            </div>
            <div className={styles.sectionBody}>
              {/* Browser Notifications */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>
                    Browser Notifications
                  </span>
                  <span className={styles.settingHint}>
                    Enable native browser push notifications
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <SwitchComponent
                    checked={settings.browserNotifications}
                    onChange={(checked) => updateSetting("browserNotifications", checked)}
                  />
                </div>
              </div>

              {/* Down Alerts */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Down Alerts</span>
                  <span className={styles.settingHint}>
                    Get notified when a project goes offline
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <SwitchComponent
                    checked={settings.downAlerts}
                    onChange={(checked) => updateSetting("downAlerts", checked)}
                  />
                </div>
              </div>

              {/* Performance Alerts */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>
                    Performance Alerts
                  </span>
                  <span className={styles.settingHint}>
                    Notify when CPU or memory exceeds thresholds
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <SwitchComponent
                    checked={settings.performanceAlerts}
                    onChange={(checked) => updateSetting("performanceAlerts", checked)}
                  />
                </div>
              </div>

              {/* Notification Sound */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Sound</span>
                  <span className={styles.settingHint}>
                    Play a sound effect when alerts are triggered
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <SwitchComponent
                    checked={settings.notificationSound}
                    onChange={(checked) => updateSetting("notificationSound", checked)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ═══ Data & Privacy ═══ */}
          <section
            ref={(element) => {
              sectionRefs.current.data = element;
            }}
            className={`${styles.section} ${styles.dangerSection}`}
            id="settings-data"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIconWrap}>
                <Shield size={17} strokeWidth={2} />
              </div>
              <div className={styles.sectionTitleGroup}>
                <h2 className={styles.sectionTitle}>Data & Privacy</h2>
                <p className={styles.sectionDescription}>
                  Telemetry, log retention, and data management
                </p>
              </div>
            </div>
            <div className={styles.sectionBody}>
              {/* Telemetry */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Usage Telemetry</span>
                  <span className={styles.settingHint}>
                    Send anonymized usage data to improve the portal
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <SwitchComponent
                    checked={settings.telemetryEnabled}
                    onChange={(checked) => updateSetting("telemetryEnabled", checked)}
                  />
                </div>
              </div>

              {/* Log Retention */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Log Retention</span>
                  <span className={styles.settingHint}>
                    How long to keep request logs before auto-pruning
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <SelectComponent
                    value={settings.retainLogs}
                    onChange={(value) => updateSetting("retainLogs", value)}
                    options={[
                      { value: "7d", label: "7 days" },
                      { value: "14d", label: "14 days" },
                      { value: "30d", label: "30 days" },
                      { value: "90d", label: "90 days" },
                      { value: "forever", label: "Forever" },
                    ]}
                  />
                </div>
              </div>

              {/* Reset Settings */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>
                    Reset All Settings
                  </span>
                  <span className={styles.settingHint}>
                    Restore every setting to its default value
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <ButtonComponent
                    variant="outlined"
                    size="small"
                    icon={RefreshCw}
                    onClick={resetSettings}
                    className={styles.dangerButton}
                  >
                    Reset
                  </ButtonComponent>
                </div>
              </div>

              {/* Clear Local Data */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Clear Local Data</span>
                  <span className={styles.settingHint}>
                    Wipe cached data and preferences from this browser
                  </span>
                </div>
                <div className={styles.settingControl}>
                  <ButtonComponent
                    variant="outlined"
                    size="small"
                    icon={Trash2}
                    onClick={clearLocalData}
                    className={styles.dangerButton}
                  >
                    Clear
                  </ButtonComponent>
                </div>
              </div>
            </div>
          </section>

          {/* ── Footer ── */}
          <div className={styles.footer}>
            <span className={styles.footerVersion}>Portal v1.0.0</span>
            <div className={styles.footerLinks}>
              <span className={styles.footerLink}>
                Keyboard shortcuts
                <span className={styles.kbdGroup} style={{ marginLeft: 6 }}>
                  <kbd className={styles.kbd}>⌘</kbd>
                  <kbd className={styles.kbd}>K</kbd>
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
