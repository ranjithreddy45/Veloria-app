"use client";

import * as React from "react";
import { Smartphone, Share, Plus, Check, Download, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================================
// Install ("download") the app on a phone.
// ------------------------------------------------------------
// Veloria Grand ships as an installable web app — there is NO App Store / Play
// Store listing, so this deliberately shows the real Add-to-Home-Screen flow
// rather than store badges that would 404.
//
// Behaviour by platform:
//   Android/Chrome — a REAL install button, driven by the `beforeinstallprompt`
//                    event the browser fires when the app is installable.
//   iOS/Safari     — iOS never fires that event, so we show the exact Share →
//                    Add to Home Screen steps instead of a dead button.
//   Desktop        — offers the same install prompt when available, and shows a
//                    QR so the user can open it on their phone.
//   Already installed — detected via display-mode: standalone; we say so rather
//                    than inviting a second install.
// ============================================================

type Platform = "ios" | "android" | "desktop";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  // iPadOS 13+ reports as Mac; the touch-point check disambiguates a real iPad.
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && typeof document !== "undefined" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function InstallAppCard({ className }: { className?: string }) {
  const [platform, setPlatform] = React.useState<Platform>("desktop");
  const [installed, setInstalled] = React.useState(false);
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [appUrl, setAppUrl] = React.useState("");

  React.useEffect(() => {
    setPlatform(detectPlatform());
    setAppUrl(window.location.origin);

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari uses a non-standard flag.
      (window.navigator as { standalone?: boolean }).standalone === true;
    setInstalled(!!standalone);

    const onPrompt = (e: Event) => {
      // Stop Chrome's own mini-infobar so this card is the single install entry.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null); // the event is single-use
    } finally {
      setBusy(false);
    }
  }

  if (installed) {
    return (
      <div className={`border-success/20 bg-success/10 rounded-2xl border p-5 ${className ?? ""}`}>
        <div className="flex items-center gap-3">
          <Check className="text-success size-5 shrink-0" />
          <div>
            <p className="text-success text-sm font-semibold">The app is installed</p>
            <p className="text-success/80 text-xs">You&apos;re running Veloria Grand as an app.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card shadow-card rounded-2xl border p-6 ${className ?? ""}`}>
      <div className="flex items-start gap-4">
        <div className="bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-2xl">
          <Smartphone className="size-[22px]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-editorial text-foreground text-[20px] font-semibold">
            Get the app on your phone
          </h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Install Veloria Grand for a full-screen app with its own home-screen icon —
            no app store needed.
          </p>

          {/* Android + desktop: the browser told us it's installable. */}
          {deferred && (
            <Button onClick={install} disabled={busy} className="mt-4 gap-2">
              <Download className="size-4" />
              {busy ? "Installing…" : "Install app"}
            </Button>
          )}

          {/* iOS never fires beforeinstallprompt — show the real steps. */}
          {platform === "ios" && (
            <ol className="mt-4 space-y-2.5">
              <Step n={1} icon={<Share className="size-3.5" />}>
                Tap the <strong>Share</strong> button in Safari&apos;s toolbar
              </Step>
              <Step n={2} icon={<Plus className="size-3.5" />}>
                Choose <strong>Add to Home Screen</strong>
              </Step>
              <Step n={3} icon={<Check className="size-3.5" />}>
                Tap <strong>Add</strong> — the icon appears on your home screen
              </Step>
            </ol>
          )}

          {/* Android without the event yet (e.g. non-Chrome browser). */}
          {platform === "android" && !deferred && (
            <p className="text-muted-foreground mt-4 text-[13px] leading-relaxed">
              Open this page in <strong>Chrome</strong>, then use the ⋮ menu →{" "}
              <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
            </p>
          )}

          {/* Desktop: point them at their phone. */}
          {platform === "desktop" && !deferred && appUrl && (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=132x132&data=${encodeURIComponent(
                  `${appUrl}/get-app`
                )}`}
                alt="QR code to open Veloria Grand on your phone"
                className="size-[132px] shrink-0 rounded-xl border bg-white p-1.5"
              />
              <p className="text-muted-foreground max-w-[15rem] text-[13px] leading-relaxed">
                <span className="text-foreground inline-flex items-center gap-1.5 font-medium">
                  <MonitorSmartphone className="size-3.5" /> On a computer?
                </span>
                <br />
                Scan this with your phone&apos;s camera to open Veloria Grand, then install it
                from there.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="bg-muted text-muted-foreground numeric flex size-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold">
        {n}
      </span>
      <span className="text-foreground/90 flex items-center gap-1.5 text-[13px]">
        <span className="text-muted-foreground">{icon}</span>
        {children}
      </span>
    </li>
  );
}
