// ============================================================
// Web Portal — Runtime Configuration
// ============================================================
// Imports defaults from secrets.js and overrides with production
// values when served from *.com
// ============================================================

import {
  PORTAL_PORT as SECRETS_PORT,
  PORTAL_API_URL as DEFAULT_PORTAL_API_URL,
} from "./secrets.js";

export const PORT = SECRETS_PORT || 4000;

export const IS_PRODUCTION =
  typeof window !== "undefined" &&
  window.location.hostname.endsWith(".com");

export const IS_LOCALHOST = !IS_PRODUCTION;

// Environment-aware project name — isolates data between dev and prod
export const PROJECT_NAME = "portal";

export const PORTAL_API_URL = IS_PRODUCTION
  ? "https://portal-api.clankerbox.com"
  : DEFAULT_PORTAL_API_URL;
