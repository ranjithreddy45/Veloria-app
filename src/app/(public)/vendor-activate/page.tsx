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
      <div className="bg-card shadow-card mx-auto max-w-md rounded-2xl border p-10 text-center">
        <ShieldAlert className="mx-auto size-8 text-amber-500" />
        <h1 className="text-foreground mt-4 text-[24px]">
          {preview.reason === "expired"
            ? "This link has expired"
            : "This link is invalid"}
        </h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-xs text-sm leading-relaxed">
          Your Veloria Grand coordinator can issue a fresh vendor-portal invite
          right away.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-7">
      <header className="text-center">
        <div className="bg-primary text-primary-foreground mx-auto flex size-12 items-center justify-center rounded-2xl">
          <Store className="size-[22px]" />
        </div>
        <p className="text-muted-foreground mt-5 text-[11px] font-semibold uppercase tracking-[0.18em]">
          Welcome, {preview.vendorName}
        </p>
        <h1 className="text-foreground mt-3 text-[30px] sm:text-[34px]">
          Activate your vendor portal
        </h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-[15px] leading-relaxed">
          Choose a password to see your assigned events, submit bids and track
          payouts — all in one place.
        </p>
      </header>
      <VendorActivateForm vendorId={vendorId} token={token} email={preview.vendorEmail} />
    </div>
  );
}
