import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import {
  TWO_FACTOR_CHALLENGE_PATH,
  isTwoFactorRequiredForRole,
} from "@/lib/security/two-factor-policy";
import { TwoFactorBanner } from "@/components/security/two-factor-banner";

// ============================================================
// Rendered once in the dashboard layout.
// - Defence in depth for the /two-factor redirect that auth.config's
//   `authorized` callback already performs at the edge.
// - Soft policy: roles in REQUIRED_2FA_ROLES that have not enrolled get a
//   dismissable-per-session banner. Reads the JWT flag (refreshed on enrol /
//   disable via unstable_update, and every 5 minutes) — no DB round-trip.
// ============================================================

export async function TwoFactorGate() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  if (user.twoFactorPending) redirect(TWO_FACTOR_CHALLENGE_PATH);

  if (!isTwoFactorRequiredForRole(user.role) || user.twoFactorEnabled) {
    return null;
  }

  return <TwoFactorBanner />;
}
