import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/../auth";
import { PageHeader } from "@/components/layout/page-header";
import { readTwoFactorStatus } from "@/lib/security/two-factor-login";
import { isTwoFactorRequiredForRole } from "@/lib/security/two-factor-policy";
import { TwoFactorSettings } from "./_components/two-factor-settings";

export const metadata: Metadata = { title: "Security" };

// ============================================================
// Security — self-service two-factor authentication for the signed-in user.
// Mounted at /settings/security (this file) and re-exported at /me/security,
// because the /settings tree is settings:read-gated in middleware and every
// staff role (incl. HR_MANAGER, which must enrol) needs to reach this page.
// ============================================================

export default async function SecuritySettingsPage() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) redirect("/sign-in");

  const status = await readTwoFactorStatus(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        accent="emerald"
        title="Security"
        eyebrow="My account · Sign-in protection"
        description="Protect your sign-in with a one-time code from an authenticator app such as Google Authenticator, Microsoft Authenticator, Authy or 1Password."
      />

      <TwoFactorSettings
        initialStatus={{
          enabled: status.enabled,
          enabledAt: status.enabledAt?.toISOString() ?? null,
          lastUsedAt: status.lastUsedAt?.toISOString() ?? null,
          recoveryCodesLeft: status.recoveryCodesLeft,
          required: isTwoFactorRequiredForRole(user.role),
        }}
        accountEmail={user.email ?? ""}
      />
    </div>
  );
}
