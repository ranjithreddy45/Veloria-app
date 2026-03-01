import type { Metadata } from "next";
import { getTeamMembers, getBookingsForSelect } from "@/actions/task.actions";
import { PageHeader } from "@/components/layout/page-header";
import { TaskForm } from "../_components/task-form";

export const metadata: Metadata = { title: "New Task" };

// ============================================================
// New Task Page
// ============================================================

export default async function NewTaskPage() {
  const [membersResult, bookingsResult] = await Promise.all([
    getTeamMembers(),
    getBookingsForSelect(),
  ]);

  const teamMembers = membersResult.success ? membersResult.data : [];
  const bookings = bookingsResult.success ? bookingsResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Task"
        description="Add a new task to your project"
      />
      <div className="max-w-3xl">
        <TaskForm teamMembers={teamMembers} bookings={bookings} />
      </div>
    </div>
  );
}
