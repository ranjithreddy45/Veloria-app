"use client";

import { useEffect } from "react";

// ============================================================
// Registers /sw.js so the app is INSTALLABLE on Android/Chrome (which requires a
// service worker with a fetch handler before it will offer "Install app").
//
// Skipped inside the Capacitor native shell — that build already IS the app, and
// a second caching layer there only risks serving stale screens.
// Registration is deferred to `load` so it never competes with first paint.
// ============================================================
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Capacitor exposes a global bridge; don't register inside the native shell.
    if ((window as { Capacitor?: unknown }).Capacitor) return;
    // Dev has its own HMR/asset pipeline — registering here causes confusing
    // cache behaviour while developing.
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("[SW] registration failed", err);
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
