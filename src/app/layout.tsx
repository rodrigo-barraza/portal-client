import { Inter } from "next/font/google";
import {
  ComponentsProvider,
  ThemeProvider,
  generateThemeInitScript,
} from "@rodrigo-barraza/components-library";
import "./globals.css";
import SessionTrackerComponent from "@/components/SessionTrackerComponent";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "Portal",
  description:
    "Central developer portal for observability, service health, and analytics across all services.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <template
          dangerouslySetInnerHTML={{
            __html: `<script>${generateThemeInitScript("portal:theme")}</script>`,
          }}
          suppressHydrationWarning
        />
      </head>
      <body className={inter.variable}>
        <ThemeProvider storageKey="portal:theme">
          <ComponentsProvider>
            {children}
            <SessionTrackerComponent />
          </ComponentsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
