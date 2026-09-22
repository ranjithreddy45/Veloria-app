# 01 Portal Landscape & Classification Matrix

`CODE VERIFIED`

## Subsystem Overview

The Veloria Grand application implements a multi-tiered portal architecture catering to clients, vendors, event guests, referral partners, and public visitors. Rather than maintaining monolithic external applications, all portals reside within the Next.js App Router codebase, leveraging role-scoped route groups (`(portal)`, `(vendor-portal)`, `(guest)`, `(public)`) and tokenized public route handlers.

```
+-----------------------------------------------------------------------------------+
|                            VELORIA GRAND PORTAL SYSTEM                            |
+-----------------------------------------------------------------------------------+
       |                    |                    |                   |
       v                    v                    v                   v
+--------------+     +--------------+     +--------------+    +--------------------+
| CLIENT PORTAL|     | VENDOR PORTAL|     | GUEST APP    |    | PUBLIC TOKENIZED   |
|   (/portal)  |     |(/vendor-por.)|     |    (/app)    |    | EXPERIENCES        |
+--------------+     +--------------+     +--------------+    +--------------------+
| NextAuth     |     | NextAuth     |     | Public/PWA   |    | Token Lookups      |
| Role: CLIENT |     | Role: VENDOR |     | Cookie/Local |    | (Cryptographic Hash|
+--------------+     +--------------+     +--------------+    +--------------------+
```

## Master Portal Landscape Classification

| Portal / Experience | Route Group | User Identity / Role | Authentication Mechanism | Target Domain Entity | Implementation Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Client Portal** | `(portal)` -> `/portal/*` | `User` (`role: CLIENT`) | NextAuth Session Cookie | `Contact`, `Booking`, `Invoice`, `Contract` | `IMPLEMENTED` |
| **Vendor Portal** | `(vendor-portal)` -> `/vendor-portal/*` | `User` (`role: VENDOR`) | NextAuth Session Cookie | `Vendor`, `WorkOrder`, `VendorBid`, `VendorBill` | `IMPLEMENTED` |
| **Guest Mobile Experience (PWA)** | `(guest)` -> `/app/*` | Guest / Client | Tokenized Link / Cookie / Public | `Booking`, `GuestList`, `GuestInvitation`, `Event` | `IMPLEMENTED` |
| **Public Quotation Viewer** | `(public)` -> `/q/[token]` | Anonymous Signer / Client | Cryptographic URL Token | `Quote`, `QuoteShareLink`, `QuoteView` | `IMPLEMENTED` |
| **Public Payment Checkout** | Root -> `/pay/[token]`, `/pay/split/[token]` | Anonymous Payer / Client | Cryptographic URL Token | `Invoice`, `Payment`, `PaymentSplit` | `IMPLEMENTED` |
| **Digital Contract E-Sign** | `(public)` -> `/sign/[token]` | Signer / Client Representative | Tokenized URL Token + IP/User-Agent | `Contract`, `SignatureRequest`, `ESignRequest` | `IMPLEMENTED` |
| **Public Venue Hold** | `(public)` -> `/hold`, `/hold/[token]` | Anonymous Visitor / Lead | Razorpay Payment + Hold Token | `PublicHold`, `Booking`, `Lead` | `IMPLEMENTED` |
| **Public Webforms & Widgets** | `(public)` -> `/form/[slug]`, `/widget` | Anonymous Web Visitor | WebForm Slug / Rate Limit | `WebForm`, `Lead`, `Inquiry` | `IMPLEMENTED` |
| **Referral Partner Experience** | `(public)` -> `/refer/[code]` | Partner / Advocate | Referral Code / Cookie | `ReferralPartner`, `ReferralPortalSubmission` | `IMPLEMENTED` |
| **Vendor Activation / Confirm** | `(public)` -> `/vendor-activate`, `/vendor-confirm/[token]` | Invited Vendor Contact | Hashed Activation Token | `Vendor`, `VendorAssignment`, `WorkOrder` | `IMPLEMENTED` |
| **Employee Self-Service** | Dashboard -> `/staff`, `/finance/reimbursements` | `User` (Staff Roles) | NextAuth Internal RBAC | `Employee`, `Attendance`, `LeaveRequest`, `Payroll` | `INTERNAL DASHBOARD` |
