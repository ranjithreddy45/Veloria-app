# Navigation Manual Verification Checklist

## Production Verification Checklist
1. **Role Filtering**: Verify that logging in with an `EMPLOYEE_USER` role only displays `My HR` and `Dashboard` sections.
2. **Workspace Pins**: Test pinning an item (e.g., `Payroll Runs`), refresh browser, and verify pin persistence.
3. **Mobile Responsive Drawer**: Resize browser window below 768px (`<md`) and confirm sidebar converts to slide-out Sheet drawer.
4. **Active Route Highlight**: Navigate to `/quotations` and verify the right-edge accent bar `.sidebar-active-accent` highlights the `Quotations` item.
5. **Feature Flag Switch**: Toggle `LEAD_OPS_PAGES_ENABLED` in `src/config/feature-flags.ts` to confirm dynamic insertion/removal of Lead-Ops submodules.
