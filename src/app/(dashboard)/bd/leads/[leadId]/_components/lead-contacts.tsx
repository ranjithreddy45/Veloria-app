"use client";

// ============================================================
// Contacts on a lead — every person the team works this property through, each
// shown with the role they play (item 1). The lead's own ownerName/mobilePrimary
// stays the headline contact; this panel is the rest of the cast.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Phone, Pencil, Plus, Star, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/shared/status-pill";
import {
  ACQ_CONTACT_DESIGNATION,
  ACQ_CONTACT_DESIGNATION_LABEL,
} from "@/lib/acq/constants";
import {
  addAcqLeadContact,
  updateAcqLeadContact,
  deleteAcqLeadContact,
} from "@/actions/acq-lead-contact.actions";

export interface AcqLeadContactRow {
  id: string;
  name: string;
  designation: string;
  designationOther?: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary: boolean;
  notes?: string | null;
}

/** Digits only, for a tel: link — same helper the header call button uses. */
function dial(raw: string): string {
  return (raw || "").replace(/[^\d]/g, "");
}

function roleLabel(c: AcqLeadContactRow): string {
  if (c.designation === "OTHER") return c.designationOther?.trim() || "Other";
  return (
    (ACQ_CONTACT_DESIGNATION_LABEL as Record<string, string>)[c.designation] ??
    c.designation.replaceAll("_", " ")
  );
}

export function LeadContacts({
  leadId,
  contacts,
  canWrite,
}: {
  leadId: string;
  contacts: AcqLeadContactRow[];
  canWrite: boolean;
}) {
  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AcqLeadContactRow | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-copy">
          <Users className="size-4 text-primary" /> Contacts
        </CardTitle>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" /> Add contact
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {contacts.length === 0 ? (
          <p className="py-2 text-body text-muted-foreground">
            No extra contacts yet — add the co-owner, manager, accountant or broker you deal with.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {contacts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body font-medium text-foreground">{c.name}</span>
                    {/* Role reads as prominently as the name — it's the whole point. */}
                    <StatusPill label={roleLabel(c)} hue="indigo" size="xs" />
                    {c.isPrimary && (
                      <span className="inline-flex items-center gap-1 text-meta font-medium text-primary">
                        <Star className="size-3 fill-current" /> Primary
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-detail">
                    {c.phone && (
                      <a
                        href={`tel:+${dial(c.phone)}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Phone className="size-3" /> {c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Mail className="size-3" /> {c.email}
                      </a>
                    )}
                  </div>
                  {c.notes && <p className="text-detail text-muted-foreground">{c.notes}</p>}
                </div>
                {canWrite && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="xs" variant="ghost" onClick={() => setEditing(c)}>
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                    <DeleteContactButton contact={c} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ContactDialog
        leadId={leadId}
        contact={null}
        open={addOpen}
        onOpenChange={setAddOpen}
        isFirst={contacts.length === 0}
      />
      <ContactDialog
        leadId={leadId}
        contact={editing}
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        isFirst={false}
      />
    </Card>
  );
}

function DeleteContactButton({ contact }: { contact: AcqLeadContactRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function confirm() {
    setBusy(true);
    try {
      const res = await deleteAcqLeadContact(contact.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Contact removed");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Couldn't remove — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        size="xs"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {contact.name}?</DialogTitle>
            <DialogDescription>
              They&apos;ll be removed from this lead&apos;s contact list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={busy}>
              {busy ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ContactForm {
  name: string;
  designation: string;
  designationOther: string;
  phone: string;
  email: string;
  notes: string;
  isPrimary: boolean;
}

function toForm(c: AcqLeadContactRow | null, isFirst: boolean): ContactForm {
  return {
    name: c?.name ?? "",
    designation: c?.designation ?? ACQ_CONTACT_DESIGNATION[0],
    designationOther: c?.designationOther ?? "",
    phone: c?.phone ?? "",
    email: c?.email ?? "",
    notes: c?.notes ?? "",
    // The first person captured is the one to call by default (the server
    // enforces the same rule, so an unticked first contact still lands primary).
    isPrimary: c?.isPrimary ?? isFirst,
  };
}

function ContactDialog({
  leadId,
  contact,
  open,
  onOpenChange,
  isFirst,
}: {
  leadId: string;
  contact: AcqLeadContactRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isFirst: boolean;
}) {
  const router = useRouter();
  const [f, setF] = React.useState<ContactForm>(() => toForm(contact, isFirst));
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setF(toForm(contact, isFirst));
  }, [open, contact, isFirst]);

  function set<K extends keyof ContactForm>(k: K, v: ContactForm[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  const needsOther = f.designation === "OTHER";
  const valid = f.name.trim().length > 0 && (!needsOther || f.designationOther.trim().length > 0);

  async function save() {
    if (!valid) return;
    setBusy(true);
    try {
      const payload = {
        name: f.name.trim(),
        designation: f.designation as (typeof ACQ_CONTACT_DESIGNATION)[number],
        designationOther: needsOther ? f.designationOther.trim() : "",
        phone: f.phone.trim(),
        email: f.email.trim(),
        notes: f.notes.trim(),
        isPrimary: f.isPrimary,
      };
      const res = contact
        ? await updateAcqLeadContact(contact.id, payload)
        : await addAcqLeadContact(leadId, payload);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(contact ? "Contact updated" : "Contact added");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Couldn't save — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "Add contact"}</DialogTitle>
          <DialogDescription>
            Who they are and the role they play for this property.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 text-body sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-detail">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ramesh Kumar" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-detail">Designation / role</Label>
            <Select value={f.designation} onValueChange={(v) => set("designation", v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACQ_CONTACT_DESIGNATION.map((d) => (
                  <SelectItem key={d} value={d}>
                    {ACQ_CONTACT_DESIGNATION_LABEL[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsOther && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-detail">
                Describe the role <span className="text-destructive">*</span>
              </Label>
              <Input
                value={f.designationOther}
                onChange={(e) => set("designationOther", e.target.value)}
                placeholder="e.g. Estate lawyer"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-detail">Phone</Label>
            <Input
              value={f.phone}
              onChange={(e) => set("phone", e.target.value)}
              inputMode="tel"
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-detail">Email</Label>
            <Input
              type="email"
              value={f.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="person@example.com"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-detail">Notes</Label>
            <Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 sm:col-span-2">
            <Checkbox
              checked={f.isPrimary}
              onCheckedChange={(v) => set("isPrimary", v === true)}
            />
            <span>
              Primary contact
              <span className="ml-1 text-muted-foreground">— the main person to call</span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !valid}>
            {busy ? "Saving…" : contact ? "Save contact" : "Add contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
