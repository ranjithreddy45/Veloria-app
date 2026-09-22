# 09 Client Invoices, Payments & Split Pay (`/pay/[token]`, `/pay/split/[token]`)

`CODE VERIFIED`

## Payment Link Infrastructure (`src/actions/payment.actions.ts`)

Clients view invoices and settle balances online via Razorpay integration.

### Single Payment Link (`/pay/[token]`)
- Loads invoice details (`invoiceNumber`, `totalAmount`, `amountPaid`, `balanceDue`).
- Initiates Razorpay Order via `/api/payments/create-order`.
- Renders Razorpay Checkout modal in client browser.
- Upon successful payment, Razorpay webhook (`/api/payments/webhook`) updates `Payment` record status to `SUCCESS` and updates `Invoice.amountPaid` and `Invoice.status`.

### Split Payment Link (`/pay/split/[token]`)
- Allows hosts to split event payments among multiple co-hosts or corporate sponsors.
- Linked to `PaymentSplit` table (`invoiceId`, `splitAmount`, `payerName`, `payerEmail`, `status`).
- Each split payer receives an isolated cryptographic link and payment receipt.
