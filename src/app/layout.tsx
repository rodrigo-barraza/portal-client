import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import {
  ComponentsProvider,
  ThemeProvider,
  generateThemeInitScript,
} from "@rodrigo-barraza/components-library";
import "./globals.css";
import SessionTrackerComponent from "@/components/SessionTrackerComponent";
import AuthProvider from "@/providers/AuthProvider";
import { AUTH_ENABLED } from "@/auth";
import { THEME_STORAGE_KEY } from "@/lib/storageKeys";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portal",
  description:
    "Central developer portal for observability, service health, and analytics across all services.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the persisted theme before first paint. It must be a
            plain <script>: one wrapped in <template> is inert and never
            runs, which made every non-default theme flash on load. */}
        <script
          dangerouslySetInnerHTML={{
            __html: generateThemeInitScript(THEME_STORAGE_KEY),
          }}
        />
      </head>
      <body className={inter.variable}>
        <ThemeProvider storageKey={THEME_STORAGE_KEY}>
          <ComponentsProvider>
            <AuthProvider authEnabled={AUTH_ENABLED}>
              {children}
              <SessionTrackerComponent />
            </AuthProvider>
          </ComponentsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
