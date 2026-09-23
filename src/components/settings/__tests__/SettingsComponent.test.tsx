import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import SettingsComponent from "@/components/SettingsComponent";
import NumberSettingInput from "@/components/settings/NumberSettingInput";
import {
  DEFAULT_SETTINGS,
  getSettings,
  resetSettings,
  updateSettings,
} from "@/lib/settings";

// Settings are driven through the store API — Node's experimental
// localStorage shadows jsdom's in this environment.
beforeEach(() => {
  resetSettings();
});

function renderInput() {
  return render(
    <NumberSettingInput
      id="interval"
      setting="healthCheckInterval"
      value={getSettings().healthCheckInterval}
      unit="sec"
    />,
  );
}

describe("NumberSettingInput", () => {
  it("lets a multi-digit value be typed without clamping each keystroke", () => {
    renderInput();
    const input = screen.getByRole("spinbutton");

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "1" } });
    expect(input).toHaveValue(1);
    fireEvent.change(input, { target: { value: "10" } });

    expect(input).toHaveValue(10);
    expect(getSettings().healthCheckInterval).toBe(10);
  });

  it("clamps an out-of-range value when the field is left", () => {
    renderInput();
    const input = screen.getByRole("spinbutton");

    fireEvent.change(input, { target: { value: "2" } });
    expect(getSettings().healthCheckInterval).toBe(
      DEFAULT_SETTINGS.healthCheckInterval,
    );
    fireEvent.blur(input);

    expect(getSettings().healthCheckInterval).toBe(5);
  });

  it("drops an empty draft instead of storing zero", () => {
    renderInput();
    const input = screen.getByRole("spinbutton");

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(getSettings().healthCheckInterval).toBe(
      DEFAULT_SETTINGS.healthCheckInterval,
    );
  });
});

describe("SettingsComponent", () => {
  it("names every switch after its setting", () => {
    render(<SettingsComponent />);
    for (const name of [
      "System Summary",
      "Infrastructure Projects",
      "Auto-Refresh",
      "Response Times",
      "Session Tracking",
    ]) {
      expect(screen.getByRole("switch", { name })).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Health Check Interval")).toBeInTheDocument();
  });

  it("resets every setting after confirmation", () => {
    updateSettings({ showResponseTimes: false, alertThresholdCpu: 50 });
    render(<SettingsComponent />);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reset" }));

    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("highlights the clicked section in the section nav", () => {
    render(<SettingsComponent />);
    const nav = screen.getByRole("navigation", { name: "Settings sections" });

    fireEvent.click(within(nav).getByRole("button", { name: "Monitoring" }));

    expect(
      within(nav).getByRole("button", { name: "Monitoring" }),
    ).toHaveAttribute("aria-current", "true");
  });
});
