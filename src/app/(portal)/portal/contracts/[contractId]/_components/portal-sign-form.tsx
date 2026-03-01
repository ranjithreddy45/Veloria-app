"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenTool } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { portalSignContract } from "@/actions/contract.actions";

// ============================================================
// Portal Sign Form
// ============================================================

interface PortalSignFormProps {
  contractId: string;
  userId: string;
}

export function PortalSignForm({ contractId, userId }: PortalSignFormProps) {
  const router = useRouter();
  const [signatureName, setSignatureName] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSign = () => {
    if (!signatureName.trim()) {
      toast.error("Please enter your name to sign");
      return;
    }

    startTransition(async () => {
      const result = await portalSignContract(
        userId,
        contractId,
        signatureName.trim()
      );

      if (result.success) {
        toast.success("Contract signed successfully!");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to sign contract");
      }
    });
  };

  return (
    <Card className="border-indigo-200 bg-gradient-to-br from-white to-indigo-50/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-900">
          <PenTool className="size-4 text-indigo-500" />
          Sign Contract
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-zinc-500">
          By signing below, you agree to the terms outlined in this contract.
        </p>
        <div>
          <Label htmlFor="signatureName" className="text-sm">
            Type your full name to sign
          </Label>
          <Input
            id="signatureName"
            placeholder="Your full name"
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            className="mt-1"
          />
        </div>
        {signatureName && (
          <div className="rounded-lg border border-indigo-200 bg-white p-4 text-center">
            <p className="text-xs text-zinc-400 mb-1">Signature preview</p>
            <p className="text-2xl italic text-zinc-900 font-serif">
              {signatureName}
            </p>
          </div>
        )}
        <Button
          onClick={handleSign}
          disabled={isPending || !signatureName.trim()}
          className="w-full"
        >
          <PenTool className="mr-2 size-4" />
          {isPending ? "Signing..." : "Sign Contract"}
        </Button>
      </CardContent>
    </Card>
  );
}
