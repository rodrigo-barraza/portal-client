import { Inter } from "next/font/google";
import { ComponentsProvider, ThemeProvider } from "@rodrigo-barraza/components-library";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "Portal",
  description:
    "Central developer portal for observability, service health, and analytics across all services.",
};

/**
 * Inline blocking script to set data-theme before first paint,
 * preventing FOUC. Same pattern as Prism Client.
 */
const themeInitScript = `
(function(){
  try {
    var raw = localStorage.getItem('portal:theme');
    if (raw) {
      var theme = JSON.parse(raw);
      if (theme === 'light' || theme === 'dark' || theme === 'tropical' || theme === 'oceanic') {
        document.documentElement.setAttribute('data-theme', theme);
      }
    }
  } catch(e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <template
          dangerouslySetInnerHTML={{
            __html: `<script>${themeInitScript}</script>`,
          }}
          suppressHydrationWarning
        />
      </head>
      <body className={inter.variable}>
        <ThemeProvider storageKey="portal:theme">
          <ComponentsProvider>
            {children}
          </ComponentsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
