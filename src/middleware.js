// ============================================================
// Portal — Next.js Middleware (Auth Gate)
// ============================================================
// Conditionally enforces Google OAuth based on env vars.
//
// When AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET are set:
//   → Auth.js intercepts requests and redirects to Google sign-in.
// When either is missing:
//   → All requests pass through unauthenticated (open access).
//
// Excluded paths (always public):
//   /api/auth/*       — OAuth flow routes
//   /_next/*          — Next.js static assets and images
//   /favicon.ico      — Browser favicon request
// ============================================================

import { NextResponse } from "next/server";
import { auth, AUTH_ENABLED } from "@/auth";

export const middleware = AUTH_ENABLED ? auth : () => NextResponse.next();

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
