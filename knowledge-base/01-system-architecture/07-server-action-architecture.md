# CHUNK 01-07 — SERVER ACTION ARCHITECTURE

- **Status**: `CODE VERIFIED`
- **Module**: System Architecture
- **Target Path**: `knowledge-base/01-system-architecture/07-server-action-architecture.md`

---

## 📌 Server Action Standards & Conventions

All data mutations in Veloria Grand execute through **Next.js Server Actions** located in `src/actions/` (**325 Action Files**, **1,799 Exported Functions**).

### Standard Execution Pattern

Every Server Action strictly adheres to the following sequence:
```typescript
"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { targetSchema } from "@/schemas/domain.schema";

export async function sampleServerAction(inputData: unknown) {
  // 1. Session Verification
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  // 2. Permission Assertion
  const userRole = session.user.role;
  if (!hasPermission(userRole, "domain:write")) {
    return { success: false, error: "Forbidden: Insufficient Permissions" };
  }

  // 3. Zod Input Validation & Sanitization
  const parseResult = targetSchema.safeParse(inputData);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.flatten() };
  }
  const data = parseResult.data;

  // 4. Prisma Database Mutation (Transaction if multi-model)
  try {
    const record = await prisma.targetModel.create({ data });
    
    # 5. Cache Revalidation & Side-Effects
    revalidatePath("/dashboard/target");
    return { success: true, data: record };
  } catch (error) {
    return { success: false, error: "Database Mutation Failed" };
  }
}
```

---

## 🔍 Tracing 5 Real Production Server Actions

### 1. `createReimbursementClaim()` — Expense Claim Submission
- **File**: `src/actions/hr-reimbursement.actions.ts#L45-L92`
- **Session Check**: Calls `auth()` -> verifies `session.user.id`.
- **Permission Assertion**: Asserts `hasPermission(role, "hr:read")`.
- **Validation**: Evaluates `reimbursementClaimSchema` (verifies amount > 0, receiptUrl valid).
- **Database Action**: `prisma.hrReimbursementClaim.create({ data: { employeeId, amount, category, receiptUrl, status: "SUBMITTED" } })`.
- **Side Effect**: Dispatches email via `sendEmail()` to reporting manager; calls `revalidatePath("/people/reimbursements")`.

### 2. `createRazorpayPaymentOrder()` — Online Checkout Link Generation
- **File**: `src/actions/payment.actions.ts#L15-L110`
- **Session Check**: Verifies active user or valid invoice token.
- **Permission Assertion**: Asserts `payments:create` or public client token access.
- **Validation**: Verifies invoice exists, status is `UNPAID`, amount > 0.
- **Integration Call**: Invokes `razorpay.orders.create({ amount: amountInPaise, currency: "INR", receipt: invoiceId })`.
- **Database Action**: `prisma.payment.create({ data: { invoiceId, razorpayOrderId, status: "PENDING" } })`.

### 3. `ingestLead()` — Inbound Multi-Channel Lead Ingestion
- **File**: `src/lib/lead-capture.ts#L15-L110`
- **Security Check**: API Key header or Webhook HMAC signature verification.
- **Validation**: `leadSchema.parse(incomingBody)`.
- **AI Scoring**: Calls `computeAiLeadScore(leadData)` via OpenAI GPT-4.
- **Allocation Engine**: Calls `allocateLeadRoundRobin()` to select active Sales Rep.
- **Database Action**: `prisma.lead.create({ data: { ...leadData, score, assignedRepId } })`.
- **Side Effect**: Triggers Meta WhatsApp Cloud API alert to assigned Sales Rep.

### 4. `calculateQuotationPrice()` — Yield Pricing Matrix Calculation
- **File**: `src/actions/pricing.actions.ts#L10-L105`
- **Session Check**: Verifies active staff session (`quotes:read`).
- **Logic Execution**: Reads base venue package price -> queries `PricingRule` for auspicious saava date multiplier (+25%), day-of-week rate, and slot multiplier -> applies volume discount tiers.
- **Output**: Returns calculated itemized price breakdown (Venue, Catering, Decor, Taxes, Final CTC).

### 5. `createBooking()` — Booking Confirmation & Slot Lock
- **File**: `src/actions/booking.actions.ts#L40-L135`
- **Session Check**: Asserts `bookings:create` permission.
- **Validation**: Checks slot collision against `prisma.booking.findFirst()` and `prisma.blackoutDate.findFirst()`.
- **Transaction**: `prisma.$transaction([ prisma.booking.create(...), prisma.slotHold.update(status: "CONVERTED"), prisma.lead.update(status: "WON") ])`.
- **Side Effect**: Triggers Blueprint task generator (`src/lib/blueprints/`) to create BEO execution tasks.
