# 43 - Vendor Procurement End-to-End User Journeys

---

## 🗺️ Journey 1: Vendor Onboarding & Portal Activation

```
[ Staff Creates Vendor ] ---> [ Generate Portal Invite ] ---> [ Vendor Receives Link ]
                                                                      |
                                                                      v
[ Vendor Portal Access ] <--- [ User Account Created ] <--- [ Vendor Sets Password ]
```

---

## 🗺️ Journey 2: Purchase Requisition to GL Accrual

```
[ Staff Creates PR ] ---> [ PR Pending ] ---> [ Manager Approves (Maker-Checker) ]
                                                            |
                                                            v
[ GL Accrual Posted ] <--- [ Goods Marked Received ] <--- [ Order Placed ]
 (Dr 5230 / Cr 2010)        (markReceived)                (markOrdered)
```
