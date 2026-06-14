"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

import { createEmployeeFromCandidate } from "@/actions/recruit-hire.actions";
import { Button } from "@/components/ui/button";

// ============================================================
// Recruitment → HR handoff entry point.
// Shown only when the candidate is HIRED and the viewer holds the HR
// write permission. One click materialises the candidate into an HR
// Employee (idempotent server-side), toasts, and routes to the record.
// ============================================================
export function CreateEmployeeButton({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function run() {
    setPending(true);
    const res = await createEmployeeFromCandidate(candidateId);
    setPending(false);
    if (res.success) {
      toast.success(
        res.data.created
          ? "Employee created from candidate."
          : "Employee already exists for this candidate."
      );
      router.push(`/people/${res.data.employeeId}`);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Button size="sm" onClick={run} disabled={pending}>
      <UserPlus className="size-4" />
      {pending ? "Creating…" : "Create employee"}
    </Button>
  );
}
