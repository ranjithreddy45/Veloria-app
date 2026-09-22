# 14 - BEO Publishing & Distribution Workflow

---

## 📢 Publishing Mechanics (`setBeoStatus('PUBLISHED')`)

```mermaid
sequenceDiagram
    autonumber
    actor Ops as Operations Head
    participant Action as beo.actions.ts
    participant DB as PostgreSQL Database
    participant Notif as Notification Engine

    Ops->>Action: Call `setBeoStatus(beoId, 'PUBLISHED')`
    Action->>DB: Update `Beo.status = 'PUBLISHED'`
    Action->>Notif: Trigger in-app alerts to Kitchen & Banquet Stewards
    Action->>Notif: Send WhatsApp BEO summary link to lead Event Coordinator
    Action->>Notif: Email BEO PDF attachment to external decor & vendor partners
```

- **File Reference**: `src/actions/beo.actions.ts`
- **Visibility Effect**: Published BEOs become visible on kitchen prep dashboards (`/kitchen`) and vendor portals (`/vendor-portal/events`).
