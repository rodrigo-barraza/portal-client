// ============================================================
// Portal — Next.js Middleware (Auth Gate)
// ============================================================
// Uses the shared auth middleware factory from utilities-library.
// LAN bypass + optional Google OAuth — see createAuthMiddleware docs.
// ============================================================

import { createAuthMiddleware } from "@rodrigo-barraza/utilities-library/nextjs";
import { auth, AUTH_ENABLED } from "@/auth";

// @ts-expect-error -- NextAuth's overloaded `auth` type doesn't match the simplified middleware signature
export const middleware = createAuthMiddleware({
  auth,
  authEnabled: AUTH_ENABLED,
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
