import { parseAnsiSegments, stripAnsi, type AnsiSegment } from "./ansi";

/** Lines kept in the viewer (and in the pause buffer). */
export const MAX_LOG_LINES = 5000;

export type LogLevel = "error" | "warn" | "info" | "success" | "debug";

export interface LogLine {
  /** Monotonic per stream — stable React key and line number. */
  id: number;
  /** "HH:MM:SS.mmm" (UTC, as Docker stamps it), or null. */
  timestamp: string | null;
  /** Docker's full timestamp, fraction padded so strings sort by time. */
  sortKey: string | null;
  content: string;
  /** ANSI-free, lower-cased content for search. */
  searchText: string;
  level: LogLevel | null;
  segments: AnsiSegment[];
}

// Docker prefixes each line (timestamps=1) with an RFC 3339 nano timestamp.
const TIMESTAMP_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?\s*/;

/**
 * portal-service sends each line as `data: {"line": "...", "stream":
 * "stdout"}`; older builds sent the raw line. Accept both.
 */
export function parseLogFrame(data: string): string {
  if (data.startsWith("{")) {
    try {
      const frame = JSON.parse(data) as { line?: unknown };
      if (typeof frame.line === "string") return frame.line;
    } catch {
      // Not JSON after all — a raw line that starts with "{".
    }
  }
  return data;
}

export function detectLevel(plainText: string): LogLevel | null {
  if (/\bERR(?:OR)?\b/i.test(plainText)) return "error";
  if (/\bWARN(?:ING)?\b/i.test(plainText)) return "warn";
  if (/\bINFO\b/i.test(plainText)) return "info";
  if (/\b(?:OK|SUCCESS)\b/i.test(plainText)) return "success";
  if (/\b(?:DBG|DEBUG)\b/i.test(plainText)) return "debug";
  return null;
}

export function parseLogLine(raw: string, id: number): LogLine {
  const match = raw.match(TIMESTAMP_PATTERN);
  const content = match ? raw.slice(match[0].length) : raw;
  const plainText = stripAnsi(content);
  let timestamp: string | null = null;
  let sortKey: string | null = null;
  if (match) {
    const fraction = match[2] ?? "";
    timestamp = `${match[1].slice(11)}.${fraction.slice(0, 3).padEnd(3, "0")}`;
    // RFC 3339 nano trims trailing zeros ("…12.1Z"), which breaks string
    // ordering against "…12.05Z" — pad the fraction to nine digits.
    sortKey = `${match[1]}.${fraction.padEnd(9, "0").slice(0, 9)}`;
  }
  return {
    id,
    timestamp,
    sortKey,
    content,
    searchText: plainText.toLowerCase(),
    level: detectLevel(plainText),
    segments: parseAnsiSegments(content),
  };
}

/** Append, keeping only the newest `max` entries. */
export function appendCapped<T>(existing: T[], incoming: T[], max = MAX_LOG_LINES): T[] {
  if (incoming.length === 0) return existing;
  const combined = existing.concat(incoming);
  return combined.length > max ? combined.slice(combined.length - max) : combined;
}

export function filterLogLines(lines: LogLine[], query: string): LogLine[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return lines;
  return lines.filter(
    (line) => line.searchText.includes(needle) || (line.timestamp?.includes(needle) ?? false),
  );
}
