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
      <div className="bg-card shadow-card mx-auto max-w-lg rounded-2xl border p-10 text-center">
        <FileWarning className="mx-auto size-9 text-warning" />
        <h1 className="text-foreground mt-5 text-h2">
          This signing link isn&apos;t valid
        </h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
          It may have expired, already been completed, or been withdrawn. Get in
          touch and we&apos;ll send a fresh link.
        </p>
      </div>
    );
  }

  const doc = res.data;
  const alreadySigned = doc.status === "SIGNED" || doc.isLocked;

  return (
    <div className="space-y-7">
      <div className="text-center">
        <p className="text-muted-foreground text-meta font-semibold uppercase tracking-[0.18em]">
          For your signature
        </p>
        <h1 className="text-foreground mt-3 text-h2 sm:text-h1">
          {doc.documentTitle}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">{doc.eventName}</p>
      </div>

      {/* Frozen, server-generated document. Safe to render as HTML because
          buildSignatureDocumentHtml() escapes every dynamic value. */}
      <div className="bg-card shadow-card rounded-2xl border p-6 sm:p-8">
        <div
          className="signature-document text-foreground/85 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: doc.documentBody }}
        />
      </div>

      {alreadySigned ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-success/25 bg-success/[0.07] p-8 text-center">
          <CheckCircle2 className="size-8 text-success" />
          <p className="font-editorial mt-1 text-title font-semibold text-success">
            This document has been signed
          </p>
          <p className="text-sm leading-relaxed text-success/85">
            {doc.signerName ? `Signed by ${doc.signerName}` : "Signed"}
            {doc.signedAt
              ? ` on ${format(new Date(doc.signedAt), "d MMM yyyy, h:mm a")}`
              : ""}
            . Thank you — nothing further is needed from you.
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
