# 35 - Booking Feature Dependency Map

---

## 🔄 Upstream & Downstream Dependencies

```mermaid
graph LR
    Lead[Lead CRM] --> Quote[SalesQuotation]
    Quote --> Contract[Contract Module]
    Contract --> Booking[Booking Module]
    Booking --> BEO[BEO / Banquet Ops]
    Booking --> Timeline[Event Day Timeline]
    Booking --> Inv[Invoicing & Taxes]
    Inv --> Pay[Payment Gateway]
    Booking --> Review[Automated Review System]
```

- **Upstream Modules**: `Lead`, `SalesQuotation`, `Contract`, `Venue`.
- **Downstream Modules**: `BEO`, `EventOperation`, `Invoice`, `Payment`, `Client Portal`, `Review`.
