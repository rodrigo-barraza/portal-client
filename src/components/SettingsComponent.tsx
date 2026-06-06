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


// ── Section Definitions ──────────────────────────────────────────
const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "monitoring", label: "Monitoring", icon: Gauge },

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
  const { theme, setTheme } = useTheme();
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
      setSettings((previousSettings: typeof DEFAULT_SETTINGS) => ({
        ...previousSettings,
        [key]: value,
      }));
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

      <div className={styles['settings-body']}>
        {/* ── Sidebar ── */}
        <nav className={styles.sidebar}>
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
            className={styles.section}
            id="settings-appearance"
          >
            <div className={styles['section-header']}>
              <div className={styles['section-icon-wrap']}>
                <Palette size={17} strokeWidth={2} />
              </div>
              <div className={styles['section-title-group']}>
                <h2 className={styles['section-title']}>Appearance</h2>
                <p className={styles['section-description']}>
                  Theme, colors, and visual preferences
                </p>
              </div>
            </div>
            <div className={styles['section-body']}>
              {/* Theme */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>Theme</span>
                  <span className={styles['setting-hint']}>
                    Switch between color schemes
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <SelectComponent
                    value={theme}
                    onChange={(selectedValue: string) => {
                      setTheme(selectedValue);
                    }}
                    options={[
                      { value: "dark", label: "Dark" },
                      { value: "light", label: "Daylight" },
                      { value: "twilight", label: "Twilight" },
                      { value: "muted", label: "Overcast" },
                      { value: "tropical", label: "Tropical" },
                      { value: "oceanic", label: "Oceanic" },
                      { value: "punk", label: "Punk" },
                      { value: "ember", label: "Ember" },
                      { value: "arctic", label: "Arctic" },
                      { value: "forest", label: "Forest" },
                      { value: "mono", label: "Mono" },
                    ]}
                  />
                </div>
              </div>

              {/* Accent Color */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>Accent Color</span>
                  <span className={styles['setting-hint']}>
                    Primary highlight and interactive element color
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <div className={styles['color-swatches']}>
                    {ACCENT_COLORS.map((accentColor) => (
                      <button
                        key={accentColor.id}
                        className={`${styles['color-swatch']} ${settings.accentColor === accentColor.id ? styles['is-active-state'] : ""}`}
                        style={
                          {
                            background: accentColor.value,
                            "--swatch-color": accentColor.value,
                          } as React.CSSProperties
                        }
                        onClick={() => updateSetting("accentColor", accentColor.id)}
                        title={accentColor.id}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Font Scale */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>Font Scale</span>
                  <span className={styles['setting-hint']}>
                    Adjust interface text size
                  </span>
                </div>
                <div className={styles['setting-control']}>
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
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>Animations</span>
                  <span className={styles['setting-hint']}>
                    Enable micro-animations and transitions
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <SwitchComponent
                    checked={settings.animationsEnabled}
                    onChange={(checked: boolean) => updateSetting("animationsEnabled", checked)}
                  />
                </div>
              </div>

              {/* Reduced Motion */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>Reduced Motion</span>
                  <span className={styles['setting-hint']}>
                    Respect prefers-reduced-motion accessibility setting
                  </span>
                </div>
                <div className={styles['setting-control']}>
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
                    onChange={(value: string) => updateSetting("defaultView", value)}
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
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>Card Density</span>
                  <span className={styles['setting-hint']}>
                    Spacing between card elements in grid views
                  </span>
                </div>
                <div className={styles['setting-control']}>
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
            className={styles.section}
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
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        updateSetting(
                          "healthCheckInterval",
                          Math.max(5, Number((event.target as HTMLInputElement).value)),
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
                          Math.max(1, Number((event.target as HTMLInputElement).value)),
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
                          Math.max(10, Math.min(100, Number((event.target as HTMLInputElement).value))),
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
                          Math.max(10, Math.min(100, Number((event.target as HTMLInputElement).value))),
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



          {/* ═══ Notifications ═══ */}
          <section
            ref={(element) => {
              sectionRefs.current.notifications = element;
            }}
            className={styles.section}
            id="settings-notifications"
          >
            <div className={styles['section-header']}>
              <div className={styles['section-icon-wrap']}>
                <Bell size={17} strokeWidth={2} />
              </div>
              <div className={styles['section-title-group']}>
                <h2 className={styles['section-title']}>Notifications</h2>
                <p className={styles['section-description']}>
                  Alert preferences and notification channels
                </p>
              </div>
            </div>
            <div className={styles['section-body']}>
              {/* Browser Notifications */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>
                    Browser Notifications
                  </span>
                  <span className={styles['setting-hint']}>
                    Enable native browser push notifications
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <SwitchComponent
                    checked={settings.browserNotifications}
                    onChange={(checked: boolean) => updateSetting("browserNotifications", checked)}
                  />
                </div>
              </div>

              {/* Down Alerts */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>Down Alerts</span>
                  <span className={styles['setting-hint']}>
                    Get notified when a project goes offline
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <SwitchComponent
                    checked={settings.downAlerts}
                    onChange={(checked: boolean) => updateSetting("downAlerts", checked)}
                  />
                </div>
              </div>

              {/* Performance Alerts */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>
                    Performance Alerts
                  </span>
                  <span className={styles['setting-hint']}>
                    Notify when CPU or memory exceeds thresholds
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <SwitchComponent
                    checked={settings.performanceAlerts}
                    onChange={(checked: boolean) => updateSetting("performanceAlerts", checked)}
                  />
                </div>
              </div>

              {/* Notification Sound */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>Sound</span>
                  <span className={styles['setting-hint']}>
                    Play a sound effect when alerts are triggered
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <SwitchComponent
                    checked={settings.notificationSound}
                    onChange={(checked: boolean) => updateSetting("notificationSound", checked)}
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
            className={`${styles.section} ${styles['danger-section']}`}
            id="settings-data"
          >
            <div className={styles['section-header']}>
              <div className={styles['section-icon-wrap']}>
                <Shield size={17} strokeWidth={2} />
              </div>
              <div className={styles['section-title-group']}>
                <h2 className={styles['section-title']}>Data & Privacy</h2>
                <p className={styles['section-description']}>
                  Telemetry, log retention, and data management
                </p>
              </div>
            </div>
            <div className={styles['section-body']}>
              {/* Telemetry */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>Usage Telemetry</span>
                  <span className={styles['setting-hint']}>
                    Send anonymized usage data to improve the portal
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <SwitchComponent
                    checked={settings.telemetryEnabled}
                    onChange={(checked: boolean) => updateSetting("telemetryEnabled", checked)}
                  />
                </div>
              </div>

              {/* Log Retention */}
              <div className={styles['setting-row']}>
                <div className={styles['setting-info']}>
                  <span className={styles['setting-label']}>Log Retention</span>
                  <span className={styles['setting-hint']}>
                    How long to keep request logs before auto-pruning
                  </span>
                </div>
                <div className={styles['setting-control']}>
                  <SelectComponent
                    value={settings.retainLogs}
                    onChange={(value: string) => updateSetting("retainLogs", value)}
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
                    onClick={resetSettings}
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
                    onClick={clearLocalData}
                    className={styles['danger-button']}
                  >
                    Clear
                  </ButtonComponent>
                </div>
              </div>
            </div>
          </section>

          {/* ── Footer ── */}
          <div className={styles.footer}>
            <span className={styles['footer-version']}>Portal v1.0.0</span>
            <div className={styles['footer-links']}>
              <span className={styles['footer-link']}>
                Keyboard shortcuts
                <span className={styles['kbd-group']} style={{ marginLeft: 6 }}>
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
