# 04 Identity Model & Account Linking Architecture

`CODE VERIFIED`

## Identity Representation

In the Veloria Grand Prisma schema, physical individuals and external portal entities map to specific relational models:

```
+-----------------------------------------------------------------------------------+
|                                  USER (Auth Account)                              |
|                          id, email, passwordHash, role                            |
+-----------------------------------------------------------------------------------+
           |                                                      |
           | (role == CLIENT)                                     | (role == VENDOR)
           v                                                      v
+-----------------------+                              +-----------------------+
|        CONTACT        |                              |        VENDOR         |
|  id, email, phone,    |                              |  id, name, email,     |
|   companyName, name   |                              |   phone, category     |
+-----------------------+                              +-----------------------+
           |                                                      |
           v                                                      v
+-----------------------+                              +-----------------------+
|        BOOKING        |                              |       WORK ORDER      |
|  id, contactId, venue |                              |  id, vendorId, event  |
+-----------------------+                              +-----------------------+
```

## Entity Mapping Breakdown

1. **Client Identity**:
   - `User` table holds authentication credentials (`email`, `passwordHash`, `role = CLIENT`).
   - Linked to `Contact` record where `Contact.email == User.email` or explicit `contactId` link.
   - `Contact` connects to `Booking`, `Invoice`, `Contract`, `Quotation`, `GuestList`.

2. **Vendor Identity**:
   - `User` table holds login credentials (`email`, `passwordHash`, `role = VENDOR`).
   - `Vendor` table contains business details (`name`, `category`, `contactEmail`, `phone`, `bankDetails`).
   - Linked via `Vendor.userId == User.id` or `User.vendorId == Vendor.id`.
   - Connects to `WorkOrder`, `VendorBid`, `VendorBill`, `VendorAssignment`, `Payout`.

3. **Referral Partner Identity**:
   - Represented by `ReferralPartner` model (`id`, `name`, `email`, `code`, `payoutDetails`).
   - Submissions stored in `ReferralPortalSubmission` (`partnerId`, `leadName`, `status`).

4. **Guest Identity**:
   - Ephemeral or record-based guest identity in `GuestList` / `GuestInvitation` (`guestName`, `email`, `phone`, `rsvpStatus`).
