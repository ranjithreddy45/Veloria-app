"use client";

// ============================================================
// OMS CR-004 — Service Confirmation card (Stage 2)
// ------------------------------------------------------------
// Booking-level service confirmation: a 24h SLA badge, a Décor sub-form, a
// Photography/Videography selector, an add-on checklist, a link to the
// existing F&B menu builder, and Lock / Send-summary actions.
// ============================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  SparklesIcon,
  LockIcon,
  SendIcon,
  UtensilsCrossedIcon,
  PaletteIcon,
  CameraIcon,
  PlusIcon,
  ExternalLinkIcon,
  ClockIcon,
  CheckCircle2,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  upsertBookingService,
  lockServices,
  sendServiceSummary,
  type BookingServicesData,
  type SlaStatus,
} from "@/actions/booking-services.actions";

const SLA_STYLES: Record<SlaStatus, { label: string; className: string }> = {
  OnTrack: { label: "On track", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  DueSoon: { label: "Due soon", className: "bg-amber-100 text-amber-800 border-amber-200" },
  Overdue: { label: "Overdue", className: "bg-red-100 text-red-800 border-red-200" },
  Locked: { label: "Locked", className: "bg-slate-200 text-slate-700 border-slate-300" },
};

const DECOR_ADDONS = ["Stage backdrop", "Entrance arch", "Floral centrepieces", "Lighting / uplighters", "Welcome signage"];
const PHOTO_DELIVERABLES = ["Edited photo album", "Highlight reel (3–5 min)", "Full event film", "Drone coverage", "Same-day teaser"];
const PHOTO_MODES = ["None", "Photo", "Video", "Both"] as const;
type PhotoMode = (typeof PHOTO_MODES)[number];
const ADDON_SERVICES = ["DJ / Live Music", "LED wall", "Valet", "Invitation printing"];

function findSelection(group: BookingServicesData["groups"][keyof BookingServicesData["groups"]], name: string) {
  return group.find((s) => s.name === name) ?? null;
}

export interface ServiceConfirmationCardProps {
  bookingId: string;
  data: BookingServicesData;
}

export function ServiceConfirmationCard({ bookingId, data }: ServiceConfirmationCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const locked = !data.editable;

  // ---- Décor ----
  const decorRow = data.groups.DECOR[0] ?? null;
  const decorDetails = (decorRow?.details ?? {}) as Record<string, unknown>;
  const [theme, setTheme] = useState<string>(typeof decorDetails.theme === "string" ? decorDetails.theme : "");
  const [colour, setColour] = useState<string>(typeof decorDetails.colour === "string" ? decorDetails.colour : "");
  const [decorAddons, setDecorAddons] = useState<string[]>(
    Array.isArray(decorDetails.addons) ? (decorDetails.addons as unknown[]).filter((x): x is string => typeof x === "string") : []
  );

  // ---- Photo / Video ----
  const photoRow = data.groups.PHOTO_VIDEO[0] ?? null;
  const photoDetails = (photoRow?.details ?? {}) as Record<string, unknown>;
  const [photoMode, setPhotoMode] = useState<PhotoMode>(
    PHOTO_MODES.includes(photoDetails.mode as PhotoMode) ? (photoDetails.mode as PhotoMode) : "None"
  );
  const [photoPackage, setPhotoPackage] = useState<string>(typeof photoDetails.package === "string" ? photoDetails.package : "");
  const [deliverables, setDeliverables] = useState<string[]>(
    Array.isArray(photoDetails.deliverables) ? (photoDetails.deliverables as unknown[]).filter((x): x is string => typeof x === "string") : []
  );

  function toggle(list: string[], value: string, setter: (v: string[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function run(fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.success) {
        toast.success(okMsg);
        router.refresh();
      } else {
        toast.error(res.error || "Something went wrong");
      }
    });
  }

  const saveDecor = () =>
    run(
      () =>
        upsertBookingService(bookingId, {
          category: "DECOR",
          name: "Décor",
          enabled: true,
          details: { theme, colour, addons: decorAddons },
        }),
      "Décor saved"
    );

  const savePhoto = () =>
    run(
      () =>
        upsertBookingService(bookingId, {
          category: "PHOTO_VIDEO",
          name: "Photography / Videography",
          enabled: photoMode !== "None",
          details: { mode: photoMode, package: photoPackage, deliverables },
        }),
      "Photography / videography saved"
    );

  const toggleAddon = (name: string, enabled: boolean) =>
    run(
      () => upsertBookingService(bookingId, { category: "ADDON", name, enabled }),
      `${name} ${enabled ? "added" : "removed"}`
    );

  const sla = SLA_STYLES[data.sla.status];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <SparklesIcon className="size-4 text-violet-600" />
          Service confirmation
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("gap-1 font-medium", sla.className)}>
            {data.sla.status === "Locked" ? <LockIcon className="size-3" /> : <ClockIcon className="size-3" />}
            {sla.label}
            {data.sla.status !== "Locked" && (
              <span className="opacity-70">
                · {data.sla.hoursRemaining >= 0 ? `${data.sla.hoursRemaining}h left` : `${Math.abs(data.sla.hoursRemaining)}h over`}
              </span>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {locked && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <LockIcon className="size-4 shrink-0" />
            Services are locked and read-only. Editing is closed.
          </div>
        )}

        {/* F&B — link to existing menu builder */}
        <section className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2.5">
            <UtensilsCrossedIcon className="size-4 text-warning" />
            <div>
              <p className="text-sm font-medium">Food &amp; Beverage</p>
              <p className="text-xs text-muted-foreground">Build the menu in the dedicated F&amp;B menu builder.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/bookings/${bookingId}/menu`}>
              Open menu builder
              <ExternalLinkIcon className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        </section>

        {/* Décor */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <PaletteIcon className="size-4 text-pink-600" />
            <h3 className="text-sm font-semibold">Décor</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="decor-theme" className="text-xs">Theme</Label>
              <Input id="decor-theme" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Royal Mughal" disabled={locked} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="decor-colour" className="text-xs">Colour palette</Label>
              <Input id="decor-colour" value={colour} onChange={(e) => setColour(e.target.value)} placeholder="e.g. Maroon & gold" disabled={locked} />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {DECOR_ADDONS.map((a) => (
              <label key={a} className="flex items-center gap-2 text-sm">
                <Checkbox checked={decorAddons.includes(a)} onCheckedChange={() => toggle(decorAddons, a, setDecorAddons)} disabled={locked} />
                {a}
              </label>
            ))}
          </div>
          {!locked && (
            <Button size="sm" variant="secondary" onClick={saveDecor} disabled={isPending}>
              Save décor
            </Button>
          )}
        </section>

        {/* Photography / Videography */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CameraIcon className="size-4 text-sky-600" />
            <h3 className="text-sm font-semibold">Photography / Videography</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {PHOTO_MODES.map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={photoMode === m ? "default" : "outline"}
                onClick={() => setPhotoMode(m)}
                disabled={locked}
              >
                {m}
              </Button>
            ))}
          </div>
          {photoMode !== "None" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="photo-pkg" className="text-xs">Package</Label>
                <Input id="photo-pkg" value={photoPackage} onChange={(e) => setPhotoPackage(e.target.value)} placeholder="e.g. Premium 2-camera" disabled={locked} />
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {PHOTO_DELIVERABLES.map((d) => (
                  <label key={d} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={deliverables.includes(d)} onCheckedChange={() => toggle(deliverables, d, setDeliverables)} disabled={locked} />
                    {d}
                  </label>
                ))}
              </div>
            </>
          )}
          {!locked && (
            <Button size="sm" variant="secondary" onClick={savePhoto} disabled={isPending}>
              Save photography / videography
            </Button>
          )}
        </section>

        {/* Add-on services */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <PlusIcon className="size-4 text-success" />
            <h3 className="text-sm font-semibold">Other add-on services</h3>
          </div>
          <div className="divide-y rounded-lg border">
            {ADDON_SERVICES.map((name) => {
              const sel = findSelection(data.groups.ADDON, name);
              const enabled = sel?.enabled ?? false;
              return (
                <div key={name} className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <span>{name}</span>
                  <Switch checked={enabled} onCheckedChange={(v) => toggleAddon(name, v)} disabled={locked || isPending} />
                </div>
              );
            })}
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {data.servicesSummarySentAt
              ? `Summary last sent ${new Date(data.servicesSummarySentAt).toLocaleString()}`
              : "Confirm all services within 24h of booking, then lock and send the summary."}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => run(() => lockServices(bookingId), "Services locked")}
              disabled={locked || isPending}
            >
              {locked ? <CheckCircle2 className="mr-1.5 size-4" /> : <LockIcon className="mr-1.5 size-4" />}
              {locked ? "Locked" : "Lock services"}
            </Button>
            <Button
              size="sm"
              onClick={() => run(() => sendServiceSummary(bookingId), "Service summary sent")}
              disabled={isPending}
            >
              <SendIcon className="mr-1.5 size-4" />
              Send service summary
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
