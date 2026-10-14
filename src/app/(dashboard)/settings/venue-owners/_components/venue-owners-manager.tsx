"use client";

// ============================================================
// Settings → Venue owners: the owner list, the invite dialog, the venue
// picker, the invite-link dialog (copy / WhatsApp) and on/off confirmations.
// ------------------------------------------------------------
// Invite links are only ever shown right after they are made: the server
// keeps a hash, not the link. Links made on this visit are remembered here so
// "Invite link" can show them again until the page is left; after that the
// admin generates a fresh one (which retires the old link).
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  Check,
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  inviteVenueOwner,
  regenerateVenueOwnerInvite,
  revokeVenueOwnerInvite,
  setVenueOwnerActive,
  setVenueOwnerVenues,
} from "@/actions/venue-owner.actions";
import {
  OWNER_INVITE_DAYS,
  OWNER_STATUS_META,
  ownerInviteMessage,
  ownerStatus,
  validateOwnerInvite,
  whatsAppShareUrl,
  type VenueOwnerRow,
  type VenueOwnerVenueOption,
  type VenueOwnersData,
} from "@/lib/venue-owner/admin-rules";

/** Who an invite link is for. Kept apart from VenueOwnerRow so the dialog can
 * open for an owner created a moment ago, before the refreshed list arrives. */
interface LinkTarget {
  userId: string;
  name: string | null;
  email: string;
  whatsappPhone: string | null;
}

type ConfirmKind = "deactivate" | "reactivate" | "revoke";

// Fixed zone so the server render and the browser agree.
const SHORT_DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

function displayName(owner: { name: string | null; email: string }): string {
  return owner.name?.trim() || owner.email;
}

function inviteDetail(owner: VenueOwnerRow): string {
  if (owner.inviteState === "live" && owner.inviteExpiresAt) {
    return `Link valid till ${SHORT_DATE.format(new Date(owner.inviteExpiresAt))}`;
  }
  if (owner.inviteState === "expired") return "Link expired";
  return "No live link";
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Manager
// ============================================================

export function VenueOwnersManager({ owners, venues }: VenueOwnersData) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  // Bumped on every open so the invite form starts empty (fresh component state).
  const [inviteKey, setInviteKey] = React.useState(0);
  const [venuesFor, setVenuesFor] = React.useState<VenueOwnerRow | null>(null);
  const [linkFor, setLinkFor] = React.useState<LinkTarget | null>(null);
  const [links, setLinks] = React.useState<Record<string, string>>({});
  const [confirm, setConfirm] = React.useState<{ owner: VenueOwnerRow; kind: ConfirmKind } | null>(null);

  const counts = React.useMemo(() => {
    let active = 0;
    let pending = 0;
    for (const o of owners) {
      const s = ownerStatus(o);
      if (s === "active") active += 1;
      else if (s === "pending") pending += 1;
    }
    return { active, pending };
  }, [owners]);

  function openInvite() {
    setInviteKey((k) => k + 1);
    setInviteOpen(true);
  }

  function rememberLink(userId: string, url: string) {
    setLinks((prev) => ({ ...prev, [userId]: url }));
  }

  function openLink(owner: VenueOwnerRow) {
    setLinkFor({ userId: owner.id, name: owner.name, email: owner.email, whatsappPhone: owner.whatsappPhone });
  }

  return (
    <div className="space-y-6">
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-copy font-semibold text-foreground">Owner logins</h2>
            <p className="mt-0.5 text-detail text-muted-foreground">
              {owners.length === 0
                ? "No owners yet"
                : `${owners.length} ${owners.length === 1 ? "owner" : "owners"} · ${counts.active} active · ${counts.pending} invite${counts.pending === 1 ? "" : "s"} pending`}
            </p>
          </div>
          <Button onClick={openInvite} className="gap-1.5" disabled={venues.length === 0}>
            <Plus className="size-4" /> Invite owner
          </Button>
        </div>

        {owners.length === 0 ? (
          <EmptyState
            icon={<Building2 />}
            title="No venue owners yet"
            description={
              venues.length === 0
                ? "Add a venue in Settings → Venues first, then invite its owner."
                : "Invite an owner to give them a read-only view of lead and booking counts for their venue."
            }
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {owners.map((owner) => (
              <OwnerItem
                key={owner.id}
                owner={owner}
                onEditVenues={() => setVenuesFor(owner)}
                onLink={() => openLink(owner)}
                onConfirm={(kind) => setConfirm({ owner, kind })}
              />
            ))}
          </ul>
        )}
      </Card>

      <VisibilityNote />

      <InviteDialog
        key={inviteKey}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        venues={venues}
        onInvited={(target, url, existing) => {
          setInviteOpen(false);
          router.refresh();
          if (url) {
            rememberLink(target.userId, url);
            setLinkFor(target);
            toast.success(existing ? "Venues added and a fresh invite link created." : "Owner invited. Share the link below.");
          } else {
            toast.success(`Venues added. ${displayName(target)} already has a login, so no new link is needed.`);
          }
        }}
      />

      {venuesFor && (
        <VenuesDialog
          key={venuesFor.id}
          owner={venuesFor}
          venues={venues}
          onClose={() => setVenuesFor(null)}
          onSaved={() => {
            setVenuesFor(null);
            router.refresh();
          }}
        />
      )}

      {linkFor && (
        <LinkDialog
          key={linkFor.userId}
          target={linkFor}
          url={links[linkFor.userId] ?? null}
          onClose={() => setLinkFor(null)}
          onGenerated={(url) => {
            rememberLink(linkFor.userId, url);
            router.refresh();
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          key={`${confirm.owner.id}:${confirm.kind}`}
          owner={confirm.owner}
          kind={confirm.kind}
          onClose={() => setConfirm(null)}
          onDone={() => {
            if (confirm.kind === "revoke") {
              setLinks((prev) => {
                const next = { ...prev };
                delete next[confirm.owner.id];
                return next;
              });
            }
            setConfirm(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// One owner row
// ============================================================

function OwnerItem({
  owner,
  onEditVenues,
  onLink,
  onConfirm,
}: {
  owner: VenueOwnerRow;
  onEditVenues: () => void;
  onLink: () => void;
  onConfirm: (kind: ConfirmKind) => void;
}) {
  const status = ownerStatus(owner);
  const meta = OWNER_STATUS_META[status];
  const name = displayName(owner);

  return (
    <li className="flex items-start gap-3 px-4 py-4 sm:px-6">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 break-words text-body font-semibold text-foreground">{name}</p>
          <StatusPill label={meta.label} hue={meta.hue} size="xs" />
          {status === "pending" && <span className="text-meta text-muted-foreground">{inviteDetail(owner)}</span>}
        </div>
        <p className="break-all text-detail text-muted-foreground">
          {owner.email}
          {owner.phone ? ` · ${owner.phone}` : ""}
        </p>
        {owner.venues.length === 0 ? (
          <p className="text-detail text-amber-700 dark:text-amber-300">No venues — their portal is empty.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5" aria-label="Venues">
            {owner.venues.map((v) => (
              <li
                key={v.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-meta font-medium text-foreground/80"
              >
                <Building2 className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{v.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label={`Actions for ${name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {status === "pending" && (
            <DropdownMenuItem onClick={onLink}>
              <Link2 className="size-4" /> Invite link
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onEditVenues}>
            <Building2 className="size-4" /> Edit venues
          </DropdownMenuItem>
          {status === "pending" && owner.inviteState === "live" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onConfirm("revoke")}>
                <XCircle className="size-4" /> Cancel invite link
              </DropdownMenuItem>
            </>
          )}
          {status === "active" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onConfirm("deactivate")}>
                <UserX className="size-4" /> Deactivate
              </DropdownMenuItem>
            </>
          )}
          {status === "deactivated" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onConfirm("reactivate")}>
                <UserCheck className="size-4" /> Reactivate
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

// ============================================================
// What an owner sees (and never sees)
// ============================================================

function VisibilityNote() {
  return (
    <Card className="gap-4 px-4 py-5 sm:px-6">
      <h2 className="text-copy font-semibold text-foreground">What an owner sees</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-meta font-semibold uppercase tracking-[0.06em] text-emerald-700 dark:text-emerald-300">Shown</p>
          <ul className="list-disc space-y-1 pl-4 text-detail text-muted-foreground">
            <li>Lead and booking counts for their venues</li>
            <li>A calendar of how many events fall on each date</li>
            <li>Per event: the slot, event type and guest count</li>
          </ul>
        </div>
        <div className="space-y-1.5">
          <p className="text-meta font-semibold uppercase tracking-[0.06em] text-muted-foreground">Never shown</p>
          <ul className="list-disc space-y-1 pl-4 text-detail text-muted-foreground">
            <li>Customer names, phone numbers, emails or addresses</li>
            <li>Notes, event names or record numbers</li>
            <li>Any price, payment or revenue figure</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Venue checklist (invite + edit)
// ============================================================

function VenueChecklist({
  venues,
  selected,
  onChange,
  disabled,
}: {
  venues: VenueOwnerVenueOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(id: string, on: boolean) {
    onChange(on ? (selected.includes(id) ? selected : [...selected, id]) : selected.filter((v) => v !== id));
  }

  if (venues.length === 0) {
    return <p className="rounded-xl border border-dashed px-3 py-4 text-center text-detail text-muted-foreground">No venues set up yet.</p>;
  }

  return (
    <ul className="max-h-64 divide-y divide-border/60 overflow-y-auto overscroll-contain rounded-xl border border-border/70">
      {venues.map((v) => {
        const id = `venue-${v.id}`;
        return (
          <li key={v.id}>
            <label htmlFor={id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
              <Checkbox
                id={id}
                checked={selected.includes(v.id)}
                onCheckedChange={(state) => toggle(v.id, state === true)}
                disabled={disabled}
              />
              <span className="min-w-0 flex-1 truncate text-body">{v.name}</span>
              {!v.isActive && <span className="shrink-0 text-meta text-muted-foreground">Inactive</span>}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

// ============================================================
// Invite dialog
// ============================================================

function InviteDialog({
  open,
  onOpenChange,
  venues,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venues: VenueOwnerVenueOption[];
  onInvited: (target: LinkTarget, url: string | null, existing: boolean) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [venueIds, setVenueIds] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = { name, email, phone, venueIds };
    const checked = validateOwnerInvite(input);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await inviteVenueOwner(input);
      if (!res.success) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      onInvited(
        { userId: res.data.userId, name: checked.value.name, email: checked.value.email, whatsappPhone: res.data.whatsappPhone },
        res.data.inviteUrl,
        res.data.existing
      );
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Invite a venue owner</DialogTitle>
            <DialogDescription className="text-body">
              We create their login and give you a link to send them. They set their own password, then see only lead
              and booking counts for the venues you tick.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="owner-name">Name</Label>
            <Input id="owner-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" disabled={pending} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="owner-email">Email</Label>
            <Input
              id="owner-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              disabled={pending}
            />
            <p className="text-meta text-muted-foreground">This is their sign-in. No email is sent.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="owner-phone">
              Mobile <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="owner-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              autoComplete="off"
              disabled={pending}
            />
            <p className="text-meta text-muted-foreground">Lets you send the link straight to their WhatsApp.</p>
          </div>
          <div className="grid gap-1.5">
            <Label>Venues they can see</Label>
            <VenueChecklist venues={venues} selected={venueIds} onChange={setVenueIds} disabled={pending} />
          </div>

          {error && (
            <p role="alert" className="text-detail text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="gap-1.5">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Invite owner
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Edit venues dialog
// ============================================================

function VenuesDialog({
  owner,
  venues,
  onClose,
  onSaved,
}: {
  owner: VenueOwnerRow;
  venues: VenueOwnerVenueOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [venueIds, setVenueIds] = React.useState<string[]>(() => owner.venues.map((v) => v.id));
  const [error, setError] = React.useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setVenueOwnerVenues({ userId: owner.id, venueIds });
      if (!res.success) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.venueCount === 0
          ? `${displayName(owner)} now sees no venues.`
          : `Saved. ${displayName(owner)} sees ${res.data.venueCount} ${res.data.venueCount === 1 ? "venue" : "venues"}.`
      );
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Venues for {displayName(owner)}</DialogTitle>
          <DialogDescription className="text-body">
            Their portal shows counts for exactly these venues. A venue you untick disappears from it straight away.
          </DialogDescription>
        </DialogHeader>
        <VenueChecklist venues={venues} selected={venueIds} onChange={setVenueIds} disabled={pending} />
        {venueIds.length === 0 && (
          <p className="text-detail text-amber-700 dark:text-amber-300">
            With no venues ticked, they can still sign in but their portal is empty.
          </p>
        )}
        {error && (
          <p role="alert" className="text-detail text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending} className="gap-1.5">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save venues
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Invite link dialog: copy, WhatsApp, regenerate
// ============================================================

function LinkDialog({
  target,
  url,
  onClose,
  onGenerated,
}: {
  target: LinkTarget;
  url: string | null;
  onClose: () => void;
  onGenerated: (url: string) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [copied, setCopied] = React.useState(false);
  const name = displayName(target);

  function generate() {
    startTransition(async () => {
      const res = await regenerateVenueOwnerInvite(target.userId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setCopied(false);
      onGenerated(res.data.inviteUrl);
      toast.success("New link ready. Any earlier link no longer works.");
    });
  }

  async function copy() {
    if (!url) return;
    if (await copyText(url)) {
      setCopied(true);
      toast.success("Link copied");
    } else {
      toast.error("Couldn't copy. Select the link and copy it yourself.");
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite link for {name}</DialogTitle>
          <DialogDescription className="text-body">
            {url
              ? `Send this to ${name}. It works once, expires in ${OWNER_INVITE_DAYS} days, and lets them set their password. No email is sent.`
              : "For security only a fingerprint of each link is kept, so an earlier link can't be shown again. Create a new one to send — any earlier link stops working."}
          </DialogDescription>
        </DialogHeader>

        {url ? (
          <div className="grid gap-3">
            <div className="flex min-w-0 gap-2">
              <Input
                value={url}
                readOnly
                aria-label="Invite link"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 font-mono text-detail"
              />
              <Button type="button" variant="outline" onClick={copy} className="shrink-0 gap-1.5">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button asChild variant="outline" className="w-full gap-1.5">
              <a href={whatsAppShareUrl(ownerInviteMessage(target.name, url), target.whatsappPhone)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" />
                {target.whatsappPhone ? `Send on WhatsApp to ${name}` : "Share on WhatsApp"}
              </a>
            </Button>
          </div>
        ) : null}

        <DialogFooter>
          {url ? (
            <>
              <Button type="button" variant="ghost" onClick={generate} disabled={pending} className="gap-1.5">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} New link
              </Button>
              <Button type="button" onClick={onClose} disabled={pending}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="button" onClick={generate} disabled={pending} className="gap-1.5">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Create link
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Confirmations: deactivate / reactivate / cancel link
// ============================================================

const CONFIRM_COPY: Record<ConfirmKind, { title: (n: string) => string; body: string; action: string; done: (n: string) => string }> = {
  deactivate: {
    title: (n) => `Deactivate ${n}?`,
    body: "They're signed out within five minutes and can't sign in again until you reactivate them. Their venues stay as they are.",
    action: "Deactivate",
    done: (n) => `${n} is deactivated.`,
  },
  reactivate: {
    title: (n) => `Reactivate ${n}?`,
    body: "They can sign in again with their existing password and see their venues' counts.",
    action: "Reactivate",
    done: (n) => `${n} can sign in again.`,
  },
  revoke: {
    title: (n) => `Cancel ${n}'s invite link?`,
    body: "The link stops working straight away. You can create a new one at any time.",
    action: "Cancel link",
    done: () => "Invite link cancelled.",
  },
};

function ConfirmDialog({
  owner,
  kind,
  onClose,
  onDone,
}: {
  owner: VenueOwnerRow;
  kind: ConfirmKind;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const copy = CONFIRM_COPY[kind];
  const name = displayName(owner);

  function run(e: React.MouseEvent) {
    // Keep the dialog open until the server answers.
    e.preventDefault();
    startTransition(async () => {
      const res =
        kind === "revoke"
          ? await revokeVenueOwnerInvite(owner.id)
          : await setVenueOwnerActive({ userId: owner.id, active: kind === "reactivate" });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(copy.done(name));
      onDone();
    });
  }

  return (
    <AlertDialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title(name)}</AlertDialogTitle>
          <AlertDialogDescription className="text-body">{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep as is</AlertDialogCancel>
          <AlertDialogAction
            onClick={run}
            disabled={pending}
            variant={kind === "reactivate" ? "default" : "destructive"}
            className="gap-1.5"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {copy.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
