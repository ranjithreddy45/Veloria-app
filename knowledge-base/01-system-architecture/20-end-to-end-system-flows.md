# CHUNK 01-20 — END-TO-END SYSTEM FLOWS

- **Status**: `CODE VERIFIED`
- **Module**: System Architecture
- **Target Path**: `knowledge-base/01-system-architecture/20-end-to-end-system-flows.md`

---

## 🔄 Flow 01: Inbound Lead Capture → AI Score → Round-Robin → WhatsApp Alert

```mermaid
flowchart TD
    AdClick["Ad Click / Web Enquiry"] --> Webhook["POST /api/webhooks/google-ads"]
    Webhook --> Ingest["ingestLead() in src/lib/lead-capture.ts"]
    Ingest --> ZodVal["leadSchema.parse() Validation"]
    ZodVal --> AIScore["computeAiLeadScore() via OpenAI GPT-4"]
    AIScore --> RoundRobin["allocateLeadRoundRobin() in src/lib/leads/allocation.ts"]
    RoundRobin --> DBInsert["Prisma: prisma.lead.create()"]
    DBInsert --> WAAlert["Meta WhatsApp API: sendWhatsAppTemplate() to Sales Exec"]
    WAAlert --> UIUpdate["Lead appears at top of /leads Kanban Board"]
```

---

## 🔄 Flow 02: Booking Confirmation → Invoice → Razorpay → Ledger

```mermaid
flowchart TD
    ConfirmBooking["Sales Exec clicks Confirm Booking"] --> ServerAction["createBooking() in src/actions/booking.actions.ts"]
    ServerAction --> DBBooking["Prisma: prisma.booking.create(status: CONFIRMED)"]
    DBBooking --> GenInvoice["createInvoice() in src/actions/invoice.actions.ts"]
    GenInvoice --> DBInvoice["Prisma: prisma.invoice.create(status: UNPAID)"]
    DBInvoice --> RazorpayLink["createRazorpayPaymentOrder() in src/actions/payment.actions.ts"]
    RazorpayLink --> RazorpayAPI["Razorpay Orders API -> Order ID & Checkout Link"]
    RazorpayAPI --> ClientPay["Client Pays via /pay/[token]"]
    ClientPay --> WebhookPay["POST /api/payments/webhook"]
    WebhookPay --> VerifySig["Verify HMAC SHA256 Signature"]
    VerifySig --> DBPayUpdate["Prisma: prisma.payment.update(status: CAPTURED)"]
    DBPayUpdate --> DBInvUpdate["Prisma: prisma.invoice.update(status: PAID)"]
    DBInvUpdate --> LedgerPost["Post Journal Voucher to General Ledger (src/lib/finance)"]
```
