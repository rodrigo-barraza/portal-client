"use client";

import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import { InputComponent } from "@rodrigo-barraza/components-library";
import {
  SETTING_LIMITS,
  updateSettings,
  type PortalSettings,
} from "@/lib/settings";
import styles from "../SettingsComponent.module.css";

type NumericSetting = keyof typeof SETTING_LIMITS;

/**
 * Number input for a range-limited setting.
 *
 * Keeps what the user is typing as a local draft: a value inside the range
 * applies immediately, anything else waits until blur/Enter and is then
 * clamped. Clamping every keystroke made values unreachable — clearing the
 * field snapped it to the minimum, so typing "10" into a 5–300 field
 * produced "51".
 */
export default function NumberSettingInput({
  id,
  setting,
  value,
  unit,
  disabled,
}: {
  id: string;
  setting: NumericSetting;
  value: number;
  unit: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const { min, max } = SETTING_LIMITS[setting];

  const apply = (next: number) => {
    updateSettings({ [setting]: next } as Partial<PortalSettings>);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    setDraft(text);
    const parsed = Number(text);
    if (text.trim() !== "" && Number.isInteger(parsed) && parsed >= min && parsed <= max) {
      apply(parsed);
    }
  };

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(parsed)) apply(parsed);
    setDraft(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commit();
    if (event.key === "Escape") setDraft(null);
  };

  return (
    <div className={styles["unit-group"]}>
      <InputComponent
        id={id}
        type="number"
        inputMode="numeric"
        value={draft ?? String(value)}
        disabled={disabled}
        onChange={handleChange}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
        step={1}
        size="sm"
      />
      <span className={styles["unit-label"]}>{unit}</span>
    </div>
  );
}
