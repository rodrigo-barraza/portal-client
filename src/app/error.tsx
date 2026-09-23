"use client";

import { ErrorFallbackComponent } from "@rodrigo-barraza/components-library";

/**
 * Route error boundary — renders a recovery UI instead of a blank screen.
 * "Try again" uses `retry` (stable since Next 16.3), which re-fetches the
 * segment; `reset` only re-rendered it, so a failed server render came
 * straight back.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorFallbackComponent error={error} reset={retry} logLabel="[Portal]" />
  );
}
