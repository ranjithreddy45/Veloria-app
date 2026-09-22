# 02 Route Inventory & Parameter Specifications

`CODE VERIFIED`

## Complete Route Inventory

### A. Client Portal Routes (`src/app/(portal)/portal/...`)

| Route Path | File Path | Dynamic Params | Auth Required | Role | Read/Write | Actions / APIs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/portal` | `src/app/(portal)/portal/page.tsx` | None | Yes | `CLIENT` | Read | `getClientDashboardData` |
| `/portal/bookings` | `src/app/(portal)/portal/bookings/page.tsx` | None | Yes | `CLIENT` | Read | `getClientBookings` |
| `/portal/bookings/[bookingId]` | `src/app/(portal)/portal/bookings/[bookingId]/page.tsx` | `bookingId` | Yes | `CLIENT` | Read/Write | `getPortalBookingDetails`, `updateGuestRSVP` |
| `/portal/invoices` | `src/app/(portal)/portal/invoices/page.tsx` | None | Yes | `CLIENT` | Read | `getClientInvoices` |
| `/portal/invoices/[invoiceId]` | `src/app/(portal)/portal/invoices/[invoiceId]/page.tsx` | `invoiceId` | Yes | `CLIENT` | Read | `getPortalInvoiceDetail` |
| `/portal/invoices/[invoiceId]/pdf` | `src/app/(portal)/portal/invoices/[invoiceId]/pdf/page.tsx` | `invoiceId` | Yes | `CLIENT` | Read | `/api/guest/invoice/[invoiceId]` |
| `/portal/contracts` | `src/app/(portal)/portal/contracts/page.tsx` | None | Yes | `CLIENT` | Read | `getClientContracts` |
| `/portal/contracts/[contractId]` | `src/app/(portal)/portal/contracts/[contractId]/page.tsx` | `contractId` | Yes | `CLIENT` | Read/Sign | `getPortalContractDetail`, `signPortalContract` |
| `/portal/documents` | `src/app/(portal)/portal/documents/page.tsx` | None | Yes | `CLIENT` | Read/Write | `getPortalDocuments`, `uploadPortalDocument` |
| `/portal/gallery` | `src/app/(portal)/portal/gallery/page.tsx` | None | Yes | `CLIENT` | Read | `getPortalGalleryMedia` |
| `/portal/loyalty` | `src/app/(portal)/portal/loyalty/page.tsx` | None | Yes | `CLIENT` | Read | `getClientLoyaltyBalance` |
| `/portal/surveys/[surveyId]` | `src/app/(portal)/portal/surveys/[surveyId]/page.tsx` | `surveyId` | Yes | `CLIENT` | Submit | `submitPortalSurveyResponse` |
| `/portal/activate` | `src/app/(portal)/portal/activate/page.tsx` | `token` (query) | Token | Any/New | Write | `activateClientAccount` |
| `/portal/reviews/new` | `src/app/(portal)/portal/reviews/new/page.tsx` | None | Yes | `CLIENT` | Write | `submitClientEventReview` |
| `/portal/guests` | `src/app/(portal)/portal/guests/page.tsx` | None | Yes | `CLIENT` | Read/Write | `getPortalGuestLists` |
| `/portal/guests/[bookingId]` | `src/app/(portal)/portal/guests/[bookingId]/page.tsx` | `bookingId` | Yes | `CLIENT` | Read/Write | `managePortalGuestList` |

---

### B. Vendor Portal Routes (`src/app/(vendor-portal)/vendor-portal/...`)

| Route Path | File Path | Dynamic Params | Auth Required | Role | Read/Write | Actions / APIs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/vendor-portal` | `src/app/(vendor-portal)/vendor-portal/page.tsx` | None | Yes | `VENDOR` | Read | `getVendorDashboardOverview` |
| `/vendor-portal/events` | `src/app/(vendor-portal)/vendor-portal/events/page.tsx` | None | Yes | `VENDOR` | Read/Write | `getVendorAssignedEvents`, `confirmVendorAssignment` |
| `/vendor-portal/bids` | `src/app/(vendor-portal)/vendor-portal/bids/page.tsx` | None | Yes | `VENDOR` | Read/Write | `getVendorActiveBids`, `submitVendorBid` |
| `/vendor-portal/payouts` | `src/app/(vendor-portal)/vendor-portal/payouts/page.tsx` | None | Yes | `VENDOR` | Read | `getVendorPayoutHistory`, `getVendorBills` |

---

### C. Guest PWA Experience Routes (`src/app/(guest)/app/...`)

| Route Path | File Path | Dynamic Params | Auth Required | Role | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/app` | `src/app/(guest)/app/page.tsx` | None | Optional | Guest | Guest Event Landing & Countdown |
| `/app/event` | `src/app/(guest)/app/event/page.tsx` | None | Optional | Guest | Live Event Details & Schedule |
| `/app/event/live` | `src/app/(guest)/app/event/live/page.tsx` | None | Optional | Guest | Real-time Event Updates & Itinerary |
| `/app/event/menu` | `src/app/(guest)/app/event/menu/page.tsx` | None | Optional | Guest | Interactive Event Menu |
| `/app/event/documents` | `src/app/(guest)/app/event/documents/page.tsx` | None | Optional | Guest | Event Itinerary & Directions PDF |
| `/app/event/guests` | `src/app/(guest)/app/event/guests/page.tsx` | None | Optional | Guest | Guest Directory & Seating Chart |
| `/app/concierge` | `src/app/(guest)/app/concierge/page.tsx` | None | Optional | Guest | Digital Concierge Chat / AI Assistant |
| `/app/venues` | `src/app/(guest)/app/venues/page.tsx` | None | Public | Guest | Property Showcase & Photos |
| `/app/book` | `src/app/(guest)/app/book/page.tsx` | None | Public | Guest | Direct Booking Enquiry Form |

---

### D. Public Tokenized Routes

| Route Path | File Path | Token Parameter | Target Entity | Primary Server Action / API |
| :--- | :--- | :--- | :--- | :--- |
| `/q/[token]` | `src/app/(public)/q/[token]/page.tsx` | `token` | `QuoteShareLink` | `getPublicQuoteByToken`, `acceptQuoteOneTap` |
| `/pay/[token]` | `src/app/pay/[token]/page.tsx` | `token` | `PaymentLink` | `getPaymentLinkDetails`, `/api/payments/create-order` |
| `/pay/split/[token]` | `src/app/pay/split/[token]/page.tsx` | `token` | `PaymentSplit` | `getPaymentSplitDetails`, `processSplitPayment` |
| `/sign/[token]` | `src/app/(public)/sign/[token]/page.tsx` | `token` | `SignatureRequest` | `getPublicSignatureRequest`, `executeDigitalSignature` |
| `/hold/[token]` | `src/app/(public)/hold/[token]/page.tsx` | `token` | `PublicHold` | `getPublicHoldByToken`, `confirmPublicHoldPayment` |
| `/vendor-confirm/[token]`| `src/app/(public)/vendor-confirm/[token]/page.tsx`| `token` | `VendorAssignment` | `getVendorAssignmentByToken`, `confirmVendorAssignmentToken` |
| `/rsvp/[token]` | `src/app/(public)/rsvp/[token]/page.tsx` | `token` | `GuestInvitation` | `getGuestInvitationByToken`, `submitGuestRSVP` |
| `/refer/[code]` | `src/app/(public)/refer/[code]/page.tsx` | `code` | `ReferralPartner` | `processReferralLandingCode` |
| `/form/[slug]` | `src/app/(public)/form/[slug]/page.tsx` | `slug` | `WebForm` | `submitPublicWebForm`, `/api/webforms/[slug]` |
