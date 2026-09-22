# CHUNK 01-05 — REQUEST / RESPONSE ARCHITECTURE

- **Status**: `CODE VERIFIED`
- **Module**: System Architecture
- **Target Path**: `knowledge-base/01-system-architecture/05-request-response-architecture.md`

---

## 📌 Interactive Request-Response Lifecycle

Below is the complete end-to-end trace of a user interaction in Veloria Grand, moving from browser user input down to server-side action processing, database mutation, external integration, and cache revalidation.

```mermaid
sequenceDiagram
    autonumber
    actor User as Staff User (Browser)
    participant RCC as Client Component (RCC)
    participant Action as Server Action (src/actions/*)
    participant Middleware as Edge Middleware (middleware.ts)
    participant Auth as NextAuth Session Engine (auth.ts)
    participant Zod as Zod Schema Validator
    participant DB as PostgreSQL (Prisma ORM)
    participant S3 as AWS S3 Storage
    participant WA as Meta WhatsApp API

    User->>RCC: Clicks "Submit Expense Claim"
    RCC->>S3: Requests Presigned Upload URL
    S3-->>RCC: Returns Presigned URL & Object Key
    RCC->>S3: Uploads Receipt Image Direct to S3
    RCC->>Action: Invokes createReimbursementClaim(formData)
    Action->>Middleware: Session Verification Check
    Middleware-->>Action: Session Token Validated
    Action->>Auth: requireUser() -> Extracts Session User & Role
    Auth-->>Action: User ID & UserRole ("SALES_EXEC")
    Action->>Action: Assert Permission: hasPermission("hr:read")
    Action->>Zod: reimbursementClaimSchema.parse(payload)
    Zod-->>Action: Validated Payload (Amount, Category, S3 Key)
    Action->>DB: prisma.hrReimbursementClaim.create()
    DB-->>Action: Returns Created Claim Record
    Action->>WA: Trigger WhatsApp alert to Reporting Manager
    Action->>Action: revalidatePath("/people/reimbursements")
    Action-->>RCC: Returns { success: true, data: claimRecord }
    RCC-->>User: Displays Success Toast Notification via Sonner
```

---

## 🌐 API & Webhook Request Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Gateway as Razorpay Payment Webhook
    participant API as API Route (src/app/api/payments/webhook/route.ts)
    participant Crypto as Signature Verifier (crypto.createHmac)
    participant DB as PostgreSQL (Prisma ORM)
    participant Ledger as GL Posting Engine (src/lib/finance)
    participant Resend as Resend Email Service

    Gateway->>API: POST /api/payments/webhook (Payload + X-Razorpay-Signature)
    API->>Crypto: Verify HMAC SHA256 Signature against RAZORPAY_WEBHOOK_SECRET
    Crypto-->>API: Signature Validated
    API->>DB: prisma.payment.update(status: "CAPTURED")
    API->>DB: prisma.invoice.update(status: "PAID", balanceAmount: 0)
    API->>Ledger: Post Journal Voucher to General Ledger (Debit Bank, Credit AR)
    API->>Resend: sendEmail() -> Payment Receipt PDF to Customer
    API-->>Gateway: HTTP 200 OK { received: true }
```
