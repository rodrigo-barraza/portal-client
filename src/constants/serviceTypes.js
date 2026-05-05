// ============================================================
// Service Type Constants — Shared across all service-display components
// ============================================================
// SERVICE_TYPE_ICONS: Lucide icon mapping for each service type.
// SERVICE_TYPE_COLORS: Hardcoded fallback colors that match the
//   vault-service serviceTypeColors. At runtime, prefer the
//   colors returned from the portal-service API response
//   (res.serviceTypeColors) since those are the canonical source.
// ============================================================

import { Bot, Database, Globe, HardDrive, Monitor, Server } from "lucide-react";

/**
 * Map serviceType → Lucide icon component.
 */
export const SERVICE_TYPE_ICONS = {
  Service: Server,
  Client: Monitor,
  Bot: Bot,
  Database: Database,
  Store: HardDrive,
};

/**
 * Resolve the icon for a given service entry.
 * Falls back to Globe for unknown types.
 */
export function getServiceIcon(service) {
  return SERVICE_TYPE_ICONS[service.serviceType] || Globe;
}

/**
 * Default service type colors — mirrors vault-service serviceTypeColors.
 * Used as a fallback when the API response doesn't include colors.
 */
export const DEFAULT_SERVICE_TYPE_COLORS = {
  Service:  { color: "#3b82f6", subtle: "rgba(59, 130, 246, 0.12)" },
  Client:   { color: "#22c55e", subtle: "rgba(34, 197, 94, 0.12)" },
  Bot:      { color: "#eab308", subtle: "rgba(234, 179, 8, 0.12)" },
  Database: { color: "#a855f7", subtle: "rgba(168, 85, 247, 0.12)" },
  Store:    { color: "#f97316", subtle: "rgba(249, 115, 22, 0.12)" },
};
