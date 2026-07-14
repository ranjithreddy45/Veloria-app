#!/usr/bin/env python3
"""Normalize 'Vendor Rate Card.xlsx' -> vendor-import.json for the DB importer.
Deterministic, no guessing: mapping rules are explicit and documented below.
Run: python3 scripts/normalize-vendor-rate-card.py "<path to xlsx>" <out.json>
"""
import json, re, sys
import openpyxl

SRC = sys.argv[1] if len(sys.argv) > 1 else "/Users/ranjithreddy/Downloads/Vendor Rate Card.xlsx"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/Users/ranjithreddy/Downloads/VeloriaApp/scripts/vendor-import.json"

# Sheet "Vendor Category" (col B) -> catalog category key (1:1, dedup obvious synonyms).
CAT_KEY = {
    "Birthday Decor": "decor",
    "Decoration": "decor",
    "Pure Veg (North Indian)": "catering",
    "Non veg": "catering",
    "Photographer": "photography",
    "Photography": "photography",
    "Birthday Cake/Engagement Cake": "cakes",
    "Activities": "activities",
    "Live stall": "live_stalls",
}
# New catalog categories (created if missing). Existing keys: decor, catering, photography.
NEW_CATEGORIES = [
    {"key": "cakes", "label": "Cakes"},
    {"key": "activities", "label": "Activities"},
    {"key": "live_stalls", "label": "Live Stalls"},
]
# Catalog key -> legacy Vendor.category enum (coarse operational tag).
KEY_TO_ENUM = {
    "decor": "DECORATION", "catering": "CATERING", "photography": "PHOTOGRAPHY",
    "cakes": "CATERING", "activities": "ENTERTAINMENT", "live_stalls": "ENTERTAINMENT",
}
# Unit -> VendorPackagePriceUnit enum. "Per KG" has no enum -> PER_PIECE (+ noted in desc).
def price_unit(u):
    s = (u or "").strip().lower()
    return {"per event": "PER_EVENT", "per plate": "PER_PLATE", "each": "PER_PIECE",
            "per kg": "PER_PIECE", "per piece": "PER_PIECE"}.get(s, "PER_EVENT")

GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{3}$")

def phone_str(v):
    if v is None: return None
    if isinstance(v, float): return str(int(v))
    return str(v).strip()

def num(v):
    if v is None: return None
    if isinstance(v, (int, float)): return float(v)
    return None

wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb["4. Rate Card"]

vendors = {}   # name -> vendor dict
order = []      # preserve first-seen vendor order

def get_vendor(name, addr, email, phone, gstin):
    if name not in vendors:
        vendors[name] = {
            "name": name, "email": email, "phone": phone, "address": addr,
            "city": "Bengaluru", "gstin": gstin, "categoryKeys": [], "packages": [],
        }
        order.append(name)
    v = vendors[name]
    # backfill any field that was blank on the first row
    if not v["email"] and email: v["email"] = email
    if not v["phone"] and phone: v["phone"] = phone
    if not v["address"] and addr: v["address"] = addr
    if not v["gstin"] and gstin: v["gstin"] = gstin
    return v

for r in range(8, ws.max_row + 1):
    cat_raw = ws.cell(r, 2).value
    name = ws.cell(r, 3).value
    if not name or not cat_raw:
        continue
    name = str(name).strip()
    addr = (str(ws.cell(r, 4).value).strip() if ws.cell(r, 4).value else None)
    email = (str(ws.cell(r, 5).value).strip() if ws.cell(r, 5).value else None)
    phone = phone_str(ws.cell(r, 6).value)
    pkg_name = str(ws.cell(r, 7).value).strip() if ws.cell(r, 7).value else None
    unit = ws.cell(r, 8).value
    vendor_rate = num(ws.cell(r, 9).value)      # I: cost to Veloria
    customer_raw = ws.cell(r, 10).value          # J: customer price (may be a range string)
    desc = str(ws.cell(r, 13).value).strip() if ws.cell(r, 13).value else None
    l_val = ws.cell(r, 12).value                 # L: mislabeled "GST Inclusive?" — sometimes a GSTIN
    gstin = str(l_val).strip() if (l_val and GSTIN_RE.match(str(l_val).strip())) else None

    key = CAT_KEY.get(cat_raw.strip())
    if not key:
        raise SystemExit(f"Row {r}: unmapped category {cat_raw!r}")
    unit_enum = price_unit(unit)
    if (unit or "").strip().lower() == "per kg":
        desc = (desc + "\n" if desc else "") + "(Priced per KG.)"

    v = get_vendor(name, addr, email, phone, gstin)
    if key not in v["categoryKeys"]:
        v["categoryKeys"].append(key)

    def add_pkg(pn, cust, vrate, extra_desc=None):
        d = desc
        if extra_desc:
            d = (d + "\n" if d else "") + extra_desc
        v["packages"].append({
            "name": pn, "category": key, "priceUnit": unit_enum,
            "vendorPrice": vrate, "customerPrice": cust, "description": d,
        })

    # Bharath "PHOTOGRAPHY/ VIDEOGRAPHY" customer price "6500/ 10000" -> split in two.
    if isinstance(customer_raw, str) and "/" in customer_raw:
        parts = [p.strip() for p in customer_raw.split("/")]
        nums = [float(re.sub(r"[^0-9.]", "", p)) for p in parts if re.sub(r"[^0-9.]", "", p)]
        if len(nums) == 2 and re.search(r"video", (pkg_name or ""), re.I):
            add_pkg("Photography", nums[0], vendor_rate)
            add_pkg("Photography + Videography", nums[1], vendor_rate)
        else:
            raise SystemExit(f"Row {r}: unexpected range price {customer_raw!r}")
    else:
        add_pkg(pkg_name, num(customer_raw), vendor_rate)

out = {
    "categories": NEW_CATEGORIES,
    "vendors": [
        {**{k: vendors[n][k] for k in ("name", "email", "phone", "address", "city", "gstin", "categoryKeys")},
         "primaryEnum": KEY_TO_ENUM[vendors[n]["categoryKeys"][0]],
         "packages": vendors[n]["packages"]}
        for n in order
    ],
}
with open(OUT, "w") as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

nv = len(out["vendors"])
npk = sum(len(v["packages"]) for v in out["vendors"])
print(f"Wrote {OUT}: {nv} vendors, {npk} packages, {len(NEW_CATEGORIES)} new categories")
for v in out["vendors"]:
    print(f"  - {v['name']}  [{v['primaryEnum']}] cats={v['categoryKeys']} phone={v['phone']} gstin={v['gstin']} pkgs={len(v['packages'])}")
