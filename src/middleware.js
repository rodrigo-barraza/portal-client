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
// LAN bypass: Requests arriving via private/RFC 1918 IPs
// (e.g. 192.168.x.x, 10.x.x.x, localhost) skip auth entirely.
//
// Excluded paths (always public):
//   /api/auth/*       — OAuth flow routes
//   /_next/*          — Next.js static assets and images
//   /favicon.ico      — Browser favicon request
// ============================================================

import { NextResponse } from "next/server";
import { auth, AUTH_ENABLED } from "@/auth";

/**
 * RFC 1918 private network check on the Host header.
 * Matches 10.x.x.x, 172.16–31.x.x, 192.168.x.x, localhost, and [::1].
 */
const PRIVATE_HOST_RE =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|\[::1\])(:\d+)?$/;

function isPrivateHost(request) {
  const host = request.headers.get("host") || "";
  return PRIVATE_HOST_RE.test(host);
}

export function middleware(request) {
  if (!AUTH_ENABLED || isPrivateHost(request)) {
    return NextResponse.next();
  }
  return auth(request);
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
