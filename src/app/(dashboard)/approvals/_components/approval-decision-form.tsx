"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  XCircleIcon,
  ArrowRightCircleIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  approveRequest,
  rejectRequest,
  delegateRequest,
} from "@/actions/approval.actions";
import { getUsers } from "@/actions/user.actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// Props
// ============================================================

interface ApprovalDecisionFormProps {
  requestId: string;
}

// ============================================================
// Component
// ============================================================

export function ApprovalDecisionForm({ requestId }: ApprovalDecisionFormProps) {
  const router = useRouter();

  const [action, setAction] = React.useState<
    "APPROVE" | "REJECT" | "DELEGATE" | null
  >(null);
  const [comment, setComment] = React.useState("");
  const [delegateToId, setDelegateToId] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // Users for delegation
  const [users, setUsers] = React.useState<
    { id: string; name: string | null; email: string }[]
  >([]);
  const [usersLoaded, setUsersLoaded] = React.useState(false);

  async function loadUsers() {
    if (usersLoaded) return;
    const result = await getUsers({ limit: 100 });
    if (result.success) {
      setUsers(result.data.users);
    }
    setUsersLoaded(true);
  }

  React.useEffect(() => {
    if (action === "DELEGATE") {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  async function handleSubmit() {
    if (!action) return;

    setLoading(true);

    let result: { success: true } | { success: false; error: string };

    switch (action) {
      case "APPROVE":
        result = await approveRequest(requestId, comment || undefined);
        break;
      case "REJECT":
        if (!comment.trim()) {
          toast.error("A comment is required when rejecting");
          setLoading(false);
          return;
        }
        result = await rejectRequest(requestId, comment.trim());
        break;
      case "DELEGATE":
        if (!delegateToId) {
          toast.error("Please select a user to delegate to");
          setLoading(false);
          return;
        }
        result = await delegateRequest(
          requestId,
          delegateToId,
          comment || undefined
        );
        break;
      default:
        setLoading(false);
        return;
    }

    if (result.success) {
      toast.success(
        action === "APPROVE"
          ? "Request approved"
          : action === "REJECT"
            ? "Request rejected"
            : "Request delegated"
      );
      router.push("/approvals");
      router.refresh();
    } else {
      toast.error(result.error);
    }

    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Make a Decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={action === "APPROVE" ? "default" : "outline"}
            onClick={() => setAction("APPROVE")}
            className={
              action === "APPROVE"
                ? "bg-success hover:bg-success text-white"
                : "text-success border-success/20 hover:bg-success/10"
            }
          >
            <CheckCircle2Icon className="mr-2 size-4" />
            Approve
          </Button>
          <Button
            variant={action === "REJECT" ? "default" : "outline"}
            onClick={() => setAction("REJECT")}
            className={
              action === "REJECT"
                ? "bg-destructive hover:bg-destructive text-white"
                : "text-destructive border-destructive/20 hover:bg-destructive/10"
            }
          >
            <XCircleIcon className="mr-2 size-4" />
            Reject
          </Button>
          <Button
            variant={action === "DELEGATE" ? "default" : "outline"}
            onClick={() => setAction("DELEGATE")}
            className={
              action === "DELEGATE"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "text-blue-600 border-blue-200 hover:bg-blue-50"
            }
          >
            <ArrowRightCircleIcon className="mr-2 size-4" />
            Delegate
          </Button>
        </div>

        {/* Delegate User Select */}
        {action === "DELEGATE" && (
          <div className="space-y-2">
            <Label>Delegate to</Label>
            <Select value={delegateToId} onValueChange={setDelegateToId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name ?? user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Comment */}
        {action && (
          <div className="space-y-2">
            <Label>
              Comment{action === "REJECT" && <span className="text-destructive"> *</span>}
            </Label>
            <Textarea
              placeholder={
                action === "REJECT"
                  ? "Reason for rejection (required)..."
                  : "Optional comment..."
              }
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
        )}

        {/* Submit */}
        {action && (
          <Button
            onClick={handleSubmit}
            disabled={
              loading ||
              (action === "REJECT" && !comment.trim()) ||
              (action === "DELEGATE" && !delegateToId)
            }
            className="w-full"
          >
            {loading && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            {action === "APPROVE"
              ? "Confirm Approval"
              : action === "REJECT"
                ? "Confirm Rejection"
                : "Confirm Delegation"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
