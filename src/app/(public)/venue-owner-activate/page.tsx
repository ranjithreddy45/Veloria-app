import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getVenueOwnerInvitePreview } from "@/actions/venue-owner.actions";
import { VenueOwnerActivateForm } from "./_components/venue-owner-activate-form";

// ============================================================
// /venue-owner-activate?u=<userId>&token=<raw> — PUBLIC. A venue owner opens
// the link an admin sent from Settings → Venue owners and sets a password,
// which switches their login on. Public because it is outside every
// middleware INTERNAL_ROUTES prefix and every auth.config protected prefix
// (like /vendor-activate); the token is the only key.
// ============================================================

export const metadata: Metadata = {
  title: "Activate your owner login — Veloria Grand",
  robots: { index: false, follow: false },
  // The URL carries a single-use token: never send it on as a Referer.
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

const SIGN_IN_HREF = "/sign-in?callbackUrl=/venue-portal";

export default async function VenueOwnerActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string | string[]; token?: string | string[] }>;
}) {
  const params = await searchParams;
  const userId = typeof params.u === "string" ? params.u : "";
  const token = typeof params.token === "string" ? params.token : "";
  const preview = await getVenueOwnerInvitePreview(userId, token);

  if (!preview.valid) {
    if (preview.reason === "used") {
      return (
        <div className="surface-glass mx-auto max-w-md rounded-[22px] p-8 text-center sm:p-10">
          <CheckCircle2 className="mx-auto size-8 text-success" />
          <h1 className="mt-4 text-h2 text-foreground">You&rsquo;re already set up</h1>
          <p className="mx-auto mt-2 max-w-xs text-body leading-relaxed text-muted-foreground">
            This link has been used. Sign in with your email and the password you chose.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link href={SIGN_IN_HREF}>Go to sign in</Link>
          </Button>
        </div>
      );
    }
    return (
      <div className="surface-glass mx-auto max-w-md rounded-[22px] p-8 text-center sm:p-10">
        <ShieldAlert className="mx-auto size-8 text-warning" />
        <h1 className="mt-4 text-h2 text-foreground">
          {preview.reason === "expired" ? "This link has expired" : "This link is invalid"}
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-body leading-relaxed text-muted-foreground">
          Your Veloria Grand contact can send you a fresh owner-login link right away.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-7">
      <header className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Building2 className="size-6" />
        </div>
        {preview.name && (
          <p className="mt-5 text-meta font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Welcome, {preview.name}
          </p>
        )}
        <h1 className="mt-3 text-h2 text-foreground sm:text-h1">Activate your owner login</h1>
        <p className="mx-auto mt-3 max-w-sm text-copy leading-relaxed text-muted-foreground">
          Choose a password to see how many enquiries and bookings your venue has, and which dates are taken.
        </p>
      </header>
      <VenueOwnerActivateForm userId={userId} token={token} email={preview.email} signInHref={SIGN_IN_HREF} />
    </div>
  );
}
