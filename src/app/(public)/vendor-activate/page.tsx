import type { Metadata } from "next";
import { Store, ShieldAlert } from "lucide-react";
import { getVendorInvitePreview } from "@/actions/vendor-portal-invite.actions";
import { VendorActivateForm } from "./_components/vendor-activate-form";

export const metadata: Metadata = {
  title: "Activate your vendor portal — Veloria Grand",
  robots: { index: false, follow: false },
};

export default async function VendorActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ vendor?: string; token?: string }>;
}) {
  const { vendor: vendorId = "", token = "" } = await searchParams;
  const preview = await getVendorInvitePreview(vendorId, token);

  if (!preview.valid) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <ShieldAlert className="mx-auto size-8 text-amber-500" />
        <h1 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {preview.reason === "expired" ? "This link has expired" : "This link is invalid"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Please contact your Veloria Grand coordinator for a fresh vendor-portal invite.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <header className="text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <Store className="size-5" />
        </div>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Activate your vendor portal</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Welcome, <strong>{preview.vendorName}</strong>. Set a password to access your events, bids, and payouts.
        </p>
      </header>
      <VendorActivateForm vendorId={vendorId} token={token} email={preview.vendorEmail} />
    </div>
  );
}
