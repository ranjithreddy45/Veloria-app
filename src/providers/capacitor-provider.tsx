"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { isCapacitor, isAndroid } from "@/lib/capacitor/platform";

/**
 * CapacitorProvider — Initializes native Capacitor plugins when running
 * inside a native iOS/Android shell. No-ops gracefully on web.
 *
 * Handles:
 * - Status bar styling (synced with theme)
 * - Splash screen auto-hide
 * - Back button navigation (Android)
 * - Deep link routing
 * - Push notification listener registration
 * - Keyboard behavior
 */
export function CapacitorProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();

  // Initialize Capacitor plugins on mount
  useEffect(() => {
    if (!isCapacitor()) return;

    let cleanup: (() => void) | undefined;

    async function init() {
      try {
        // 1. Hide splash screen
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide({ fadeOutDuration: 300 });

        // 2. Configure status bar
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#09090b" });

        // 3. Handle back button on Android
        if (isAndroid()) {
          const { App } = await import("@capacitor/app");
          const backHandler = await App.addListener("backButton", ({ canGoBack }) => {
            if (canGoBack) {
              window.history.back();
            } else {
              App.minimizeApp();
            }
          });

          // 4. Handle deep links
          const urlHandler = await App.addListener("appUrlOpen", ({ url }) => {
            try {
              const parsedUrl = new URL(url);
              const path = parsedUrl.pathname;
              if (path && path !== "/") {
                window.location.href = path;
              }
            } catch {
              // Invalid URL, ignore
            }
          });

          cleanup = () => {
            backHandler.remove();
            urlHandler.remove();
          };
        } else {
          // iOS deep links
          const { App } = await import("@capacitor/app");
          const urlHandler = await App.addListener("appUrlOpen", ({ url }) => {
            try {
              const parsedUrl = new URL(url);
              const path = parsedUrl.pathname;
              if (path && path !== "/") {
                window.location.href = path;
              }
            } catch {
              // Invalid URL, ignore
            }
          });

          cleanup = () => {
            urlHandler.remove();
          };
        }

        // 5. Configure keyboard behavior
        const { Keyboard } = await import("@capacitor/keyboard");
        await Keyboard.setResizeMode({ mode: "body" as never });
      } catch (error) {
        console.warn("[Capacitor] Plugin initialization error:", error);
      }
    }

    init();

    return () => {
      cleanup?.();
    };
  }, []);

  // Sync status bar style with theme changes
  useEffect(() => {
    if (!isCapacitor()) return;

    async function syncStatusBar() {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        if (resolvedTheme === "dark") {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: "#09090b" });
        } else {
          await StatusBar.setStyle({ style: Style.Light });
          await StatusBar.setBackgroundColor({ color: "#7c3aed" });
        }
      } catch {
        // StatusBar plugin not available
      }
    }

    syncStatusBar();
  }, [resolvedTheme]);

  return <>{children}</>;
}
