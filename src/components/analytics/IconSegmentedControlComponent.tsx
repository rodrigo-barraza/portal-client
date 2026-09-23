"use client";

import type { ReactNode } from "react";
import { SegmentedControlComponent } from "@rodrigo-barraza/components-library";
import styles from "./IconSegmentedControl.module.css";

export interface IconSegment<T extends string> {
  value: T;
  icon: ReactNode;
  /** Accessible name — announced, not shown. */
  label: string;
}

/**
 * The library SegmentedControlComponent with icon-only segments that still
 * have accessible names. Its segment buttons are labelled only by their
 * visible content, so a bare icon left a screen reader with an unnamed
 * radio; the label here is rendered visually hidden instead.
 */
export default function IconSegmentedControlComponent<T extends string>({
  value,
  onChange,
  segments,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  segments: IconSegment<T>[];
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={styles["icon-segments"]}
    >
      <SegmentedControlComponent
        value={value}
        onChange={(next: string) => onChange(next as T)}
        segments={segments.map((segment) => ({
          value: segment.value,
          icon: segment.icon,
          label: (
            <span className={styles["visually-hidden"]} title={segment.label}>
              {segment.label}
            </span>
          ),
        }))}
        compact
      />
    </div>
  );
}
