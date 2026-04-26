import { Inter } from "next/font/google";
import { ThemeProvider } from "../components/ThemeProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "Portal — Sun Ecosystem Hub",
  description:
    "Central developer portal for observability, service health, analytics, and portfolio across the Sun ecosystem.",
};

/**
 * Inline blocking script to set data-theme before first paint,
 * preventing FOUC. Same pattern as Retina.
 */
const themeInitScript = `
(function(){
  try {
    var raw = localStorage.getItem('portal:theme');
    if (raw) {
      var theme = JSON.parse(raw);
      if (theme === 'light' || theme === 'dark') {
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
