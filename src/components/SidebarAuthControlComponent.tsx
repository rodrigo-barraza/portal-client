"use client";

// ============================================================
// SidebarAuthControlComponent — account control for the sidebar
// ============================================================
// Rendered in the sidebar footer (bottomActions). Shows the
// signed-in identity with a sign-out action, or a "Sign in"
// button (Google OAuth) when signed out. Renders nothing when
// auth is disabled — no SessionProvider exists to read.
// ============================================================

import { signIn, signOut, useSession } from "next-auth/react";
import { LogIn, LogOut } from "lucide-react";
import { useAuthEnabled } from "@/providers/AuthProvider";
import { ADMIN_ROLE } from "@/utils/adminAccess";
import styles from "./SidebarAuthControlComponent.module.css";

function AuthControlInner() {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  if (session?.user) {
    const label = session.user.email || session.user.name || "Account";
    const isAdmin = !!session.user.roles?.includes(ADMIN_ROLE);
    return (
      <button
        type="button"
        className={styles.control}
        onClick={() => signOut()}
        title={`${label}${isAdmin ? " · admin" : ""} — sign out`}
      >
        <LogOut size={16} aria-hidden />
        <span className={styles.label}>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={styles.control}
      onClick={() => signIn("google")}
      title="Sign in with Google"
    >
      <LogIn size={16} aria-hidden />
      <span className={styles.label}>Sign in</span>
    </button>
  );
}

export default function SidebarAuthControlComponent() {
  const authEnabled = useAuthEnabled();
  if (!authEnabled) return null;
  return <AuthControlInner />;
}
