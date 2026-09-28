# DASHBOARD RESPONSIVE BEHAVIOR

## 1. Responsive Grid & Layout Adaptation

The primary dashboard layout uses Tailwind CSS v4 grid breakpoints:

```html
<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
  <section className="lg:col-span-8"> <!-- Attention Feed --> </section>
  <aside className="lg:col-span-4"> <!-- Side Card --> </aside>
</div>
```

---

## 2. Breakpoint Summary Table

| Element | Desktop (≥ 1024px) | Tablet (768px - 1023px) | Mobile (< 768px) |
|---|---|---|---|
| **KPI Strip** | 4 columns (`grid-cols-4`) | 2 columns (`grid-cols-2`) | 1 column stacked (`grid-cols-1`) |
| **Main Content Grid** | 12 columns (8 feed, 4 side) | Stacked 1 column | Stacked 1 column |
| **Header Salutation** | Large text (`text-h1`) | Medium text (`text-h2`) | Compact text (`text-h2`) |
| **Quick Action Buttons**| Icon + Label | Icon + Label | Icon Only / Floating Action Button |
