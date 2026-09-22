# 22 - Stock Transfers Between Locations

---

## 🔍 Inter-Warehouse Stock Transfer Status

- **Status**: **NOT FOUND AS A DEDICATED MODEL**.
- **Implementation**: Property locations (`location` field in `InventoryItem`, e.g. "Main Warehouse", "Hall A Store") represent item storage bins. Transfers between venues or store rooms are performed by updating the `location` field or adjusting quantities via `updateItem`.
