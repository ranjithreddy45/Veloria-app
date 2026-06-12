// End-to-end test of the Sales quotation → booking → payment → confirm → ops
// pipeline against the real local DB. Mocks auth + next/cache + the outbound
// channels (email/SMS/WhatsApp) and drives the REAL server actions + the
// payment-confirm + ops-handoff wiring.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue({ success: true }) }));
vi.mock("@/lib/sms", () => ({ sendSMSFireAndForget: vi.fn(), sendSMS: vi.fn().mockResolvedValue({ success: true }) }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: vi.fn().mockResolvedValue({ success: false }) }));
// next/server `after()` is used by createBooking — run the callback inline.
vi.mock("next/server", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, after: (fn: () => unknown) => Promise.resolve().then(fn) };
});

import { prisma } from "@/lib/prisma";
import { createSalesQuotation, submitSalesQuotation, approveSalesQuotation } from "./sales-quotation.actions";
import { blockSlotFromQuotation } from "./quotation-booking.actions";
import { createBookingInvoiceFromQuotation } from "./booking-invoice.actions";
import { recordPayment } from "./payment.actions";

const U = Date.now();
let adminId: string;
let contactId: string;
let venueId: string;
let templateId: string;
let quotationId: string;
let bookingId: string;
let invoiceId: string;

const setActor = (id: string, role: string) => authMock.mockResolvedValue({ user: { id, role, name: role } });

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: { name: "Quote Admin", email: `quote-admin-${U}@t.local`, role: "ADMIN", phone: "+919900000000", isActive: true },
    select: { id: true },
  });
  adminId = admin.id;

  const contact = await prisma.contact.create({
    data: { firstName: "Ravi", lastName: "Kumar", phone: `+9198${String(U).slice(-8)}`, email: `cust-${U}@t.local` },
    select: { id: true },
  });
  contactId = contact.id;

  const venue = await prisma.venue.create({
    data: { name: `Grand Hall ${U}`, capacity: 300, pricePerSlot: 50000, amenities: [], isActive: true },
    select: { id: true },
  });
  venueId = venue.id;

  // SOP template for the ops-handoff step: 1 phase, 2 task definitions.
  const tmpl = await prisma.sOPTemplate.create({
    data: {
      name: `Birthday SOP ${U}`,
      eventType: "Birthday",
      isActive: true,
      isDefault: true,
      phases: {
        create: [
          {
            name: "Setup",
            phase: "SETUP",
            order: 0,
            taskDefinitions: {
              create: [
                { title: "Arrange decor", category: "DECOR", priority: "HIGH", order: 0, isMandatory: true },
                { title: "Test AV", category: "AV", priority: "MEDIUM", order: 1 },
              ],
            },
          },
        ],
      },
    },
    select: { id: true },
  });
  templateId = tmpl.id;

  setActor(adminId, "ADMIN");
});

afterAll(async () => {
  // Unwind in FK-safe order.
  if (bookingId) {
    await prisma.executionTask.deleteMany({ where: { phase: { plan: { bookingId } } } });
    await prisma.executionPhase.deleteMany({ where: { plan: { bookingId } } });
    await prisma.executionPlan.deleteMany({ where: { bookingId } });
  }
  await prisma.installment.deleteMany({ where: { invoice: { contactId } } });
  await prisma.payment.deleteMany({ where: { invoice: { contactId } } });
  await prisma.invoiceLineItem.deleteMany({ where: { invoice: { contactId } } });
  await prisma.invoice.deleteMany({ where: { contactId } });
  await prisma.salesQuotationTransition.deleteMany({ where: { quotation: { contactId } } });
  await prisma.salesQuotation.deleteMany({ where: { contactId } });
  if (bookingId) await prisma.booking.deleteMany({ where: { id: bookingId } });
  await prisma.sOPTaskDefinition.deleteMany({ where: { phase: { templateId } } });
  await prisma.sOPPhase.deleteMany({ where: { templateId } });
  await prisma.sOPTemplate.deleteMany({ where: { id: templateId } });
  // Workflows fired on booking-create may attach comms to the contact.
  await prisma.communication.deleteMany({ where: { contactId } });
  await prisma.whatsAppMessage.deleteMany({ where: { contactId } });
  await prisma.notification.deleteMany({ where: { actionUrl: { contains: bookingId || "__none__" } } });
  await prisma.contact.deleteMany({ where: { id: contactId } });
  await prisma.venue.deleteMany({ where: { id: venueId } });
  await prisma.activityLog.deleteMany({ where: { userId: adminId } });
  await prisma.notification.deleteMany({ where: { userId: adminId } });
  // Booking-create workflows may spawn tasks owned by the actor / booking.
  const taskWhere = { OR: [{ creatorId: adminId }, ...(bookingId ? [{ bookingId }] : [])] };
  await prisma.checklistItem.deleteMany({ where: { task: taskWhere } });
  await prisma.task.deleteMany({ where: taskWhere });
  await prisma.user.deleteMany({ where: { id: adminId } });
});

describe("Sales quotation → booking → payment → confirm → ops (E2E)", () => {
  it("creates and approves a quotation built from the planner", async () => {
    const created = await createSalesQuotation(
      { guestCount: 120, foodPackageId: "veg_gold", decorId: "babyshower_premium", photographyId: "bday" },
      { clientName: "Ravi Kumar", clientPhone: "+919812345678", clientEmail: `cust-${U}@t.local`, occasion: "Birthday", eventDate: "2026-09-01", contactId, venueId }
    );
    expect(created.success).toBe(true);
    if (!created.success) return;
    quotationId = created.data.id;

    // Planner oracle: 83,880 + 25,000 + 15,000 = 123,880 → +5% = 130,074
    const row = await prisma.salesQuotation.findUnique({ where: { id: quotationId }, select: { grandTotal: true } });
    expect(Math.round(Number(row!.grandTotal))).toBe(130074);

    expect((await submitSalesQuotation(quotationId)).success).toBe(true);
    expect((await approveSalesQuotation(quotationId)).success).toBe(true);
    const approved = await prisma.salesQuotation.findUnique({ where: { id: quotationId }, select: { status: true, outputsJson: true } });
    expect(approved!.status).toBe("APPROVED");
    expect(approved!.outputsJson).toBeTruthy(); // frozen snapshot
  });

  it("blocks the slot (creates a HOLD booking)", async () => {
    const res = await blockSlotFromQuotation(quotationId, { venueId, dateISO: "2026-09-01", timeSlot: "EVENING" });
    expect(res.success).toBe(true);
    if (!res.success) return;
    bookingId = res.data.bookingId;
    const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true, timeSlot: true } });
    expect(b!.status).toBe("HOLD");
    expect(b!.timeSlot).toBe("EVENING");
  });

  it("rejects a double-book of the same venue/date/slot", async () => {
    const res = await blockSlotFromQuotation(quotationId, { venueId, dateISO: "2026-09-01", timeSlot: "EVENING" });
    expect(res.success).toBe(false); // quote already has a booking
  });

  it("rejects a FULL_DAY block that overlaps an existing partial-slot booking", async () => {
    // A second quote tries to take the WHOLE day the EVENING slot is already on.
    const q2 = await createSalesQuotation(
      { guestCount: 50, foodPackageId: "veg_silver" },
      { clientName: "Overlap Test", contactId, venueId, eventDate: "2026-09-01" }
    );
    expect(q2.success).toBe(true);
    if (!q2.success) return;
    await submitSalesQuotation(q2.data.id);
    await approveSalesQuotation(q2.data.id);
    const res = await blockSlotFromQuotation(q2.data.id, { venueId, dateISO: "2026-09-01", timeSlot: "FULL_DAY" });
    expect(res.success).toBe(false); // FULL_DAY conflicts with the existing EVENING booking
    await prisma.salesQuotationTransition.deleteMany({ where: { quotationId: q2.data.id } });
    await prisma.salesQuotation.delete({ where: { id: q2.data.id } });
  });

  it("generates a 5%-tax, per-plate invoice with a 10/50/40 plan", async () => {
    const res = await createBookingInvoiceFromQuotation(quotationId);
    expect(res.success).toBe(true);
    if (!res.success) return;
    invoiceId = res.data.invoiceId;

    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { totalAmount: true, cgstRate: true, sgstRate: true, lineItems: true, installments: { orderBy: { order: "asc" } } },
    });
    // 5% total tax (2.5 + 2.5) → invoice total equals the quotation grand total.
    expect(Number(inv!.cgstRate) + Number(inv!.sgstRate)).toBe(5);
    expect(Math.round(Number(inv!.totalAmount))).toBe(130074);
    // Food line is per-plate: quantity = guests (120), unit price = 699.
    const food = inv!.lineItems.find((l) => l.description.startsWith("Food Plan"))!;
    expect(Number(food.quantity)).toBe(120);
    expect(Number(food.unitPrice)).toBe(699);
    // 10 / 50 / 40 installments that sum to the total.
    expect(inv!.installments.length).toBe(3);
    const sum = inv!.installments.reduce((s, i) => s + Number(i.amount), 0);
    expect(Math.round(sum)).toBe(130074);
    expect(Math.round(Number(inv!.installments[0].amount))).toBe(Math.round(130074 * 0.1));
  });

  it("auto-confirms the slot and stamps ops tasks once the 10% advance is paid", async () => {
    const advance = Math.round(130074 * 0.1); // 13,007
    const pay = await recordPayment({ invoiceId, amount: advance, method: "UPI", notes: "Booking advance" });
    expect(pay.success).toBe(true);

    // BookMyShow-style: booking flips HOLD → CONFIRMED.
    const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
    expect(b!.status).toBe("CONFIRMED");

    // Ops auto-tasks from the SOP template are now live on the booking.
    const plan = await prisma.executionPlan.findUnique({
      where: { bookingId },
      select: { sopTemplateId: true, phases: { include: { tasks: true } } },
    });
    expect(plan).toBeTruthy();
    expect(plan!.sopTemplateId).toBe(templateId);
    expect(plan!.phases.length).toBe(1);
    expect(plan!.phases[0].tasks.length).toBe(2);
    expect(plan!.phases[0].tasks.map((t) => t.title).sort()).toEqual(["Arrange decor", "Test AV"]);
  });
});
