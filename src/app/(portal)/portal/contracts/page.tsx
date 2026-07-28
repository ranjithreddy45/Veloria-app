import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FileText,
  ArrowUpRight,
  PenTool,
  FileX,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { auth } from "@/../auth";
import { getPortalContracts } from "@/actions/contract.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { CONTRACT_STATUS_COLORS } from "@/lib/constants";

export const metadata: Metadata = { title: "My Contracts" };

// ============================================================
// Portal Contracts List Page
// ============================================================

export default async function PortalContractsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const contracts = await getPortalContracts(session.user.id);

  const pendingContracts = contracts.filter(
    (c) => c.status === "SENT" || c.status === "VIEWED"
  );
  const otherContracts = contracts.filter(
    (c) => c.status !== "SENT" && c.status !== "VIEWED"
  );

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Your account"
        title="My Contracts"
        description="Everything we've agreed, in writing — ready to read and sign whenever you are."
      />

      {contracts.length === 0 ? (
        <Card className="shadow-card rounded-2xl py-0">
          <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="bg-muted flex size-16 items-center justify-center rounded-2xl">
              <FileX className="text-muted-foreground/60 size-8" />
            </div>
            <h3 className="font-editorial text-foreground mt-5 text-xl font-semibold">
              Nothing to sign today
            </h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              When we send an agreement across, it will be right here — with a
              signature line and no paperwork to print.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pending Signature */}
          {pendingContracts.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                Awaiting your signature
                <span className="numeric text-muted-foreground/60">
                  {pendingContracts.length}
                </span>
              </h2>
              <div className="space-y-3">
                {pendingContracts.map((contract) => (
                  <ContractRow
                    key={contract.id}
                    contract={contract}
                    showSignButton
                  />
                ))}
              </div>
            </section>
          )}

          {/* Other Contracts */}
          {otherContracts.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                {pendingContracts.length > 0
                  ? "Other contracts"
                  : "All contracts"}
                <span className="numeric text-muted-foreground/60">
                  {otherContracts.length}
                </span>
              </h2>
              <div className="space-y-3">
                {otherContracts.map((contract) => (
                  <ContractRow key={contract.id} contract={contract} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Contract Row Component
// ============================================================

interface ContractRowProps {
  contract: {
    id: string;
    title: string;
    status: string;
    sentAt: Date | string | null;
    signedAt: Date | string | null;
    expiresAt: Date | string | null;
    signerName: string | null;
    createdAt: Date | string;
    eventName: string | null;
    bookingNumber: string | null;
  };
  showSignButton?: boolean;
}

function ContractRow({ contract, showSignButton }: ContractRowProps) {
  const isSigned = contract.status === "SIGNED";
  const isExpired = contract.status === "EXPIRED";

  return (
    <Link href={`/portal/contracts/${contract.id}`} className="block">
      <Card
        className={`group shadow-card hover:shadow-card-hover overflow-hidden rounded-2xl py-0 transition-all duration-200 ${
          isSigned
            ? "border-success/25"
            : isExpired
              ? "border-destructive/30"
              : ""
        }`}
      >
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            {/* Icon + Contract Info */}
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div
                className={`flex size-10 flex-shrink-0 items-center justify-center rounded-xl ${
                  isSigned
                    ? "bg-success/10"
                    : isExpired
                      ? "bg-destructive/10"
                      : "bg-primary/10"
                }`}
              >
                {isSigned ? (
                  <CheckCircle2 className="size-5 text-success" />
                ) : (
                  <FileText
                    className={`size-5 ${
                      isExpired
                        ? "text-destructive"
                        : "text-primary"
                    }`}
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-foreground truncate text-sm font-semibold">
                    {contract.title}
                  </p>
                  <StatusBadge
                    status={contract.status}
                    colorMap={CONTRACT_STATUS_COLORS}
                    className="text-[10px]"
                  />
                </div>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {contract.eventName && (
                    <>
                      {contract.eventName}
                      {" "}&middot;{" "}
                    </>
                  )}
                  Sent{" "}
                  <span className="numeric">
                    {contract.sentAt
                      ? new Date(contract.sentAt).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </span>
                </p>
              </div>
            </div>

            {/* Sign Button or Arrow */}
            <div className="flex items-center gap-5">
              {contract.signerName && (
                <div className="text-right">
                  <p className="text-muted-foreground/70 text-[10px] font-semibold uppercase tracking-[0.1em]">
                    Signer
                  </p>
                  <p className="text-foreground mt-0.5 text-sm font-medium">
                    {contract.signerName}
                  </p>
                </div>
              )}

              {showSignButton ? (
                <span className="bg-primary text-primary-foreground hidden items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-opacity group-hover:opacity-90 sm:inline-flex">
                  <PenTool className="size-3.5" />
                  Sign now
                </span>
              ) : (
                <ArrowUpRight className="text-muted-foreground/40 group-hover:text-primary size-4 flex-shrink-0 transition-colors" />
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            className={`flex items-center justify-between border-t px-5 py-2.5 text-xs ${
              isExpired
                ? "border-destructive/20 bg-destructive/[0.06] text-destructive"
                : isSigned
                  ? "border-success/20 bg-success/[0.06] text-success"
                  : "text-muted-foreground/70 bg-muted/25"
            }`}
          >
            <span>
              {contract.expiresAt && (
                <>
                  {isExpired ? "Expired " : "Expires "}
                  <span className="numeric">
                    {new Date(contract.expiresAt).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </>
              )}
              {!contract.expiresAt && "No expiry date"}
            </span>
            {isSigned && contract.signedAt && (
              <span className="font-semibold">
                Signed{" "}
                <span className="numeric">
                  {new Date(contract.signedAt).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </span>
            )}
            {isExpired && <span className="font-semibold">Expired</span>}
            {/* Mobile Sign Button */}
            {showSignButton && (
              <span className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:hidden">
                <PenTool className="size-3" />
                Sign now
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
