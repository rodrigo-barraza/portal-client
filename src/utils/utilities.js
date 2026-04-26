/**
 * utilities.js — Shared utility functions for the Web Portal app.
 */

/**
 * Format a number with compact notation (1.2K, 3.4M, etc.)
 * @param {number} value
 * @returns {string}
 */
export function formatCompact(value) {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

/**
 * Format a duration in milliseconds to a human-readable string.
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Format a cost value in USD.
 * @param {number} cost
 * @returns {string}
 */
export function formatCost(cost) {
  if (cost == null) return "—";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Relative time string (e.g. "2m ago", "3h ago").
 * @param {string|Date} date
 * @returns {string}
 */
export function timeAgo(date) {
  if (!date) return "—";
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;

  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
