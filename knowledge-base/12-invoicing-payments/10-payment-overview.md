# 10 - Payment Subsystem Overview

---

## 💸 Payment Architecture

Payments can be captured via online payment gateways (Razorpay) or manually recorded by finance staff (Bank Transfer, Cash, Cheque, UPI).

```
+-----------------------------------------------------------------------------------+
|                              PAYMENT CAPTURE WAYS                                 |
+-----------------------------------------------------------------------------------+
|  1. Online Razorpay Checkout  --->  verifyRazorpayPayment() / Webhook             |
|  2. Public One-Click Link     --->  /pay/[token] -> Razorpay Order                |
|  3. Multi-Payer Split Link    --->  /pay/split/[token] -> Razorpay Order          |
|  4. Manual Offline Record     --->  recordPayment({ method: BANK_TRANSFER/CASH }) |
+-----------------------------------------------------------------------------------+
```
