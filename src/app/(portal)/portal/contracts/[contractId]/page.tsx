import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  Clock,
  PenTool,
  User,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/../auth";
import { getPortalContract } from "@/actions/contract.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { CONTRACT_STATUS_COLORS } from "@/lib/constants";
import { PortalSignForm } from "./_components/portal-sign-form";

// ============================================================
// Portal Contract Detail Page
// ============================================================

export default async function PortalContractDetailPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const { contractId } = await params;
  const contract = await getPortalContract(session.user.id, contractId);

  if (!contract) notFound();

  const canSign =
    contract.status === "VIEWED" &&
    (!contract.expiresAt || new Date(contract.expiresAt) > new Date());
  const isExpired =
    contract.expiresAt && new Date(contract.expiresAt) < new Date();

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/portal/contracts"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-700"
      >
        <ArrowLeft className="size-4" />
        Back to Contracts
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              {contract.title}
            </h1>
            <StatusBadge
              status={contract.status}
              colorMap={CONTRACT_STATUS_COLORS}
            />
          </div>
          {contract.booking && (
            <p className="mt-1 text-sm text-zinc-500">
              {contract.booking.eventName}
              {contract.booking.bookingNumber && (
                <> &middot; Booking #{contract.booking.bookingNumber}</>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Contract Content */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-zinc-200/80 shadow-sm overflow-hidden">
            {/* Meta Info */}
            <div className="grid grid-cols-2 gap-4 border-b border-zinc-100 bg-zinc-50/50 p-5 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Sent Date
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900">
                  {contract.sentAt
                    ? new Date(contract.sentAt).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "N/A"}
                </p>
              </div>
              {contract.expiresAt && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Expires
                  </p>
                  <p
                    className={`mt-1 text-sm font-medium ${
                      isExpired ? "text-red-600" : "text-zinc-900"
                    }`}
                  >
                    {new Date(contract.expiresAt).toLocaleDateString(
                      "en-IN",
                      { month: "short", day: "numeric", year: "numeric" }
                    )}
                  </p>
                </div>
              )}
              {contract.signerName && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Signer
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-900">
                    {contract.signerName}
                  </p>
                </div>
              )}
            </div>

            {/* Contact Info */}
            <div className="border-b border-zinc-100 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <User className="size-3.5" />
                Parties
              </div>
              <div className="mt-2">
                <p className="text-sm font-medium text-zinc-900">
                  {contract.contact.firstName} {contract.contact.lastName}
                </p>
                {contract.contact.company && (
                  <p className="text-sm text-zinc-500">
                    {contract.contact.company}
                  </p>
                )}
              </div>
            </div>

            {/* Contract Body */}
            <div className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                Contract Content
              </h3>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded-lg bg-zinc-50 p-6 border border-zinc-200 text-sm text-zinc-700 leading-relaxed">
                {contract.content}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Sign CTA */}
          {canSign && (
            <PortalSignForm
              contractId={contractId}
              userId={session.user.id}
            />
          )}

          {/* Expired Notice */}
          {isExpired && contract.status !== "SIGNED" && (
            <Card className="border-red-200 bg-red-50 shadow-sm">
              <CardContent className="flex flex-col items-center p-6 text-center">
                <Clock className="size-12 text-red-400" />
                <h3 className="mt-3 text-base font-semibold text-red-900">
                  Contract Expired
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  This contract has expired and can no longer be signed.
                  Please contact us for a new contract.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Signed Badge */}
          {contract.status === "SIGNED" && (
            <Card className="border-emerald-200 bg-emerald-50 shadow-sm">
              <CardContent className="flex flex-col items-center p-6 text-center">
                <CheckCircle2 className="size-12 text-emerald-600" />
                <h3 className="mt-3 text-base font-semibold text-emerald-900">
                  Contract Signed
                </h3>
                <p className="mt-1 text-sm text-emerald-700">
                  Signed on{" "}
                  {contract.signedAt
                    ? new Date(contract.signedAt).toLocaleDateString(
                        "en-IN",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )
                    : "N/A"}
                </p>
                {contract.signatureData && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-white dark:bg-card p-3">
                    <p className="text-xs text-zinc-400 mb-1">
                      Signature
                    </p>
                    <p className="text-xl italic text-zinc-900 font-serif">
                      {contract.signatureData}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Contract Summary */}
          <Card className="border-zinc-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-900">
                Contract Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Status</span>
                  <StatusBadge
                    status={contract.status}
                    colorMap={CONTRACT_STATUS_COLORS}
                    className="text-[10px]"
                  />
                </div>
                {contract.templateName && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Template</span>
                    <span className="font-medium text-zinc-900">
                      {contract.templateName}
                    </span>
                  </div>
                )}
                {contract.booking && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Event</span>
                      <span className="font-medium text-zinc-900">
                        {contract.booking.eventName}
                      </span>
                    </div>
                    {contract.booking.venueName && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Venue</span>
                        <span className="font-medium text-zinc-900">
                          {contract.booking.venueName}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Event Date</span>
                      <span className="font-medium text-zinc-900">
                        {new Date(contract.booking.date).toLocaleDateString(
                          "en-IN",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
