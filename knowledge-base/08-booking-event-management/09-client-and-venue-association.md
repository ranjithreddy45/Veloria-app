# 09 - Client & Venue Association

---

## 🏢 Venue & Property Hierarchy Architecture

```mermaid
graph TD
    P[Property / Parent Venue] --> H1[Hall 1: Royal Banquet]
    P --> H2[Hall 2: Grand Lawn]
    P --> H3[Hall 3: Crystal Ballroom]
    H1 --> B1[Booking A: MORNING]
    H1 --> B2[Booking B: EVENING]
```

- **Venue Entity (`Venue`)**: Represents a physical property or sub-hall (capacity, base price per slot, amenities, property type).
- **Sub-Hall Assignment (`Booking.hallBooked`)**: Stores the specific hall/section name within the venue (e.g., "Grand Ballroom Section A").
- **Client Linkage (`Contact` / `Client`)**: Linked via `Booking.contactId`. Captures primary host contact details, phone, email, and billing address.
