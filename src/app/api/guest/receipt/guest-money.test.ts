import { describe, it, expect } from "vitest";
import { bookingBalance } from "@/app/(guest)/app/event/_components/event-view";
import { INSTALLMENT_STATUS_LABEL, INVOICE_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/customer-app/status-labels";
import {
  bookingRecordsWhere,
  canSeeOwnedRecord,
  decideDocumentAccess,
  formatIstDate,
  isCustomerVisibleContract,
  isCustomerVisibleInvoice,
  isCustomerVisiblePayment,
  isInvitedBooking,
  isIssuedInvoice,
  isLiveShareLink,
  isPayableInvoice,
  mayView,
  money,
  quotationLink,
  selectedBookingId,
  shapeInvoice,
  shapeReceipt,
  sortReceipts,
  sumMoney,
  summarizeInvoices,
  unlinkedRecordWhere,
  visibleBookingIds,
  type BookingRecordsWhere,
  type InvoiceSource,
  type OwnedRecord,
  type ViewerScope,
} from "./guest-money";

/** A Prisma Decimal stand-in: the app reads these with Number(). */
const dec = (s: string) => ({ toString: () => s, valueOf: () => s });

// b_own / b_later are the host's own bookings; b_invited is someone else's booking they were invited to.
const customer: ViewerScope = {
  preview: false,
  contactIds: ["c_host"],
  bookings: [{ id: "b_invited" }, { id: "b_own" }, { id: "b_later" }],
  booking: { id: "b_invited" }, // the next upcoming booking happens to be the invited one
  collaboratorRoles: { b_invited: "CO_HOST" },
};
/** A login that only ever accepted an invite: no contacts of its own. */
const collaboratorOnly: ViewerScope = {
  preview: false,
  contactIds: [],
  bookings: [{ id: "b_invited" }],
  booking: { id: "b_invited" },
  collaboratorRoles: { b_invited: "VIEWER" },
};
const preview: ViewerScope = { preview: true, contactIds: ["c_other"], bookings: [{ id: "b_x" }, { id: "b_y" }], booking: { id: "b_x" } };
const noPerms = () => false;
const allPerms = () => true;
const only = (...perms: string[]) => (p: string) => perms.includes(p);

/** Evaluates bookingRecordsWhere the way Postgres would, for the fields it uses. */
function matches(where: BookingRecordsWhere | null, rec: OwnedRecord): boolean {
  if (!where) return false;
  return where.OR.some((c) =>
    c.bookingId === null ? rec.bookingId === null && c.contactId.in.includes(rec.contactId) : rec.bookingId === c.bookingId
  );
}

describe("money()", () => {
  it("reads Decimal, string and number exactly as the team's screens do", () => {
    expect(money(dec("123456.78"))).toBe(123456.78);
    expect(money(dec("123456.78"))).toBe(Number(dec("123456.78")));
    expect(money("0.10")).toBe(0.1);
    expect(money(2500)).toBe(2500);
    expect(money(null)).toBe(0);
    expect(money(undefined)).toBe(0);
    expect(money("not money")).toBe(0);
  });

  it("adds stored fields to the paisa", () => {
    expect(sumMoney(dec("0.10"), dec("0.20"), null)).toBe(0.3);
    expect(sumMoney(dec("12187.50"), dec("12187.50"), dec("0.00"))).toBe(24375);
    expect(sumMoney()).toBe(0);
  });
});

describe("scope", () => {
  it("customers see their own bookings, never ones they were invited to; preview sees the previewed one", () => {
    expect(visibleBookingIds(customer)).toEqual(["b_own", "b_later"]);
    expect(visibleBookingIds(collaboratorOnly)).toEqual([]);
    expect(visibleBookingIds(preview)).toEqual(["b_x"]);
    expect(visibleBookingIds({ ...preview, booking: null })).toEqual([]);
  });

  it("knows which bookings are invitations", () => {
    expect(isInvitedBooking(customer, "b_invited")).toBe(true);
    expect(isInvitedBooking(customer, "b_own")).toBe(false);
    expect(isInvitedBooking(customer, "toString")).toBe(false);
    expect(isInvitedBooking(customer, null)).toBe(false);
    expect(isInvitedBooking(preview, "b_x")).toBe(false);
  });

  it("selects the requested booking if it is the viewer's own, else their first own booking", () => {
    expect(selectedBookingId(customer, "b_later")).toBe("b_later");
    expect(selectedBookingId(customer, "b_invited")).toBe("b_own");
    expect(selectedBookingId(customer, "b_someone_else")).toBe("b_own");
    expect(selectedBookingId({ ...customer, booking: { id: "b_later" } })).toBe("b_later");
    expect(selectedBookingId(collaboratorOnly, "b_invited")).toBeNull();
    expect(selectedBookingId(preview, "b_y")).toBe("b_x");
    expect(selectedBookingId({ preview: false, contactIds: ["c"], bookings: [], booking: null })).toBeNull();
  });

  it("unlinked records are the customer's own, never for preview or a collaborator-only login", () => {
    expect(unlinkedRecordWhere(customer)).toEqual({ bookingId: null, contactId: { in: ["c_host"] } });
    expect(unlinkedRecordWhere(collaboratorOnly)).toBeNull();
    expect(unlinkedRecordWhere(preview)).toBeNull();
  });

  const records: OwnedRecord[] = [
    { bookingId: "b_own", contactId: "c_host" },
    { bookingId: "b_invited", contactId: "c_other_host" }, // the host's invoice: not ours
    { bookingId: null, contactId: "c_host" }, // our invoice, not tied to a booking yet
    { bookingId: null, contactId: "c_other" },
    { bookingId: "b_x", contactId: "c_other" },
    { bookingId: "b_y", contactId: "c_other" },
    { bookingId: "b_cancelled", contactId: "c_host" }, // getHostScope leaves cancelled bookings out
  ];

  it("customer visibility (downloads)", () => {
    expect(records.map((r) => canSeeOwnedRecord(customer, r))).toEqual([true, false, true, false, false, false, false]);
    expect(records.map((r) => canSeeOwnedRecord(collaboratorOnly, r))).toEqual([false, false, false, false, false, false, false]);
  });

  it("preview visibility: only the previewed booking's records, never unlinked ones", () => {
    expect(records.map((r) => canSeeOwnedRecord(preview, r))).toEqual([false, false, false, false, true, false, false]);
  });

  it("a screen's query returns exactly its booking's records plus the customer's unlinked ones", () => {
    const expectFor = (scope: ViewerScope, bookingId: string | null) => {
      const where = bookingRecordsWhere(scope, bookingId);
      for (const r of records) {
        const expected = canSeeOwnedRecord(scope, r) && (r.bookingId === null || r.bookingId === bookingId);
        expect(matches(where, r), JSON.stringify({ preview: scope.preview, bookingId, r })).toBe(expected);
      }
    };
    expectFor(customer, "b_own");
    expectFor(customer, "b_invited");
    expectFor(customer, null);
    expectFor(collaboratorOnly, "b_invited");
    expectFor(preview, "b_x");
    expect(bookingRecordsWhere(customer, "b_invited")).toEqual({ OR: [{ bookingId: null, contactId: { in: ["c_host"] } }] });
    expect(bookingRecordsWhere(collaboratorOnly, "b_invited")).toBeNull();
    expect(bookingRecordsWhere(preview, "b_y")).toBeNull();
  });
});

describe("staff preview gates", () => {
  it("never gate customers", () => {
    for (const gate of ["invoices", "payments", "contracts", "signatures", "quotations"] as const) {
      expect(mayView(customer, gate, noPerms)).toBe(true);
    }
  });

  it("need every permission of the team screen for that data", () => {
    expect(mayView(preview, "invoices", only("invoices:read"))).toBe(true);
    expect(mayView(preview, "payments", only("invoices:read"))).toBe(false);
    expect(mayView(preview, "payments", only("payments:read"))).toBe(false);
    expect(mayView(preview, "payments", only("invoices:read", "payments:read"))).toBe(true);
    expect(mayView(preview, "contracts", only("contracts:read"))).toBe(true);
    expect(mayView(preview, "signatures", only("contracts:read"))).toBe(false);
    expect(mayView(preview, "signatures", only("esign:read"))).toBe(true);
    expect(mayView(preview, "quotations", only("quotes:read"))).toBe(true);
    expect(mayView(preview, "quotations", noPerms)).toBe(false);
  });
});

describe("decideDocumentAccess", () => {
  const invoice = { bookingId: "b_own", contactId: "c_host", invoiceStatus: "PARTIALLY_PAID" };

  it("asks signed-out visitors to sign in", () => {
    expect(decideDocumentAccess({ scope: null, kind: "invoice", record: invoice, can: allPerms })).toMatchObject({ allow: false, status: 401 });
  });

  it("lets customers download their own booking's and their unlinked documents", () => {
    expect(decideDocumentAccess({ scope: customer, kind: "invoice", record: invoice, can: noPerms })).toEqual({ allow: true, viewer: "customer" });
    expect(decideDocumentAccess({ scope: customer, kind: "receipt", record: { ...invoice, paymentStatus: "COMPLETED" }, can: noPerms })).toEqual({ allow: true, viewer: "customer" });
    expect(decideDocumentAccess({ scope: customer, kind: "invoice", record: { bookingId: null, contactId: "c_host", invoiceStatus: "SENT" }, can: noPerms })).toEqual({ allow: true, viewer: "customer" });
  });

  it("never lets an invited collaborator download the host's documents", () => {
    const hostInvoice = { bookingId: "b_invited", contactId: "c_other_host", invoiceStatus: "PAID", paymentStatus: "COMPLETED" };
    for (const scope of [customer, collaboratorOnly, { ...collaboratorOnly, collaboratorRoles: { b_invited: "CO_HOST" } }]) {
      expect(decideDocumentAccess({ scope, kind: "invoice", record: hostInvoice, can: allPerms })).toMatchObject({ allow: false, status: 404 });
      expect(decideDocumentAccess({ scope, kind: "receipt", record: hostInvoice, can: allPerms })).toMatchObject({ allow: false, status: 404 });
    }
  });

  it("answers 404 for anything missing, unissued, unreceived or out of scope", () => {
    const deny = (d: ReturnType<typeof decideDocumentAccess>) => expect(d).toMatchObject({ allow: false, status: 404 });
    deny(decideDocumentAccess({ scope: customer, kind: "invoice", record: null, can: allPerms }));
    deny(decideDocumentAccess({ scope: customer, kind: "invoice", record: { ...invoice, invoiceStatus: "DRAFT" }, can: allPerms }));
    for (const paymentStatus of ["PENDING", "FAILED", "REFUNDED", "CANCELLED", "PROCESSING", null]) {
      deny(decideDocumentAccess({ scope: customer, kind: "receipt", record: { ...invoice, paymentStatus }, can: allPerms }));
    }
    deny(decideDocumentAccess({ scope: customer, kind: "invoice", record: { ...invoice, bookingId: "b_cancelled" }, can: allPerms }));
    deny(decideDocumentAccess({ scope: customer, kind: "invoice", record: { bookingId: null, contactId: "c_other", invoiceStatus: "SENT" }, can: allPerms }));
  });

  it("staff preview downloads only with the team screen's permissions, and only for the previewed booking", () => {
    const rec = { bookingId: "b_x", contactId: "c_other", invoiceStatus: "SENT", paymentStatus: "COMPLETED" };
    expect(decideDocumentAccess({ scope: preview, kind: "invoice", record: rec, can: only("invoices:read") })).toEqual({ allow: true, viewer: "staff" });
    expect(decideDocumentAccess({ scope: preview, kind: "receipt", record: rec, can: only("invoices:read") })).toMatchObject({ allow: false, status: 403 });
    expect(decideDocumentAccess({ scope: preview, kind: "receipt", record: rec, can: only("invoices:read", "payments:read") })).toEqual({ allow: true, viewer: "staff" });
    expect(decideDocumentAccess({ scope: preview, kind: "invoice", record: rec, can: noPerms })).toMatchObject({ allow: false, status: 403 });
    expect(decideDocumentAccess({ scope: preview, kind: "invoice", record: { ...rec, bookingId: "b_y" }, can: allPerms })).toMatchObject({ allow: false, status: 404 });
    expect(decideDocumentAccess({ scope: preview, kind: "invoice", record: { ...rec, bookingId: null }, can: allPerms })).toMatchObject({ allow: false, status: 404 });
  });
});

describe("booking money — the overview's rule, the team's figures", () => {
  const rows = [
    { status: "PARTIALLY_PAID", totalAmount: dec("100000.10"), paidAmount: dec("20000.02"), balanceDue: dec("80000.08") },
    { status: "PAID", totalAmount: dec("200000.20"), paidAmount: dec("200000.20"), balanceDue: dec("0.00") },
    { status: "OVERDUE", totalAmount: "0.30", paidAmount: "0.10", balanceDue: "0.20" },
    // A full refund restores Invoice.balanceDue to the total, but the invoice is closed:
    // still billed (it counts in invoiced and paid), no longer owed (not in the balance).
    { status: "REFUNDED", totalAmount: dec("5000.00"), paidAmount: dec("0.00"), balanceDue: dec("5000.00") },
    // Not issued: still being prepared, or void.
    { status: "DRAFT", totalAmount: 999, paidAmount: 0, balanceDue: 999 },
    { status: "CANCELLED", totalAmount: 555, paidAmount: 0, balanceDue: 0 },
  ];

  it("balance due IS bookingBalance() over the same invoices", () => {
    const s = summarizeInvoices(rows);
    const b = bookingBalance(rows.map((r) => ({ status: r.status, balanceDue: Number(r.balanceDue) })));
    expect(s.balanceDue).toBe(b.balanceDue);
    expect(s.invoiceCount).toBe(b.issued);
  });

  it("adds totals and payments to the paisa over billed invoices, and the balance over owed ones", () => {
    // Balance: 80000.08 (PARTIALLY_PAID) + 0.20 (OVERDUE). The REFUNDED invoice's restored 5000.00 isn't owed.
    expect(summarizeInvoices(rows)).toEqual({ invoiced: 305000.6, paid: 220000.32, balanceDue: 80000.28, invoiceCount: 4 });
    expect(summarizeInvoices([])).toEqual({ invoiced: 0, paid: 0, balanceDue: 0, invoiceCount: 0 });
  });

  it("issued means neither DRAFT nor CANCELLED", () => {
    expect(["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"].filter(isIssuedInvoice)).toEqual([
      "SENT",
      "PARTIALLY_PAID",
      "PAID",
      "OVERDUE",
      "REFUNDED",
    ]);
    expect(isCustomerVisibleInvoice("DRAFT")).toBe(false);
    expect(isCustomerVisibleInvoice("CANCELLED")).toBe(true);
  });
});

describe("invoice shaping — team figures pass through unchanged", () => {
  const src = (over: Partial<InvoiceSource> = {}): InvoiceSource => ({
    id: "inv_1",
    invoiceNumber: "INV-2026-0042",
    status: "PARTIALLY_PAID",
    issueDate: new Date("2026-09-01T06:00:00.000Z"),
    dueDate: new Date("2026-10-01T00:00:00.000Z"),
    totalAmount: dec("512345.67"),
    paidAmount: dec("102469.13"),
    balanceDue: dec("409876.54"),
    bookingId: "b_own",
    eventName: "Wedding reception",
    installments: [
      { id: "i3", label: "Final (30%)", amount: dec("153703.70"), dueDate: new Date("2026-12-01T00:00:00.000Z"), status: "PENDING", paidAt: null, order: 2 },
      { id: "i1", label: "Booking advance (20%)", amount: dec("102469.13"), dueDate: new Date("2026-09-02T00:00:00.000Z"), status: "COMPLETED", paidAt: new Date("2026-09-02T09:15:00.000Z"), order: 0 },
      { id: "i2", label: "Second (50%)", amount: dec("256172.84"), dueDate: new Date("2026-11-01T00:00:00.000Z"), status: "PENDING", paidAt: null, order: 1 },
    ],
    ...over,
  });

  it("copies Invoice.totalAmount / paidAmount / balanceDue and each Installment.amount exactly", () => {
    const g = shapeInvoice(src(), { label: "Second (50%)", amount: 256173 });
    expect(g.total).toBe(512345.67);
    expect(g.paid).toBe(102469.13);
    expect(g.balanceDue).toBe(409876.54);
    expect(g.installments.map((i) => i.amount)).toEqual([102469.13, 256172.84, 153703.7]);
    expect(g.statusLabel).toBe(INVOICE_STATUS_LABEL.PARTIALLY_PAID);
    expect(g.installments.map((i) => i.statusLabel)).toEqual([INSTALLMENT_STATUS_LABEL.COMPLETED, INSTALLMENT_STATUS_LABEL.PENDING, INSTALLMENT_STATUS_LABEL.PENDING]);
    expect(g.installments[0].paidAt).toBe("2026-09-02T09:15:00.000Z");
  });

  it("orders instalments oldest-due first, like the allocation and /pay", () => {
    expect(shapeInvoice(src(), null).installments.map((i) => i.id)).toEqual(["i1", "i2", "i3"]);
    const sameDay = src({
      installments: [
        { id: "b", label: "B", amount: 1, dueDate: new Date("2026-11-01T00:00:00.000Z"), status: "PENDING", paidAt: null, order: 1 },
        { id: "a", label: "A", amount: 1, dueDate: new Date("2026-11-01T00:00:00.000Z"), status: "PENDING", paidAt: null, order: 0 },
      ],
    });
    expect(shapeInvoice(sameDay, null).installments.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("passes /pay's next-due amount through untouched, and only for a payable invoice", () => {
    const nextDue = { label: "Second (50%)", amount: 256173 };
    expect(shapeInvoice(src(), nextDue).nextDue).toBe(nextDue);
    expect(shapeInvoice(src({ status: "PAID", balanceDue: dec("0.00") }), nextDue).nextDue).toBeNull();
    expect(shapeInvoice(src({ status: "REFUNDED" }), nextDue).nextDue).toBeNull();
  });

  it("payable means the team's payment paths accept money and a balance remains", () => {
    expect(isPayableInvoice({ status: "SENT", balanceDue: dec("10.00") })).toBe(true);
    expect(isPayableInvoice({ status: "OVERDUE", balanceDue: dec("0.01") })).toBe(true);
    expect(isPayableInvoice({ status: "PARTIALLY_PAID", balanceDue: dec("0.00") })).toBe(false);
    for (const status of ["DRAFT", "PAID", "CANCELLED", "REFUNDED"]) expect(isPayableInvoice({ status, balanceDue: 100 })).toBe(false);
  });
});

describe("receipts", () => {
  const base = { receiptNumber: null, receiptUploadedAt: null, cancelledAt: null };

  it("shows recorded money and proofs under review; hides checkouts that never captured", () => {
    expect(isCustomerVisiblePayment({ ...base, status: "COMPLETED", receiptNumber: "RCP-2026-0001" })).toBe(true);
    expect(isCustomerVisiblePayment({ ...base, status: "COMPLETED" })).toBe(true); // legacy row without a number
    expect(isCustomerVisiblePayment({ ...base, status: "REFUNDED", receiptNumber: "RCP-2026-0002" })).toBe(true);
    expect(isCustomerVisiblePayment({ ...base, status: "CANCELLED", receiptNumber: "RCP-2026-0003", cancelledAt: new Date() })).toBe(true);
    expect(isCustomerVisiblePayment({ ...base, status: "CANCELLED" })).toBe(false);
    expect(isCustomerVisiblePayment({ ...base, status: "PENDING", receiptUploadedAt: new Date() })).toBe(true);
    expect(isCustomerVisiblePayment({ ...base, status: "PENDING" })).toBe(false);
    expect(isCustomerVisiblePayment({ ...base, status: "FAILED" })).toBe(false);
    expect(isCustomerVisiblePayment({ ...base, status: "PROCESSING" })).toBe(false);
  });

  it("copies Payment.amount exactly and only offers a download for money received", () => {
    const source = {
      id: "p1",
      amount: dec("102469.13"),
      status: "COMPLETED",
      method: "RAZORPAY",
      receiptNumber: "RCP-2026-0007",
      paidAt: new Date("2026-09-02T09:15:00.000Z"),
      createdAt: new Date("2026-09-02T09:10:00.000Z"),
      receiptUploadedAt: null,
      cancelledAt: null,
      invoice: { id: "inv_1", invoiceNumber: "INV-2026-0042" },
    };
    expect(shapeReceipt(source)).toMatchObject({
      amount: 102469.13,
      statusLabel: PAYMENT_STATUS_LABEL.COMPLETED,
      methodLabel: "Online payment",
      date: "2026-09-02T09:15:00.000Z",
      downloadable: true,
    });
    for (const status of ["REFUNDED", "CANCELLED", "PENDING"]) {
      expect(shapeReceipt({ ...source, status, paidAt: null }).downloadable).toBe(false);
      expect(shapeReceipt({ ...source, status, paidAt: null }).date).toBe("2026-09-02T09:10:00.000Z");
    }
  });

  it("sorts newest first", () => {
    const mk = (id: string, date: string) =>
      shapeReceipt({ id, amount: 1, status: "COMPLETED", method: "CASH", receiptNumber: null, paidAt: new Date(date), createdAt: new Date(date), receiptUploadedAt: null, cancelledAt: null, invoice: { id: "i", invoiceNumber: "n" } });
    expect(sortReceipts([mk("a", "2026-09-01T00:00:00.000Z"), mk("b", "2026-09-03T00:00:00.000Z"), mk("c", "2026-09-02T00:00:00.000Z")]).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
});

describe("agreements & quotations", () => {
  it("contracts follow the portal rule: everything but a draft", () => {
    expect(isCustomerVisibleContract("DRAFT")).toBe(false);
    for (const s of ["SENT", "VIEWED", "SIGNED", "EXPIRED", "CANCELLED"]) expect(isCustomerVisibleContract(s)).toBe(true);
  });

  it("a quotation is listed only when the team shared it and a page will open", () => {
    const live = new Set(["tok_live"]);
    expect(quotationLink({ id: "q1", status: "APPROVED", shareLinkToken: "tok_live" }, live)).toBe("/q/tok_live");
    expect(quotationLink({ id: "q2", status: "SENT", shareLinkToken: "tok_dead" }, live)).toBe("/api/quotations/q2/pdf");
    // Approved but never sent: the PDF route would serve it, but the customer was never sent it.
    expect(quotationLink({ id: "q3", status: "APPROVED", shareLinkToken: null }, live)).toBeNull();
    expect(quotationLink({ id: "q3b", status: "APPROVED", shareLinkToken: "tok_dead" }, live)).toBeNull();
    // Sent, accepted and turned into a booking: still the customer's quotation.
    expect(quotationLink({ id: "q4", status: "CONVERTED", shareLinkToken: "tok_dead" }, live)).toBe("/api/quotations/q4/pdf");
    expect(quotationLink({ id: "q4b", status: "CONVERTED", shareLinkToken: null }, live)).toBe("/api/quotations/q4b/pdf");
    expect(quotationLink({ id: "q4c", status: "CONVERTED", shareLinkToken: "tok_live" }, live)).toBe("/q/tok_live");
    expect(quotationLink({ id: "q5", status: "DRAFT", shareLinkToken: null }, live)).toBeNull();
  });

  it("share links are live while ACTIVE and unexpired", () => {
    const now = new Date("2026-09-16T00:00:00.000Z");
    expect(isLiveShareLink({ status: "ACTIVE", expiresAt: null }, now)).toBe(true);
    expect(isLiveShareLink({ status: "ACTIVE", expiresAt: new Date("2026-09-17T00:00:00.000Z") }, now)).toBe(true);
    expect(isLiveShareLink({ status: "ACTIVE", expiresAt: new Date("2026-09-15T00:00:00.000Z") }, now)).toBe(false);
    expect(isLiveShareLink({ status: "REVOKED", expiresAt: null }, now)).toBe(false);
  });
});

describe("formatIstDate", () => {
  it("formats in IST whatever the server's time zone", () => {
    expect(formatIstDate(new Date("2026-10-10T00:00:00.000Z"), { day: "numeric" })).toBe("10");
    // 8 pm UTC on the 9th is 1:30 am IST on the 10th.
    expect(formatIstDate("2026-10-09T20:00:00.000Z", { day: "numeric" })).toBe("10");
  });
});
