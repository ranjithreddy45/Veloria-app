import type { Metadata } from "next";
import { CheckCircle2, FileWarning } from "lucide-react";
import { format } from "date-fns";

import { getPublicSignatureRequest } from "@/actions/signature-public.actions";
import { SignPad } from "./_components/sign-pad";

export const metadata: Metadata = {
  title: "Sign your booking confirmation — Veloria Grand",
};

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await getPublicSignatureRequest(token);

  if (!res.success) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <FileWarning className="mx-auto size-10 text-amber-500" />
        <h1 className="mt-4 text-lg font-bold text-zinc-900 dark:text-zinc-100">
          This signing link isn&apos;t valid
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may have expired, already been completed, or been
          withdrawn. Please contact us for an updated link.
        </p>
      </div>
    );
  }

  const doc = res.data;
  const alreadySigned = doc.status === "SIGNED" || doc.isLocked;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {doc.documentTitle}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {doc.eventName}
        </p>
      </div>

      {/* Frozen, server-generated document. Safe to render as HTML because
          buildSignatureDocumentHtml() escapes every dynamic value. */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm dark:bg-zinc-900 sm:p-7">
        <div
          className="signature-document text-sm leading-relaxed text-zinc-800 dark:text-zinc-200"
          dangerouslySetInnerHTML={{ __html: doc.documentBody }}
        />
      </div>

      {alreadySigned ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <CheckCircle2 className="size-9 text-emerald-600" />
          <p className="text-base font-semibold text-emerald-800 dark:text-emerald-300">
            This document has been signed
          </p>
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {doc.signerName ? `Signed by ${doc.signerName}` : "Signed"}
            {doc.signedAt
              ? ` on ${format(new Date(doc.signedAt), "d MMM yyyy, h:mm a")}`
              : ""}
            . Thank you — no further action is needed.
          </p>
        </div>
      ) : (
        <SignPad
          token={token}
          defaultSignerName={doc.signerName ?? ""}
        />
      )}
    </div>
  );
}
