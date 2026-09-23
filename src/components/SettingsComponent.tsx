"use client";

import { useRef, useState } from "react";
import {
  Gauge,
  LayoutGrid,
  Palette,
  RefreshCw,
  Shield,
  Table2,
  Trash2,
} from "lucide-react";
import {
  ButtonComponent,
  DialogComponent,
  PageHeaderComponent,
  SegmentedControlComponent,
  SelectComponent,
  SwitchComponent,
  useTheme,
} from "@rodrigo-barraza/components-library";
import {
  LANDING_PAGES,
  resetSettings,
  updateSettings,
  usePortalSettings,
  type PortalSettings,
} from "@/lib/settings";
import { clearPreferenceStorage } from "@/lib/storageKeys";
import NumberSettingInput from "./settings/NumberSettingInput";
import ThemeGridComponent from "./settings/ThemeGridComponent";
import { SettingRow, SettingsSection } from "./settings/SettingsLayoutParts";
import { useActiveSection } from "./settings/useActiveSection";
import styles from "./SettingsComponent.module.css";

// ── Section Definitions ──────────────────────────────────────────
const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "monitoring", label: "Monitoring", icon: Gauge },
  { id: "data", label: "Data & Privacy", icon: Shield },
] as const;

const DEFAULT_THEME = "twilight";

const VIEW_SEGMENTS = [
  {
    value: "card",
    label: "Cards",
    icon: <LayoutGrid size={12} strokeWidth={2.2} />,
  },
  {
    value: "table",
    label: "Table",
    icon: <Table2 size={12} strokeWidth={2.2} />,
  },
];

const LANDING_PAGE_OPTIONS = LANDING_PAGES.map((page) => ({ ...page }));

type ConfirmAction = "reset" | "clear";

const CONFIRM_DIALOGS: Record<
  ConfirmAction,
  { headline: string; label: string; body: string; icon: typeof Trash2 }
> = {
  reset: {
    headline: "Reset all settings?",
    label: "Reset",
    body: "Every setting returns to its default value. Your theme choice is kept.",
    icon: RefreshCw,
  },
  clear: {
    headline: "Clear local data?",
    label: "Clear data",
    body: "This wipes every portal preference stored in this browser — settings, theme, sidebar state, and saved table layouts — and restores the defaults.",
    icon: Trash2,
  },
};

function toggle<K extends keyof PortalSettings>(key: K) {
  return (checked: boolean) =>
    updateSettings({ [key]: checked } as Partial<PortalSettings>);
}

export default function SettingsComponent() {
  const { setTheme } = useTheme();
  const settings = usePortalSettings();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const sectionsRef = useRef<HTMLDivElement>(null);
  const { activeSection, scrollToSection } = useActiveSection(
    sectionsRef,
    SECTIONS[0].id,
  );

  const handleConfirm = () => {
    if (confirmAction === "clear") {
      clearPreferenceStorage();
      setTheme(DEFAULT_THEME);
    }
    resetSettings();
    setConfirmAction(null);
  };

  const dialog = confirmAction ? CONFIRM_DIALOGS[confirmAction] : null;
  const DialogIcon = dialog?.icon ?? RefreshCw;

  return (
    <div className={`settings-component ${styles["settings"]}`}>
      <PageHeaderComponent
        sticky={false}
        title="Settings"
        subtitle="Customize your portal experience"
      />

      <div className={styles["settings-body"]}>
        {/* ── Section nav ── */}
        <nav className={styles["sidebar"]} aria-label="Settings sections">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                className={`${styles["sidebar-link"]}${isActive ? ` ${styles["is-active-state"]}` : ""}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => scrollToSection(id)}
              >
                <Icon
                  size={15}
                  strokeWidth={2}
                  className={styles["sidebar-icon"]}
                />
                {label}
              </button>
            );
          })}
        </nav>

        {/* ── Sections ── */}
        <div ref={sectionsRef} className={styles["sections-container"]}>
          <SettingsSection
            id="appearance"
            icon={Palette}
            title="Appearance"
            description="Pick a theme — each theme defines its own colors, accents, and contrast"
          >
            <ThemeGridComponent />
          </SettingsSection>

          <SettingsSection
            id="dashboard"
            icon={LayoutGrid}
            title="Dashboard"
            description="Default views, layout, and page preferences"
          >
            <SettingRow
              label="Default View"
              hint="Initial view mode for the projects page"
            >
              <SegmentedControlComponent
                value={settings.defaultView}
                onChange={(value) =>
                  updateSettings({
                    defaultView: value as PortalSettings["defaultView"],
                  })
                }
                segments={VIEW_SEGMENTS}
              />
            </SettingRow>

            <SettingRow
              label="Landing Page"
              hint="Page to show when opening the portal"
            >
              <SelectComponent
                value={settings.defaultPage}
                onChange={(value) =>
                  updateSettings({ defaultPage: String(value) })
                }
                options={LANDING_PAGE_OPTIONS}
              />
            </SettingRow>

            <SettingRow
              label="System Summary"
              hint="Show CPU, memory, and storage cards at the top of Projects"
            >
              <SwitchComponent
                ariaLabel="System Summary"
                checked={settings.showSystemSummary}
                onChange={toggle("showSystemSummary")}
              />
            </SettingRow>

            <SettingRow
              label="Infrastructure Projects"
              hint="Include databases and stores in project lists"
            >
              <SwitchComponent
                ariaLabel="Infrastructure Projects"
                checked={settings.showInfrastructure}
                onChange={toggle("showInfrastructure")}
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            id="monitoring"
            icon={Gauge}
            title="Monitoring"
            description="Health check intervals, thresholds, and refresh behavior"
          >
            <SettingRow
              label="Auto-Refresh"
              hint="Periodically re-fetch project health status"
            >
              <SwitchComponent
                ariaLabel="Auto-Refresh"
                checked={settings.autoRefreshEnabled}
                onChange={toggle("autoRefreshEnabled")}
              />
            </SettingRow>

            <SettingRow
              label="Health Check Interval"
              hint="How often to poll project health endpoints"
              controlId="setting-health-check-interval"
            >
              <NumberSettingInput
                id="setting-health-check-interval"
                setting="healthCheckInterval"
                value={settings.healthCheckInterval}
                unit="sec"
                disabled={!settings.autoRefreshEnabled}
              />
            </SettingRow>

            <SettingRow
              label="Container Stats Polling"
              hint="Frequency of Docker container metrics updates"
              controlId="setting-container-polling-interval"
            >
              <NumberSettingInput
                id="setting-container-polling-interval"
                setting="containerPollingInterval"
                value={settings.containerPollingInterval}
                unit="sec"
              />
            </SettingRow>

            <SettingRow
              label="Response Times"
              hint="Display latency in project tables and cards"
            >
              <SwitchComponent
                ariaLabel="Response Times"
                checked={settings.showResponseTimes}
                onChange={toggle("showResponseTimes")}
              />
            </SettingRow>

            <SettingRow
              label="CPU Alert Threshold"
              hint="Highlight containers above this CPU percentage"
              controlId="setting-alert-threshold-cpu"
            >
              <NumberSettingInput
                id="setting-alert-threshold-cpu"
                setting="alertThresholdCpu"
                value={settings.alertThresholdCpu}
                unit="%"
              />
            </SettingRow>

            <SettingRow
              label="Memory Alert Threshold"
              hint="Highlight containers above this memory percentage"
              controlId="setting-alert-threshold-memory"
            >
              <NumberSettingInput
                id="setting-alert-threshold-memory"
                setting="alertThresholdMemory"
                value={settings.alertThresholdMemory}
                unit="%"
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            id="data"
            icon={Shield}
            title="Data & Privacy"
            description="Session tracking and local data management"
            danger
          >
            <SettingRow
              label="Session Tracking"
              hint="Record page navigation for the session explorer"
            >
              <SwitchComponent
                ariaLabel="Session Tracking"
                checked={settings.telemetryEnabled}
                onChange={toggle("telemetryEnabled")}
              />
            </SettingRow>

            <SettingRow
              label="Reset All Settings"
              hint="Restore every setting to its default value"
            >
              <ButtonComponent
                variant="outlined"
                size="small"
                icon={RefreshCw}
                onClick={() => setConfirmAction("reset")}
                className={styles["danger-button"]}
              >
                Reset
              </ButtonComponent>
            </SettingRow>

            <SettingRow
              label="Clear Local Data"
              hint="Wipe cached data and preferences from this browser"
            >
              <ButtonComponent
                variant="outlined"
                size="small"
                icon={Trash2}
                onClick={() => setConfirmAction("clear")}
                className={styles["danger-button"]}
              >
                Clear
              </ButtonComponent>
            </SettingRow>
          </SettingsSection>

          {/* ── Footer ── */}
          <div className={styles["footer"]}>
            <span className={styles["footer-version"]}>Portal v0.1.0</span>
          </div>
        </div>
      </div>

      {/* ── Destructive-action confirmation ── */}
      <DialogComponent
        open={dialog !== null}
        onClose={() => setConfirmAction(null)}
        icon={<DialogIcon size={22} />}
        headline={dialog?.headline ?? ""}
        onConfirm={handleConfirm}
        confirmLabel={dialog?.label ?? ""}
        confirmVariant="destructive"
      >
        {dialog?.body}
      </DialogComponent>
    </div>
  );
}
