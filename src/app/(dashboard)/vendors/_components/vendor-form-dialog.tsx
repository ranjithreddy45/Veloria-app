"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  VENDOR_EMPANELMENT_STATUSES,
  VENDOR_TYPE_OPTIONS,
} from "@/lib/constants";
import {
  createCatalogVendor,
  updateCatalogVendor,
  type VendorCatalogInput,
} from "@/actions/vendor-catalog.actions";
import type { CategoryOption, VenueOption } from "./vendor-module";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// Types
// ============================================================

type ExistingVendor = {
  id: string;
  name: string;
  categories: string[];
  city: string | null;
  email: string | null;
  phone: string | null;
  empanelmentStatus: string | null;
  vendorType?: string | null;
  venueIds?: string[];
  allVenues?: boolean;
  // optional — only present if vendor-catalog action returns them
  contactPerson?: string | null;
  keyPersonnel?: { name: string; role?: string }[];
  licences?: { type: string; number?: string; expiry?: string }[];
  notes?: string | null;
};

interface VendorFormDialogProps {
  vendor?: ExistingVendor;
  categories: CategoryOption[];
  venues: VenueOption[];
  trigger: React.ReactNode;
}

interface KeyPersonRow {
  name: string;
  role: string;
}

interface LicenceRow {
  type: string;
  number: string;
  expiry: string;
}

// ============================================================
// Empanelment status labels
// ============================================================

const EMPANELMENT_LABELS: Record<string, string> = {
  empanelled: "Empanelled",
  probation: "Probation",
  suspended: "Suspended",
};

// ============================================================
// Helpers
// ============================================================

function emptyKeyPerson(): KeyPersonRow {
  return { name: "", role: "" };
}

function emptyLicence(): LicenceRow {
  return { type: "", number: "", expiry: "" };
}

// ============================================================
// VendorFormDialog
// ============================================================

export function VendorFormDialog({ vendor, categories, venues, trigger }: VendorFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = useTransition();

  // ── Form state ──
  const [name, setName] = React.useState(vendor?.name ?? "");
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>(
    vendor?.categories ?? []
  );
  const [vendorType, setVendorType] = React.useState<string>(
    vendor?.vendorType ?? "EXTERNAL"
  );
  const [allVenues, setAllVenues] = React.useState<boolean>(
    vendor?.allVenues ?? false
  );
  const [venueIds, setVenueIds] = React.useState<string[]>(
    vendor?.venueIds ?? []
  );
  const [contactPerson, setContactPerson] = React.useState(
    vendor?.contactPerson ?? ""
  );
  const [phone, setPhone] = React.useState(vendor?.phone ?? "");
  const [email, setEmail] = React.useState(vendor?.email ?? "");
  const [city, setCity] = React.useState(vendor?.city ?? "Bengaluru");
  const [empanelmentStatus, setEmpanelmentStatus] = React.useState<string>(
    vendor?.empanelmentStatus ?? "empanelled"
  );
  const [keyPersonnel, setKeyPersonnel] = React.useState<KeyPersonRow[]>(
    vendor?.keyPersonnel?.map((kp) => ({ name: kp.name, role: kp.role ?? "" })) ?? []
  );
  const [licences, setLicences] = React.useState<LicenceRow[]>(
    vendor?.licences?.map((l) => ({
      type: l.type,
      number: l.number ?? "",
      expiry: l.expiry ?? "",
    })) ?? []
  );
  const [notes, setNotes] = React.useState(vendor?.notes ?? "");

  // ── Field errors ──
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // ── Reset on open ──
  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (val) {
      setName(vendor?.name ?? "");
      setSelectedCategories(vendor?.categories ?? []);
      setVendorType(vendor?.vendorType ?? "EXTERNAL");
      setAllVenues(vendor?.allVenues ?? false);
      setVenueIds(vendor?.venueIds ?? []);
      setContactPerson(vendor?.contactPerson ?? "");
      setPhone(vendor?.phone ?? "");
      setEmail(vendor?.email ?? "");
      setCity(vendor?.city ?? "Bengaluru");
      setEmpanelmentStatus(vendor?.empanelmentStatus ?? "empanelled");
      setKeyPersonnel(
        vendor?.keyPersonnel?.map((kp) => ({ name: kp.name, role: kp.role ?? "" })) ?? []
      );
      setLicences(
        vendor?.licences?.map((l) => ({
          type: l.type,
          number: l.number ?? "",
          expiry: l.expiry ?? "",
        })) ?? []
      );
      setNotes(vendor?.notes ?? "");
      setFieldErrors({});
    }
  };

  // ── Category toggle ──
  const toggleCategory = (key: string) => {
    setSelectedCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
    if (fieldErrors.categories) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.categories;
        return next;
      });
    }
  };

  // ── Venue scope helpers ──
  const toggleVenue = (id: string) =>
    setVenueIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );

  // ── Key personnel helpers ──
  const addKeyPerson = () => setKeyPersonnel((p) => [...p, emptyKeyPerson()]);
  const removeKeyPerson = (i: number) =>
    setKeyPersonnel((p) => p.filter((_, idx) => idx !== i));
  const updateKeyPerson = (i: number, field: keyof KeyPersonRow, val: string) =>
    setKeyPersonnel((p) =>
      p.map((row, idx) => (idx === i ? { ...row, [field]: val } : row))
    );

  // ── Licence helpers ──
  const addLicence = () => setLicences((p) => [...p, emptyLicence()]);
  const removeLicence = (i: number) =>
    setLicences((p) => p.filter((_, idx) => idx !== i));
  const updateLicence = (i: number, field: keyof LicenceRow, val: string) =>
    setLicences((p) =>
      p.map((row, idx) => (idx === i ? { ...row, [field]: val } : row))
    );

  // ── Submit ──
  const isValid = name.trim().length > 0 && selectedCategories.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Vendor name is required";
    if (selectedCategories.length === 0) errs.categories = "Select at least one category";
    if (
      email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    )
      errs.email = "Enter a valid email address";

    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    const input: VendorCatalogInput = {
      name: name.trim(),
      categories: selectedCategories,
      vendorType,
      allVenues,
      venueIds: allVenues ? [] : venueIds,
      contactPerson: contactPerson.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      city: city.trim() || "Bengaluru",
      empanelmentStatus,
      keyPersonnel: keyPersonnel
        .filter((kp) => kp.name.trim())
        .map((kp) => ({ name: kp.name.trim(), role: kp.role.trim() || undefined })),
      licences: licences
        .filter((l) => l.type.trim())
        .map((l) => ({
          type: l.type.trim(),
          number: l.number.trim() || undefined,
          expiry: l.expiry || undefined,
        })),
      notes: notes.trim() || null,
    };

    startTransition(async () => {
      const res = vendor
        ? await updateCatalogVendor(vendor.id, input)
        : await createCatalogVendor(input);

      if (!res.success) {
        if ("fields" in res && res.fields) {
          setFieldErrors(res.fields);
        }
        toast.error(res.error ?? "Something went wrong");
        return;
      }

      // R3 — warn if update affected packages whose category is now stale
      if (
        vendor &&
        res.success &&
        "data" in res &&
        res.data &&
        typeof res.data === "object" &&
        "affectedPackages" in res.data &&
        Array.isArray((res.data as { affectedPackages: { name: string }[] }).affectedPackages) &&
        (res.data as { affectedPackages: { name: string }[] }).affectedPackages.length > 0
      ) {
        const names = (res.data as { affectedPackages: { name: string }[] }).affectedPackages
          .map((p) => p.name)
          .join(", ");
        toast.warning(
          `Category change may affect ${(res.data as { affectedPackages: unknown[] }).affectedPackages.length} package(s): ${names}`
        );
      }

      toast.success(vendor ? "Vendor updated" : "Vendor created");
      router.refresh();
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-semibold">
            {vendor ? "Edit vendor" : "Add vendor"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-5">
          {/* ── Vendor name ── */}
          <div className="space-y-1.5">
            <Label htmlFor="vf-name" className="text-[13px] font-medium">
              Vendor name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="vf-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name)
                  setFieldErrors((p) => { const n = { ...p }; delete n.name; return n; });
              }}
              placeholder="e.g. Rangoli Décor Studio"
              className={cn("h-9 text-[13px]", fieldErrors.name && "border-destructive")}
              autoFocus
            />
            {fieldErrors.name && (
              <p className="text-[12px] text-destructive">{fieldErrors.name}</p>
            )}
          </div>

          {/* ── Categories (toggle chips) ── */}
          <div className="space-y-2">
            <Label className="text-[13px] font-medium">
              Categories <span className="text-destructive">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const active = selectedCategories.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleCategory(c.key)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                      active
                        ? "border-violet-400 bg-violet-100 text-violet-700 dark:border-violet-600 dark:bg-violet-950/60 dark:text-violet-300"
                        : "border-border bg-muted/50 text-muted-foreground hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            {fieldErrors.categories && (
              <p className="text-[12px] text-destructive">{fieldErrors.categories}</p>
            )}
          </div>

          {/* ── Vendor type ── */}
          <div className="space-y-1.5">
            <Label htmlFor="vf-type" className="text-[13px] font-medium">
              Vendor type
            </Label>
            <Select value={vendorType} onValueChange={setVendorType}>
              <SelectTrigger id="vf-type" className="h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VENDOR_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t.key} value={t.key} className="text-[13px]">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.vendorType && (
              <p className="text-[12px] text-destructive">{fieldErrors.vendorType}</p>
            )}
          </div>

          {/* ── Venue scope ── */}
          <div className="space-y-2">
            <Label className="text-[13px] font-medium">Assigned venues</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAllVenues(true)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                  allVenues
                    ? "border-violet-400 bg-violet-100 text-violet-700 dark:border-violet-600 dark:bg-violet-950/60 dark:text-violet-300"
                    : "border-border bg-muted/50 text-muted-foreground hover:border-violet-300"
                )}
              >
                All venues
              </button>
              <button
                type="button"
                onClick={() => setAllVenues(false)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                  !allVenues
                    ? "border-violet-400 bg-violet-100 text-violet-700 dark:border-violet-600 dark:bg-violet-950/60 dark:text-violet-300"
                    : "border-border bg-muted/50 text-muted-foreground hover:border-violet-300"
                )}
              >
                Specific venues
              </button>
            </div>

            {!allVenues && (
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-border/70 bg-muted/20 p-2.5">
                {venues.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground/70">No active venues found.</p>
                ) : (
                  venues.map((v) => (
                    <label
                      key={v.id}
                      className="flex cursor-pointer items-center gap-2 text-[12px]"
                    >
                      <Checkbox
                        checked={venueIds.includes(v.id)}
                        onCheckedChange={() => toggleVenue(v.id)}
                      />
                      <span className="text-foreground">{v.name}</span>
                    </label>
                  ))
                )}
              </div>
            )}
            {!allVenues && venueIds.length === 0 && (
              <p className="text-[11px] text-muted-foreground/70">
                Select at least one venue, or switch to "All venues".
              </p>
            )}
          </div>

          <Separator />

          {/* ── Contact details ── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vf-contact" className="text-[13px] font-medium">
                Primary contact
              </Label>
              <Input
                id="vf-contact"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Full name"
                className="h-9 text-[13px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vf-phone" className="text-[13px] font-medium">
                Phone
              </Label>
              <Input
                id="vf-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="h-9 text-[13px] tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vf-email" className="text-[13px] font-medium">
                Email
              </Label>
              <Input
                id="vf-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email)
                    setFieldErrors((p) => { const n = { ...p }; delete n.email; return n; });
                }}
                placeholder="vendor@example.com"
                className={cn("h-9 text-[13px]", fieldErrors.email && "border-destructive")}
              />
              {fieldErrors.email && (
                <p className="text-[12px] text-destructive">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vf-city" className="text-[13px] font-medium">
                City
              </Label>
              <Input
                id="vf-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Bengaluru"
                className="h-9 text-[13px]"
              />
            </div>
          </div>

          {/* ── Empanelment status ── */}
          <div className="space-y-1.5">
            <Label htmlFor="vf-status" className="text-[13px] font-medium">
              Empanelment status
            </Label>
            <Select value={empanelmentStatus} onValueChange={setEmpanelmentStatus}>
              <SelectTrigger id="vf-status" className="h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VENDOR_EMPANELMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-[13px]">
                    {EMPANELMENT_LABELS[s] ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.empanelmentStatus && (
              <p className="text-[12px] text-destructive">{fieldErrors.empanelmentStatus}</p>
            )}
          </div>

          <Separator />

          {/* ── Key personnel ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[13px] font-medium">Key personnel</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-[12px]"
                onClick={addKeyPerson}
              >
                <PlusIcon className="size-3" />
                Add person
              </Button>
            </div>

            {keyPersonnel.length === 0 && (
              <p className="text-[12px] text-muted-foreground/70">No key personnel added.</p>
            )}

            <div className="space-y-2">
              {keyPersonnel.map((kp, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="grid flex-1 grid-cols-2 gap-2">
                    <Input
                      value={kp.name}
                      onChange={(e) => updateKeyPerson(i, "name", e.target.value)}
                      placeholder="Name"
                      className="h-8 text-[12px]"
                    />
                    <Input
                      value={kp.role}
                      onChange={(e) => updateKeyPerson(i, "role", e.target.value)}
                      placeholder="Role (optional)"
                      className="h-8 text-[12px]"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeKeyPerson(i)}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Licences ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[13px] font-medium">Licences &amp; certifications</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-[12px]"
                onClick={addLicence}
              >
                <PlusIcon className="size-3" />
                Add licence
              </Button>
            </div>

            {licences.length === 0 && (
              <p className="text-[12px] text-muted-foreground/70">No licences added.</p>
            )}

            <div className="space-y-2">
              {licences.map((lic, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="grid flex-1 grid-cols-3 gap-2">
                    <Input
                      value={lic.type}
                      onChange={(e) => updateLicence(i, "type", e.target.value)}
                      placeholder="Type"
                      className="h-8 text-[12px]"
                    />
                    <Input
                      value={lic.number}
                      onChange={(e) => updateLicence(i, "number", e.target.value)}
                      placeholder="Number"
                      className="h-8 text-[12px] tabular-nums"
                    />
                    <Input
                      type="date"
                      value={lic.expiry}
                      onChange={(e) => updateLicence(i, "expiry", e.target.value)}
                      className="h-8 text-[12px]"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeLicence(i)}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="space-y-1.5">
            <Label htmlFor="vf-notes" className="text-[13px] font-medium">
              Notes
            </Label>
            <Textarea
              id="vf-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this vendor…"
              rows={3}
              className="resize-none text-[13px]"
            />
          </div>

          {/* ── Footer ── */}
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="text-[13px]"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="min-w-[80px] text-[13px]"
              disabled={!isValid || pending}
            >
              {pending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : vendor ? (
                "Save changes"
              ) : (
                "Create vendor"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
