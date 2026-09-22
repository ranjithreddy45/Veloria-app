# 38 - End-to-End User Journeys

---

## 🗺️ Journey 1: Online Invoice Payment via Razorpay

```
[ Staff Creates Invoice ] ---> [ Status: SENT ] ---> [ Customer Opens /pay/[token] ]
                                                                |
                                                                v
[ GL Cash Receipt Posted ] <--- [ applyRazorpayCapture ] <--- [ Razorpay Checkout Paid ]
```

---

## 🗺️ Journey 2: Public Hold Advance Deposit

```
[ Client Selects Slot ] ---> [ PublicHold Created ] ---> [ Advance Deposit Invoice Minted ]
                                                                      |
                                                                      v
[ Booking Status: CONFIRMED ] <--- [ maybeConfirmBookingOnPayment ] <--- [ Deposit Paid ]
```
