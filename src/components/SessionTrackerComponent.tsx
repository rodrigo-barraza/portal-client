"use client";

import { SessionTrackerComponent as LibrarySessionTracker } from "@rodrigo-barraza/components-library";
import { PROJECT_NAME } from "@/config";
import { usePortalSettings } from "@/lib/settings";

export default function SessionTrackerComponent() {
  const { telemetryEnabled } = usePortalSettings();

  if (!telemetryEnabled) return null;
  return <LibrarySessionTracker projectId={PROJECT_NAME} />;
}
