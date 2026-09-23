// ============================================================
// Portal — Next.js Proxy (auth gate)
// ============================================================
// Next 16 renamed the `middleware` file convention to `proxy`
// (Node.js runtime). Uses the shared auth gate factory from
// utilities-library: private-network hosts bypass it, public
// hosts go through Auth.js, whose `authorized` callback in
// src/auth.ts decides who passes.
// ============================================================

import { createAuthMiddleware } from "@rodrigo-barraza/utilities-library/nextjs";
import { auth, AUTH_ENABLED } from "@/auth";

// Auth.js supports calling `auth(request)` directly as a proxy handler
// (it runs the `authorized` callback and refreshes the session cookie),
// but its overloaded type only declares the wrapper form — hence the cast.
const authGate = auth as unknown as (request: Request) => Promise<Response>;

export const proxy = createAuthMiddleware({
  auth: authGate,
  authEnabled: AUTH_ENABLED,
});

export const config = {
  // Static images (public/ and the app/icon.png metadata route) never need
  // a session — skip the per-request session decode for them.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
