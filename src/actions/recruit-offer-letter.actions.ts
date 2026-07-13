"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Recruitment — Offer-letter generation.
// New file (recruit.actions.ts / recruit-candidate.actions.ts are off-limits).
// Rec* models use relationless string FKs, so candidate names + job titles are
// resolved via small lookups. "PDF" = branded HTML + window.print(); no PDF lib.
//
// AUTH: recruit:read for reads, recruit:write for writes (none here — this is a
// read-only generation surface).
// ============================================================

async function requireRole(): Promise<string | null> {
  const session = await auth();
  const role = session?.user?.role;
  return role ?? null;
}
const canRead = (r: string | null) => !!r && hasPermission(r, "recruit:read");

// en-IN INR (whole rupees — CTC is an annual figure).
const inrFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const inr = (n: number) => inrFmt.format(Math.round(n));

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});
const fmtDate = (d: Date | null | undefined) => (d ? dateFmt.format(d) : "—");

// Escape values interpolated into the (HTML) template body so a candidate
// name/notes can never inject markup into the merged letter.
function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  );
}

const candidateName = (c: { firstName: string; lastName: string | null }) =>
  `${c.firstName} ${c.lastName ?? ""}`.trim();

// Built-in fallback letter, used when no HrDocumentTemplate exists. Uses the
// same {{placeholders}} as authored templates so the merge path is identical.
const DEFAULT_OFFER_TEMPLATE = `
<p>Date: {{today}}</p>
<p>Dear {{candidateName}},</p>
<p>We are delighted to extend to you an offer of employment for the position of
<strong>{{jobTitle}}</strong>. We were thoroughly impressed with your background
and are confident you will be a valuable addition to our team.</p>
<p>The details of your offer are as follows:</p>
<ul>
  <li><strong>Position:</strong> {{jobTitle}}</li>
  <li><strong>Annual Cost to Company (CTC):</strong> {{ctc}}</li>
  <li><strong>Proposed Date of Joining:</strong> {{joiningDate}}</li>
</ul>
<p>This offer is subject to the successful completion of our standard
pre-employment checks and the terms of your formal employment agreement.</p>
<p>We look forward to welcoming you aboard. Please sign and return a copy of this
letter to indicate your acceptance.</p>
<p>Warm regards,<br/>The Talent Acquisition Team</p>
`.trim();

function mergeTemplate(
  body: string,
  vars: {
    candidateName: string;
    jobTitle: string;
    ctc: string;
    joiningDate: string;
    today: string;
  }
): string {
  const map: Record<string, string> = {
    candidateName: esc(vars.candidateName),
    jobTitle: esc(vars.jobTitle),
    ctc: esc(vars.ctc),
    joiningDate: esc(vars.joiningDate),
    today: esc(vars.today),
  };
  // Replace {{key}} (with optional surrounding whitespace). Unknown tokens are
  // left untouched so an author sees the miss rather than a blank.
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, key: string) =>
    key in map ? map[key] : whole
  );
}

// ============================================================
// listOffers — every offer with candidate name + job title + ctc (Number).
// ============================================================
export async function listOffers() {
  if (!canRead(await requireRole())) return [];

  const offers = await prisma.recOffer.findMany({
    orderBy: { createdAt: "desc" },
  });
  if (offers.length === 0) return [];

  const candidateIds = [...new Set(offers.map((o) => o.candidateId))];
  const jobIds = [...new Set(offers.map((o) => o.jobOpeningId).filter((x): x is string => !!x))];

  const [candidates, jobs] = await Promise.all([
    prisma.recCandidate.findMany({
      where: { id: { in: candidateIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    jobIds.length
      ? prisma.recJobOpening.findMany({
          where: { id: { in: jobIds } },
          select: { id: true, postingTitle: true },
        })
      : Promise.resolve([] as { id: string; postingTitle: string }[]),
  ]);

  const cand = new Map(candidates.map((c) => [c.id, c]));
  const jobTitle = new Map(jobs.map((j) => [j.id, j.postingTitle]));

  return offers.map((o) => {
    const c = cand.get(o.candidateId);
    return {
      id: o.id,
      candidateId: o.candidateId,
      candidateName: c ? candidateName(c) : "Unknown candidate",
      candidateEmail: c?.email ?? null,
      jobOpeningId: o.jobOpeningId,
      jobTitle: o.jobOpeningId ? jobTitle.get(o.jobOpeningId) ?? null : null,
      ctc: Number(o.ctc),
      joiningDate: o.joiningDate ? o.joiningDate.toISOString() : null,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    };
  });
}

// ============================================================
// listOfferTemplates — HrDocumentTemplate rows usable as letters.
// ============================================================
export async function listOfferTemplates() {
  if (!canRead(await requireRole())) return [];

  const rows = await prisma.hrDocumentTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return rows.map((t) => ({ id: t.id, name: t.name }));
}

// ============================================================
// getOfferLetter — merged, ready-to-print letter body for one offer.
// templateId is optional: when omitted we pick a sensible active template
// (one whose name mentions "offer" first, else the first active), and finally
// fall back to the built-in default letter.
// ============================================================
export async function getOfferLetter(offerId: string, templateId?: string) {
  if (!canRead(await requireRole())) return null;

  const offer = await prisma.recOffer.findUnique({ where: { id: offerId } });
  if (!offer) return null;

  const [candidate, job] = await Promise.all([
    prisma.recCandidate.findUnique({
      where: { id: offer.candidateId },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, city: true },
    }),
    offer.jobOpeningId
      ? prisma.recJobOpening.findUnique({
          where: { id: offer.jobOpeningId },
          select: { id: true, postingTitle: true },
        })
      : Promise.resolve(null),
  ]);

  // Resolve the template body.
  let templateBody = DEFAULT_OFFER_TEMPLATE;
  let templateName: string | null = null;
  if (templateId) {
    const t = await prisma.hrDocumentTemplate.findUnique({ where: { id: templateId } });
    if (t?.isActive && t.body.trim()) {
      templateBody = t.body;
      templateName = t.name;
    }
  } else {
    const actives = await prisma.hrDocumentTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, body: true },
    });
    const chosen =
      actives.find((t) => /offer/i.test(t.name) && t.body.trim()) ??
      actives.find((t) => t.body.trim());
    if (chosen) {
      templateBody = chosen.body;
      templateName = chosen.name;
    }
  }

  const name = candidate ? candidateName(candidate) : "Candidate";
  const title = job?.postingTitle ?? "the offered position";

  const mergedHtml = mergeTemplate(templateBody, {
    candidateName: name,
    jobTitle: title,
    ctc: inr(Number(offer.ctc)),
    joiningDate: fmtDate(offer.joiningDate),
    today: fmtDate(new Date()),
  });

  return {
    offer: {
      id: offer.id,
      candidateId: offer.candidateId,
      jobOpeningId: offer.jobOpeningId,
      ctc: Number(offer.ctc),
      ctcFormatted: inr(Number(offer.ctc)),
      joiningDate: offer.joiningDate ? offer.joiningDate.toISOString() : null,
      joiningDateFormatted: fmtDate(offer.joiningDate),
      status: offer.status,
      notes: offer.notes,
    },
    candidate: candidate
      ? {
          id: candidate.id,
          name,
          email: candidate.email,
          phone: candidate.phone,
          city: candidate.city,
        }
      : null,
    job: job ? { id: job.id, title: job.postingTitle } : null,
    templateName,
    mergedHtml,
  };
}
