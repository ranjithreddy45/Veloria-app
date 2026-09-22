# 05 Client Portal Core Capabilities (`/portal/*`)

`CODE VERIFIED`

## Client Portal Feature Inventory

The Client Portal (`/portal`) acts as the dedicated dashboard for event hosts and clients. It restricts data access strictly to records associated with the logged-in client's `Contact` or `User.id`.

### Core Capabilities Matrix

| Feature | Sub-Route | Action / Service | Permission / Scoping | Capability Class |
| :--- | :--- | :--- | :--- | :--- |
| **Dashboard Overview** | `/portal` | `getClientDashboardData()` | `session.user.role == CLIENT` | `READ` |
| **My Bookings** | `/portal/bookings` | `getClientBookings()` | `contact.email == session.email` | `READ` |
| **Booking Control Center**| `/portal/bookings/[id]` | `getPortalBookingDetails()` | `booking.contactId == contact.id`| `READ / WRITE` |
| **Invoices & Receipts** | `/portal/invoices` | `getClientInvoices()` | `invoice.booking.contactId == contact.id` | `READ / PAY` |
| **Contract Center** | `/portal/contracts` | `getClientContracts()` | `contract.booking.contactId == contact.id` | `READ / SIGN` |
| **Document Library** | `/portal/documents` | `getPortalDocuments()` | `document.booking.contactId == contact.id` | `READ / UPLOAD` |
| **Event Gallery** | `/portal/gallery` | `getPortalGalleryMedia()` | `booking.contactId == contact.id` | `READ / DOWNLOAD` |
| **Guest List & RSVP** | `/portal/guests` | `managePortalGuestList()` | `booking.contactId == contact.id` | `READ / WRITE` |
| **Surveys & Feedback** | `/portal/surveys/[id]`| `submitPortalSurveyResponse()`| `survey.contactId == contact.id` | `SUBMIT` |
| **Loyalty Rewards** | `/portal/loyalty` | `getClientLoyaltyBalance()` | `contact.id == session.contactId`| `READ` |

---

## Server Action Implementation (`src/actions/portal.actions.ts`)

```typescript
export async function getClientDashboardData() {
  const session = await auth();
  if (!session || session.user.role !== "CLIENT") {
    throw new Error("Unauthorized client portal access");
  }

  const contact = await prisma.contact.findFirst({
    where: { email: session.user.email },
  });

  if (!contact) return null;

  const bookings = await prisma.booking.findMany({
    where: { contactId: contact.id },
    include: { venue: true, invoices: true, contracts: true },
  });

  return { contact, bookings };
}
```
