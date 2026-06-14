import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getEmployees, getPayrollRuns } from "@/actions/finance-payroll.actions";
import { PayrollWorkspace } from "../_components/payroll-workspace";

export const metadata = { title: "Payroll · Veloria Grand" };

export default async function PayrollPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "finance:read")) redirect("/dashboard");
  const canWrite = role === "SUPER_ADMIN" || role === "ADMIN" || role === "FINANCE";

  const [employees, runs] = await Promise.all([getEmployees(), getPayrollRuns()]);

  return (
    <div className="space-y-6 p-6">
      <PayrollWorkspace canWrite={canWrite} employees={employees} runs={runs} />
    </div>
  );
}
