"use client";

import * as React from "react";
import { Loader2Icon, ScrollTextIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getConsentRecords, type ConsentRecordRow } from "@/actions/consent-records.actions";

// ============================================================
// ConsentPanel (TEAM) — what the customer accepted, word for word.
// Lists ConsentRecord rows for a booking or a contact: the policy and the
// version they saw (or that only a notice was shown), the exact text, when,
// and where. The same rows the customer app writes, never a re-rendering of
// today's policy. Mount with <ConsentPanel bookingId={...} /> or
// <ConsentPanel contactId={...} />; the action enforces bookings:read /
// contacts:read.
// ============================================================

const POLICY_LABEL: Record<string, string> = {
  CANCELLATION_REFUND: "Cancellation & refund policy",
  BOOKING_TERMS: "Booking terms",
  HOUSE_RULES: "House rules",
};

const PURPOSE_LABEL: Record<string, string> = {
  DATE_HOLD: "Privacy notice · date hold",
  ENQUIRY_RESPONSE: "Privacy notice · enquiry",
  SITE_VISIT: "Privacy notice · site visit",
  RSVP: "Privacy notice · RSVP",
  JOB_APPLICATION: "Privacy notice · job application",
  DRAW_WHATSAPP: "Guest draw · WhatsApp",
};

const SOURCE_LABEL: Record<string, string> = {
  APP_HOLD: "Customer app · date hold",
  PAY_PAGE: "Payment page",
  "/hold": "Website · hold form",
  "/visit": "Website · site visit form",
};

function givenAtLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })} IST`;
}

type PanelState =
  | { kind: "loading" }
  | { kind: "error"; error: string }
  | { kind: "ready"; rows: ConsentRecordRow[] };

export function ConsentPanel({
  bookingId,
  contactId,
  title = "Terms & consent",
}: {
  bookingId?: string;
  contactId?: string;
  title?: string;
}) {
  const [state, setState] = React.useState<PanelState>({ kind: "loading" });

  React.useEffect(() => {
    let alive = true;
    getConsentRecords({ bookingId, contactId })
      .then((res) => {
        if (alive) setState(res.success ? { kind: "ready", rows: res.data } : { kind: "error", error: res.error });
      })
      .catch(() => {
        if (alive) setState({ kind: "error", error: "Failed to load consent records." });
      });
    return () => {
      alive = false;
    };
  }, [bookingId, contactId]);

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollTextIcon className="h-4 w-4" /> {title}
        </CardTitle>
        <CardDescription>
          What the customer accepted, word for word, with the policy version and when.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.kind === "loading" ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2Icon className="h-4 w-4 animate-spin" />
          </div>
        ) : state.kind === "error" ? (
          <p className="text-sm text-muted-foreground">
            {state.error === "Unauthorized" ? "You don't have access to consent records." : state.error}
          </p>
        ) : state.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No terms or consents recorded for this {bookingId ? "booking" : "contact"} yet.
          </p>
        ) : (
          <ul className="divide-y">
            {state.rows.map((row) => (
              <ConsentRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ConsentRow({ row }: { row: ConsentRecordRow }) {
  const name = row.policyKey
    ? (POLICY_LABEL[row.policyKey] ?? row.policyKey)
    : (PURPOSE_LABEL[row.purpose] ?? row.purpose);
  const version = row.policyKey
    ? row.policyVersion != null
      ? `Version ${row.policyVersion}`
      : "No published policy · notice shown"
    : null;
  const givenBy = [row.phone, row.email].filter(Boolean).join(" · ");

  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{name}</span>
        {version && <Badge variant={row.policyVersion != null ? "secondary" : "outline"}>{version}</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">
        {givenAtLabel(row.givenAt)} · {SOURCE_LABEL[row.source] ?? row.source}
        {givenBy ? ` · ${givenBy}` : ""}
      </p>
      <details className="rounded-lg border bg-muted/30">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
          Exact text accepted
        </summary>
        <p className="whitespace-pre-wrap border-t px-3 py-2 text-xs leading-relaxed">{row.consentText}</p>
      </details>
      {row.policyHref && (
        <a
          href={row.policyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Open the policy page (current published version)
        </a>
      )}
    </li>
  );
}
