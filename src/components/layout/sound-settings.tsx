"use client";

import * as React from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import {
  getServerSoundPrefs,
  getSoundPrefs,
  playSound,
  setSoundEnabled,
  setSoundVolume,
  subscribeSoundPrefs,
} from "@/lib/ui/sound";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

// ============================================================
// The sound controls in the menu under your initials: "Sounds" (a checkbox
// item, so screen readers hear on/off) and, while on, a "Volume" submenu of
// three levels (radio items, reachable by keyboard; a range slider inside a
// menu is not, because the menu owns the arrow keys). Each control plays its
// own sound (data-sound="none" keeps SoundRuntime from adding a click).
// ============================================================

export function useSoundPrefs() {
  return React.useSyncExternalStore(subscribeSoundPrefs, getSoundPrefs, getServerSoundPrefs);
}

const LEVELS = [
  { value: "0.25", label: "Quiet" },
  { value: "0.55", label: "Normal" },
  { value: "0.85", label: "Loud" },
] as const;

/** The level nearest a stored volume, so older custom values still show a choice. */
function nearestLevel(volume: number): string {
  let best: string = LEVELS[1].value;
  for (const l of LEVELS) {
    if (Math.abs(Number(l.value) - volume) < Math.abs(Number(best) - volume)) best = l.value;
  }
  return best;
}

export function SoundMenuItems() {
  const { enabled, volume } = useSoundPrefs();

  return (
    <>
      <DropdownMenuCheckboxItem
        data-sound="none"
        className="cursor-pointer"
        checked={enabled}
        onCheckedChange={(next) => {
          if (next) {
            setSoundEnabled(true);
            playSound("on");
          } else {
            // Played before switching off, so the person hears what "off" means.
            playSound("off");
            setSoundEnabled(false);
          }
        }}
        // Keep the menu open so the change is visible in place.
        onSelect={(e) => e.preventDefault()}
      >
        {enabled ? <Volume2 className="mr-2 size-4" /> : <VolumeX className="mr-2 size-4" />}
        Sounds
      </DropdownMenuCheckboxItem>
      {enabled && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-sound="none" className="cursor-pointer">
            <Volume1 className="mr-2 size-4" />
            Volume
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={nearestLevel(volume)}
              onValueChange={(v) => {
                setSoundVolume(Number(v));
                playSound("tap");
              }}
            >
              {LEVELS.map((l) => (
                <DropdownMenuRadioItem
                  key={l.value}
                  value={l.value}
                  data-sound="none"
                  className="cursor-pointer"
                  onSelect={(e) => e.preventDefault()}
                >
                  {l.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
    </>
  );
}
