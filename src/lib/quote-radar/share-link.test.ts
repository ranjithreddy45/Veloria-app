import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { decideQuotationPdfAccess, shareTokenParam } from "@/app/api/quotations/[id]/pdf/access";
import { ensureQuoteShareLink, quotationPdfShareUrl, type ShareableQuotation } from "./share-link";

// ============================================================
// The share link behind "Send to customer" by email. No database: the helper
// gets a fake client, and the emailed link is checked against the printout's
// own rule (access.ts next to /api/quotations/[id]/pdf) for a visitor who
// isn't signed in, which is who opens a quotation email.
// ============================================================

const NOW = new Date("2030-01-10T06:00:00.000Z");
const APP = "https://app.theveloriagrand.com";
const LIVE = "Zq4mVb7nT1xR9sK2pL6wYc3d"; // base64url, the shape generateShareToken() issues
const STALE = "Hk8pWq2mXc5vBn7rTy4uLs1a";

const quotation = (over: Partial<ShareableQuotation> = {}): ShareableQuotation => ({
  id: "q-asha",
  quoteGroupId: null,
  clientName: "Asha Rao",
  clientPhone: "+919876543210",
  occasion: "Wedding",
  eventDate: new Date("2030-02-14T00:00:00.000Z"),
  timeSlot: "EVENING",
  grandTotal: new Prisma.Decimal(250000),
  leadId: "lead-asha",
  contactId: "contact-asha",
  venueId: "venue-grand",
  shareLinkToken: null,
  ...over,
});

interface LinkRow {
  id: string;
  token: string;
  status: string;
  expiresAt: Date | null;
  payInvoiceId: string | null;
}

/** A client whose ACTIVE-link lookup returns `rows`, newest first as the helper orders them. */
function fakeDb(rows: LinkRow[] = []) {
  const findMany = vi.fn(async () => rows);
  const create = vi.fn(async (args: { data: { token: string } }) => ({
    id: "link-new",
    token: args.data.token,
    payInvoiceId: null,
  }));
  const update = vi.fn(async () => ({}));
  const db = { quoteShareLink: { findMany, create }, salesQuotation: { update } } as unknown as Parameters<
    typeof ensureQuoteShareLink
  >[0];
  return { db, findMany, create, update };
}

/** The printout's decision for a visitor who isn't signed in and opens `url`. */
function openSignedOut(url: string, links: { token: string; status: string; expiresAt: Date | null }[]) {
  return decideQuotationPdfAccess({
    contactId: "contact-asha",
    viewer: null,
    verifiedContactIds: [],
    token: shareTokenParam(new URL(url).searchParams.get("token")),
    shareLinks: links,
    now: NOW,
  });
}

describe("quotationPdfShareUrl: the link in the quotation email", () => {
  it("is absolute and carries the share token the printout reads back", () => {
    const url = quotationPdfShareUrl(APP, "q-asha", LIVE);
    expect(url).toBe(`${APP}/api/quotations/q-asha/pdf?token=${LIVE}`);
    expect(new URL(url).pathname).toBe("/api/quotations/q-asha/pdf");
    expect(shareTokenParam(new URL(url).searchParams.get("token"))).toBe(LIVE);
  });

  it("drops a trailing slash on the app URL and encodes the id", () => {
    expect(quotationPdfShareUrl("http://localhost:3000/", "q 1", LIVE)).toBe(
      `http://localhost:3000/api/quotations/q%201/pdf?token=${LIVE}`
    );
  });
});

describe("ensureQuoteShareLink: reuse the live link, or mint one", () => {
  it("reuses the newest live link, skipping an ACTIVE one past its expiry, and stamps the quotation", async () => {
    const { db, findMany, create, update } = fakeDb([
      { id: "link-stale", token: STALE, status: "ACTIVE", expiresAt: new Date(NOW.getTime() - 1), payInvoiceId: null },
      { id: "link-live", token: LIVE, status: "ACTIVE", expiresAt: null, payInvoiceId: "inv-1" },
    ]);
    const link = await ensureQuoteShareLink(db, quotation(), { actorId: "rep-1", now: NOW });

    expect(link).toEqual({ id: "link-live", token: LIVE, payInvoiceId: "inv-1", created: false });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { primaryQuotationId: "q-asha", status: "ACTIVE" } })
    );
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ where: { id: "q-asha" }, data: { shareLinkToken: LIVE } });
  });

  it("leaves the quotation alone when it already points at the live link", async () => {
    const { db, update } = fakeDb([{ id: "link-live", token: LIVE, status: "ACTIVE", expiresAt: null, payInvoiceId: null }]);
    await ensureQuoteShareLink(db, quotation({ shareLinkToken: LIVE }), { actorId: "rep-1", now: NOW });
    expect(update).not.toHaveBeenCalled();
  });

  it("mints an ACTIVE link from the quotation's headline when none is live, and stamps it", async () => {
    const { db, create, update } = fakeDb([
      { id: "link-stale", token: STALE, status: "ACTIVE", expiresAt: new Date(NOW.getTime() - 1), payInvoiceId: null },
    ]);
    const link = await ensureQuoteShareLink(db, quotation(), { actorId: "rep-1", now: NOW });

    expect(link.created).toBe(true);
    expect(link.token).not.toBe(STALE);
    expect(shareTokenParam(link.token)).toBe(link.token);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          token: link.token,
          status: "ACTIVE",
          primaryQuotationId: "q-asha",
          contactId: "contact-asha",
          clientName: "Asha Rao",
          createdById: "rep-1",
        }),
      })
    );
    expect(update).toHaveBeenCalledWith({ where: { id: "q-asha" }, data: { shareLinkToken: link.token } });
  });
});

describe("the emailed link, as the printout sees it", () => {
  it("opens for a customer who isn't signed in, unlike the tokenless link, until the share link is revoked", async () => {
    const { db } = fakeDb();
    const link = await ensureQuoteShareLink(db, quotation(), { actorId: "rep-1", now: NOW });
    const url = quotationPdfShareUrl(APP, "q-asha", link.token);
    const minted = { token: link.token, status: "ACTIVE", expiresAt: null };

    expect(openSignedOut(url, [minted])).toEqual({ allowed: true, via: "SHARE_LINK" });
    // What the email linked to before: no token, so nothing opens.
    expect(openSignedOut(`${APP}/api/quotations/q-asha/pdf`, [minted])).toEqual({ allowed: false });
    expect(openSignedOut(url, [{ ...minted, status: "REVOKED" }])).toEqual({ allowed: false });
  });
});
