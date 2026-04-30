// ============================================================
// Portal — Auth.js (next-auth v5) Configuration
// ============================================================
// Google SSO with email whitelist. Only emails listed in
// AUTH_ALLOWED_EMAILS can access the portal.
//
// Required env vars (resolved from Vault):
//   AUTH_SECRET           — random 32+ char string for JWT signing
//   AUTH_GOOGLE_ID        — Google OAuth2 Client ID
//   AUTH_GOOGLE_SECRET    — Google OAuth2 Client Secret
//   AUTH_ALLOWED_EMAILS   — comma-separated list of allowed emails
//   AUTH_TRUST_HOST       — set to "true" when behind a reverse proxy
// ============================================================

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Parse the comma-separated allowlist once at module load.
 */
const ALLOWED_EMAILS = (process.env.AUTH_ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  trustHost: true,

  callbacks: {
    /**
     * Gate sign-in to only whitelisted emails.
     * If AUTH_ALLOWED_EMAILS is empty, all Google accounts are allowed.
     */
    signIn({ user }) {
      if (ALLOWED_EMAILS.length === 0) return true;
      return ALLOWED_EMAILS.includes(user.email?.toLowerCase());
    },

    /**
     * Middleware authorization check. Returning false triggers
     * a redirect to the sign-in page for page requests, or a
     * 401 for API requests.
     */
    authorized({ auth: session }) {
      return !!session?.user;
    },
  },
});
