import type { Metadata } from "next";
import { PartyPopper, ShieldAlert } from "lucide-react";
import { getHostInvitePreview } from "@/actions/host-portal-invite.actions";
import { HostActivateForm } from "./_components/host-activate-form";

export const metadata: Metadata = {
  title: "Activate your event portal — Veloria Grand",
  robots: { index: false, follow: false },
};

export default async function HostActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string; token?: string }>;
}) {
  const { contact: contactId = "", token = "" } = await searchParams;
  const preview = await getHostInvitePreview(contactId, token);

  if (!preview.valid) {
    return (
      <div className="bg-card shadow-card mx-auto max-w-md rounded-2xl border p-10 text-center">
        <ShieldAlert className="mx-auto size-8 text-warning" />
        <h1 className="text-foreground mt-4 text-h2">
          {preview.reason === "expired"
            ? "This link has expired"
            : "This link is invalid"}
        </h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-xs text-sm leading-relaxed">
          Your Veloria Grand event manager can send you a fresh portal invite
          right away.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-7">
      <header className="text-center">
        <div className="bg-primary text-primary-foreground mx-auto flex size-12 items-center justify-center rounded-2xl">
          <PartyPopper className="size-[22px]" />
        </div>
        <p className="text-muted-foreground mt-5 text-meta font-semibold uppercase tracking-[0.18em]">
          Welcome, {preview.name}
        </p>
        <h1 className="text-foreground mt-3 text-h1 sm:text-h1">
          Activate your event portal
        </h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-copy leading-relaxed">
          Choose a password, and your bookings, invoices, guest list and
          documents will all be waiting for you in one place.
        </p>
      </header>
      <HostActivateForm contactId={contactId} token={token} email={preview.email} />
    </div>
  );
}
