"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangleIcon, CheckIcon, Loader2Icon, UtensilsCrossedIcon, XIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatINR } from "@/lib/utils";
import { groupByMenuCategory, MENU_REQUEST_LIMITS, type MenuReviewData, type MenuReviewRequestView } from "@/app/(guest)/app/event/menu/_lib/menu-rules";

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface MenuRequestsReviewProps {
  data: MenuReviewData;
  /** acceptMenuRequest, passed by MenuRequestsPanel. */
  acceptAction: (requestId: string, reviewNote?: string | null) => Promise<Result<{ bookingMenuId: string; selectionCount: number; warnings: string[] }>>;
  /** declineMenuRequest, passed by MenuRequestsPanel. */
  declineAction: (requestId: string, reviewNote: string) => Promise<Result<{ status: string }>>;
}

const STATUS: Record<string, { label: string; className: string }> = {
  SUBMITTED: { label: "Awaiting review", className: "border-amber-200 bg-amber-100 text-amber-800" },
  ACCEPTED: { label: "Accepted", className: "border-emerald-200 bg-emerald-100 text-emerald-800" },
  DECLINED: { label: "Declined", className: "border-red-200 bg-red-100 text-red-800" },
  WITHDRAWN: { label: "Withdrawn by customer", className: "border-slate-300 bg-slate-100 text-slate-700" },
};

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function MenuRequestsReview({ data, acceptAction, declineAction }: MenuRequestsReviewProps) {
  const open = data.requests.filter((r) => r.status === "SUBMITTED").length;
  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <UtensilsCrossedIcon className="size-4" />
            Customer menu requests
          </span>
          {open > 0 && <Badge className="border-amber-200 bg-amber-100 text-amber-800">{open} to review</Badge>}
        </CardTitle>
        <p className="text-muted-foreground text-xs">
          Dishes the host picked in the Veloria app. Accepting replaces this booking&apos;s menu selections, priced at today&apos;s list prices for {data.guestCount} guests (negotiated dish prices already on the menu are kept).
          {data.rules.packageLabel ? ` Quoted package: ${data.rules.packageLabel}${data.rules.vegOnly ? " (vegetarian)" : ""}.` : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.requests.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No menu requests from the customer yet.</p>
        ) : (
          data.requests.map((r) => <RequestRow key={r.id} request={r} data={data} acceptAction={acceptAction} declineAction={declineAction} />)
        )}
      </CardContent>
    </Card>
  );
}

function RequestRow({ request: r, data, acceptAction, declineAction }: { request: MenuReviewRequestView } & MenuRequestsReviewProps) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"idle" | "accept" | "decline">("idle");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const status = STATUS[r.status] ?? { label: r.status, className: "" };
  const reviewable = r.status === "SUBMITTED" && data.canReview;

  async function accept() {
    setBusy(true);
    const res = await acceptAction(r.id, note.trim() || null);
    if (!res.success) {
      setBusy(false);
      toast.error(res.error);
      return;
    }
    toast.success(`Menu updated: ${res.data.selectionCount} dishes from the customer's request. The customer has been notified.`);
    // Full reload: a menu builder on the same page keeps its own form state and would otherwise show the old menu.
    window.location.reload();
  }

  async function decline() {
    setBusy(true);
    const res = await declineAction(r.id, note);
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Request declined. The customer has been notified.");
    setMode("idle");
    router.refresh();
  }

  return (
    <div className={cn("rounded-xl border p-3", r.status === "SUBMITTED" ? "border-amber-200" : "")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={status.className}>{status.label}</Badge>
          <span className="text-muted-foreground text-xs">
            {r.items.length} {r.items.length === 1 ? "dish" : "dishes"} · sent {when(r.createdAt)}
            {r.submittedBy ? ` by ${r.submittedBy}` : ""}
          </span>
        </div>
        <span className="numeric text-sm font-semibold">
          {formatINR(r.pricing.pricePerHead)}
          <span className="text-muted-foreground text-xs font-normal"> /head · {formatINR(r.pricing.totalPrice)} for {r.pricing.guestCount}</span>
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {groupByMenuCategory(r.items).map((g) => (
          <div key={g.category}>
            <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">{g.category}</p>
            <ul className="space-y-1">
              {g.rows.map((it) => (
                <li key={it.menuItemId} className="flex items-start justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className={cn("font-medium", !it.available && "text-destructive line-through")}>{it.name}</span>
                    {it.quantity > 1 && <span className="text-muted-foreground"> × {it.quantity}</span>}
                    {it.dietaryTags.length > 0 && <span className="text-muted-foreground text-xs"> · {it.dietaryTags.join(", ")}</span>}
                    {it.note && <span className="text-muted-foreground block text-xs">Note: {it.note}</span>}
                  </span>
                  <span className="numeric text-muted-foreground shrink-0 text-xs">
                    {!it.available ? "Unavailable" : it.customPrice != null ? `${formatINR(it.customPrice)} (negotiated)` : it.pricePerHead != null ? formatINR(it.pricePerHead) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {r.notes && <p className="bg-muted/50 mt-3 rounded-md px-2.5 py-2 text-sm"><span className="font-medium">Customer&apos;s notes:</span> {r.notes}</p>}

      {(r.blockers.length > 0 || r.warnings.length > 0) && r.status === "SUBMITTED" && (
        <div className="mt-3 space-y-1 text-xs">
          {r.blockers.map((b, i) => <p key={`b${i}`} className="text-destructive flex gap-1.5"><XIcon className="mt-0.5 size-3 shrink-0" />{b}</p>)}
          {r.warnings.map((w, i) => <p key={`w${i}`} className="flex gap-1.5 text-amber-700"><AlertTriangleIcon className="mt-0.5 size-3 shrink-0" />{w}</p>)}
        </div>
      )}

      {r.reviewedAt && (
        <p className="text-muted-foreground mt-3 text-xs">
          Reviewed {when(r.reviewedAt)}{r.reviewedBy ? ` by ${r.reviewedBy}` : ""}{r.reviewNote ? ` — “${r.reviewNote}”` : ""}
        </p>
      )}

      {r.status === "SUBMITTED" && !data.canReview && (
        <p className="text-muted-foreground mt-3 text-xs">Accepting or declining needs menu and booking edit access.</p>
      )}

      {reviewable && mode === "idle" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => { setNote(""); setMode("accept"); }} disabled={r.blockers.length > 0}>
            <CheckIcon className="mr-1 size-3.5" /> Accept &amp; update menu
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setNote(""); setMode("decline"); }}>
            <XIcon className="mr-1 size-3.5" /> Decline
          </Button>
        </div>
      )}

      {reviewable && mode !== "idle" && (
        <div className="mt-3 space-y-2 rounded-lg border p-2.5">
          {mode === "accept" ? (
            <p className="text-xs">
              {data.currentMenu
                ? `This replaces the booking's current menu (${data.currentMenu.selectionCount} dishes, ${formatINR(data.currentMenu.pricePerHead)}/head) with these ${r.items.length} dishes.`
                : `This creates the booking's menu with these ${r.items.length} dishes.`}
            </p>
          ) : (
            <p className="text-xs">Tell the customer why, so they can pick again. They&apos;ll see this note.</p>
          )}
          <Textarea
            rows={2}
            value={note}
            maxLength={MENU_REQUEST_LIMITS.maxReviewNote}
            onChange={(e) => setNote(e.target.value)}
            placeholder={mode === "accept" ? "Optional note for the customer" : "Required: why these picks can't be used"}
          />
          <div className="flex flex-wrap gap-2">
            {mode === "accept" ? (
              <Button size="sm" onClick={accept} disabled={busy}>
                {busy ? <Loader2Icon className="mr-1 size-3.5 animate-spin" /> : <CheckIcon className="mr-1 size-3.5" />} Confirm accept
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={decline} disabled={busy || note.trim().length < 3}>
                {busy ? <Loader2Icon className="mr-1 size-3.5 animate-spin" /> : <XIcon className="mr-1 size-3.5" />} Confirm decline
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")} disabled={busy}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
