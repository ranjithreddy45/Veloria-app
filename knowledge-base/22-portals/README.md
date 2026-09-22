# 22 Portals Subsystem Knowledge Base

Status: `COMPLETE`  
Documentation Date: 2026-09-22  
Source of Truth: Actual repository implementation  
Source Modifications: 0  
Schema Modifications: 0  
Migration Modifications: 0  

---

## Executive Summary

The **Veloria Grand Portals Subsystem** delivers dedicated web and mobile interfaces for external stakeholders, including clients, venue vendors, event guests, referral partners, and public visitors.

Built using Next.js App Router, the portal ecosystem combines **stateful NextAuth session authentication** for client and vendor portals with **stateless cryptographic tokenized links** for public quotation viewing, online payments, digital contract signing, and vendor work order confirmations.

---

## Knowledge Base Navigation Matrix

| Topic # | Document Title | Primary Focus | Status |
| :--- | :--- | :--- | :--- |
| **01** | [01 Portal Landscape](01-portal-landscape.md) | Multi-tiered portal classification table | `IMPLEMENTED` |
| **02** | [02 Route Inventory](02-route-inventory.md) | Route specifications, file paths, dynamic params | `IMPLEMENTED` |
| **03** | [03 Authentication](03-authentication.md) | NextAuth cookies vs. URL token security | `IMPLEMENTED` |
| **04** | [04 Identity & Account Linking](04-identity-and-account-linking.md) | User, Contact, Vendor, Partner mapping | `IMPLEMENTED` |
| **05** | [05 Client Portal](05-client-portal.md) | Host & Client dashboard capabilities | `IMPLEMENTED` |
| **06** | [06 Client Booking Experience](06-client-booking-experience.md) | Event details, BEOs, and milestone tracking | `IMPLEMENTED` |
| **07** | [07 Client Quotation Experience](07-client-quotation-experience.md) | `/q/[token]` public quote viewer & 1-tap accept | `IMPLEMENTED` |
| **08** | [08 Client Contract Experience](08-client-contract-experience.md) | Digital contract signing & HTML5 canvas pad | `IMPLEMENTED` |
| **09** | [09 Client Payment Experience](09-client-payment-experience.md) | Razorpay payment links & split pay | `IMPLEMENTED` |
| **10** | [10 Client Documents](10-client-documents.md) | AWS S3 document vault & signed URLs | `IMPLEMENTED` |
| **11** | [11 Vendor Portal](11-vendor-portal.md) | Service provider dashboard overview | `IMPLEMENTED` |
| **12** | [12 Vendor Activation](12-vendor-activation.md) | Hashed token invitation & account creation | `IMPLEMENTED` |
| **13** | [13 Vendor Workflow](13-vendor-workflow.md) | Work order assignments & token confirmations | `IMPLEMENTED` |
| **14** | [14 Vendor Bids](14-vendor-bids.md) | RFP bidding & tender selection | `IMPLEMENTED` |
| **15** | [15 Vendor Payouts](15-vendor-payouts.md) | Bill tracking, approvals & payout history | `IMPLEMENTED` |
| **16** | [16 Guest Experience](16-guest-experience.md) | Guest PWA, AI Concierge & seating chart | `IMPLEMENTED` |
| **17** | [17 Public Token Experiences](17-public-token-experiences.md) | Token entropy, expiration & replay protection | `IMPLEMENTED` |
| **18** | [18 Public Booking Experience](18-public-booking-experience.md) | Temporary date hold engine & checkout | `IMPLEMENTED` |
| **19** | [19 Public Webforms](19-public-webforms.md) | Dynamic lead capture, honeypots & UTM tracking | `IMPLEMENTED` |
| **20** | [20 Referral Experience](20-referral-experience.md) | Partner codes, lead submissions & commission | `IMPLEMENTED` |
| **21** | [21 Employee Self-Service](21-employee-self-service.md) | Internal RBAC classification | `INTERNAL DASHBOARD` |
| **22** | [22 Portal APIs](22-portal-apis.md) | Inventory of portal-facing API handlers | `IMPLEMENTED` |
| **23** | [23 Server Actions](23-portal-server-actions.md) | Inventory of portal-facing Server Actions | `IMPLEMENTED` |
| **24** | [24 Data Models](24-portal-data-models.md) | Prisma schemas supporting portal state | `IMPLEMENTED` |
| **25** | [25 Data Scoping & Isolation](25-data-scoping-and-isolation.md) | IDOR defense & tenant isolation | `IMPLEMENTED` |
| **26** | [26 RBAC & Permissions](26-rbac-and-portal-permissions.md) | System roles & portal access rules | `IMPLEMENTED` |
| **27** | [27 Invitations & Activation](27-invitations-and-activation.md) | Token hashing & password setup flows | `IMPLEMENTED` |
| **28** | [28 Document Access](28-portal-document-access.md) | S3 presigned URLs & MIME validation | `IMPLEMENTED` |
| **29** | [29 Portal Notifications](29-portal-notifications.md) | Cross-channel WhatsApp, email & in-app alerts | `IMPLEMENTED` |
| **30** | [30 Portal Payments](30-portal-payments.md) | Razorpay checkout modal & webhook security | `IMPLEMENTED` |
| **31** | [31 Digital Signatures](31-portal-signatures.md) | Contract locking & audit metadata | `IMPLEMENTED` |
| **32** | [32 Security Review](32-security-review.md) | Comprehensive vulnerability audit | `IMPLEMENTED` |
| **33** | [33 Public Endpoint Hardening](33-public-endpoint-security.md) | Rate limiting, honeypots & CSRF protection | `IMPLEMENTED` |
| **34** | [34 Failure Modes](34-failure-modes.md) | Error handling, timeouts & fallbacks | `IMPLEMENTED` |
| **35** | [35 Audit & Activity Trail](35-audit-and-activity.md) | View logging, signatures & payment audits | `IMPLEMENTED` |
| **36** | [36 Portal Automation](36-portal-automation.md) | Cron jobs for holds, nudges & reminders | `IMPLEMENTED` |
| **37** | [37 Portal Data Flows](37-portal-data-flows.md) | Mermaid sequence & data flow diagrams | `IMPLEMENTED` |
| **38** | [38 State Machines](38-portal-state-machines.md) | Public hold & vendor assignment lifecycles | `IMPLEMENTED` |
| **39** | [39 User Journeys](39-portal-user-journeys.md) | End-to-end client & vendor scenarios | `IMPLEMENTED` |
| **40** | [40 Feature Status](40-feature-status.md) | Implementation status matrix (`POR-001` to `015`) | `IMPLEMENTED` |
| **41** | [41 Brief vs. Code](41-brief-vs-code.md) | Codebase vs. Project Brief comparison | `IMPLEMENTED` |
| **42** | [42 Manual Verification](42-manual-verification.md) | Operator testing steps & expected results | `IMPLEMENTED` |
| **43** | [43 Test Matrix](43-test-matrix.md) | QA and security test specifications | `IMPLEMENTED` |
| **44** | [44 Performance & Scalability](44-performance-and-scalability.md) | Query optimization & S3 URL caching | `IMPLEMENTED` |
| **45** | [45 API Contracts](45-api-contracts.md) | JSON request/response specifications | `IMPLEMENTED` |
| **46** | [46 Feature Index](46-feature-index.md) | Master index of portal features (`POR-001`+) | `IMPLEMENTED` |
| **47** | [47 Requirement Traceability](47-requirement-traceability.md) | Mapping business rules to code files | `IMPLEMENTED` |
| **48** | [48 Capability Matrix](48-portal-capability-matrix.md) | Cross-portal capability matrix | `IMPLEMENTED` |
| **49** | [Completion Report](COMPLETION-REPORT.md) | Official Chunk 22 audit summary | `COMPLETE` |
