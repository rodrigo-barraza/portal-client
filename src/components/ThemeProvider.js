"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const ThemeContext = createContext({ theme: "dark", toggleTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
  // Always start with "dark" to match SSR — avoids hydration mismatch
  const [theme, setTheme] = useState("dark");
  const [mounted, setMounted] = useState(false);

  // Sync from localStorage after hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem("portal:theme");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed === "light" || parsed === "dark") {
          setTheme(parsed);
          document.documentElement.setAttribute("data-theme", parsed);
        }
      }
    } catch {
      // Ignore
    }
    setMounted(true);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("portal:theme", JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}
