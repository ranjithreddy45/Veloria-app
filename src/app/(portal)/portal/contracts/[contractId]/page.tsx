import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, User } from "lucide-react";
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
    <div className="space-y-10">
      {/* Back Button */}
      <Link
        href="/portal/contracts"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-[13px] transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Back to contracts
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
            Your agreement
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="large-title text-foreground text-[28px] leading-tight sm:text-[32px]">
              {contract.title}
            </h1>
            <StatusBadge
              status={contract.status}
              colorMap={CONTRACT_STATUS_COLORS}
            />
          </div>
          {contract.booking && (
            <p className="text-muted-foreground text-[15px]">
              {contract.booking.eventName}
              {contract.booking.bookingNumber && (
                <>
                  {" "}
                  &middot; Booking{" "}
                  <span className="numeric">
                    {contract.booking.bookingNumber}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Contract Content */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="shadow-card overflow-hidden rounded-2xl py-0">
            {/* Meta Info */}
            <div className="bg-muted/30 grid grid-cols-2 gap-4 border-b p-6 sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
                  Sent
                </p>
                <p className="numeric text-foreground mt-1.5 text-sm font-medium">
                  {contract.sentAt
                    ? new Date(contract.sentAt).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </p>
              </div>
              {contract.expiresAt && (
                <div>
                  <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
                    Expires
                  </p>
                  <p
                    className={`numeric mt-1.5 text-sm font-medium ${
                      isExpired ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {new Date(contract.expiresAt).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}
              {contract.signerName && (
                <div>
                  <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
                    Signer
                  </p>
                  <p className="text-foreground mt-1.5 text-sm font-medium">
                    {contract.signerName}
                  </p>
                </div>
              )}
            </div>

            {/* Contact Info */}
            <div className="border-b p-6">
              <div className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                <User className="size-3.5" />
                Parties
              </div>
              <div className="mt-2.5">
                <p className="text-foreground text-sm font-medium">
                  {contract.contact.firstName} {contract.contact.lastName}
                </p>
                {contract.contact.company && (
                  <p className="text-muted-foreground text-sm">
                    {contract.contact.company}
                  </p>
                )}
              </div>
            </div>

            {/* Contract Body */}
            <div className="p-6">
              <h3 className="text-muted-foreground mb-3 text-[11px] font-semibold uppercase tracking-[0.14em]">
                The agreement
              </h3>
              <div className="bg-muted/40 text-foreground/80 max-w-none whitespace-pre-wrap rounded-xl border p-6 text-sm leading-relaxed">
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
            <Card className="shadow-card border-destructive/25 bg-destructive/[0.06] rounded-2xl py-0">
              <CardContent className="flex flex-col items-center p-6 text-center">
                <div className="bg-destructive/12 flex size-14 items-center justify-center rounded-2xl">
                  <Clock className="text-destructive size-7" />
                </div>
                <h3 className="font-editorial text-foreground mt-4 text-[20px] font-semibold">
                  This one has expired
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  It can no longer be signed. Get in touch and we&apos;ll send a
                  fresh agreement over straight away.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Signed Badge */}
          {contract.status === "SIGNED" && (
            <Card className="shadow-card border-success/25 bg-success/[0.06] rounded-2xl py-0">
              <CardContent className="flex flex-col items-center p-6 text-center">
                <div className="bg-success/12 flex size-14 items-center justify-center rounded-2xl">
                  <CheckCircle2 className="text-success size-7" />
                </div>
                <h3 className="font-editorial text-foreground mt-4 text-[20px] font-semibold">
                  Signed and settled
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Signed on{" "}
                  <span className="numeric">
                    {contract.signedAt
                      ? new Date(contract.signedAt).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </span>
                </p>
                {contract.signatureData && (
                  <div className="bg-card border-success/20 mt-4 w-full rounded-xl border p-4">
                    <p className="text-muted-foreground/70 mb-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                      Signature
                    </p>
                    <p className="font-editorial text-foreground text-xl italic">
                      {contract.signatureData}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Contract Summary */}
          <Card className="shadow-card rounded-2xl py-0">
            <CardHeader className="px-6 pt-6 pb-4">
              <CardTitle className="font-editorial text-foreground text-[20px] font-semibold">
                At a glance
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge
                    status={contract.status}
                    colorMap={CONTRACT_STATUS_COLORS}
                    className="text-[10px]"
                  />
                </div>
                {contract.booking && (
                  <>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Event</span>
                      <span className="text-foreground text-right font-medium">
                        {contract.booking.eventName}
                      </span>
                    </div>
                    {contract.booking.venueName && (
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">Venue</span>
                        <span className="text-foreground text-right font-medium">
                          {contract.booking.venueName}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Event date</span>
                      <span className="numeric text-foreground font-medium">
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
