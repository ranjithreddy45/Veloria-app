"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  SendIcon,
  PenToolIcon,
  PrinterIcon,
  ClockIcon,
  UserIcon,
  MailIcon,
  CalendarIcon,
  FileTextIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { CONTRACT_STATUS_COLORS } from "@/lib/constants";
import {
  sendContract,
  markContractSigned,
} from "@/actions/contract.actions";

// ============================================================
// Types
// ============================================================

interface ContractDetailProps {
  contract: {
    id: string;
    title: string;
    status: string;
    content: string;
    sentAt: Date | string | null;
    signedAt: Date | string | null;
    expiresAt: Date | string | null;
    signerName: string | null;
    signerEmail: string | null;
    signatureData: string | null;
    signedViaEsign: boolean;
    notes: string | null;
    createdAt: Date | string;
    contact: {
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
      company: string | null;
    };
    booking?: {
      id: string;
      bookingNumber: string;
      eventName: string;
      eventType: string;
      date: Date | string;
      totalAmount: number | string | { toString(): string };
      venue?: { name: string } | null;
    } | null;
    template?: {
      id: string;
      name: string;
    } | null;
    createdBy: {
      id: string;
      name: string | null;
      email: string | null;
    };
  };
}

// ============================================================
// Contract Detail Component
// ============================================================

export function ContractDetail({ contract }: ContractDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSend = () => {
    startTransition(async () => {
      const result = await sendContract(contract.id);
      if (result.success) {
        if ("warning" in result && result.warning) {
          toast.warning(result.warning);
        } else {
          toast.success("Contract sent successfully");
        }
        router.refresh();
      } else {
        toast.error(result.error || "Failed to send contract");
      }
    });
  };

  const handleMarkSigned = () => {
    if (!confirm("Mark this contract as signed? This action cannot be undone."))
      return;
    startTransition(async () => {
      const result = await markContractSigned(contract.id);
      if (result.success) {
        toast.success("Contract marked as signed");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to sign contract");
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left: Contract Content */}
      <div className="space-y-6 lg:col-span-2">
        {/* Contract Content Card */}
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <FileTextIcon className="size-4 text-indigo-500" />
              Contract Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap rounded-lg bg-zinc-50 dark:bg-zinc-900 p-6 border border-zinc-200 dark:border-zinc-700 print:border-none print:bg-white print:p-0">
              {contract.content}
            </div>
          </CardContent>
        </Card>

        {/* Signature Section */}
        {contract.status === "SIGNED" && (
          <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20 shadow-sm">
            <CardContent className="flex flex-col items-center py-8 text-center">
              <CheckCircle2Icon className="size-12 text-green-600 dark:text-green-400" />
              <h3 className="mt-3 text-lg font-semibold text-green-900 dark:text-green-100">
                Contract Signed
              </h3>
              <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                Signed on{" "}
                {contract.signedAt
                  ? format(new Date(contract.signedAt), "dd MMM yyyy 'at' h:mm a")
                  : "N/A"}
                {contract.signedViaEsign && " (via e-sign)"}
              </p>
              {contract.signatureData && (
                <div className="mt-4 rounded-lg border border-green-200 dark:border-green-700 bg-white dark:bg-zinc-900 p-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    Signature
                  </p>
                  <p className="font-handwriting text-2xl italic text-zinc-900 dark:text-zinc-100">
                    {contract.signatureData}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Internal Notes */}
        {contract.notes && (
          <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Internal Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {contract.notes}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right: Actions & Info */}
      <div className="space-y-6">
        {/* Actions */}
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {contract.status === "DRAFT" && (
              <Button
                onClick={handleSend}
                disabled={isPending}
                className="w-full"
              >
                <SendIcon className="mr-2 size-4" />
                {isPending ? "Sending..." : "Send Contract"}
              </Button>
            )}

            {(contract.status === "SENT" ||
              contract.status === "VIEWED") && (
              <Button
                onClick={handleMarkSigned}
                disabled={isPending}
                className="w-full"
                variant="default"
              >
                <PenToolIcon className="mr-2 size-4" />
                {isPending ? "Processing..." : "Mark as Signed"}
              </Button>
            )}

            <Button
              onClick={handlePrint}
              variant="outline"
              className="w-full"
            >
              <PrinterIcon className="mr-2 size-4" />
              Print / PDF
            </Button>
          </CardContent>
        </Card>

        {/* Contract Info */}
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge
                status={contract.status}
                colorMap={CONTRACT_STATUS_COLORS}
              />
            </div>

            <Separator />

            <div className="flex items-start gap-2">
              <UserIcon className="size-4 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium">
                  {contract.contact.firstName} {contract.contact.lastName}
                </div>
                {contract.contact.company && (
                  <div className="text-xs text-muted-foreground">
                    {contract.contact.company}
                  </div>
                )}
              </div>
            </div>

            {contract.signerEmail && (
              <div className="flex items-center gap-2">
                <MailIcon className="size-4 text-muted-foreground" />
                <span>{contract.signerEmail}</span>
              </div>
            )}

            <Separator />

            <div className="flex items-center gap-2">
              <CalendarIcon className="size-4 text-muted-foreground" />
              <span>
                Created{" "}
                {format(new Date(contract.createdAt), "dd MMM yyyy")}
              </span>
            </div>

            {contract.sentAt && (
              <div className="flex items-center gap-2">
                <SendIcon className="size-4 text-muted-foreground" />
                <span>
                  Sent{" "}
                  {format(new Date(contract.sentAt), "dd MMM yyyy")}
                </span>
              </div>
            )}

            {contract.signedAt && (
              <div className="flex items-center gap-2">
                <PenToolIcon className="size-4 text-muted-foreground" />
                <span>
                  Signed{" "}
                  {format(new Date(contract.signedAt), "dd MMM yyyy")}
                </span>
              </div>
            )}

            {contract.expiresAt && (
              <div className="flex items-center gap-2">
                <ClockIcon
                  className={`size-4 ${
                    new Date(contract.expiresAt) < new Date()
                      ? "text-red-500"
                      : "text-muted-foreground"
                  }`}
                />
                <span
                  className={
                    new Date(contract.expiresAt) < new Date()
                      ? "text-red-600 font-medium"
                      : ""
                  }
                >
                  {new Date(contract.expiresAt) < new Date()
                    ? "Expired "
                    : "Expires "}
                  {format(new Date(contract.expiresAt), "dd MMM yyyy")}
                </span>
              </div>
            )}

            {contract.template && (
              <>
                <Separator />
                <div className="flex items-center gap-2">
                  <FileTextIcon className="size-4 text-muted-foreground" />
                  <span>
                    Template: {contract.template.name}
                  </span>
                </div>
              </>
            )}

            {contract.booking && (
              <>
                <Separator />
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
                    Linked Booking
                  </div>
                  <div className="font-medium">
                    {contract.booking.bookingNumber}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {contract.booking.eventName}
                  </div>
                  {contract.booking.venue && (
                    <div className="text-xs text-muted-foreground">
                      {contract.booking.venue.name}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {format(
                      new Date(contract.booking.date),
                      "dd MMM yyyy"
                    )}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div className="text-xs text-muted-foreground">
              Created by {contract.createdBy.name || contract.createdBy.email}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
