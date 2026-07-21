"use client";

import { SessionTrackerComponent as LibrarySessionTracker } from "@rodrigo-barraza/components-library";
import { useSession } from "next-auth/react";
import { PROJECT_NAME } from "@/config";
import { usePortalSettings } from "@/lib/settings";
import { useAuthEnabled } from "@/providers/AuthProvider";

/**
 * Links the signed-in identity to the analytics session. Requires a
 * SessionProvider ancestor (present only when auth is enabled).
 */
function AuthedSessionTracker() {
  const { data: session } = useSession();
  const userId = session?.user?.email || session?.user?.name || null;
  return <LibrarySessionTracker projectId={PROJECT_NAME} userId={userId} replay heatmap />;
}

export default function SessionTrackerComponent() {
  const { telemetryEnabled } = usePortalSettings();
  const authEnabled = useAuthEnabled();

  if (!telemetryEnabled) return null;
  // With auth disabled there is no SessionProvider in the tree, so
  // useSession() would throw — fall back to anonymous-only tracking.
  if (!authEnabled) return <LibrarySessionTracker projectId={PROJECT_NAME} replay heatmap />;
  return <AuthedSessionTracker />;
}
