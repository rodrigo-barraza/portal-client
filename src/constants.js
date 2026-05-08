/**
 * constants.js — Centralized constants for the Web Portal app.
 */

import {
  Bot,
  Database,
  Globe,
  HardDrive,
  Monitor,
  Server,
} from "lucide-react";

// ── Navigation ──────────────────────────────────────────────────
export const NAV_ITEMS = [
  { id: "projects", label: "Projects", href: "/projects", icon: "Server" },
  { id: "integrations", label: "Integrations", href: "/integrations", icon: "KeyRound" },
  { id: "devices", label: "Devices", href: "/devices", icon: "Cpu" },
  { id: "topology", label: "Topology", href: "/topology", icon: "Waypoints" },
  { id: "storage", label: "Storage", href: "/storage", icon: "HardDrive" },
  { id: "logs", label: "Logs", href: "/logs", icon: "ScrollText" },
  { id: "analytics", label: "Analytics", href: "/analytics", icon: "BarChart3" },
  { id: "web-analytics", label: "Web Analytics", href: "/web-analytics", icon: "TrendingUp" },
  { id: "components", label: "Components", href: "/components", icon: "Blocks" },
  { id: "providers", label: "Providers", href: "/providers", icon: "Plug" },
  { id: "hooks", label: "Hooks", href: "/hooks", icon: "Anchor" },
  { id: "services-library", label: "Services Library", href: "/services-library", icon: "Cog" },
  { id: "utilities", label: "Utilities", href: "/utilities", icon: "Wrench" },
];

// ── Service status colors ───────────────────────────────────────
export const SERVICE_STATUS = {
  healthy: { label: "Healthy", color: "var(--success)" },
  unhealthy: { label: "Down", color: "var(--danger)" },
  unknown: { label: "Unknown", color: "var(--text-muted)" },
};

// ── Service type → Lucide icon map ──────────────────────────────
export const SERVICE_TYPE_ICONS = {
  Service: Server,
  Client: Monitor,
  Bot: Bot,
  Database: Database,
  Store: HardDrive,
};

/** Default icon when serviceType is unrecognized. */
export const DEFAULT_SERVICE_TYPE_ICON = Globe;

// ── Service type → badge colors (mirrors vault-service) ─────────
export const SERVICE_TYPE_COLORS = {
  Service:  { color: "#3b82f6", subtle: "rgba(59, 130, 246, 0.12)" },
  Client:   { color: "#22c55e", subtle: "rgba(34, 197, 94, 0.12)" },
  Bot:      { color: "#eab308", subtle: "rgba(234, 179, 8, 0.12)" },
  Database: { color: "#a855f7", subtle: "rgba(168, 85, 247, 0.12)" },
  Store:    { color: "#f97316", subtle: "rgba(249, 115, 22, 0.12)" },
};

// ── Chart color palette ─────────────────────────────────────────
export const CHART_COLORS = [
  "#6366f1", "#a855f7", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#06b6d4",
];
