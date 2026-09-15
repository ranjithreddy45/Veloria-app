import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import TwoFactorChallengeForm from "./_components/two-factor-challenge-form";

export const metadata: Metadata = { title: "Two-factor authentication" };

// ============================================================
// Second step for sessions that signed in via Google or a WhatsApp code and
// have an authenticator enrolled. The `authorized` callback (auth.config.ts)
// sends every other route here while `twoFactorPending` is set on the JWT;
// completeTwoFactorChallenge clears it once a code verifies.
// ============================================================

export default async function TwoFactorPage() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) redirect("/sign-in");
  if (!user.twoFactorPending) {
    redirect(
      user.role === "CLIENT"
        ? "/portal"
        : user.role === "VENDOR"
          ? "/vendor-portal"
          : "/dashboard"
    );
  }

  return <TwoFactorChallengeForm email={user.email ?? ""} />;
}
