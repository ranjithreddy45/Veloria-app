# 17 - Vendor Work Order Lifecycle

---

## 🔄 State Machine Transitions

```
+-------+   sendWorkOrder()   +------+   acknowledgeWorkOrder()   +--------------+
| DRAFT | ------------------> | SENT | -------------------------> | ACKNOWLEDGED |
+-------+                     +------+                            +--------------+
                                 |                                       |
                                 | declineWorkOrder()                    | signWorkOrder()
                                 v                                       v
                            +----------+                            +------------+
                            | DECLINED |                            |   SIGNED   |
                            +----------+                            +------------+
```

---

## 🛡️ Atomic Concurrency Protection

Every status transition uses guarded `updateMany` updates (`where: { id, status: expected }`) to ensure concurrent requests cannot double-apply transitions.
