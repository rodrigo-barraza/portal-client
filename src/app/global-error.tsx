"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary — catches errors in the root layout itself.
 * It replaces the root layout, so it brings its own <html>/<body> and
 * inline styles (globals.css and the theme attribute never reach it);
 * `light-dark()` follows the OS color scheme instead.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[Portal] Root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          colorScheme: "light dark",
          background: "light-dark(#fafafa, #0a0a0a)",
          color: "light-dark(#171717, #e5e5e5)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <title>Something went wrong — Portal</title>
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            gap: "16px",
            padding: "32px",
          }}
        >
          <div
            aria-hidden
            style={{ fontSize: "48px", lineHeight: 1, opacity: 0.4 }}
          >
            ⚠
          </div>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 600,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "light-dark(#595959, #999)",
              margin: 0,
              textAlign: "center",
              maxWidth: "400px",
            }}
          >
            {error?.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={retry}
            style={{
              marginTop: "8px",
              padding: "8px 20px",
              fontSize: "13px",
              fontWeight: 500,
              color: "inherit",
              background:
                "light-dark(rgb(0 0 0 / 0.04), rgb(255 255 255 / 0.06))",
              border:
                "1px solid light-dark(rgb(0 0 0 / 0.12), rgb(255 255 255 / 0.08))",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </main>
      </body>
    </html>
  );
}
