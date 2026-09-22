# Contracts & Agreements Architecture Overview

## Overview

The Contracts & Agreements module in Veloria Grand provides a digital contract creation, template rendering, multi-tier legal approval, public tokenized digital signing, and booking integration platform.

---

## Technical Architecture & Lifecycle Diagram

```mermaid
flowchart TD
    Quote[Quotation Accepted / Sales Lead] --> Template[Select ContractTemplate / Draft Contract<br/>src/lib/acq/contract-template.ts]
    Template --> Render[Placeholder Replacement<br/>{{clientName}}, {{eventDate}}, {{totalAmount}}]
    Render --> Draft[Create Contract / SignatureRequest<br/>Status: DRAFT]
    Draft --> Approval{Legal / Manager Review Required?}
    Approval -- Yes --> Review[Legal Approval Queue<br/>Status: PENDING_APPROVAL -> APPROVED]
    Approval -- No --> Send[Generate Tokenized Share Link<br/>/sign/[token]]
    Review --> Send
    Send --> Portal[Public Digital Signing Portal<br/>/sign/[token] & sign-pad.tsx]
    Portal --> Sign[Capture Typed / Drawn Signature<br/>SignatureRequest.signatureData + IP + UA]
    Sign --> Lock[Document Lock & E-Sign Completion<br/>isLocked = true, Status: SIGNED]
    Lock --> Booking[Link Confirmed Booking<br/>Booking.contractId / Contract.bookingId]
```

---

## Evidence Summary

| Component / Layer | Primary File / Code Reference | Status |
|---|---|---|
| Contract Dashboard UI | `src/app/(dashboard)/contracts/page.tsx`, `contracts-table.tsx` | CODE VERIFIED |
| Contract Template Engine | `src/app/(dashboard)/settings/contract-templates`, `contract-template.ts` | CODE VERIFIED |
| Public E-Sign Portal | `src/app/(public)/sign/[token]/page.tsx`, `sign-pad.tsx` | CODE VERIFIED |
| Client Portal E-Sign | `src/app/(portal)/portal/contracts/[contractId]`, `portal-sign-form.tsx` | CODE VERIFIED |
| Digital Signature Verification | `src/lib/esign.ts`, `SignatureRequest` | CODE VERIFIED |
| Property Acquisition Contracts | `src/app/(dashboard)/bd/contracts`, `AcqContract` | CODE VERIFIED |
