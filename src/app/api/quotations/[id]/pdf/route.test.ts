import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// /api/quotations/[id]/pdf: who may open a quotation printout, and which
// quotations it prints. The printout carries the client's name and phone,
// pricing and bank details, so the id alone opens nothing: it takes a team
// login with quotes:read, the customer's verified login, or ?token= of a live
// /q share link. For those viewers a quotation the customer accepted
// (CONVERTED) opens, APPROVED and SENT open as before, and drafts and anything
// not finalised don't. Prisma, the session and the verified-contact lookup
// are mocked.
// ============================================================

const db = vi.hoisted(() => ({
  salesQuotation: { findUnique: vi.fn() },
  quoteShareLink: { findMany: vi.fn() },
}));
const authMock = vi.hoisted(() => vi.fn());
const verifiedContactIds = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/portal-identity", () => ({
  getVerifiedContactIds: (userId: string) => verifiedContactIds(userId),
}));

import { GET } from "./route";

const SNAPSHOT = {
  lines: [{ sl: 1, particulars: "Hall & décor", plan: "Evening", amount: 200000 }],
  subtotal: 200000,
  discountAmount: 0,
  discountPct: 0,
  taxRate: 0.05,
  tax: 10000,
  grandTotal: 210000,
  paymentSchedule: [{ label: "Booking advance", pct: 20, dueHint: "To block the date", amount: 42000 }],
};

function quotation(status: string) {
  return {
    id: "q1",
    quoteNumber: "VG-Q-00042",
    status,
    inputsJson: {},
    outputsJson: SNAPSHOT,
    clientName: "Asha Rao",
    clientPhone: "+919876543210",
    occasion: "Wedding",
    eventDate: new Date("2030-06-20T00:00:00.000Z"),
    timeSlot: null,
    guestCount: 250,
    createdAt: new Date("2030-01-10T06:00:00.000Z"),
    contactId: "contact-asha",
    venue: { name: "Grand Hall" },
    contact: null,
  };
}

const TOKEN = "Zq4mVb7nT1xR9sK2pL6wYc3d"; // base64url, the shape generateShareToken() issues
const liveLink = { token: TOKEN, status: "ACTIVE", expiresAt: null as Date | null };

const staff = (over: Record<string, unknown> = {}) => ({
  user: { id: "u-sales", role: "SALES_EXEC", perms: ["quotes:read"], ...over },
});
const customer = { user: { id: "u-asha", role: "CLIENT", perms: ["portal:access"] } };

interface OpenOptions {
  /** Quotation status; null = no such quotation. Default SENT. */
  status?: string | null;
  session?: unknown;
  token?: string;
  verified?: string[];
  links?: { token: string; status: string; expiresAt: Date | null }[];
}

async function open(o: OpenOptions = {}) {
  db.salesQuotation.findUnique.mockResolvedValue(o.status === null ? null : quotation(o.status ?? "SENT"));
  authMock.mockResolvedValue(o.session ?? null);
  verifiedContactIds.mockResolvedValue(o.verified ?? []);
  db.quoteShareLink.findMany.mockResolvedValue(o.links ?? []);
  const query = o.token === undefined ? "" : `?token=${encodeURIComponent(o.token)}`;
  const res = await GET(new Request(`http://localhost/api/quotations/q1/pdf${query}`), {
    params: Promise.resolve({ id: "q1" }),
  });
  return { status: res.status, body: await res.text(), headers: res.headers };
}

function expectNothingLeaked(body: string) {
  expect(body).not.toContain("VG-Q-00042");
  expect(body).not.toContain("Asha Rao");
  expect(body).not.toContain("+919876543210");
  expect(body).not.toContain("44772679325"); // bank account number
}

beforeEach(() => {
  db.salesQuotation.findUnique.mockReset();
  db.quoteShareLink.findMany.mockReset();
  authMock.mockReset();
  verifiedContactIds.mockReset();
});

describe("quotation PDF: the id alone opens nothing", () => {
  it("refuses a signed-out visitor who has only the quotation id", async () => {
    const r = await open();
    expect(r.status).toBe(404);
    expectNothingLeaked(r.body);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(db.quoteShareLink.findMany).not.toHaveBeenCalled();
    expect(verifiedContactIds).not.toHaveBeenCalled();
  });

  it("gives a stranger the same answer for a draft, so the id reveals nothing about it", async () => {
    const r = await open({ status: "DRAFT" });
    expect(r.status).toBe(404);
    expectNothingLeaked(r.body);
  });

  it("returns 404 for an unknown quotation", async () => {
    expect((await open({ status: null, session: staff() })).status).toBe(404);
  });
});

describe("quotation PDF: team logins", () => {
  it("opens for a team login with quotes:read, never cached, indexed or leaked through Referer", async () => {
    const r = await open({ session: staff() });
    expect(r.status).toBe(200);
    expect(r.body).toContain("VG-Q-00042");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(verifiedContactIds).not.toHaveBeenCalled();
  });

  it("opens for an admin", async () => {
    expect((await open({ session: staff({ role: "ADMIN", perms: ["*"] }) })).status).toBe(200);
  });

  it("follows the session's effective permissions over the role's defaults", async () => {
    const r = await open({ session: staff({ perms: ["leads:read"] }) });
    expect(r.status).toBe(404);
    expectNothingLeaked(r.body);
  });

  it("treats a session that still owes its second factor as signed out", async () => {
    const r = await open({ session: staff({ twoFactorPending: true }), verified: ["contact-asha"] });
    expect(r.status).toBe(404);
    expectNothingLeaked(r.body);
    expect(verifiedContactIds).not.toHaveBeenCalled();
  });
});

describe("quotation PDF: the customer's own login", () => {
  it("opens when the login's verified contacts include the quotation's contact", async () => {
    const r = await open({ session: customer, verified: ["contact-asha"] });
    expect(r.status).toBe(200);
    expect(r.body).toContain("VG-Q-00042");
    expect(verifiedContactIds).toHaveBeenCalledWith("u-asha");
  });

  it("refuses another customer's login", async () => {
    const r = await open({ session: customer, verified: ["contact-someone-else"] });
    expect(r.status).toBe(404);
    expectNothingLeaked(r.body);
  });
});

describe("quotation PDF: ?token= of the /q share link", () => {
  it("opens, signed out, with the token of a live link that shows this quotation", async () => {
    const r = await open({ token: TOKEN, links: [liveLink] });
    expect(r.status).toBe(200);
    expect(r.body).toContain("VG-Q-00042");
    expect(db.quoteShareLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ primaryQuotationId: "q1" }, { tiers: { some: { quotationId: "q1" } } }] },
      })
    );
  });

  it("refuses a wrong token, a revoked link, an expired link and a token with no link", async () => {
    expect((await open({ token: "Wrong0000000000000000000", links: [liveLink] })).status).toBe(404);
    expect((await open({ token: TOKEN, links: [{ ...liveLink, status: "REVOKED" }] })).status).toBe(404);
    expect((await open({ token: TOKEN, links: [{ ...liveLink, expiresAt: new Date("2000-01-01T00:00:00.000Z") }] })).status).toBe(404);
    expect((await open({ token: TOKEN, links: [] })).status).toBe(404);
  });
});

describe("quotation PDF: which quotations open", () => {
  it("opens a CONVERTED quotation (the customer accepted it) and no longer calls it a 15-day offer", async () => {
    const r = await open({ status: "CONVERTED", session: customer, verified: ["contact-asha"] });
    expect(r.status).toBe(200);
    expect(r.body).toContain("VG-Q-00042");
    expect(r.body).toContain("This quotation was accepted and converted to a booking.");
    expect(r.body).not.toContain("valid for 15 days");
  });

  it.each(["APPROVED", "SENT"])("opens a %s quotation as before", async (status) => {
    const r = await open({ status, token: TOKEN, links: [liveLink] });
    expect(r.status).toBe(200);
    expect(r.body).toContain("VG-Q-00042");
    expect(r.body).toContain("This quotation is valid for 15 days.");
  });

  it.each(["DRAFT", "PENDING_APPROVAL", "REJECTED"])("refuses a %s quotation, even to the team", async (status) => {
    const r = await open({ status, session: staff() });
    expect(r.status).toBe(403);
    expect(r.body).not.toContain("VG-Q-00042");
  });
});
