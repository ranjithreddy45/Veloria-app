import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FileText,
  FileSignature,
  Download,
  ArrowUpRight,
  FolderOpen,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/../auth";
import { getPortalDocuments } from "@/actions/portal.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import {
  INVOICE_STATUS_COLORS,
  CONTRACT_STATUS_COLORS,
} from "@/lib/constants";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "My Documents" };

// ============================================================
// H3 — Documents Hub
// A real hub listing the client's downloadable items: signed contract,
// invoices/receipts. Reuses the verified-scope portal query.
// ============================================================

export default async function PortalDocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const docs = await getPortalDocuments(session.user.id);

  const isEmpty =
    docs.invoices.length === 0 && docs.contracts.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Documents"
        description="Download your invoices, receipts, and signed contracts."
      />

      {/* Unverified account notice (C9) */}
      {!docs.verified && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <ShieldAlert className="mt-0.5 size-5 flex-shrink-0 text-amber-600" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Your account needs to be verified
              </h3>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300/80">
                Please contact us to activate your portal. Once verified,
                your documents will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {docs.verified && isEmpty && (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <FolderOpen className="size-8 text-zinc-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              No documents yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Your invoices and contracts will appear here as they are issued.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Contracts */}
      {docs.contracts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Contracts ({docs.contracts.length})
          </h2>
          <div className="space-y-3">
            {docs.contracts.map((c) => {
              const isSigned = c.status === "SIGNED";
              return (
                <Link key={c.id} href={`/portal/contracts/${c.id}`} className="block">
                  <Card className="group border-zinc-200/80 shadow-sm transition-all hover:shadow-md hover:border-indigo-200">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div
                        className={`flex size-10 items-center justify-center rounded-lg ${
                          isSigned ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-indigo-50 dark:bg-indigo-950/40"
                        }`}
                      >
                        {isSigned ? (
                          <CheckCircle2 className="size-5 text-emerald-600" />
                        ) : (
                          <FileSignature className="size-5 text-indigo-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {c.title}
                        </p>
                        {c.eventName && (
                          <p className="truncate text-xs text-muted-foreground">
                            {c.eventName}
                          </p>
                        )}
                      </div>
                      <StatusBadge
                        status={c.status}
                        colorMap={CONTRACT_STATUS_COLORS}
                        className="text-[10px]"
                      />
                      <ArrowUpRight className="size-4 flex-shrink-0 text-zinc-300 transition-colors group-hover:text-indigo-500" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Invoices & Receipts */}
      {docs.invoices.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Invoices &amp; Receipts ({docs.invoices.length})
          </h2>
          <div className="space-y-3">
            {docs.invoices.map((inv) => (
              <Card
                key={inv.id}
                className="group border-zinc-200/80 shadow-sm transition-all hover:shadow-md hover:border-indigo-200"
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <Link
                    href={`/portal/invoices/${inv.id}`}
                    className="flex min-w-0 flex-1 items-center gap-4"
                  >
                    <div className="flex size-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      <FileText className="size-5 text-zinc-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {inv.invoiceNumber}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {inv.eventName ?? "—"} &middot; {formatINR(inv.totalAmount)}
                      </p>
                    </div>
                  </Link>
                  <StatusBadge
                    status={inv.status}
                    colorMap={INVOICE_STATUS_COLORS}
                    className="text-[10px]"
                  />
                  <a
                    href={`/portal/invoices/${inv.id}/pdf?auto=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:border-zinc-700"
                    title="Download PDF"
                  >
                    <Download className="size-3.5" />
                    <span className="hidden sm:inline">PDF</span>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
