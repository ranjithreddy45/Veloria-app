"use client";

// ============================================================
// Settings → Business contact form. Validates with the same rules the server
// action applies (../_lib/contact-rules), and shows what customers see right
// now — including numbers that still come from the server env fallback.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveBusinessProfile, type BusinessContactSettings } from "@/actions/business-profile.actions";
import type { ContactSource } from "@/lib/public/business-contact";
import { ContactLinks } from "@/app/(guest)/_components/contact-links";
import { formatIstDate } from "../../customer-content/_lib/content-rules";
import {
  BUSINESS_PROFILE_FIELDS,
  formatPhoneForDisplay,
  normalizePhoneNumber,
  validateBusinessProfileInput,
  type BusinessProfileField,
  type FieldErrors,
} from "../_lib/contact-rules";

type Values = Record<BusinessProfileField, string>;

interface FieldDef {
  key: BusinessProfileField;
  label: string;
  help: string;
  placeholder: string;
  multiline?: boolean;
  type?: "text" | "tel" | "email" | "url";
}

const CHANNEL_FIELDS: FieldDef[] = [
  {
    key: "phone",
    label: "Phone for calls",
    help: "Indian number. Landlines need the STD code; 1800/1860 toll-free numbers are fine.",
    placeholder: "e.g. +91 98765 43210",
    type: "tel",
  },
  {
    key: "whatsapp",
    label: "WhatsApp number",
    help: "The Indian number your WhatsApp account is on. The customer app's WhatsApp button opens a chat with it.",
    placeholder: "e.g. +91 98765 43210",
    type: "tel",
  },
  {
    key: "email",
    label: "Email",
    help: "Offered as an Email button on the customer Help screen.",
    placeholder: "name@example.com",
    type: "email",
  },
  {
    key: "supportHours",
    label: "Team hours",
    help: "When your team answers calls and WhatsApp, shown exactly as written. The callback form uses it instead of promising a time; leave it empty and no time is promised.",
    placeholder: "e.g. Mon–Sat, 10 am – 7 pm",
  },
];

const PLACE_FIELDS: FieldDef[] = [
  {
    key: "displayName",
    label: "Business name",
    help: "Shown above the contact options on the customer Help screen.",
    placeholder: "The name customers know you by",
  },
  {
    key: "address",
    label: "Address",
    help: "Shown on the customer Help screen. Each hall can also have its own address under Settings → Venues.",
    placeholder: "Street, area, city, PIN",
    multiline: true,
  },
  {
    key: "mapUrl",
    label: "Google Maps link",
    help: "In Google Maps: Share → Copy link.",
    placeholder: "https://maps.app.goo.gl/…",
    type: "url",
  },
];

function toValues(profile: BusinessContactSettings["profile"]): Values {
  return Object.fromEntries(
    BUSINESS_PROFILE_FIELDS.map((field) => {
      const v = profile?.[field] ?? "";
      return [field, (field === "phone" || field === "whatsapp") && v ? formatPhoneForDisplay(v) : v];
    })
  ) as Values;
}

function SourceBadge({ source }: { source: ContactSource }) {
  if (source === "settings") {
    return (
      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        From this page
      </Badge>
    );
  }
  if (source === "env") {
    return (
      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
        Server fallback
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Hidden
    </Badge>
  );
}

export function BusinessContactForm({ profile, live }: BusinessContactSettings) {
  const router = useRouter();
  const [values, setValues] = React.useState<Values>(() => toValues(profile));
  const [errors, setErrors] = React.useState<FieldErrors<BusinessProfileField>>({});
  const [saving, setSaving] = React.useState(false);

  function update(field: BusinessProfileField, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function checkField(field: BusinessProfileField) {
    const r = validateBusinessProfileInput(values);
    setErrors((e) => ({ ...e, [field]: r.ok ? undefined : r.errors[field] }));
  }

  /** "Will be saved as +91 80123 45678" when a typed number is understood differently from how it reads. */
  function savedAs(field: BusinessProfileField): string | null {
    if (field !== "phone" && field !== "whatsapp") return null;
    const r = normalizePhoneNumber(values[field], field);
    if (!r.ok || !r.value) return null;
    const shown = formatPhoneForDisplay(r.value);
    return shown !== values[field].trim() ? shown : null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const check = validateBusinessProfileInput(values);
    if (!check.ok) {
      setErrors(check.errors);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const res = await saveBusinessProfile(values);
      if (!res.success) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
        return;
      }
      if (!res.data.changed) {
        toast.info("No changes to save.");
        return;
      }
      setValues(
        toValues({ ...check.data, id: profile?.id ?? "", updatedAt: res.data.updatedAt ?? "", updatedByName: null })
      );
      toast.success("Saved. Customer screens now show these details.");
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function renderField(def: FieldDef) {
    const id = `business-contact-${def.key}`;
    const error = errors[def.key];
    const hint = savedAs(def.key);
    const common = {
      id,
      value: values[def.key],
      placeholder: def.placeholder,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": `${id}-note`,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(def.key, e.target.value),
      onBlur: () => checkField(def.key),
    };
    return (
      <div key={def.key} className="space-y-1.5">
        <Label htmlFor={id}>{def.label}</Label>
        {def.multiline ? (
          <Textarea rows={3} {...common} />
        ) : (
          <Input type={def.type ?? "text"} inputMode={def.type === "tel" ? "tel" : undefined} {...common} />
        )}
        <p id={`${id}-note`} className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {error ?? (hint ? `Will be saved as ${hint}` : def.help)}
        </p>
      </div>
    );
  }

  const c = live.contact;
  const liveRows: { label: string; value: string | null; source: ContactSource }[] = [
    { label: "Phone", value: c.phone ? formatPhoneForDisplay(c.phone) : null, source: live.sources.phone },
    { label: "WhatsApp", value: c.whatsapp ? formatPhoneForDisplay(c.whatsapp) : null, source: live.sources.whatsapp },
    { label: "Email", value: c.email, source: c.email ? "settings" : null },
    { label: "Team hours", value: c.supportHours, source: c.supportHours ? "settings" : null },
    { label: "Address", value: c.address, source: c.address ? "settings" : null },
    { label: "Map link", value: c.mapUrl, source: c.mapUrl ? "settings" : null },
  ];
  const usesFallback = live.sources.phone === "env" || live.sources.whatsapp === "env";
  const hasButtons = Boolean(c.phone || c.whatsapp || c.email);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How customers reach you</CardTitle>
            <CardDescription>Leave a field empty to hide that option from customers. Nothing is filled in for you.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">{CHANNEL_FIELDS.map(renderField)}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Name and location</CardTitle>
            <CardDescription>Shown on the customer Help screen.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">{PLACE_FIELDS.map(renderField)}</CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {profile
              ? `Last saved ${formatIstDate(profile.updatedAt, { withTime: true })}${profile.updatedByName ? ` by ${profile.updatedByName}` : ""}. Every save is recorded in the Activity Log.`
              : "Not saved yet."}
          </p>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </Button>
        </div>
      </form>

      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle className="text-base">What customers see now</CardTitle>
          <CardDescription>The saved details, as the customer app shows them.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-[#f3f0ec] p-3">
            {hasButtons ? (
              <ContactLinks contact={c} withEmail />
            ) : (
              <p className="px-2 py-3 text-center text-[13px] text-[#6e6e73]">
                No contact buttons. Customers are told the contact details aren&apos;t published yet.
              </p>
            )}
          </div>
          <dl className="space-y-3 text-sm">
            {liveRows.map((row) => (
              <div key={row.label}>
                <dt className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span>{row.label}</span>
                  <SourceBadge source={row.source} />
                </dt>
                <dd className="mt-0.5 whitespace-pre-line break-words font-medium">{row.value ?? "—"}</dd>
              </div>
            ))}
          </dl>
          {usesFallback && (
            <p className="text-xs text-muted-foreground">
              &ldquo;Server fallback&rdquo; numbers come from the server&apos;s NEXT_PUBLIC_COMPANY_PHONE / NEXT_PUBLIC_COMPANY_WHATSAPP
              settings because that field is empty here. Save a number on this page to replace it.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
