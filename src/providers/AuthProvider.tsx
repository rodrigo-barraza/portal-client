"use client";

// ============================================================
// AuthProvider — NextAuth session context for the portal
// ============================================================
// Mounts NextAuth's SessionProvider only when auth is enabled
// (Google OAuth configured). When disabled, there is no session
// context — components must guard useSession() behind
// useAuthEnabled() to avoid throwing.
// ============================================================

import { createContext, useContext, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

const AuthEnabledContext = createContext(false);

/** True when portal auth (Google OAuth) is configured and active. */
export function useAuthEnabled(): boolean {
  return useContext(AuthEnabledContext);
}

export default function AuthProvider({
  authEnabled,
  children,
}: {
  authEnabled: boolean;
  children: ReactNode;
}) {
  const tree = authEnabled ? (
    <SessionProvider>{children}</SessionProvider>
  ) : (
    children
  );

  return (
    <AuthEnabledContext.Provider value={authEnabled}>
      {tree}
    </AuthEnabledContext.Provider>
  );
}
