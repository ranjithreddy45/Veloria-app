# 10 Automated Triggered Communications

`CODE VERIFIED`

Automated messaging triggers across the application:
1. **Lead Intake**: `captureLeadFromExternal()` triggers WhatsApp welcome message.
2. **Booking Confirmation**: `confirmBooking()` triggers `booking_confirmation` template.
3. **Quotation Sent**: `sendQuote()` triggers `quote_sent` template and email copy.
4. **Contract Signing**: E-sign request sends WhatsApp link to client.
5. **Payslip Notification**: `finalizePayrollRun()` emails employee payslip PDF.
