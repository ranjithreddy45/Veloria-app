import { redirect } from "next/navigation";

// Employee self-service moved to /me/payslips, which sits outside the
// hr:read-gated /people tree so ordinary employees can actually reach it.
// Kept as a redirect so existing links and bookmarks keep working.
export default function LegacyMyPayslipsPage() {
  redirect("/me/payslips");
}
