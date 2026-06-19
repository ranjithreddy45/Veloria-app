"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateFranchiseVenue } from "@/actions/franchise.actions";
import { toStorefrontSlug, validateStorefrontSlug } from "@/lib/franchise/slug";

// ============================================================
// White-label storefront settings for one FranchiseVenue.
// ============================================================

interface VenueStorefrontFormProps {
  franchiseVenueId: string;
  venueName: string;
  initial: {
    storefrontSlug: string | null;
    brandName: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    customDomain: string | null;
    isStorefrontLive: boolean;
  };
}

export function VenueStorefrontForm({
  franchiseVenueId,
  venueName,
  initial,
}: VenueStorefrontFormProps) {
  const router = useRouter();
  const [slug, setSlug] = React.useState(initial.storefrontSlug ?? "");
  const [brandName, setBrandName] = React.useState(initial.brandName ?? "");
  const [logoUrl, setLogoUrl] = React.useState(initial.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = React.useState(
    initial.primaryColor ?? "#4f46e5"
  );
  const [customDomain, setCustomDomain] = React.useState(
    initial.customDomain ?? ""
  );
  const [isLive, setIsLive] = React.useState(initial.isStorefrontLive);
  const [saving, setSaving] = React.useState(false);

  const slugError = slug ? validateStorefrontSlug(toStorefrontSlug(slug)) : null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (slug && slugError) {
      toast.error(slugError);
      return;
    }
    if (isLive && !slug) {
      toast.error("Set a storefront slug before going live.");
      return;
    }
    setSaving(true);
    try {
      const result = await updateFranchiseVenue(franchiseVenueId, {
        storefrontSlug: slug ? toStorefrontSlug(slug) : null,
        brandName: brandName.trim() || null,
        logoUrl: logoUrl.trim() || null,
        primaryColor: primaryColor || null,
        customDomain: customDomain.trim() || null,
        storefrontConfig: {},
        isStorefrontLive: isLive,
      });
      if (result.success) {
        toast.success("Storefront updated");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to update");
      }
    } finally {
      setSaving(false);
    }
  }

  const previewSlug = slug ? toStorefrontSlug(slug) : "";

  return (
    <form
      onSubmit={handleSave}
      className="space-y-4 rounded-xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{venueName}</h3>
        <div className="flex items-center gap-2">
          <Switch
            checked={isLive}
            onCheckedChange={setIsLive}
            id={`live-${franchiseVenueId}`}
          />
          <Label htmlFor={`live-${franchiseVenueId}`} className="text-xs">
            Storefront live
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Storefront slug</Label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="sunrise-banquets"
          />
          {slug && slugError ? (
            <p className="text-xs text-destructive">{slugError}</p>
          ) : previewSlug ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              Public URL: <code className="rounded bg-muted px-1">/s/{previewSlug}</code>
              {initial.isStorefrontLive && initial.storefrontSlug && (
                <a
                  href={`/s/${initial.storefrontSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-primary hover:underline"
                >
                  open <ExternalLink className="ml-0.5 size-3" />
                </a>
              )}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label>Brand name</Label>
          <Input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Sunrise Banquets"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Logo URL</Label>
          <Input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…/logo.png"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Primary color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : "#4f46e5"}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
              aria-label="Primary color"
            />
            <Input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#4f46e5"
              className="w-32"
            />
          </div>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>Custom domain (display only)</Label>
          <Input
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="book.sunrisebanquets.com"
          />
          <p className="text-xs text-muted-foreground">
            Domain routing/SSL is configured separately; this field is stored for
            reference only.
          </p>
        </div>
      </div>

      <div>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save storefront
        </Button>
      </div>
    </form>
  );
}
