# 20 - Booking to BEO Handoff Workflow

---

## 📄 Banquet Event Order (BEO) Creation Engine

```mermaid
graph TD
    B[Booking Record] -->|Invoke createBeo| Action[beo.actions.ts]
    Action -->|Mint Record| BEO[Beo Sheet Record]
    BEO -->|Copy Attributes| Attributes[beoNumber, bookingId, covers, runOfShow]
    BEO -->|Generate Sections| Sections[Hall Setup, Menu & Bar, Audio/Visual, Timeline]
    BEO -->|Publish Sheet| Ops[Banquet Ops & Kitchen Staff]
```

- **Server Action**: `createBeo(bookingId)` in `src/actions/beo.actions.ts`.
- **Headcount Synchronization**: Reads `covers` from `Booking.guestCount` and sets `coversSource = 'CONTRACTED'`.
- **Run of Show Setup**: Initializes standard banquet timeline JSON structure (`runOfShow`) for operational execution.
