import styles from "./UsageBar.module.css";

/**
 * Thin usage bar (CPU / RAM) under a metric value. Decorative — the value
 * it mirrors is always printed next to it — so it is hidden from assistive
 * technology rather than announced twice.
 */
export default function UsageBar({
  percent,
  color,
}: {
  percent: number;
  color: string;
}) {
  const width = Math.max(0, Math.min(percent, 100));
  return (
    <div className={styles["track"]} aria-hidden="true">
      <div
        className={styles["fill"]}
        style={{ width: `${width}%`, background: color }}
      />
    </div>
  );
}
