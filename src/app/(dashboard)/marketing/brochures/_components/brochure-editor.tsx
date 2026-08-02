"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import {
  createBrochure,
  updateBrochure,
  publishBrochure,
  unpublishBrochure,
  type BrochureDetail,
  type BrochureEditorOptions,
} from "@/actions/brochure.actions";

// ============================================================
// Brochure editor — create/update + publish toggle.
// Curate gallery items + reviews, set media URLs, pricing teaser and CTAs.
// Write buttons are disabled when the user lacks marketing:manage; the action
// re-checks server-side regardless.
// ============================================================

const CTA_OPTIONS: { value: string; label: string; needsVenue: boolean }[] = [
  { value: "HOLD_DATE", label: "Hold this date", needsVenue: true },
  { value: "BOOK_VISIT", label: "Book a visit", needsVenue: true },
  { value: "GET_QUOTE", label: "Get a quote", needsVenue: true },
  { value: "WHATSAPP", label: "WhatsApp us", needsVenue: false },
];

const NO_VENUE = "__none__";

interface FormState {
  slug: string;
  venueId: string;
  eventType: string;
  title: string;
  subtitle: string;
  seoDescription: string;
  heroImageUrl: string;
  videoEmbedUrl: string;
  tour360Url: string;
  startingFromAmount: string;
  whatsappNumber: string;
  enabledCtas: string[];
  galleryItemIds: string[];
  reviewIds: string[];
}

export function BrochureEditor({
  brochure,
  options,
  canManage,
}: {
  brochure: BrochureDetail | null;
  options: BrochureEditorOptions;
  canManage: boolean;
}) {
  const router = useRouter();
  const isNew = !brochure;

  const [form, setForm] = React.useState<FormState>({
    slug: brochure?.slug ?? "",
    venueId: brochure?.venueId ?? NO_VENUE,
    eventType: brochure?.eventType ?? "",
    title: brochure?.title ?? "",
    subtitle: brochure?.subtitle ?? "",
    seoDescription: brochure?.seoDescription ?? "",
    heroImageUrl: brochure?.heroImageUrl ?? "",
    videoEmbedUrl: brochure?.videoEmbedUrl ?? "",
    tour360Url: brochure?.tour360Url ?? "",
    startingFromAmount:
      brochure?.startingFromAmount != null ? String(brochure.startingFromAmount) : "",
    whatsappNumber: brochure?.whatsappNumber ?? "",
    enabledCtas: brochure?.enabledCtas ?? [],
    galleryItemIds: brochure?.galleryItemIds ?? [],
    reviewIds: brochure?.reviewIds ?? [],
  });

  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleArray(key: "galleryItemIds" | "reviewIds" | "enabledCtas", id: string) {
    setForm((f) => {
      const has = f[key].includes(id);
      return { ...f, [key]: has ? f[key].filter((x) => x !== id) : [...f[key], id] };
    });
  }

  async function handleSave() {
    setError(null);
    setOk(null);
    if (form.title.trim().length < 1) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        venueId: form.venueId === NO_VENUE ? null : form.venueId,
        eventType: form.eventType.trim() || null,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        seoDescription: form.seoDescription.trim() || null,
        heroImageUrl: form.heroImageUrl.trim(),
        videoEmbedUrl: form.videoEmbedUrl.trim(),
        tour360Url: form.tour360Url.trim(),
        galleryItemIds: form.galleryItemIds,
        reviewIds: form.reviewIds,
        startingFromAmount: form.startingFromAmount.trim(),
        enabledCtas: form.enabledCtas as ("HOLD_DATE" | "BOOK_VISIT" | "GET_QUOTE" | "WHATSAPP")[],
        whatsappNumber: form.whatsappNumber.trim(),
      };

      const res = isNew
        ? await createBrochure({ ...payload, slug: form.slug.trim() || undefined })
        : await updateBrochure({ ...payload, id: brochure!.id, slug: form.slug.trim() });

      if (res.success) {
        if (isNew) {
          router.push(`/marketing/brochures/${res.data.id}`);
          router.refresh();
        } else {
          setOk("Saved.");
          router.refresh();
        }
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishToggle() {
    if (!brochure) return;
    setError(null);
    setOk(null);
    setPublishing(true);
    try {
      const res = brochure.isPublished
        ? await unpublishBrochure(brochure.id)
        : await publishBrochure(brochure.id);
      if (res.success) {
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      {(error || ok) && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-sm ${
            error
              ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40"
          }`}
        >
          {error || ok}
        </div>
      )}

      {/* Basics */}
      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
          <CardDescription>Title, slug and the venue/event this microsite represents.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Title *">
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} />
          </Field>
          <Field label="Slug" hint="Public link: /v/<slug>. Leave blank to auto-generate.">
            <Input
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="grand-ballroom"
            />
          </Field>
          <Field label="Subtitle">
            <Input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} maxLength={200} />
          </Field>
          <Field label="Venue">
            <Select value={form.venueId} onValueChange={(v) => set("venueId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a venue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VENUE}>No venue (event-type variant)</SelectItem>
                {options.venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Event type" hint="Optional — for an event-type-scoped variant.">
            <Input
              value={form.eventType}
              onChange={(e) => set("eventType", e.target.value)}
              placeholder="Wedding"
            />
          </Field>
          <Field label="SEO description">
            <Textarea
              value={form.seoDescription}
              onChange={(e) => set("seoDescription", e.target.value)}
              rows={2}
              maxLength={320}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Media */}
      <Card>
        <CardHeader>
          <CardTitle>Media</CardTitle>
          <CardDescription>
            Hero image plus optional video / 360° tour (YouTube, Vimeo or Matterport links only).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Hero image URL">
            <Input
              value={form.heroImageUrl}
              onChange={(e) => set("heroImageUrl", e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field label="Video embed URL" hint="YouTube or Vimeo link.">
            <Input
              value={form.videoEmbedUrl}
              onChange={(e) => set("videoEmbedUrl", e.target.value)}
              placeholder="https://youtu.be/…"
            />
          </Field>
          <Field label="360° tour URL" hint="Matterport / Vimeo link.">
            <Input
              value={form.tour360Url}
              onChange={(e) => set("tour360Url", e.target.value)}
              placeholder="https://my.matterport.com/show/…"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Pricing + CTAs */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing &amp; CTAs</CardTitle>
          <CardDescription>Starting-from teaser and the buttons surfaced to prospects.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Starting from (₹)" hint="Display only — never used in payment math.">
            <Input
              value={form.startingFromAmount}
              onChange={(e) => set("startingFromAmount", e.target.value)}
              inputMode="decimal"
              placeholder="150000"
            />
          </Field>
          <Field label="WhatsApp number" hint="Required for the WhatsApp CTA.">
            <Input
              value={form.whatsappNumber}
              onChange={(e) => set("whatsappNumber", e.target.value)}
              placeholder="+9198XXXXXXXX"
            />
          </Field>
          <div className="sm:col-span-2">
            <Label className="mb-2 block">Enabled CTAs</Label>
            <div className="flex flex-wrap gap-2">
              {CTA_OPTIONS.map((c) => {
                const active = form.enabledCtas.includes(c.value);
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggleArray("enabledCtas", c.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                        : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {c.label}
                    {c.needsVenue && form.venueId === NO_VENUE && active ? " (needs venue)" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Curated gallery */}
      <Card>
        <CardHeader>
          <CardTitle>Gallery ({form.galleryItemIds.length})</CardTitle>
          <CardDescription>Select public photos to feature. Only approved/public items appear live.</CardDescription>
        </CardHeader>
        <CardContent>
          {options.galleryItems.length === 0 ? (
            <p className="text-sm text-zinc-500">No public gallery items available.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {options.galleryItems.map((g) => {
                const selected = form.galleryItemIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleArray("galleryItemIds", g.id)}
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                      selected ? "border-violet-500 ring-2 ring-violet-300" : "border-transparent"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.thumbnailUrl || g.url}
                      alt={g.title || "Gallery item"}
                      className="h-full w-full object-cover"
                    />
                    {selected && (
                      <span className="absolute right-1 top-1 rounded-full bg-violet-600 px-1.5 text-meta font-bold text-white">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Curated reviews */}
      <Card>
        <CardHeader>
          <CardTitle>Testimonials ({form.reviewIds.length})</CardTitle>
          <CardDescription>Select approved reviews to feature. First-name only is shown publicly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {options.reviews.length === 0 ? (
            <p className="text-sm text-zinc-500">No approved reviews available.</p>
          ) : (
            options.reviews.map((r) => {
              const selected = form.reviewIds.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleArray("reviewIds", r.id)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selected
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                      : "border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  <div className="flex shrink-0 gap-0.5 pt-0.5">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <div className="min-w-0">
                    {r.title && <p className="text-sm font-medium">{r.title}</p>}
                    <p className="line-clamp-2 text-xs text-zinc-500">{r.content}</p>
                    <p className="mt-1 text-meta text-zinc-400">— {r.authorFirstName}</p>
                  </div>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Save / publish bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/70 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          {!isNew &&
            (brochure!.isPublished ? (
              <Badge variant="success">Published</Badge>
            ) : (
              <Badge variant="secondary">Draft</Badge>
            ))}
          {!isNew && (
            <div className="flex items-center gap-2">
              <Switch
                checked={brochure!.isPublished}
                disabled={!canManage || publishing}
                onCheckedChange={handlePublishToggle}
              />
              <span className="text-sm text-zinc-600 dark:text-zinc-300">
                {brochure!.isPublished ? "Live at /v/" + brochure!.slug : "Publish"}
              </span>
            </div>
          )}
        </div>
        <Button onClick={handleSave} disabled={!canManage || saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {isNew ? "Create brochure" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
