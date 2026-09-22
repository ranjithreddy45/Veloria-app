# 34 - Booking End-to-End User Journeys

---

## 🛤️ Supported User Journeys

### Journey A: Sales Executive Converts Quotation to Booking & Deposit Invoice
```
Sales Exec views Quotation (status = APPROVED)
  -> Clicks "Convert to Booking"
  -> Action `createBookingInvoiceFromQuotation` validates availability grid
  -> Mints Booking record (status = HOLD) & initial deposit Invoice (25%)
  -> SalesQuotation updated to status CONVERTED
  -> Client receives WhatsApp deposit payment link
```

### Journey B: Public Date Hold to Confirmed Booking
```
Public user visits `/public/hold`
  -> Selects Venue, Date, TimeSlot & pays token deposit via Razorpay
  -> Action `createPublicHold` creates PublicHold record (status = PAID)
  -> System auto-creates Booking (status = HOLD) & mints CRM Lead
  -> Sales Executive contacts host to finalize menu and execute legal contract
```

### Journey C: Banquet Operations Executes Event Day via BEO & Timeline
```
Operations Head accesses `/beo`
  -> Clicks `createBeo(bookingId)` to generate function sheet
  -> Populates run-of-show timeline & assigns staff shifts
  -> Kitchen staff receives BEO printout 48h prior to event
  -> On event day, Ops Lead monitors live timeline (`/bookings/[bookingId]/day-of`)
  -> Post-event, Ops Lead clicks `completeBooking()`, triggering client review request cron
```
