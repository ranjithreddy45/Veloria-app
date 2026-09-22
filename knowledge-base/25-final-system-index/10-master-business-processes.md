# Phase 10: Master Business Process Map

```mermaid
graph TD
    A[Lead Generation] --> B[Sales Quote Engine]
    B --> C[Public Quote Link / Soft Hold]
    C --> D[Contract Generation & Digital Signature]
    D --> E[Booking Confirmation & Calendar Lock]
    E --> F[BEO Drafting & Readiness Lock]
    F --> G[Kitchen Prep & Vendor Procurement]
    G --> H[Event Execution]
    H --> I[Invoice Generation & Tax Calculation]
    I --> J[Razorpay / Bank Payment Capture]
    J --> K[Automated GL Double-Entry Posting]
```

## Core Workflows
1. **Event Sales Lifecycle**: Lead -> Quote -> Contract -> Booking -> BEO -> Event -> Invoice -> Payment -> GL.
2. **Property Acquisition**: Property Lead -> Acquisition Deal -> Lease Contract -> Property Master -> Venue Sales.
3. **Marketing Attribution**: Ad Campaign -> Multi-Channel Track -> Lead -> Quotation -> Revenue Attribution.
4. **Recruitment to Onboarding**: Open Position -> Applicant -> Interview -> Offer Letter -> Employee Master -> Payroll.
5. **Attendance & Payroll**: Biometric Sync -> Attendance Log -> Leave LOP -> 30-Day Fixed Payroll -> Payslip -> GL Posting.
6. **Procurement & AP**: Requisition -> Work Order / PO -> Goods Receipt -> Vendor Bill -> AP -> Disbursed Payment -> GL.
