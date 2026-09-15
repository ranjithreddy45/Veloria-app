import { describe, it, expect, vi, beforeEach } from "vitest";

// A booking cancelled while its customer was paying (a checkout left open past
// its hold's release, or a team cancellation) must never be confirmed by that
// payment: its slot may belong to someone else by now. The money is recorded
// by the capture path; maybeConfirmBookingOnPayment only ever acts on HOLD.

const h = vi.hoisted(() => ({
  db: {
    invoice: { findUnique: vi.fn() },
    booking: { updateMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
  notify: vi.fn(),
  initArtifacts: vi.fn(),
  provision: vi.fn(),
}));

vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: h.db }));
vi.mock("@/lib/notify", () => ({ notify: h.notify }));
vi.mock("@/lib/customer-notify", () => ({ notifyCustomer: vi.fn() }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/sms", () => ({ sendSMS: vi.fn(), isSmsConfigured: () => false }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: vi.fn() }));
vi.mock("@/lib/ops/provision", () => ({ provisionEventOperations: h.provision }));
vi.mock("@/lib/ops-alert", () => ({ reportSystemFailure: vi.fn() }));
vi.mock("@/lib/sales/ops-assignment", () => ({ notifyOpsAssignees: vi.fn(), triggerVendorsForBooking: vi.fn() }));
vi.mock("@/lib/sales/booking-confirmation-artifacts", () => ({ initBookingConfirmationArtifacts: h.initArtifacts }));

import { maybeConfirmBookingOnPayment } from "./confirm-booking";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("maybeConfirmBookingOnPayment and a cancelled booking", () => {
  it("never confirms a CANCELLED booking, even with its whole invoice paid", async () => {
    h.db.invoice.findUnique.mockResolvedValue({
      id: "inv-1",
      paidAmount: 100000,
      totalAmount: 100000,
      bookingId: "bk-1",
      booking: {
        id: "bk-1",
        status: "CANCELLED",
        totalAmount: 100000,
        bookingNumber: "VG-2026-0101",
        eventName: "Rao Wedding",
        date: new Date("2026-10-02T00:00:00.000Z"),
        timeSlot: "EVENING",
        guestCount: 300,
        createdById: "rep-1",
        contactId: "contact-1",
        eventType: "WEDDING",
        contact: { firstName: "Asha", lastName: "Rao", email: null, phone: null },
        venue: { name: "Grand Hall" },
        createdBy: { name: "Rep", email: null, phone: null },
      },
    });

    await maybeConfirmBookingOnPayment("inv-1");

    expect(h.db.booking.updateMany).not.toHaveBeenCalled();
    expect(h.notify).not.toHaveBeenCalled();
    expect(h.initArtifacts).not.toHaveBeenCalled();
    expect(h.provision).not.toHaveBeenCalled();
  });
});
