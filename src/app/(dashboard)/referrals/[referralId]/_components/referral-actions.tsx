"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2Icon,
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  processReferral,
  markConverted,
  updateReferral,
} from "@/actions/referral.actions";

// ============================================================
// Types
// ============================================================

interface ReferralActionsProps {
  referralId: string;
  status: string;
  convertedLeadId: string | null;
}

// ============================================================
// ReferralActions Component
// ============================================================

export function ReferralActions({
  referralId,
  status,
  convertedLeadId,
}: ReferralActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState<string | null>(null);

  async function handleProcess() {
    setLoading("process");
    try {
      const result = await processReferral(referralId);
      if (result.success) {
        toast.success("Referral processed. A new lead has been created.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function handleConvert() {
    setLoading("convert");
    try {
      const result = await markConverted(
        referralId,
        convertedLeadId ?? undefined
      );
      if (result.success) {
        toast.success("Referral marked as converted. Reward points awarded.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function handleExpire() {
    setLoading("expire");
    try {
      const result = await updateReferral(referralId, { status: "EXPIRED" });
      if (result.success) {
        toast.success("Referral marked as expired.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Process — only for PENDING */}
      {status === "PENDING" && (
        <Button
          onClick={handleProcess}
          disabled={loading !== null}
          size="sm"
        >
          {loading === "process" ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <PlayIcon className="mr-2 size-4" />
          )}
          Process (Create Lead)
        </Button>
      )}

      {/* Mark Converted — for PENDING or CONTACTED */}
      {(status === "PENDING" || status === "CONTACTED") && (
        <Button
          onClick={handleConvert}
          disabled={loading !== null}
          variant="outline"
          size="sm"
          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        >
          {loading === "convert" ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <CheckCircleIcon className="mr-2 size-4" />
          )}
          Mark Converted
        </Button>
      )}

      {/* Mark Expired — for PENDING or CONTACTED */}
      {(status === "PENDING" || status === "CONTACTED") && (
        <Button
          onClick={handleExpire}
          disabled={loading !== null}
          variant="outline"
          size="sm"
          className="border-zinc-200 text-zinc-600 hover:bg-zinc-50"
        >
          {loading === "expire" ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <XCircleIcon className="mr-2 size-4" />
          )}
          Mark Expired
        </Button>
      )}
    </div>
  );
}
