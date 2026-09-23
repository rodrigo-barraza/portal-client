// ============================================================
// Portal — Auth.js (next-auth v5) Configuration
// ============================================================
// Google SSO with an email allowlist: only emails listed in
// AUTH_ALLOWED_EMAILS can sign in. Signing in is what unlocks the
// admin-gated pages; the rest of the portal is viewable signed out
// (see the `authorized` callback).
//
// Auth is CONDITIONALLY ENABLED — if AUTH_GOOGLE_ID and
// AUTH_GOOGLE_SECRET are both set, OAuth is active. Otherwise,
// the portal runs fully open (no login at all).
//
// Admin-gated pages (e.g. Web Analytics) additionally require the
// "admin" role, resolved from accounts-service at sign-in and
// stamped into the session (see src/utils/adminAccess.ts).
//
// Required env vars (resolved from Vault) when enabled:
//   AUTH_SECRET                — random 32+ char string for JWT signing
//   AUTH_GOOGLE_ID             — Google OAuth2 Client ID
//   AUTH_GOOGLE_SECRET         — Google OAuth2 Client Secret
//   AUTH_ALLOWED_EMAILS        — comma-separated list of allowed emails
//   ACCOUNTS_SERVICE_URL       — accounts-service base URL (role lookup)
//   ACCOUNTS_SERVICE_API_SECRET — shared secret for the role lookup
// ============================================================

import NextAuth, { type DefaultSession } from "next-auth";
import "next-auth/jwt";
import Google from "next-auth/providers/google";
import { fetchAccountRoles } from "./services/accountRoles";

declare module "next-auth" {
  interface Session {
    user: {
      /** Persisted roles from accounts-service (e.g. "admin"), stamped at sign-in. */
      roles?: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roles?: string[];
  }
}

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
     * Resolve persisted roles from accounts-service and carry them on the
     * JWT. Role changes take effect on the next sign-in, not mid-session.
     */
    async jwt({ token, user }) {
      if (user) {
        token.roles = await fetchAccountRoles(user.email);
      } else if (token.roles === undefined && token.email) {
        // Sessions issued before roles existed — backfill once.
        token.roles = await fetchAccountRoles(token.email);
      }
      return token;
    },

    /** Expose the resolved roles on the session for UI and route gates. */
    async session({ session, token }) {
      if (session.user) {
        session.user.roles = token.roles ?? [];
      }
      return session;
    },

    /**
     * Proxy (src/proxy.ts) authorization check for public hosts.
     * Returning false would redirect every signed-out request to the
     * sign-in page. It passes every request: the portal pages are
     * viewable signed out, and admin-only areas gate themselves
     * (e.g. the web-analytics layout via canAccessAdminSide).
     */
    authorized() {
      return true;
    },
  },
});
