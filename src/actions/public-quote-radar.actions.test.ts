import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  quoteShareLink: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  quoteView: { create: vi.fn() },
  lead: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));
const m = vi.hoisted(() => ({ notifyAwait: vi.fn(), auth: vi.fn(), ua: "Mozilla/5.0 (iPhone)" }));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/notify", () => ({ notifyAwait: m.notifyAwait }));
vi.mock("@/../auth", () => ({ auth: m.auth }));
vi.mock("next/headers", () => ({
  headers: async () => new Map([["user-agent", m.ua]]) as unknown as Headers,
}));
vi.mock("@/lib/hr/geo", () => ({ clientIpOfHeaders: () => "1.2.3.4" }));

import { recordQuoteView } from "./public-quote-radar.actions";

const TOKEN = "a".repeat(32);
const link = {
  id: "link1",
  status: "ACTIVE",
  expiresAt: null,
  leadId: "lead1",
  createdById: "sharer",
  clientName: "Priya Sharma",
  occasion: "Wedding",
  eventDate: new Date("2027-02-14T00:00:00Z"),
  grandTotal: 450000,
  viewCount: 0,
};

describe("recordQuoteView → quote-opened alert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.ua = "Mozilla/5.0 (iPhone)";
    m.auth.mockResolvedValue(null);
    db.quoteShareLink.findUnique.mockResolvedValue(link);
    db.$transaction.mockResolvedValue([]);
    db.lead.findUnique.mockResolvedValue({ assignedToId: "owner", deletedAt: null });
    db.user.findUnique.mockResolvedValue({ isActive: true, role: "SALES_EXEC" });
    m.notifyAwait.mockResolvedValue(undefined);
  });

  it("tells the lead owner on the first real open", async () => {
    db.quoteShareLink.updateMany.mockResolvedValueOnce({ count: 1 }); // firstViewedAt was null
    const res = await recordQuoteView({ token: TOKEN });
    expect(res.recorded).toBe(true);
    const n = m.notifyAwait.mock.calls[0][0];
    expect(n.userId).toBe("owner");
    expect(n.title).toBe("Priya Sharma just opened your quote");
    expect(n.message).toContain("₹4,50,000");
    expect(n.message).toContain("Wedding on 14 Feb 2027");
    expect(n.actionUrl).toBe("/leads/lead1");
  });

  it("stays quiet on a quick second look in the same sitting", async () => {
    db.quoteShareLink.updateMany
      .mockResolvedValueOnce({ count: 0 }) // already opened
      .mockResolvedValueOnce({ count: 0 }); // last view < 6h ago
    await recordQuoteView({ token: TOKEN });
    expect(m.notifyAwait).not.toHaveBeenCalled();
    expect(db.quoteShareLink.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lastViewedAt: expect.any(Date) } })
    );
  });

  it("alerts again when the customer comes back after a gap", async () => {
    db.quoteShareLink.findUnique.mockResolvedValue({ ...link, viewCount: 2 });
    db.quoteShareLink.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    await recordQuoteView({ token: TOKEN });
    const n = m.notifyAwait.mock.calls[0][0];
    expect(n.title).toBe("Priya Sharma is looking at your quote again");
    expect(n.message).toContain("opened 3 times");
  });

  it("a rep checking their own link is not a customer view", async () => {
    m.auth.mockResolvedValue({ user: { id: "rep", role: "SALES_EXEC" } });
    const res = await recordQuoteView({ token: TOKEN });
    expect(res.recorded).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(m.notifyAwait).not.toHaveBeenCalled();
  });

  it("a WhatsApp link preview never alerts", async () => {
    m.ua = "WhatsApp/2.23.20.0";
    await recordQuoteView({ token: TOKEN });
    expect(db.quoteShareLink.updateMany).not.toHaveBeenCalled();
    expect(m.notifyAwait).not.toHaveBeenCalled();
  });

  it("falls back to the rep who shared it when the owner has left", async () => {
    db.quoteShareLink.updateMany.mockResolvedValueOnce({ count: 1 });
    db.user.findUnique
      .mockResolvedValueOnce({ isActive: false, role: "SALES_EXEC" }) // owner
      .mockResolvedValueOnce({ isActive: true, role: "SALES_EXEC" }); // sharer
    await recordQuoteView({ token: TOKEN });
    expect(m.notifyAwait.mock.calls[0][0].userId).toBe("sharer");
  });
});
