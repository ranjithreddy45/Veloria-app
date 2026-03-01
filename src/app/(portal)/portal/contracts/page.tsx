import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FileText,
  ArrowUpRight,
  PenTool,
  FileX,
  CheckCircle2,
  Clock,
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
    <div className="space-y-8">
      <PageHeader
        title="My Contracts"
        description="View and sign your contracts."
      />

      {contracts.length === 0 ? (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-zinc-100">
              <FileX className="size-8 text-zinc-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-900">
              No contracts yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-zinc-500">
              Your contracts will appear here once they are sent to you.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pending Signature */}
          {pendingContracts.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Awaiting Your Signature ({pendingContracts.length})
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
            </div>
          )}

          {/* Other Contracts */}
          {otherContracts.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                {pendingContracts.length > 0
                  ? "Other Contracts"
                  : "All Contracts"}{" "}
                ({otherContracts.length})
              </h2>
              <div className="space-y-3">
                {otherContracts.map((contract) => (
                  <ContractRow key={contract.id} contract={contract} />
                ))}
              </div>
            </div>
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
        className={`group border-zinc-200/80 shadow-sm transition-all duration-200 hover:shadow-md ${
          isSigned
            ? "hover:border-green-200 border-green-100"
            : isExpired
              ? "hover:border-red-200 border-red-100"
              : "hover:border-indigo-200"
        }`}
      >
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5">
            {/* Icon + Contract Info */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div
                className={`flex size-10 items-center justify-center rounded-lg flex-shrink-0 ${
                  isSigned
                    ? "bg-green-50"
                    : isExpired
                      ? "bg-red-50"
                      : "bg-indigo-50"
                }`}
              >
                {isSigned ? (
                  <CheckCircle2
                    className="size-5 text-green-500"
                  />
                ) : (
                  <FileText
                    className={`size-5 ${
                      isExpired ? "text-red-500" : "text-indigo-500"
                    }`}
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-zinc-900 truncate">
                    {contract.title}
                  </p>
                  <StatusBadge
                    status={contract.status}
                    colorMap={CONTRACT_STATUS_COLORS}
                    className="text-[10px]"
                  />
                </div>
                <p className="mt-0.5 text-xs text-zinc-500 truncate">
                  {contract.eventName && (
                    <>
                      {contract.eventName}
                      {" "}&middot;{" "}
                    </>
                  )}
                  Sent{" "}
                  {contract.sentAt
                    ? new Date(contract.sentAt).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "N/A"}
                </p>
              </div>
            </div>

            {/* Sign Button or Arrow */}
            <div className="flex items-center gap-4">
              {contract.signerName && (
                <div className="text-right">
                  <p className="text-xs text-zinc-400">Signer</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {contract.signerName}
                  </p>
                </div>
              )}

              {showSignButton ? (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors group-hover:bg-indigo-700">
                  <PenTool className="size-3.5" />
                  Sign Now
                </span>
              ) : (
                <ArrowUpRight className="size-4 text-zinc-300 flex-shrink-0 transition-colors group-hover:text-indigo-500" />
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            className={`flex items-center justify-between border-t px-5 py-2 text-xs ${
              isExpired
                ? "border-red-100 bg-red-50/50 text-red-600"
                : isSigned
                  ? "border-green-100 bg-green-50/50 text-green-600"
                  : "border-zinc-100 text-zinc-400"
            }`}
          >
            <span>
              {contract.expiresAt && (
                <>
                  {isExpired ? "Expired: " : "Expires: "}
                  {new Date(contract.expiresAt).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </>
              )}
              {!contract.expiresAt && "No expiry date"}
            </span>
            {isSigned && contract.signedAt && (
              <span className="font-semibold">
                Signed{" "}
                {new Date(contract.signedAt).toLocaleDateString("en-IN", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
            {isExpired && (
              <span className="font-semibold">Expired</span>
            )}
            {/* Mobile Sign Button */}
            {showSignButton && (
              <span className="inline-flex sm:hidden items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">
                <PenTool className="size-3" />
                Sign Now
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
