import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getOfferLetter } from "@/actions/recruit-offer-letter.actions";
import { PrintButton } from "../../_components/print-button";
import {
  COMPANY_LEGAL_LINE,
  COMPANY_ADDRESS,
  COMPANY_GSTIN,
} from "@/lib/constants";

export const metadata: Metadata = { title: "Offer Letter" };

const PLUM = "#2D1B3D";
const GOLD = "#C9A96E";

export default async function OfferLetterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "recruit:read")) redirect("/recruitment");

  const { id } = await params;
  const data = await getOfferLetter(id);
  if (!data) notFound();

  const { offer, candidate, job, mergedHtml, templateName } = data;

  return (
    <div className="space-y-4">
      {/* Print isolation: reveal only the letter sheet when printing. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #offer-letter-sheet, #offer-letter-sheet * { visibility: visible !important; }
          #offer-letter-sheet {
            position: absolute !important;
            left: 0; top: 0; right: 0;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: 0 !important;
          }
          .no-print { display: none !important; }
        }
        @page { size: A4 portrait; margin: 16mm; }
        #offer-letter-body p { margin: 0 0 11px; }
        #offer-letter-body ul { margin: 0 0 11px; padding-left: 20px; }
        #offer-letter-body li { margin: 0 0 5px; }
        #offer-letter-body strong { color: ${PLUM}; }
      `}</style>

      {/* Toolbar — hidden on print */}
      <div className="no-print flex items-center justify-between gap-3">
        <Link
          href="/recruitment/offers"
          className="inline-flex items-center gap-1.5 text-body font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to offers
        </Link>
        <div className="flex items-center gap-2">
          {templateName && (
            <span className="hidden text-detail text-muted-foreground sm:inline">
              Template: {templateName}
            </span>
          )}
          <PrintButton />
        </div>
      </div>

      {/* A4-ish letter sheet */}
      <div
        id="offer-letter-sheet"
        className="mx-auto w-full max-w-[820px] rounded-lg border border-border/70 bg-white p-10 text-body leading-relaxed text-[#2D1B3D] shadow-card sm:p-14"
        style={{ minHeight: "1000px" }}
      >
        {/* Letterhead */}
        <div
          className="flex items-start justify-between gap-4 pb-4"
          style={{ borderBottom: `3px solid ${GOLD}` }}
        >
          <div>
            <div className="text-title font-extrabold tracking-tight" style={{ color: PLUM }}>
              Veloria Grand
            </div>
            <div
              className="text-meta font-semibold uppercase tracking-[0.18em]"
              style={{ color: GOLD }}
            >
              Premium Event Venues
            </div>
            <div className="mt-1 text-meta text-[#6b5b73]">{COMPANY_LEGAL_LINE}</div>
            <div className="text-meta text-[#6b5b73]">{COMPANY_ADDRESS}</div>
            {COMPANY_GSTIN && (
              <div className="text-meta text-[#6b5b73]">GSTIN: {COMPANY_GSTIN}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-copy font-bold" style={{ color: PLUM }}>
              Letter of Offer
            </div>
            <div className="text-meta text-[#6b5b73]">Private &amp; Confidential</div>
          </div>
        </div>

        {/* Offer summary chips */}
        <div className="my-6 grid grid-cols-2 gap-x-6 gap-y-2 text-detail sm:grid-cols-3">
          <Field label="Candidate" value={candidate?.name ?? "—"} />
          <Field label="Position" value={job?.title ?? "—"} />
          <Field label="Annual CTC" value={offer.ctcFormatted} />
          <Field label="Joining Date" value={offer.joiningDateFormatted} />
          {candidate?.email && <Field label="Email" value={candidate.email} />}
          <Field label="Status" value={offer.status} />
        </div>

        {/* Merged letter body (author-controlled HR template — values escaped in action) */}
        <div
          id="offer-letter-body"
          className="text-body leading-[1.7]"
          dangerouslySetInnerHTML={{ __html: mergedHtml }}
        />

        {/* Footer */}
        <div
          className="mt-10 flex items-center justify-between pt-4 text-meta text-[#6b5b73]"
          style={{ borderTop: "1px solid #e6dccb" }}
        >
          <span>This offer letter is issued electronically and is valid without a signature.</span>
          <span>{COMPANY_LEGAL_LINE}</span>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-dashed border-[#e6dccb] pb-1.5">
      <span className="text-meta font-semibold uppercase tracking-[0.06em] text-[#9a8ca3]">
        {label}
      </span>
      <span className="font-medium text-[#2D1B3D]">{value}</span>
    </div>
  );
}
