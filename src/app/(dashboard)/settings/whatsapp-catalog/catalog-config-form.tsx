"use client";

import * as React from "react";
import { CheckCircle2Icon, XCircleIcon, ExternalLinkIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// ============================================================
// Catalog config form (client). Surfaces the canonical event-type map.
// Editing is settings:update-gated at the page; without it the controls are
// read-only. Persistence is additive: the enable flag is env-driven
// (WHATSAPP_CATALOG_ENABLED) and the event map ships from
// src/lib/whatsapp/catalog-content.ts — this form previews + validates the
// shape ahead of a future persisted-config wave.
// ============================================================

interface CatalogConfigView {
  enabled: boolean;
  events: {
    buttonId: string;
    label: string;
    brochureSlug: string;
    foodTierIds: string[];
    eventTypeEnum: string;
  }[];
}

export function CatalogConfigForm({
  config,
  canEdit,
}: {
  config: CatalogConfigView;
  canEdit: boolean;
}) {
  const [enabled, setEnabled] = React.useState(config.enabled);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Auto-catalog status</CardTitle>
          <CardDescription>
            Toggle whether new inbound numbers receive the event-type picker
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="catalog-enabled">Send catalog on first inbound</Label>
              <p className="text-[11px] text-muted-foreground">
                Controlled by the WHATSAPP_CATALOG_ENABLED environment flag.
                {enabled ? " Currently enabled." : " Currently disabled."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {enabled ? (
                <CheckCircle2Icon className="size-4 text-emerald-500" />
              ) : (
                <XCircleIcon className="size-4 text-muted-foreground" />
              )}
              <Switch
                id="catalog-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={!canEdit}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event types</CardTitle>
          <CardDescription>
            Each option in the picker maps to a brochure and a premium-first set
            of package tiers (per-plate prices come from the live quote catalog).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.events.map((evt) => (
            <div key={evt.buttonId} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Button label</Label>
                  <Input defaultValue={evt.label} disabled={!canEdit} className="max-w-xs" />
                </div>
                <Badge variant="outline">{evt.eventTypeEnum}</Badge>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Brochure slug (/v/&lt;slug&gt;)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    defaultValue={evt.brochureSlug}
                    disabled={!canEdit}
                    className="max-w-xs"
                    placeholder="wedding"
                  />
                  {evt.brochureSlug && (
                    <a
                      href={`/v/${evt.brochureSlug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                    >
                      Preview <ExternalLinkIcon className="size-3" />
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Package tiers (premium-first)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {evt.foodTierIds.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {!canEdit && (
            <p className="text-[11px] text-muted-foreground">
              You have read-only access. Editing requires the settings:update
              permission.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
