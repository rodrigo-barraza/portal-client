/**
 * constants.ts — Centralized constants for the Web Portal app.
 */

import type { LucideIcon } from "lucide-react";
import type { ServiceTypeColor, DeployTierColor } from "./types/portal";

import {
  BookOpen,
  Bot,
  Database,
  Globe,
  HardDrive,
  Monitor,
  Rocket,
  Server,
  Wrench,
} from "lucide-react";

// ── Navigation ──────────────────────────────────────────────────
export const NAV_SECTIONS = [
  {
    label: "Infrastructure",
    items: [
      {
        id: "containers",
        label: "Containers",
        href: "/containers",
        icon: "Container",
      },
      { id: "projects", label: "Projects", href: "/projects", icon: "Server" },
      { id: "devices", label: "Devices", href: "/devices", icon: "Cpu" },
      {
        id: "topology",
        label: "Topology",
        href: "/topology",
        icon: "Waypoints",
      },
      {
        id: "object-store",
        label: "Object Store",
        href: "/object-store",
        icon: "Database",
      },
    ],
  },
  {
    label: "Observability",
    items: [
      { id: "logs", label: "Logs", href: "/logs", icon: "ScrollText" },
      {
        id: "web-analytics",
        label: "Web Analytics",
        href: "/web-analytics",
        icon: "TrendingUp",
      },
    ],
  },
  {
    label: "Integrations",
    items: [
      {
        id: "integrations",
        label: "Integrations",
        href: "/integrations",
        icon: "KeyRound",
      },
      { id: "providers", label: "Providers", href: "/providers", icon: "Plug" },
    ],
  },
  {
    label: "Developer",
    items: [
      {
        id: "components",
        label: "Components",
        href: "/components",
        icon: "Blocks",
      },
      { id: "hooks", label: "Hooks", href: "/hooks", icon: "Anchor" },
      {
        id: "services-library",
        label: "Services",
        href: "/services-library",
        icon: "Cog",
      },
      {
        id: "utilities",
        label: "Utilities",
        href: "/utilities",
        icon: "Wrench",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        id: "settings",
        label: "Settings",
        href: "/settings",
        icon: "Settings",
      },
    ],
  },
];

// ── Service status colors ───────────────────────────────────────
export const SERVICE_STATUS = {
  healthy: { label: "Healthy", color: "var(--color-success)" },
  unhealthy: { label: "Down", color: "var(--color-danger)" },
  unknown: { label: "Unknown", color: "var(--text-muted)" },
};

// ── Service type → Lucide icon map ──────────────────────────────
export const SERVICE_TYPE_ICONS: Record<string, LucideIcon> = {
  Service: Server,
  Client: Monitor,
  Bot: Bot,
  Database: Database,
  Store: HardDrive,
  Library: BookOpen,
  Kit: Rocket,
  Tool: Wrench,
};

/** Default icon when projectType is unrecognized. */
export const DEFAULT_SERVICE_TYPE_ICON = Globe;

// ── Service type → badge colors (mirrors vault-service) ─────────
export const SERVICE_TYPE_COLORS: Record<string, ServiceTypeColor> = {
  Service: { color: "#3b82f6", subtle: "rgba(59, 130, 246, 0.12)" },
  Client: { color: "#22c55e", subtle: "rgba(34, 197, 94, 0.12)" },
  Bot: { color: "#eab308", subtle: "rgba(234, 179, 8, 0.12)" },
  Database: { color: "#a855f7", subtle: "rgba(168, 85, 247, 0.12)" },
  Store: { color: "#f97316", subtle: "rgba(249, 115, 22, 0.12)" },
  Library: { color: "#06b6d4", subtle: "rgba(6, 182, 212, 0.12)" },
  Kit: { color: "#f59e0b", subtle: "rgba(245, 158, 11, 0.12)" },
  Tool: { color: "#8b5cf6", subtle: "rgba(139, 92, 246, 0.12)" },
};

// ── Deploy tier → topology colors (mirrors vault-service) ───────
export const DEPLOY_TIER_COLORS: Record<number, DeployTierColor> = {
  0: {
    color: "#f97316",
    subtle: "rgba(249, 115, 22, 0.12)",
    stroke: "rgba(249, 115, 22, 0.35)",
    fill: "rgba(249, 115, 22, 0.04)",
  },
  1: {
    color: "#3b82f6",
    subtle: "rgba(59, 130, 246, 0.12)",
    stroke: "rgba(59, 130, 246, 0.35)",
    fill: "rgba(59, 130, 246, 0.04)",
  },
  2: {
    color: "#22c55e",
    subtle: "rgba(34, 197, 94, 0.12)",
    stroke: "rgba(34, 197, 94, 0.35)",
    fill: "rgba(34, 197, 94, 0.04)",
  },
};

// ── Chart color palette ─────────────────────────────────────────
export const CHART_COLORS = [
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
  "#06b6d4",
];
