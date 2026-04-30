// ============================================================
// Portal — Auth.js API Route Handler
// ============================================================
// Mounts the GET and POST handlers for /api/auth/* routes.
// These handle the OAuth flow (sign-in, callback, sign-out, session).
// ============================================================

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
