/**
 * Helpers for the human-readable fields Docker's container list returns.
 *
 * Docker reports uptime only inside `Status` ("Up 2 hours (healthy)"),
 * formatted by go-units' HumanDuration. `Created` is when the container
 * was created, which a restart does not reset — so it is NOT uptime.
 */

const UP_PATTERN = /^Up\s+(.*?)(?:\s*\(|$)/;

const UNIT_SECONDS: Record<string, number> = {
  second: 1,
  minute: 60,
  hour: 3_600,
  day: 86_400,
  week: 604_800,
  month: 2_592_000,
  year: 31_536_000,
};

/** "Up 2 hours (healthy)" → "2 hours"; null for anything not running. */
export function parseDockerUptime(status: string | null | undefined): string | null {
  const match = status?.trim().match(UP_PATTERN);
  const uptime = match?.[1]?.trim();
  return uptime ? uptime : null;
}

/**
 * Approximate uptime in seconds, for sorting. Inverts go-units'
 * HumanDuration ("About an hour", "3 days", "Less than a second").
 */
export function dockerUptimeSeconds(status: string | null | undefined): number | null {
  const uptime = parseDockerUptime(status);
  if (!uptime) return null;
  const text = uptime.toLowerCase();
  if (text === "less than a second") return 0;
  if (text === "about a minute") return UNIT_SECONDS.minute;
  if (text === "about an hour") return UNIT_SECONDS.hour;
  const match = text.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?$/);
  if (!match) return null;
  return Number(match[1]) * UNIT_SECONDS[match[2]];
}

/** Nanoseconds → "12.5ms" / "3.2s" / "1.5m". */
export function formatNanoseconds(nanoseconds: number): string {
  if (!nanoseconds) return "0s";
  const milliseconds = nanoseconds / 1_000_000;
  if (milliseconds < 1000) return `${milliseconds.toFixed(1)}ms`;
  const totalSeconds = milliseconds / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  return `${(totalSeconds / 60).toFixed(1)}m`;
}

/** Unix seconds → localized "Sep 22, 2026, 09:41 AM"; "—" when missing. */
export function formatUnixTimestamp(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
