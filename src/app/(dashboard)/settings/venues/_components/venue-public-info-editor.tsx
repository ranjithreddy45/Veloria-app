"use client";

// ============================================================
// Settings → Venues → "Hall information for customers". Edits the practical
// fields the customer hall page shows (address, map, parking, directions,
// video, virtual tour) through updateVenuePublicInfo. Empty means hidden.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Loader2, MapPin, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateVenuePublicInfo } from "@/actions/venue-public-info.actions";
import { normalizeWebUrl, type FieldErrors } from "../../business-contact/_lib/contact-rules";
import {
  VENUE_PUBLIC_INFO_FIELDS,
  VENUE_PUBLIC_INFO_LABELS,
  countFilledPublicInfo,
  validateVenuePublicInfoInput,
  type VenuePublicInfoField,
} from "../_lib/venue-public-info-rules";

export interface VenuePublicInfoRow {
  id: string;
  name: string;
  isActive: boolean;
  parentVenueId?: string | null;
  publicAddress?: string | null;
  mapUrl?: string | null;
  parkingInfo?: string | null;
  directionsNote?: string | null;
  videoUrl?: string | null;
  virtualTourUrl?: string | null;
}

type Values = Record<VenuePublicInfoField, string>;

const FIELD_UI: Record<VenuePublicInfoField, { help: string; placeholder: string; kind: "text" | "url" }> = {
  publicAddress: {
    help: "This hall's address as customers should see it.",
    placeholder: "Street, area, city, PIN",
    kind: "text",
  },
  mapUrl: { help: "In Google Maps: Share → Copy link.", placeholder: "https://maps.app.goo.gl/…", kind: "url" },
  parkingInfo: {
    help: "Where guests park and anything they should know before arriving.",
    placeholder: "Where to park, how many cars, valet…",
    kind: "text",
  },
  directionsNote: {
    help: "Landmarks, which entrance to use, lift or ramp access.",
    placeholder: "Nearest landmark, entrance, lift access…",
    kind: "text",
  },
  videoUrl: { help: "A YouTube or Vimeo link to a walkthrough of this hall.", placeholder: "https://youtu.be/…", kind: "url" },
  virtualTourUrl: { help: "A 360° tour link, if you have one.", placeholder: "https://…", kind: "url" },
};

function toValues(venue: VenuePublicInfoRow): Values {
  return Object.fromEntries(VENUE_PUBLIC_INFO_FIELDS.map((field) => [field, venue[field] ?? ""])) as Values;
}

export function VenuePublicInfoEditor({ venues }: { venues: VenuePublicInfoRow[] }) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const editing = venues.find((v) => v.id === editingId) ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4 text-muted-foreground" /> Hall information for customers
        </CardTitle>
        <CardDescription>
          Address, map, parking, directions, video and virtual tour for each hall&apos;s page in the customer app. Empty fields are
          hidden from customers; nothing is filled in for you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {venues.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Add a venue first.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {venues.map((venue) => {
              const filled = countFilledPublicInfo(venue);
              const missing = VENUE_PUBLIC_INFO_FIELDS.filter((field) => !venue[field]?.trim());
              return (
                <li key={venue.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {venue.name}
                      {!venue.isActive ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inactive · not shown to customers
                        </Badge>
                      ) : venue.parentVenueId ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          Sub-hall · not listed in the customer app
                        </Badge>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {filled} of {VENUE_PUBLIC_INFO_FIELDS.length} filled
                      {missing.length > 0 && missing.length < VENUE_PUBLIC_INFO_FIELDS.length
                        ? ` · hidden: ${missing.map((field) => VENUE_PUBLIC_INFO_LABELS[field].toLowerCase()).join(", ")}`
                        : ""}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditingId(venue.id)}>
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      {editing && <VenuePublicInfoDialog key={editing.id} venue={editing} onClose={() => setEditingId(null)} />}
    </Card>
  );
}

function VenuePublicInfoDialog({ venue, onClose }: { venue: VenuePublicInfoRow; onClose: () => void }) {
  const router = useRouter();
  const [values, setValues] = React.useState<Values>(() => toValues(venue));
  const [errors, setErrors] = React.useState<FieldErrors<VenuePublicInfoField>>({});
  const [saving, setSaving] = React.useState(false);

  function update(field: VenuePublicInfoField, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function save() {
    const check = validateVenuePublicInfoInput(values);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setSaving(true);
    try {
      const res = await updateVenuePublicInfo(venue.id, values);
      if (!res.success) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success(res.data.changed ? `Saved. ${venue.name}'s page in the customer app is updated.` : "No changes to save.");
      if (res.data.changed) router.refresh();
      onClose();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{venue.name}: customer information</DialogTitle>
          <DialogDescription>Shown on this hall&apos;s page in the customer app. Leave a field empty to hide it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {VENUE_PUBLIC_INFO_FIELDS.map((field) => {
            const ui = FIELD_UI[field];
            const id = `venue-info-${field}`;
            const error = errors[field];
            const link = ui.kind === "url" ? normalizeWebUrl(values[field]) : null;
            const testHref = link && link.ok ? link.value : null;
            return (
              <div key={field} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={id}>{VENUE_PUBLIC_INFO_LABELS[field]}</Label>
                  {testHref && (
                    <a
                      href={testHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      Test link <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
                {ui.kind === "url" ? (
                  <Input
                    id={id}
                    type="url"
                    inputMode="url"
                    value={values[field]}
                    placeholder={ui.placeholder}
                    aria-invalid={error ? true : undefined}
                    onChange={(e) => update(field, e.target.value)}
                  />
                ) : (
                  <Textarea
                    id={id}
                    rows={2}
                    value={values[field]}
                    placeholder={ui.placeholder}
                    aria-invalid={error ? true : undefined}
                    onChange={(e) => update(field, e.target.value)}
                  />
                )}
                <p className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{error ?? ui.help}</p>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
