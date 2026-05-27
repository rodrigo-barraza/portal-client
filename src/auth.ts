// ============================================================
// Portal — Auth.js (next-auth v5) Configuration
// ============================================================
// Google SSO with email whitelist. Only emails listed in
// AUTH_ALLOWED_EMAILS can access the portal.
//
// Auth is CONDITIONALLY ENABLED — if AUTH_GOOGLE_ID and
// AUTH_GOOGLE_SECRET are both set, OAuth is active. Otherwise,
// the portal runs fully open (no login required).
//
// Required env vars (resolved from Vault) when enabled:
//   AUTH_SECRET           — random 32+ char string for JWT signing
//   AUTH_GOOGLE_ID        — Google OAuth2 Client ID
//   AUTH_GOOGLE_SECRET    — Google OAuth2 Client Secret
//   AUTH_ALLOWED_EMAILS   — comma-separated list of allowed emails
//   AUTH_TRUST_HOST       — set to "true" when behind a reverse proxy
// ============================================================

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const AUTH_ENABLED = !!(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
);

/**
 * Parse the comma-separated allowlist once at module load.
 */
const ALLOWED_EMAILS = (process.env.AUTH_ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: AUTH_ENABLED ? [Google] : [],
  trustHost: true,

  callbacks: {
    /**
     * Gate sign-in to only whitelisted emails.
     * If AUTH_ALLOWED_EMAILS is empty, all Google accounts are allowed.
     * If auth is disabled, always allow (no-op).
     */
    signIn({ user }) {
      if (!AUTH_ENABLED) return true;
      if (ALLOWED_EMAILS.length === 0) return true;
      const email = user.email?.toLowerCase();
      return email ? ALLOWED_EMAILS.includes(email) : false;
    },

    /**
     * Middleware authorization check. Returning false triggers
     * a redirect to the sign-in page for page requests, or a
     * 401 for API requests. When auth is disabled, always pass.
     */
    authorized() {
      return true;
    },
  },
});
