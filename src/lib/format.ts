/**
 * Shared formatting helpers for portal-client.
 */

/**
 * Format a size given in KILOBYTES (not bytes — the shared library
 * formatBytes takes bytes, so it does not fit these call sites).
 */
export function formatSize(kb: number): string {
  if (kb >= 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(1)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}
