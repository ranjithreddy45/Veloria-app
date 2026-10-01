import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Win-back engine: the direct-WhatsApp fallback path (no win-back cadence
// configured). Prisma, notifications and the provider are mocked.
// ============================================================

const db = vi.hoisted(() => {
  const table = () => ({
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  });
  return {
    lead: table(),
    contact: table(),
    invoice: table(),
    quoteShareLink: table(),
    salesQuotation: table(),
    winbackTarget: table(),
    cadence: table(),
  };
});
const sendWhatsApp = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/notify", () => ({ notifyAwait: vi.fn() }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/winback/enroll-into-cadence", () => ({ enrollEntityIntoCadence: vi.fn() }));
vi.mock("@/lib/integrations/whatsapp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/integrations/whatsapp")>()),
  sendWhatsApp,
}));

import { orderTemplateParams, WHATSAPP_TEMPLATES } from "@/lib/integrations/whatsapp";
import { runAbandonedQuoteWinback, runEventProximityWinback, runLostLeadRevivalWinback } from "./winback-engine";

const DAY_MS = 24 * 60 * 60 * 1000;

function proximityLead(over: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    title: "Reception enquiry",
    eventDate: new Date(Date.now() + 10 * DAY_MS),
    eventType: "RECEPTION",
    assignedToId: null,
    contactId: "c1",
    contact: { firstName: "Priya", lastName: "Rao", phone: "+91 98450 12345", deletedAt: null },
    deal: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.cadence.findFirst.mockResolvedValue(null); // no win-back cadence → direct WhatsApp fallback
  db.winbackTarget.findFirst.mockResolvedValue(null);
  db.winbackTarget.create.mockImplementation(async () => ({ id: "t1", status: "PENDING", createdAt: new Date(), coolOffUntil: null }));
  db.winbackTarget.update.mockResolvedValue({});
  sendWhatsApp.mockResolvedValue({ success: true, messageId: "wamid.1" });
});

describe("winback_event_proximity", () => {
  it("is sent with exactly the params the manual template list declares, in that order", async () => {
    db.lead.findMany.mockResolvedValue([proximityLead()]);

    await runEventProximityWinback();

    const declared = WHATSAPP_TEMPLATES.find((t) => t.name === "winback_event_proximity")!.params;
    expect(declared).toEqual(["customerName", "eventDate"]);
    const [message] = sendWhatsApp.mock.calls[0];
    expect(message.template).toBe("winback_event_proximity");
    expect(Object.keys(message.params)).toEqual([...declared]);
  });

  it("keeps a manual send in the declared order however the form filled it", () => {
    expect(Object.keys(orderTemplateParams("winback_event_proximity", { eventDate: "12 Oct", customerName: "Priya" })!)).toEqual([
      "customerName",
      "eventDate",
    ]);
    expect(orderTemplateParams("unknown_template", { b: "2", a: "1" })).toEqual({ b: "2", a: "1" });
    expect(orderTemplateParams("winback_event_proximity", undefined)).toBeUndefined();
  });
});

// ------------------------------------------------------------
// Backlog guard. A failed send leaves the target PENDING and the sweep
// retries it daily, so a fixed provider would flush weeks of win-backs at
// once. A target PENDING for more than WINBACK_MAX_PENDING_AGE_DAYS after it
// became sendable is skipped (and left untouched); eligibility itself is
// re-checked by each sweep's own query every run.
// ------------------------------------------------------------
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);

function viewedQuote(over: Record<string, unknown> = {}) {
  return {
    id: "link1",
    leadId: "lead1",
    contactId: "c1",
    primaryQuotationId: "q1",
    clientName: "Priya",
    clientPhone: "+91 98450 12345",
    occasion: "Reception",
    grandTotal: 250000,
    payInvoiceId: null,
    ...over,
  };
}

describe("abandoned-quote win-back guards", () => {
  beforeEach(() => {
    db.quoteShareLink.findMany.mockResolvedValue([viewedQuote()]);
    db.quoteShareLink.update.mockResolvedValue({});
    db.salesQuotation.findUnique.mockResolvedValue({ status: "SENT" });
    db.lead.findUnique.mockResolvedValue({ status: "QUALIFIED", assignedToId: null });
    db.contact.findUnique.mockResolvedValue({ firstName: "Priya", lastName: "Rao", phone: "+91 98450 12345", deletedAt: null });
  });

  it("nudges a fresh, unpaid, unaccepted quote", async () => {
    const result = await runAbandonedQuoteWinback();
    expect(result.fired).toBe(1);
    expect(sendWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ template: "winback_quote_followup" }));
  });

  it("only picks links last viewed inside the send window", async () => {
    await runAbandonedQuoteWinback();
    const { lastViewedAt } = db.quoteShareLink.findMany.mock.calls[0][0].where;
    // viewed ≥ N_DAYS_ABANDONED (2) days ago, and not more than 2 + 7 days ago
    expect(Math.round((Date.now() - lastViewedAt.lt.getTime()) / DAY_MS)).toBe(2);
    expect(Math.round((Date.now() - lastViewedAt.gte.getTime()) / DAY_MS)).toBe(9);
  });

  it.each([
    { label: "the quotation was converted to a booking", quotation: { status: "CONVERTED" }, lead: { status: "QUALIFIED", assignedToId: null } },
    { label: "the lead was won", quotation: { status: "SENT" }, lead: { status: "WON", assignedToId: null } },
  ])("never nudges once $label", async ({ quotation, lead }) => {
    db.salesQuotation.findUnique.mockResolvedValue(quotation);
    db.lead.findUnique.mockResolvedValue(lead);
    const result = await runAbandonedQuoteWinback();
    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(db.quoteShareLink.update).toHaveBeenCalledWith({ where: { id: "link1" }, data: { silentNudgeFiredAt: expect.any(Date) } });
  });

  it("does not send, or touch, a target left PENDING for over 7 days", async () => {
    db.winbackTarget.findFirst.mockResolvedValue({ id: "t1", status: "PENDING", createdAt: daysAgo(8) });
    const result = await runAbandonedQuoteWinback();
    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(db.winbackTarget.update).not.toHaveBeenCalled();
    expect(db.quoteShareLink.update).not.toHaveBeenCalled();
  });
});

describe("lost-lead and event-proximity win-back guards", () => {
  function lostLead() {
    return {
      id: "lead2",
      title: "Wedding enquiry",
      lostReason: "PRICE",
      updatedAt: daysAgo(100),
      assignedToId: null,
      eventType: "WEDDING",
      contactId: "c2",
      contact: { firstName: "Arjun", lastName: "K", phone: "+91 98450 54321", deletedAt: null },
    };
  }

  it("sends a lost-lead revival whose cool-off ended recently, however old its target", async () => {
    db.lead.findMany.mockResolvedValue([lostLead()]);
    db.winbackTarget.findFirst.mockResolvedValue({ id: "t2", status: "PENDING", createdAt: daysAgo(60) });
    db.winbackTarget.findUnique.mockResolvedValue({ coolOffUntil: daysAgo(3) });
    expect((await runLostLeadRevivalWinback()).fired).toBe(1);
  });

  it("skips a lost-lead revival still PENDING 7+ days after its cool-off ended", async () => {
    db.lead.findMany.mockResolvedValue([lostLead()]);
    db.winbackTarget.findFirst.mockResolvedValue({ id: "t2", status: "PENDING", createdAt: daysAgo(60) });
    db.winbackTarget.findUnique.mockResolvedValue({ coolOffUntil: daysAgo(10) });
    const result = await runLostLeadRevivalWinback();
    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it("skips an event-proximity target left PENDING for over 7 days", async () => {
    db.lead.findMany.mockResolvedValue([proximityLead()]);
    db.winbackTarget.findFirst.mockResolvedValue({ id: "t1", status: "PENDING", createdAt: daysAgo(8) });
    const result = await runEventProximityWinback();
    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it("still sends an event-proximity target retried within 7 days", async () => {
    db.lead.findMany.mockResolvedValue([proximityLead()]);
    db.winbackTarget.findFirst.mockResolvedValue({ id: "t1", status: "PENDING", createdAt: daysAgo(6) });
    expect((await runEventProximityWinback()).fired).toBe(1);
  });
});

describe("win-back template labels", () => {
  it("reads naturally after 'your' whatever casing the occasion was stored in", async () => {
    const { occasionLabel } = await import("./winback-engine");
    expect(occasionLabel("WEDDING")).toBe("wedding");
    expect(occasionLabel("Birthday Party")).toBe("birthday party");
    expect(occasionLabel("baby_shower")).toBe("baby shower");
    expect(occasionLabel("  Sangeet  ")).toBe("sangeet");
  });

  it("falls back to 'celebration', never 'your event' (which made 'for your your event')", async () => {
    const { occasionLabel } = await import("./winback-engine");
    for (const raw of [null, undefined, "", "   ", "NONE", "none", "N/A", "-"]) {
      expect(occasionLabel(raw as string | null | undefined)).toBe("celebration");
    }
  });

  it("formats the event date in IST, so a UTC server never shows the previous day", async () => {
    const { eventDateLabel } = await import("./winback-engine");
    // 14 Nov 2026 00:00 IST is 13 Nov 18:30 UTC.
    expect(eventDateLabel(new Date("2026-11-13T18:30:00.000Z"))).toBe("14 Nov 2026");
    expect(eventDateLabel(new Date("2026-11-14T00:00:00.000Z"))).toBe("14 Nov 2026");
    expect(eventDateLabel(null)).toBe("your event date");
  });
});
