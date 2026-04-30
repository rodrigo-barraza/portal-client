// ============================================================
// Portal — Next.js Middleware (Auth Gate)
// ============================================================
// Runs the Auth.js authorized callback on every matched request.
// Unauthenticated page requests → redirect to Google sign-in.
// Unauthenticated API requests  → 401 Unauthorized.
//
// Excluded paths:
//   /api/auth/*       — OAuth flow routes (must be public)
//   /_next/*          — Next.js static assets and images
//   /favicon.ico      — Browser favicon request
// ============================================================

export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
