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
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <ShieldAlert className="mx-auto size-8 text-amber-500" />
        <h1 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {preview.reason === "expired" ? "This link has expired" : "This link is invalid"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Please contact your Veloria Grand event manager for a fresh portal invite.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <header className="text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-violet-600 text-white">
          <PartyPopper className="size-5" />
        </div>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Activate your event portal</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Welcome, <strong>{preview.name}</strong>. Set a password to view your bookings, invoices, guest list, and more.
        </p>
      </header>
      <HostActivateForm contactId={contactId} token={token} email={preview.email} />
    </div>
  );
}
