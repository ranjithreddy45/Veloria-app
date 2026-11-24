import type { Metadata } from "next";
import { getUsers } from "@/actions/user.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { UsersList } from "./_components/users-list";
import { getStrandedLeads } from "@/actions/stranded-leads.actions";
import { StrandedLeadsCard } from "@/components/crm/stranded-leads-card";

export const metadata: Metadata = { title: "User Management" };

// ============================================================
// Users Management Page
// ============================================================

export default async function UsersPage() {
  // Stranded-leads lookup fails closed (no card) for anyone without leads:assign.
  const [result, stranded] = await Promise.all([getUsers(), getStrandedLeads()]);

  const users = result.success ? result.data!.users : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        help={<PageHelp id="users" />}
        description="Manage team members, assign roles, and control access."
      />
      {stranded.success && stranded.data.owners.length > 0 && (
        <StrandedLeadsCard owners={stranded.data.owners} destinations={stranded.data.destinations} />
      )}
      <UsersList users={users} />
    </div>
  );
}
