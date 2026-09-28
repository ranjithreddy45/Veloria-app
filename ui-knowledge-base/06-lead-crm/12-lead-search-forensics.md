# LEAD SEARCH FORENSICS

## 1. Search Implementation

Search is integrated into `LeadsFilterBar` ([leads-filter-bar.tsx](file:///Users/fci/Documents/Veloria-app/src/app/(dashboard)/leads/_components/leads-filter-bar.tsx)).

- **Search Fields**: Lead Name, Email, Phone Number.
- **Debounce Timing**: 300ms client-side debounce using React state.
- **URL Parameter**: `?search=query`
- **Prisma Query**:
```typescript
where: {
  OR: [
    { name: { contains: search, mode: "insensitive" } },
    { email: { contains: search, mode: "insensitive" } },
    { phone: { contains: search } }
  ]
}
```
