// ============================================================
// Service Type Constants — Shared across all service-display components
// ============================================================
// SERVICE_TYPE_ICONS: Lucide icon mapping for each service type.
// SERVICE_TYPE_COLORS: Hardcoded fallback colors that match the
//   vault-service projectTypeColors. At runtime, prefer the
//   colors returned from the portal-service API response
//   (res.projectTypeColors) since those are the canonical source.
// ============================================================

import { BookOpen, Bot, Database, Globe, HardDrive, Monitor, Rocket, Server, Wrench } from "lucide-react";

/**
 * Map projectType → Lucide icon component.
 */
export const SERVICE_TYPE_ICONS = {
  Service: Server,
  Client: Monitor,
  Bot: Bot,
  Database: Database,
  Store: HardDrive,
  Library: BookOpen,
  Kit: Rocket,
  Tool: Wrench,
};

/**
 * Resolve the icon for a given service entry.
 * Falls back to Globe for unknown types.
 */
export function getServiceIcon(service) {
  return SERVICE_TYPE_ICONS[service.projectType] || Globe;
}

/**
 * Default service type colors — mirrors vault-service projectTypeColors.
 * Used as a fallback when the API response doesn't include colors.
 */
export const DEFAULT_SERVICE_TYPE_COLORS = {
  Service:  { color: "#3b82f6", subtle: "rgba(59, 130, 246, 0.12)" },
  Client:   { color: "#22c55e", subtle: "rgba(34, 197, 94, 0.12)" },
  Bot:      { color: "#eab308", subtle: "rgba(234, 179, 8, 0.12)" },
  Database: { color: "#a855f7", subtle: "rgba(168, 85, 247, 0.12)" },
  Store:    { color: "#f97316", subtle: "rgba(249, 115, 22, 0.12)" },
  Library:  { color: "#06b6d4", subtle: "rgba(6, 182, 212, 0.12)" },
  Kit:      { color: "#f59e0b", subtle: "rgba(245, 158, 11, 0.12)" },
  Tool:     { color: "#8b5cf6", subtle: "rgba(139, 92, 246, 0.12)" },
};

/**
 * Default deploy tier colors — mirrors vault-service deployTierColors.
 * Orange (Tier 0 Foundation), Blue (Tier 1 Services), Green (Tier 2 Clients & Bots).
 */
export const DEFAULT_DEPLOY_TIER_COLORS = {
  0: { color: "#f97316", subtle: "rgba(249, 115, 22, 0.12)", stroke: "rgba(249, 115, 22, 0.35)", fill: "rgba(249, 115, 22, 0.04)" },
  1: { color: "#3b82f6", subtle: "rgba(59, 130, 246, 0.12)", stroke: "rgba(59, 130, 246, 0.35)", fill: "rgba(59, 130, 246, 0.04)" },
  2: { color: "#22c55e", subtle: "rgba(34, 197, 94, 0.12)", stroke: "rgba(34, 197, 94, 0.35)", fill: "rgba(34, 197, 94, 0.04)" },
};
