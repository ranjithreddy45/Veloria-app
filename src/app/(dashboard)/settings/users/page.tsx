import type { Metadata } from "next";
import { getUsers } from "@/actions/user.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { UsersList } from "./_components/users-list";

export const metadata: Metadata = { title: "User Management" };

// ============================================================
// Users Management Page
// ============================================================

export default async function UsersPage() {
  const result = await getUsers();

  const users = result.success ? result.data!.users : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        help={<PageHelp id="users" />}
        description="Manage team members, assign roles, and control access."
      />
      <UsersList users={users} />
    </div>
  );
}
