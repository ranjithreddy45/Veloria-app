import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { acceptPortalInviteAction } from "@/actions/portal.actions";
import { ActivateResult } from "./_components/activate-result";

// ============================================================
// C9 — Portal activation (accept a staff-issued invite).
// Marks the signed-in client's identity verified and links it to the invited
// contact. Runs server-side on load so a client just clicks the link.
// ============================================================

export const metadata = { title: "Activate Portal" };

export default async function PortalActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ contactId?: string; token?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const { contactId, token } = await searchParams;

  if (!contactId || !token) {
    return (
      <ActivateResult
        ok={false}
        message="This activation link is incomplete. Please use the full link we sent you."
      />
    );
  }

  const result = await acceptPortalInviteAction({ contactId, token });

  return (
    <ActivateResult
      ok={result.success}
      message={
        result.success
          ? "Your portal is activated. You can now view your bookings, invoices, and documents."
          : result.error
      }
    />
  );
}
