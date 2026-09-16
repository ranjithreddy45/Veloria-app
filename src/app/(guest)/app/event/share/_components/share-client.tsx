"use client";

import * as React from "react";
import { Copy, Loader2, Share2 } from "lucide-react";
import {
  inviteCollaborator,
  revokeCollaborator,
  type InviteCollaboratorResult,
  type ShareCollaboratorRow,
  type ShareScreenData,
} from "@/actions/guest-collaborators.actions";
import { COLLABORATOR_ROLE_LABEL, COLLABORATOR_STATUS_LABEL, customerLabel } from "@/lib/customer-app/status-labels";
import { COLLABORATOR_ROLES, COLLABORATOR_ROLE_DESCRIPTION, type CollaboratorRole } from "@/lib/customer-app/collaborator-permissions";
import { collaboratorInviteText } from "../_lib/invite-text";
import { Screen, ScreenHeader, Card, Avatar, Pill, SectionTitle, type Tone } from "../../../../_components/ui";
import { initials } from "../../../../_components/format";

// ============================================================
// Share with family — the host invites family or a planner to one booking.
// Rows are BookingCollaborator records: the team sees and can revoke the same
// rows on the booking page. "Sent on WhatsApp" is shown only when WhatsApp
// accepted the message; the share link is always there as the sure route.
// Role and status wording comes from status-labels.ts, like every other screen.
// ============================================================

const STATUS_TONE: Record<ShareCollaboratorRow["status"], Tone> = { ACTIVE: "green", INVITED: "amber", REVOKED: "grey" };
const ORDER: Record<ShareCollaboratorRow["status"], number> = { ACTIVE: 0, INVITED: 1, REVOKED: 2 };

const FIELD =
  "min-h-11 w-full min-w-0 rounded-[12px] border border-black/[.08] bg-white px-3.5 text-body text-[#1d1d1f] placeholder:text-[#636368] focus:border-[#6d1b52] focus:outline-none";
const GHOST_BTN =
  "flex h-10 items-center justify-center gap-2 rounded-[12px] border border-black/[.08] bg-white px-3 text-detail font-semibold text-[#1d1d1f] disabled:opacity-60";
const PRIMARY_BTN =
  "flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[#6d1b52] px-3.5 text-detail font-semibold text-[#fdf5f3] disabled:opacity-60";

const roleLabel = (role: string) => customerLabel(COLLABORATOR_ROLE_LABEL, role);
const statusLabel = (status: string) => customerLabel(COLLABORATOR_STATUS_LABEL, status);

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function dateLine(r: ShareCollaboratorRow): string {
  if (r.status === "ACTIVE") return r.acceptedAt ? `Signed in ${shortDate(r.acceptedAt)}` : "Signed in";
  if (r.status === "INVITED") return `Invited ${shortDate(r.invitedAt)} · hasn't signed in yet`;
  return r.revokedAt ? `Removed ${shortDate(r.revokedAt)}` : "Removed";
}

function upsertRow(rows: ShareCollaboratorRow[], row: ShareCollaboratorRow): ShareCollaboratorRow[] {
  const next = rows.some((r) => r.id === row.id) ? rows.map((r) => (r.id === row.id ? row : r)) : [row, ...rows];
  return [...next].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
}

export function ShareClient({ initial }: { initial: ShareScreenData }) {
  const { bookingId, canManage, preview } = initial;
  const [rows, setRows] = React.useState(initial.collaborators);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [role, setRole] = React.useState<CollaboratorRole>("CO_HOST");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<InviteCollaboratorResult | null>(null);
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [manual, setManual] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  const noteTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
  }, []);
  function flash(msg: string) {
    setNote(msg);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 2800);
  }

  function textFor(r: { name: string; role: CollaboratorRole; phoneDisplay: string }): string {
    return collaboratorInviteText({
      recipientName: r.name,
      hostName: initial.hostName,
      eventName: initial.eventName,
      eventDate: initial.eventDate,
      role: r.role,
      phoneDisplay: r.phoneDisplay,
      url: initial.welcomeUrl,
    });
  }

  async function share(text: string) {
    setManual(null);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    const w = window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    if (w) w.opener = null;
    else setManual(text);
  }

  async function copy(text: string) {
    setManual(null);
    try {
      await navigator.clipboard.writeText(text);
      flash("Invite copied — paste it into WhatsApp");
    } catch {
      setManual(text);
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setManual(null);
    if (name.trim().length < 2) return setError("Enter their name.");
    if (!phone.trim()) return setError("Enter their WhatsApp number.");
    setBusy("invite");
    const res = await inviteCollaborator({ bookingId, name, phone, role });
    setBusy(null);
    if (!res.success) return setError(res.error);
    setResult(res.data);
    setRows((rs) => upsertRow(rs, res.data.collaborator));
    setName("");
    setPhone("");
    setRole("CO_HOST");
  }

  async function revoke(r: ShareCollaboratorRow) {
    setBusy(`revoke:${r.id}`);
    const res = await revokeCollaborator(bookingId, r.id);
    setBusy(null);
    setConfirming(null);
    if (!res.success) return flash(res.error);
    setRows((rs) => upsertRow(rs, res.data.collaborator));
    if (result?.collaborator.id === r.id) setResult(null);
    flash(`${r.name} no longer has access`);
  }

  const toast = note && (
    <div role="status" aria-live="polite" className="vg-rise fixed inset-x-5 top-[calc(var(--sat)+0.75rem)] z-30 mx-auto flex max-w-md items-center gap-2.5 rounded-[14px] bg-[#1d1d1f]/[.92] px-4 py-3 text-detail font-medium text-white backdrop-blur">
      <span className="size-2 shrink-0 rounded-full bg-[#e8b631]" />
      {note}
    </div>
  );

  if (initial.access === "COLLABORATOR" && initial.role) {
    return (
      <Screen className="gap-4">
        <ScreenHeader title="Share with family" sub={initial.eventName} backHref={`/app/event?b=${bookingId}`} />
        <Card className="rounded-[18px] p-4">
          <div className="text-copy font-semibold">Shared with you by {initial.hostName}</div>
          <p className="mt-1 text-detail leading-[1.5] text-[#6e6e73]">
            Your access: <span className="font-semibold text-[#1d1d1f]">{roleLabel(initial.role)}</span>.{" "}
            {initial.role === "CO_HOST"
              ? "You can see the event, run of show, checklist and guest list, add and invite guests, add your own to-dos and message the coordinator."
              : "You can see the event, run of show, checklist and guest list, but can't change anything."}{" "}
            Payments and documents stay with the host.
          </p>
          <p className="mt-2 text-detail leading-[1.5] text-[#6e6e73]">Only {initial.hostName} can invite or remove people.</p>
        </Card>
      </Screen>
    );
  }

  const resultName = result?.collaborator.name ?? "";
  return (
    <Screen className="gap-4">
      <ScreenHeader title="Share with family" sub={initial.eventName} backHref={`/app/event?b=${bookingId}`} />
      {toast}

      {preview && (
        <div className="rounded-xl border border-[#b88513]/35 bg-[#faf3e1] px-3.5 py-2.5 text-detail text-[#6e4f0e]">
          <span className="font-semibold">Staff preview.</span> Who {initial.hostName || "the host"} shared this event with. Inviting and removing are switched off.
        </div>
      )}

      {canManage && (
        <form onSubmit={invite} className="vg-card rounded-2xl p-4">
          <div className="text-copy font-semibold">Invite family or your planner</div>
          <p className="mt-1 text-detail leading-[1.5] text-[#6e6e73]">
            They sign in to the Veloria Grand app with their own WhatsApp number and see this event. You can remove them at any time.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="Their name" aria-label="Their name" className={FIELD} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="off" placeholder="Their WhatsApp number" aria-label="Their WhatsApp number" className={FIELD} />
          </div>
          <fieldset className="mt-3">
            <legend className="text-meta font-semibold text-[#6e6e73]">What they can do</legend>
            <div className="mt-1.5 grid gap-2">
              {COLLABORATOR_ROLES.map((r) => (
                <label key={r} className={`flex cursor-pointer items-start gap-3 rounded-[14px] border px-3.5 py-3 ${role === r ? "border-[#6d1b52] bg-[#f7eef2]" : "border-black/[.08] bg-white"}`}>
                  <input type="radio" name="collaborator-role" value={r} checked={role === r} onChange={() => setRole(r)} className="mt-1 accent-[#6d1b52]" />
                  <span>
                    <span className="block text-body font-semibold text-[#1d1d1f]">{roleLabel(r)}</span>
                    <span className="block text-meta leading-[1.45] text-[#6e6e73]">{COLLABORATOR_ROLE_DESCRIPTION[r]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p role="alert" className="mt-2 text-meta text-[#b3261e]">{error}</p>}
          <button type="submit" disabled={busy === "invite"} className={`${PRIMARY_BTN} mt-3 w-full`}>
            {busy === "invite" ? <Loader2 className="size-4 animate-spin" /> : "Send invite"}
          </button>
        </form>
      )}

      {result && (
        <Card className="rounded-[18px] p-4">
          <div role="status" aria-live="polite" className="text-body font-semibold text-[#1d1d1f]">
            {result.alreadyActive
              ? `${resultName} already has access. Their access is now: ${roleLabel(result.collaborator.role)}.`
              : result.whatsapp === "SENT"
                ? `Invite sent to ${resultName} on WhatsApp.`
                : `${resultName} is invited. Send them the invite yourself.`}
          </div>
          {!result.alreadyActive && (
            <>
              <p className="mt-1 text-detail leading-[1.5] text-[#6e6e73]">
                {result.whatsapp === "SENT"
                  ? `They'll see this event after signing in with ${result.collaborator.phoneDisplay}. If the message doesn't reach them, share the invite yourself.`
                  : `We couldn't send it on WhatsApp. Share it from your phone — they sign in with ${result.collaborator.phoneDisplay} to see this event.`}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => share(result.shareText)} className={result.whatsapp === "SENT" ? GHOST_BTN : PRIMARY_BTN}>
                  <Share2 className="size-3.5" /> Share invite
                </button>
                <button type="button" onClick={() => copy(result.shareText)} className={GHOST_BTN}>
                  <Copy className="size-3.5" /> Copy invite
                </button>
              </div>
            </>
          )}
        </Card>
      )}

      {manual && (
        <textarea readOnly value={manual} rows={5} onFocus={(e) => e.currentTarget.select()} aria-label="Invite to copy" className={`${FIELD} py-2.5 text-meta`} />
      )}

      <div>
        <SectionTitle title="People with access" />
        <Card className="vg-divide mt-2.5 overflow-hidden">
          {rows.length === 0 && (
            <div className="px-4 py-6 text-center text-body text-[#6e6e73]">No one yet. People you invite appear here with their status.</div>
          )}
          {rows.map((r, i) => (
            <div key={r.id} className="px-3.5 py-3">
              <div className="flex items-center gap-3">
                <Avatar text={initials(r.name)} tone={r.status === "REVOKED" ? "grey" : i % 2 ? "gold" : "plum"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body font-semibold text-[#1d1d1f]">{r.name}</div>
                  <div className="truncate text-meta text-[#6e6e73]">
                    {roleLabel(r.role)} · {r.phoneDisplay}
                  </div>
                </div>
                <Pill tone={STATUS_TONE[r.status]}>{statusLabel(r.status)}</Pill>
              </div>
              <div className="mt-1 pl-12 text-meta text-[#636368]">{dateLine(r)}</div>
              {canManage && r.status !== "REVOKED" && (
                confirming === r.id ? (
                  <div className="mt-2 flex items-center gap-2 pl-12">
                    <span className="min-w-0 flex-1 text-meta text-[#1d1d1f]">Remove {r.name}&apos;s access?</span>
                    <button type="button" onClick={() => setConfirming(null)} className="h-8 rounded-full border border-black/[.08] bg-white px-3 text-meta font-semibold text-[#1d1d1f]">
                      Cancel
                    </button>
                    <button type="button" onClick={() => revoke(r)} disabled={busy === `revoke:${r.id}`} className="flex h-8 items-center rounded-full bg-[#b3261e] px-3 text-meta font-semibold text-white disabled:opacity-60">
                      {busy === `revoke:${r.id}` ? <Loader2 className="size-3.5 animate-spin" /> : "Remove"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2 pl-12">
                    {r.status === "INVITED" && (
                      <button type="button" onClick={() => share(textFor(r))} className="flex h-8 items-center gap-1.5 rounded-full border border-black/[.08] bg-white px-3 text-meta font-semibold text-[#1d1d1f]">
                        <Share2 className="size-3" /> Share invite
                      </button>
                    )}
                    <button type="button" onClick={() => setConfirming(r.id)} className="h-8 rounded-full px-2 text-meta font-semibold text-[#b3261e]">
                      Remove access
                    </button>
                  </div>
                )
              )}
            </div>
          ))}
        </Card>
      </div>
    </Screen>
  );
}
