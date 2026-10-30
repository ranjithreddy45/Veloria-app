"use client";

import * as React from "react";
import { playSound, registerSoundRuntime, unlockSound, type SoundName } from "@/lib/ui/sound";

// ============================================================
// SoundRuntime: one listener that gives every control its click sound, and one
// observer that gives every toast its outcome sound. Mounted once in the
// dashboard layout, so no page or primitive has to opt in.
//
// Click sounds (pointer presses only; keyboard and typing stay silent):
//   filled buttons (primary, destructive)  "press"
//   sidebar links                           "nav"
//   switches and checkboxes                 "on" / "off" by the state they go to
//   any other button, tab, menu item, link  "tap"
// A control (or an ancestor) with data-sound="none" opts out; data-sound="<name>"
// picks a specific sound.
//
// Toasts: success → "success", error → "error". Sonner renders each toast as
// <li data-sonner-toast data-type="…"> inside an <ol> that only exists while a
// toast is showing, inside an always-present <section>. The first toast after
// a quiet spell therefore arrives as a whole new <ol>, so added nodes are
// searched, not just matched.
// ============================================================

const CLICKABLE =
  'button, a[href], [role="button"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="tab"], [role="option"], [role="switch"], [role="checkbox"], summary';

function clickSound(el: Element): SoundName | null {
  const opt = el.closest("[data-sound]")?.getAttribute("data-sound");
  if (opt === "none") return null;
  if (opt) return opt as SoundName;

  const role = el.getAttribute("role");
  if (role === "switch" || role === "checkbox" || role === "menuitemcheckbox") {
    // Pressed before it flips: a checked control is about to turn off.
    return el.getAttribute("aria-checked") === "true" || el.getAttribute("data-state") === "checked" ? "off" : "on";
  }
  // Only a <Button> (data-slot="button") has a filled variant; menu items use
  // data-variant too ("default" | "destructive") and stay a light tap.
  const variant = el.getAttribute("data-slot") === "button" ? el.getAttribute("data-variant") : null;
  if (variant === "default" || variant === "gradient" || variant === "destructive") return "press";
  if (el.closest('[data-sidebar="menu-button"], [data-sidebar="menu-sub-button"]')) return "nav";
  return "tap";
}

// cmdk and Sonner write data-disabled="false" on enabled items.
const DISABLED = ":disabled, [aria-disabled='true'], [data-disabled]:not([data-disabled='false'])";
// Gestures that may unlock audio. iOS Safari only counts touchend/click.
const UNLOCK_EVENTS = ["pointerdown", "keydown", "touchend", "click"] as const;

export function SoundRuntime() {
  React.useEffect(() => {
    const unregister = registerSoundRuntime();
    const onGesture = () => unlockSound();
    for (const type of UNLOCK_EVENTS) {
      document.addEventListener(type, onGesture, { capture: true, passive: true });
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as Element | null;
      const el = target?.closest?.(CLICKABLE);
      if (!el) return;
      if (el.matches(DISABLED)) return;
      const name = clickSound(el);
      if (name) playSound(name);
    };
    document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });

    // Toast outcomes.
    let observer: MutationObserver | null = null;
    let tries = 0;
    let retry = 0;
    const attach = () => {
      const host = document.querySelector('section[aria-label^="Notifications"]');
      if (!host) {
        if (tries++ < 10) retry = window.setTimeout(attach, 500);
        return;
      }
      observer = new MutationObserver((records) => {
        for (const r of records) {
          for (const node of r.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            const toasts = node.matches("[data-sonner-toast]")
              ? [node]
              : Array.from(node.querySelectorAll<HTMLElement>("[data-sonner-toast]"));
            for (const toast of toasts) {
              const type = toast.getAttribute("data-type");
              if (type === "success") playSound("success");
              else if (type === "error") playSound("error");
            }
          }
        }
      });
      observer.observe(host, { childList: true, subtree: true });
    };
    attach();

    return () => {
      unregister();
      for (const type of UNLOCK_EVENTS) {
        document.removeEventListener(type, onGesture, { capture: true });
      }
      document.removeEventListener("pointerdown", onPointerDown, { capture: true });
      window.clearTimeout(retry);
      observer?.disconnect();
    };
  }, []);

  return null;
}

/**
 * Plays "open" when the calling surface mounts and "close" when it unmounts.
 * For dialogs and sheets, whose content only exists while they are open.
 */
export function useOpenCloseSound() {
  React.useEffect(() => {
    playSound("open");
    return () => playSound("close");
  }, []);
}

/** Render inside a dialog's or sheet's content: it exists only while open. */
export function OpenCloseSound() {
  useOpenCloseSound();
  return null;
}
