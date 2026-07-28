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
    <div className="space-y-10">
      <PageHeader
        eyebrow="Your account"
        title="My Documents"
        description="Your invoices, receipts and signed agreements — all in one place, always downloadable."
      />

      {/* Unverified account notice (C9) */}
      {!docs.verified && (
        <Card className="shadow-card rounded-2xl border-amber-500/25 bg-amber-500/[0.06] py-0">
          <CardContent className="flex items-start gap-3.5 p-6">
            <ShieldAlert className="mt-0.5 size-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="font-editorial text-foreground text-[20px] font-semibold">
                One quick step first
              </h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                We need to verify your account before we can show your paperwork.
                Get in touch and we&apos;ll activate your portal right away.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {docs.verified && isEmpty && (
        <Card className="shadow-card rounded-2xl py-0">
          <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="bg-muted flex size-16 items-center justify-center rounded-2xl">
              <FolderOpen className="text-muted-foreground/60 size-8" />
            </div>
            <h3 className="font-editorial text-foreground mt-5 text-xl font-semibold">
              Your file is still empty
            </h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              As soon as we issue an invoice or send an agreement, a copy lands
              here for you to keep.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Contracts */}
      {docs.contracts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
            Contracts
            <span className="numeric text-muted-foreground/60">
              {docs.contracts.length}
            </span>
          </h2>
          <div className="space-y-3">
            {docs.contracts.map((c) => {
              const isSigned = c.status === "SIGNED";
              return (
                <Link
                  key={c.id}
                  href={`/portal/contracts/${c.id}`}
                  className="block"
                >
                  <Card className="group shadow-card hover:shadow-card-hover rounded-2xl py-0 transition-all duration-200">
                    <CardContent className="flex items-center gap-4 p-5">
                      <div
                        className={`flex size-10 flex-shrink-0 items-center justify-center rounded-xl ${
                          isSigned ? "bg-emerald-500/10" : "bg-primary/10"
                        }`}
                      >
                        {isSigned ? (
                          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <FileSignature className="text-primary size-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate text-sm font-semibold">
                          {c.title}
                        </p>
                        {c.eventName && (
                          <p className="text-muted-foreground truncate text-xs">
                            {c.eventName}
                          </p>
                        )}
                      </div>
                      <StatusBadge
                        status={c.status}
                        colorMap={CONTRACT_STATUS_COLORS}
                        className="text-[10px]"
                      />
                      <ArrowUpRight className="text-muted-foreground/40 group-hover:text-primary size-4 flex-shrink-0 transition-colors" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Invoices & Receipts */}
      {docs.invoices.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
            Invoices &amp; receipts
            <span className="numeric text-muted-foreground/60">
              {docs.invoices.length}
            </span>
          </h2>
          <div className="space-y-3">
            {docs.invoices.map((inv) => (
              <Card
                key={inv.id}
                className="group shadow-card hover:shadow-card-hover rounded-2xl py-0 transition-all duration-200"
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <Link
                    href={`/portal/invoices/${inv.id}`}
                    className="flex min-w-0 flex-1 items-center gap-4"
                  >
                    <div className="bg-muted flex size-10 flex-shrink-0 items-center justify-center rounded-xl">
                      <FileText className="text-muted-foreground/70 size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="numeric text-foreground truncate text-sm font-semibold">
                        {inv.invoiceNumber}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {inv.eventName ?? "—"} &middot;{" "}
                        <span className="numeric">
                          {formatINR(inv.totalAmount)}
                        </span>
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
                    className="text-muted-foreground hover:text-primary hover:border-primary/30 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                    title="Download PDF"
                  >
                    <Download className="size-3.5" />
                    <span className="hidden sm:inline">PDF</span>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
