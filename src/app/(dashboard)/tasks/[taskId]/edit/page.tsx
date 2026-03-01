import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getTask,
  getTeamMembers,
  getBookingsForSelect,
} from "@/actions/task.actions";
import { PageHeader } from "@/components/layout/page-header";
import { TaskForm } from "../../_components/task-form";

export const metadata: Metadata = { title: "Edit Task" };

// ============================================================
// Edit Task Page
// ============================================================

interface EditTaskPageProps {
  params: Promise<{ taskId: string }>;
}

export default async function EditTaskPage({ params }: EditTaskPageProps) {
  const { taskId } = await params;

  const [taskResult, membersResult, bookingsResult] = await Promise.all([
    getTask(taskId),
    getTeamMembers(),
    getBookingsForSelect(),
  ]);

  if (!taskResult.success || !taskResult.data) {
    notFound();
  }

  const task = taskResult.data;
  const teamMembers = membersResult.success ? membersResult.data : [];
  const bookings = bookingsResult.success ? bookingsResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Task"
        description={`Editing: ${task.title}`}
      />
      <div className="max-w-3xl">
        <TaskForm
          task={{
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
            dueDate: task.dueDate,
            assigneeId: task.assigneeId,
            bookingId: task.bookingId,
          }}
          teamMembers={teamMembers}
          bookings={bookings}
        />
      </div>
    </div>
  );
}
