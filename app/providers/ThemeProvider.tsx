"use client";

import { ConfigProvider, theme as antdTheme } from "antd";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type ThemeContextValue = {
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "miniway:dark-mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setDarkMode(stored === "true");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, String(darkMode));
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const contextValue = useMemo(
    () => ({
      darkMode,
      setDarkMode,
      toggleDarkMode: () => setDarkMode((prev) => !prev),
    }),
    [darkMode]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <ConfigProvider
        theme={{
          algorithm: darkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: "#6366f1",
            colorSuccess: "#10b981",
            colorWarning: "#f59e0b",
            colorError: "#ef4444",
            colorInfo: "#3b82f6",
            colorLink: "#6366f1",
            colorLinkHover: "#8b5cf6",
            borderRadius: 12,
            borderRadiusSM: 8,
            borderRadiusLG: 16,
            fontSize: 14,
            fontWeightStrong: 600,
            boxShadow:
              "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
            boxShadowSecondary:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            controlHeight: 44,
            controlHeightLG: 52,
            controlHeightSM: 36,
            colorBgBase: darkMode ? "#0b1220" : "#f8fafc",
            colorBgContainer: darkMode ? "#111827" : "#ffffff",
            colorBorder: darkMode ? "#1f2937" : "#e2e8f0",
            colorTextBase: darkMode ? "#f8fafc" : "#1e293b",
          },
          components: {
            Layout: {
              headerBg: darkMode ? "#111827" : "#ffffff",
              siderBg: darkMode ? "#0f172a" : "#f8fafc",
            },
            Card: {
              borderRadiusLG: 16,
              boxShadowTertiary: darkMode
                ? "0 1px 4px rgba(0, 0, 0, 0.35)"
                : "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
            },
            Button: {
              borderRadius: 10,
              controlHeight: 44,
              controlHeightLG: 52,
              controlHeightSM: 36,
              fontWeight: 600,
            },
            Input: {
              borderRadius: 10,
              controlHeight: 44,
              controlHeightLG: 52,
            },
            Select: {
              borderRadius: 10,
              controlHeight: 44,
            },
            Table: {
              borderRadius: 12,
              headerBg: darkMode ? "#0f172a" : "#f8fafc",
              headerColor: darkMode ? "#e2e8f0" : "#1e293b",
            },
            Modal: {
              borderRadiusLG: 20,
            },
            Message: {
              borderRadiusLG: 12,
            },
            Notification: {
              borderRadiusLG: 16,
            },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within ThemeProvider");
  }
  return context;
}
