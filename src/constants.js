/**
 * constants.js — Centralized constants for the Web Portal app.
 */

// ── Navigation ──────────────────────────────────────────────────
export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { id: "services", label: "Services", href: "/services", icon: "Server" },
  { id: "devices", label: "Devices", href: "/devices", icon: "Cpu" },
  { id: "topology", label: "Topology", href: "/topology", icon: "Waypoints" },
  { id: "logs", label: "Logs", href: "/logs", icon: "ScrollText" },
  { id: "analytics", label: "Analytics", href: "/analytics", icon: "BarChart3" },
];

// ── Service status colors ───────────────────────────────────────
export const SERVICE_STATUS = {
  healthy: { label: "Healthy", color: "var(--success)" },
  unhealthy: { label: "Down", color: "var(--danger)" },
  unknown: { label: "Unknown", color: "var(--text-muted)" },
};

// ── Chart color palette ─────────────────────────────────────────
export const CHART_COLORS = [
  "#6366f1", "#a855f7", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#06b6d4",
];
