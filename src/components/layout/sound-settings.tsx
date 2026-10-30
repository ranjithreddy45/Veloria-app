"use client";

import * as React from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  getServerSoundPrefs,
  getSoundPrefs,
  playSound,
  setSoundEnabled,
  setSoundVolume,
  subscribeSoundPrefs,
} from "@/lib/ui/sound";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

// ============================================================
// The sound controls in the menu under your initials: an on/off switch and,
// while on, a volume slider. Both play their own sound (data-sound="none" keeps
// SoundRuntime from adding a click on top).
// ============================================================

export function useSoundPrefs() {
  return React.useSyncExternalStore(subscribeSoundPrefs, getSoundPrefs, getServerSoundPrefs);
}

export function SoundMenuItems() {
  const { enabled, volume } = useSoundPrefs();

  const toggle = () => {
    if (enabled) {
      // Played before switching off so the person hears what "off" means.
      playSound("off");
      setSoundEnabled(false);
    } else {
      setSoundEnabled(true);
      playSound("on");
    }
  };

  return (
    <>
      <DropdownMenuItem
        data-sound="none"
        className="cursor-pointer"
        onSelect={(e) => {
          // Keep the menu open so the switch flips in place.
          e.preventDefault();
          toggle();
        }}
      >
        {enabled ? <Volume2 className="mr-2 size-4" /> : <VolumeX className="mr-2 size-4" />}
        Sounds
        <Switch
          checked={enabled}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none ml-auto scale-90"
        />
      </DropdownMenuItem>
      {enabled && (
        <div data-sound="none" className="flex items-center gap-2.5 px-2 pb-2 pt-0.5">
          <span className="w-6 shrink-0" aria-hidden />
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={Math.round(volume * 100)}
            aria-label="Sound volume"
            className="h-1 w-full cursor-pointer accent-primary"
            // The menu moves focus on arrow keys; the slider needs them.
            onKeyDown={(e) => e.stopPropagation()}
            onChange={(e) => setSoundVolume(Number(e.target.value) / 100)}
            onPointerUp={() => playSound("tap")}
          />
        </div>
      )}
    </>
  );
}
