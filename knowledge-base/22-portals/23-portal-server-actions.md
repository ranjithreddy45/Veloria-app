# 23 Portal Server Actions Inventory

`CODE VERIFIED`

## Master List of Server Actions Powering Portals

### A. Client Portal Server Actions (`src/actions/portal.actions.ts`)
- `getClientDashboardData()`
- `getClientBookings()`
- `getPortalBookingDetails(bookingId)`
- `getClientInvoices()`
- `getClientContracts()`
- `getPortalDocuments()`
- `uploadPortalDocument(formData)`
- `getPortalGalleryMedia()`
- `submitPortalSurveyResponse(surveyId, answers)`
- `activateClientAccount(token, password)`

### B. Vendor Portal Server Actions (`src/actions/vendor.actions.ts` & `vendor-portal-invite.actions.ts`)
- `getVendorDashboardOverview()`
- `getVendorAssignedEvents()`
- `getVendorActiveBids()`
- `submitVendorBid(workOrderId, bidAmount, terms)`
- `getVendorPayoutHistory()`
- `activateVendorAccount(token, password, bankDetails)`

### C. Public Token Server Actions
- `getPublicQuoteByToken(token)` (`quote-share-public.actions.ts`)
- `acceptQuoteOneTap(token)` (`quote-onetap.actions.ts`)
- `getPublicSignatureRequest(token)` (`signature-public.actions.ts`)
- `executeDigitalSignature(token, signatureBase64)` (`signature-public.actions.ts`)
- `getPublicHoldByToken(token)` (`public-hold.actions.ts`)
- `confirmVendorAssignmentToken(token)` (`public-vendor-confirm.actions.ts`)
