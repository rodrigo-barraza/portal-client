import { memo } from "react";
import type { LogLevel, LogLine } from "./logLines";
import styles from "../LogsComponent.module.css";

const LEVEL_CLASS: Record<LogLevel, string> = {
  error: styles['level-error'],
  warn: styles['level-warn'],
  info: styles['level-info'],
  success: styles['level-success'],
  debug: styles['level-debug'],
};

const LINE_LEVEL_CLASS: Partial<Record<LogLevel, string>> = {
  error: styles['log-line-error'],
  warn: styles['log-line-warn'],
  success: styles['log-line-success'],
};

/**
 * One terminal line. Memoized on the (immutable) line object, so a new
 * batch renders only the new rows — not the whole 5,000-line buffer.
 */
function LogLineRow({ line }: { line: LogLine }) {
  const levelClass = line.level ? LEVEL_CLASS[line.level] : "";
  const lineClass = line.level ? (LINE_LEVEL_CLASS[line.level] ?? "") : "";
  return (
    <div className={`${styles['log-line']} ${lineClass}`}>
      <span className={styles['line-number']}>{line.id}</span>
      {line.timestamp && <span className={styles['line-timestamp']}>{line.timestamp}</span>}
      <span className={`${styles['line-content']} ${levelClass}`}>
        {line.segments.map((segment, index) =>
          segment.style ? (
            <span key={index} style={segment.style}>
              {segment.text}
            </span>
          ) : (
            segment.text
          ),
        )}
      </span>
    </div>
  );
}

export default memo(LogLineRow);
