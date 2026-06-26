# VeloriaApp — Team-Side Deep Audit & Remediation

_Generated from a 135-agent read-only audit of the internal `(dashboard)` app (56 modules + cross-cutting RBAC / auth / money-safety / automation), with adversarial verification of every High/Critical finding, followed by two parallel fix waves._

## Summary

| Severity | Found | 
|---|---|
| Critical | 15 |
| High | 61 |
| Medium | 109 |
| Low | 28 |
| **Total** | **213** |

**Clean modules (no findings):** availability, bd, bookings, competitors, feedback, franchise, pipeline.

## Remediation

- **Wave 1 (Critical + High):** 98 fixes across 41 files; 55 findings skipped-by-design.
- **Wave 2 (Medium + Low):** 171 fixes across 77 files; 46 findings skipped-by-design.
- **Skipped-by-design** = broad-visibility "IDOR" findings (all-payments list, dashboard aggregates, exports, activity feed). VeloriaApp is a **single-company internal ERP**; staff-wide visibility there is intentional, so adding per-record ownership filters would hide data staff need. These are recorded, not "fixed".
- One Wave-2 agent added a hard `@@unique([bookingId, ruleId])` to `CommissionEntry`; this was **reverted** because adding a unique constraint can fail `prisma db push` against existing production data (hard DB constraints are deferred until prod data is de-duplicated).

Every change was gated by a full `tsc --noEmit` + production build before deploy.

## Findings (by severity)


### CRITICAL

- **[_rbac · RBAC] Privilege Escalation via updateUser - Role Assignment without Permission Check**
  - `src/actions/user.actions.ts:168`
  - The updateUser action allows any user with 'users:update' permission to change any user's role to SUPER_ADMIN, ADMIN, or any other role without requiring the 'users:manage-roles' permission. Line 168 conditionally updates the role field without validation: if (data.role !== undefined) { updateData.role = data.role as ... }. Only SUPER_ADMIN and ADMIN roles have 'users:update', but this creates a p
- **[approvals · SECURITY] IDOR: Any authenticated user can view any approval request**
  - `src/actions/approval.actions.ts:539`
  - The getApprovalRequest() function at line 539-579 only checks if the user is authenticated (via auth()) but does not verify if the user is authorized to view the specific approval request. It does not check if the user is the submitter, an approver in the chain, or an admin. Any authenticated user can call this function with any requestId to retrieve sensitive approval details, submitter informati
- **[campaigns · SECURITY] IDOR: Campaigns not filtered by ownership**
  - `src/actions/campaign.actions.ts:55`
  - getCampaignById() retrieves any campaign by ID without checking if the requesting user is the owner. The Campaign model has a createdById field (set at line 117), but read operations ignore it. An attacker with campaigns:read permission can access, view, or modify any campaign by knowing its ID. All mutation operations (updateCampaign, deleteCampaign, sendCampaign, scheduleCampaign, cancelCampaign
- **[contracts · SECURITY] IDOR: Mutating actions lack user ownership checks**
  - `src/actions/contract.actions.ts:288`
  - updateContract, deleteContract, sendContract, and markContractSigned functions only check role-based permissions (hasPermission) but do not verify that the current user owns the contract (createdById match). A SALES_HEAD with contracts:update permission can modify, delete, or send any contract in the system regardless of who created it. This is a classic IDOR vulnerability allowing cross-user cont
- **[contracts · SECURITY] State transition vulnerability: unsigned contract can be forcibly signed by unauthorized user**
  - `src/actions/contract.actions.ts:490`
  - markContractSigned accepts an unsigned contractId and marks it as SIGNED. Line 513 allows SENT or VIEWED status, meaning a user with contracts:update permission can unilaterally mark any sent contract as signed without the actual signer's involvement (signatureData is optional). Combined with IDOR, a malicious SALES_EXEC can send a contract to a false email and mark it signed to fake compliance.
- **[documents · SECURITY] IDOR vulnerability in deleteDocument - missing ownership check**
  - `src/actions/document.actions.ts:254`
  - The deleteDocument() function verifies role-based permissions (documents:delete) but does NOT verify that the user owns the document being deleted. An attacker with documents:delete permission can delete any document in the system by supplying an arbitrary document ID. The function retrieves the document at line 266-268 but only checks existence, not ownership. The delete at line 274 has no owners
- **[documents · SECURITY] IDOR vulnerability in updateDocument - missing ownership check**
  - `src/actions/document.actions.ts:191`
  - The updateDocument() function verifies role-based permissions (documents:create for edit) but does NOT verify that the user owns the document being updated. An attacker with documents:create permission can modify any document's metadata (name, category, tags, visibility) by supplying an arbitrary document ID. The function checks existence at line 211-217 but not ownership before update at line 221
- **[kitchen · SECURITY] IDOR: Kitchen plans accessible across all users with kitchen:read permission**
  - `src/actions/kitchen.actions.ts:177`
  - The getKitchenPlan(id: string) function at line 177 accepts a kitchen plan ID and returns the full plan data (including costs and notes) without verifying the user has access to the associated booking or venue. The function only checks for kitchen:read permission globally, not data ownership. Any user with kitchen:read can read any kitchen plan by guessing or iterating IDs. Similarly, updateKitche
- **[leads · DATA_CORRECTNESS] Bulk status update bypasses WON owner requirement guard**
  - `src/actions/bulk.actions.ts:358`
  - The bulkChangeLeadStatus action updates multiple leads to any status (including WON) without checking if they are assigned to an owner. In contrast, the single-lead updateLeadStatus action in lead.actions.ts line 828 enforces the guard: 'if (status === "WON" && !existing.assignedToId) return error'. This creates an AUDIT_CORRECTNESS gap where bulk operations can violate the accountability requirem
- **[logistics · SECURITY] IDOR: Dispatch orders not scoped by user's owned venues**
  - `src/actions/logistics.actions.ts:123`
  - getDispatches() and getDispatch() functions check only role-based permissions (logistics:read) but do not filter dispatch records by the user's ownedVenueIds. The User model has ownedVenueIds and Booking has venueId, but dispatch queries include NO venue filtering. A user with logistics:read permission can view and manipulate dispatch orders for ALL bookings across ALL venues, not just their own. 
- **[payments · SECURITY] IDOR: getPayments() returns all payments across entire system without data isolation**
  - `src/actions/payment.actions.ts:51`
  - The getPayments() server action only checks if the user has 'payments:read' permission (line 63) but does not filter the Prisma query by any tenant, organization, invoice creator, or contact scope. Any authenticated staff member with this permission can view all payments in the entire system by calling this action. The findMany query at line 83-105 accepts optional invoiceId filtering but has no m
- **[payments · SECURITY] IDOR: exportPayments() exports all payments across entire system without data isolation**
  - `src/actions/export.actions.ts:324`
  - The exportPayments() server action checks permission (line 331) but performs an unbounded findMany query (line 335-346) that fetches all payments across the entire system with no organizational or user scope filter. Any staff member with 'payments:read' permission can download a CSV of all company payments via this action.
- **[payments · SECURITY] IDOR: getPaymentStats() aggregates all payments/invoices without data isolation**
  - `src/actions/payment.actions.ts:742`
  - The getPaymentStats() server action checks permission (line 749) but aggregates across ALL payments and invoices in the database without any user/organization/invoice-creator scope. The aggregations at lines 764-782 return global statistics (today's collections, pending payments, overdue amounts) rather than scoped statistics. Any staff member with 'payments:read' permission sees enterprise-wide f
- **[rentals · DATA_CORRECTNESS] Race condition in rentItem() allows inventory to become negative (TOCTOU)**
  - `src/actions/rental.actions.ts:323`
  - The availability check at line 373 (`if (rentalItem.availableQty < rentData.quantity)`) occurs outside the transaction. Two concurrent requests can both pass the check before either executes the decrement at line 423. This causes availableQty to drop below zero. The check-then-act pattern is vulnerable to race conditions; the decrement operation itself is atomic but the preceding validation is not
- **[tasks · VALIDATION] Unvalidated status parameter in moveTask allows arbitrary database values**
  - `src/actions/task.actions.ts:350`
  - The moveTask function accepts a string parameter 'newStatus' with no validation, then casts it directly to a union type with 'as' (line 366). An attacker can send any string value (e.g., 'INVALID', 'DELETED', SQL injection attempts) which will be written to the database if Prisma doesn't enforce the enum at the schema level. The function relies only on TypeScript's compile-time 'as' assertion, whi

### HIGH

- **[_auth · SECURITY] IDOR: getChart allows reading seating chart for any booking without ownership check**
  - `src/actions/seating.actions.ts:26`
  - getChart(bookingId) accepts any bookingId from the client and retrieves the seating chart without verifying that the authenticated user has access to that booking. An authenticated user with 'operations:update' permission can read seating charts for any booking by iterating or guessing booking IDs.
- **[_auth · SECURITY] IDOR: getTask allows reading any task without ownership check**
  - `src/actions/task.actions.ts:110`
  - getTask(id) accepts any task ID from the client and retrieves it without verifying the user has access to that task. An authenticated user with 'tasks:read' permission can read any task in the system by iterating or guessing IDs.
- **[_auth · SECURITY] IDOR: removeGuest allows removing guest from any table without booking ownership check**
  - `src/actions/seating.actions.ts:494`
  - removeGuest(guestId) loads the guest, then navigates to the table and chart, but never verifies that the user has access to the booking. An authenticated operations user can delete guests from any seating chart by guessing guest IDs.
- **[_auth · SECURITY] IDOR: moveGuest allows moving guest between tables across any bookings**
  - `src/actions/seating.actions.ts:542`
  - moveGuest(guestId, newTableId) verifies both tables exist and are in the same chart, but never validates that the user has access to the booking. An authenticated operations user can rearrange seating across any event by guessing IDs.
- **[_automation · ERROR_HANDLING] Fire-and-forget notification writes risk being dropped in serverless cron jobs**
  - `src/lib/lead-pipeline.ts:264`
  - escalateLeadSlaBreaches() calls notify() (line 264-270) without awaiting. In serverless cron contexts, unawaited database writes are silently dropped when the function freezes. This is called from /api/cron/fast which is time-sensitive for SLA escalation. Similarly, escalateOverdueTasks() calls notify() without awaiting at line 300-306. Both functions are called from cron routes where execution ca
- **[_automation · ERROR_HANDLING] Fire-and-forget notifications in BD SLA escalation without await**
  - `src/lib/acq/sla-escalation.ts:33`
  - escalateAcqLeadSlaBreaches() calls notify() at lines 33-39 and 44-50 without awaiting in a loop. These notifications will be dropped when the serverless function freezes after returning. This function is invoked from /api/cron/fast and is critical for BD team SLA alerting.
- **[_rbac · RBAC] No Validation of Assignable Roles in createUser Action**
  - `src/actions/user.actions.ts:121`
  - The createUser action accepts any role string from the client and assigns it directly without validating against an allowlist. Line 121: role: data.role as "SUPER_ADMIN" | "ADMIN" | "SALES_EXEC" | ... uses a TypeScript cast that does not enforce runtime validation. A malicious or misconfigured client could submit any role value. While the type cast narrows it at compile time, at runtime if a role 
- **[analytics · RBAC] Main analytics page calls actions requiring higher permissions without verification**
  - `src/app/(dashboard)/analytics/page.tsx:36`
  - The page checks hasPermission(session.user.role, 'analytics:read') at line 36, but then calls getTopClients() and getCashflow() at lines 55-56 which require 'analytics:advanced' permission. If either action fails due to insufficient permissions, the error is silently caught at lines 83-84 and replaced with empty defaults, allowing a user with only analytics:read to see the page load successfully w
- **[analytics · RBAC] getForecastEntries action lacks permission checks**
  - `src/actions/forecast.actions.ts:248`
  - The getForecastEntries() function at line 248 only checks if user is authenticated (!session?.user) but does not check for any permission. It should verify 'forecast:read' permission like getAIDemandForecast() does at line 512.
- **[analytics · RBAC] getVenuesForBudget action lacks permission checks**
  - `src/actions/forecast.actions.ts:475`
  - The getVenuesForBudget() function at line 475 only checks if user is authenticated (!session?.user) but does not check for any permission. It should verify a budget-related permission.
- **[analytics · RBAC] getBudgets action lacks permission checks**
  - `src/actions/forecast.actions.ts:23`
  - The getBudgets() function at line 23 only checks if user is authenticated (!session?.user) but does not check for any permission. Other budget mutations (createBudget, updateBudget, deleteBudget) properly check for 'budget:create', 'budget:update' permissions, but the read action is missing this check.
- **[approvals · DATA_CORRECTNESS] Step advancement logic fails with non-sequential step orders**
  - `src/actions/approval.actions.ts:659`
  - At line 659-676, when advancing to the next step, the code calculates nextStepIndex as expectedStep + 1 and updates currentStep to this value. However, the approval chain step orders can be non-contiguous (e.g., [0, 5, 10]). If currentStep is 0, the code would set nextStepIndex to 1, but there may be no step with order 1. This causes the approval chain to get stuck because the next approver lookup
- **[approvals · DATA_CORRECTNESS] isLastStep detection uses array length instead of step orders**
  - `src/actions/approval.actions.ts:660`
  - The line 'const isLastStep = nextStepIndex >= chain.length' assumes that step orders are sequential array indices. This check is incorrect when step orders are non-contiguous. With orders [0, 5, 10] and currentStep=5 (second step), nextStepIndex would be 6, which is < chain.length (3), so isLastStep would be false even though there is only one step remaining.
- **[approvals · DATA_CORRECTNESS] Step visualization uses array indices instead of step order values**
  - `src/app/(dashboard)/approvals/_components/approval-detail-card.tsx:87`
  - The approval-detail-card component at lines 87-88 compares array index with request.currentStep: 'const isCompleted = index < request.currentStep' and 'const isCurrent = index === request.currentStep'. This is incorrect because index is the array position (0, 1, 2...) while currentStep is the step order value (0, 5, 10...). This causes the UI to display incorrect step progress. The step display at
- **[approvals · DATA_CORRECTNESS] Step display in approval queue uses incorrect step numbering**
  - `src/app/(dashboard)/approvals/_components/approval-queue.tsx:179`
  - At line 179, the approval queue displays 'Step {request.currentStep + 1} of {chainLength}' treating currentStep as an array index. This is incorrect when step order values are non-sequential. For example, if steps have orders [0, 5, 10] and currentStep is 5, the display would show 'Step 6' instead of 'Step 2'.
- **[availability · VALIDATION] Unvalidated month/year parameters allow silent calendar rollover**
  - `src/actions/availability.actions.ts:126`
  - The getAvailabilityMonth(year: number, month: number) function accepts raw numeric parameters without validation. JavaScript's Date constructor silently rolls over invalid months (e.g., month=13 becomes next year's January, month=0 becomes previous year's December). A user passing month=13, year=2024 would query 2025-01 data instead of an error, breaking the calendar's expectation that 'month' alw
- **[commissions · DEAD_WIRING] calculateCommission() action never invoked by any UI**
  - `src/actions/commission.actions.ts:283`
  - The calculateCommission() server action is exported and fully implemented with permissions and validation, but grep shows it is never called from any component, page, or API route. The only references are the action definition itself and the schema import. This means commission entries cannot be created through the UI.
- **[competitors · DEAD_WIRING] Competitors module missing from navigation sidebar**
  - `src/components/layout/app-sidebar.tsx`
  - The competitors module is fully implemented with page, server actions, permissions, and middleware gating, but there is no navigation link in app-sidebar.tsx to make it discoverable to users. The route is protected by middleware (line 93 in middleware.ts) and has ROUTE_PERMISSIONS entry (line 1219), but users cannot navigate to it without knowing the direct URL.
- **[contracts · SECURITY] getContract lacks user ownership checks**
  - `src/actions/contract.actions.ts:133`
  - getContract only enforces role-based access (contracts:read) but does not verify user owns the contract. Any SALES_EXEC or SALES_HEAD can read any other user's contracts, exposing sensitive client data, negotiation terms, signer details, and internal notes.
- **[contracts · RBAC] deleteContract uses wrong permission constant**
  - `src/actions/contract.actions.ts:367`
  - deleteContract checks 'contracts:update' permission but logically should check 'contracts:delete' (if it existed) or require stricter RBAC (e.g., only createdBy or ADMIN). Currently, any user with contracts:update can permanently delete draft contracts, which may not be the intended business rule.
- **[crm · RBAC] Missing permission check on getCadence() and getCadences() read operations**
  - `src/actions/cadence.actions.ts:72`
  - getCadences() (line 72-95) and getCadence() (line 97-125) perform only auth() check but do not validate 'settings:read' permission. All other cadence operations require hasPermission(role, 'settings:read'), but these read operations skip the check, creating an inconsistent access control pattern. This allows users with no permissions to list all cadences.
- **[crm · SECURITY] IDOR: createStep() does not validate cadenceId ownership**
  - `src/actions/cadence.actions.ts:346`
  - createStep(cadenceId, input) accepts a client-supplied cadenceId (line 347) and directly creates a step without verifying the cadence exists or that the current user has access to it. An attacker can create steps in arbitrary cadences by providing any cadenceId.
- **[crm · SECURITY] IDOR: updateStep() does not validate step belongs to accessible cadence**
  - `src/actions/cadence.actions.ts:396`
  - updateStep(id, input) updates a CadenceStep by id without fetching the step first to validate it exists or belongs to a cadence the user can access. An attacker can update any step in any cadence.
- **[crm · SECURITY] IDOR: deleteStep() does not validate step belongs to accessible cadence**
  - `src/actions/cadence.actions.ts:446`
  - deleteStep(id) deletes a CadenceStep by id without verification. An attacker can delete any step from any cadence in the system.
- **[crm · SECURITY] IDOR: reorderSteps() does not validate orderedIds belong to the target cadence**
  - `src/actions/cadence.actions.ts:476`
  - reorderSteps(cadenceId, orderedIds) accepts a cadenceId and a list of step IDs, but does not verify that any of the orderedIds actually belong to that cadence. An attacker can pass step IDs from other cadences to reorder arbitrary steps.
- **[dashboard · SECURITY] Activity feed reads all team activity logs without entity-level access control**
  - `src/actions/activity.actions.ts:52`
  - getActivityLogs() checks session authentication but does NOT filter activity logs by the user's accessible entities (venues, projects, etc.). It returns all ActivityLog records matching optional entityType/userId params. If a user filters by a competitor's userId via the ActivityFeed component (activity-feed.tsx line 38), they can see all that user's actions across the entire system, including pri
- **[dashboard · SECURITY] getDashboardStats() queries all records system-wide without venue/org ownership filtering**
  - `src/actions/dashboard.actions.ts:148`
  - The action aggregates payments, bookings, leads, invoices, and tasks across the entire database. It checks hasPermission(role, 'dashboard:read') but does NOT filter by the user's accessible entities. A non-admin user with 'dashboard:read' permission will see revenue, booking counts, and payment totals from ALL venues and leads in the system, including competitors' data. This is a multi-tenant data
- **[dashboard · SECURITY] Upcoming events card displays all bookings without venue/org filtering**
  - `src/actions/dashboard.actions.ts:213`
  - upcomingEvents query selects all bookings within 7 days across all venues, without checking user ownership or role-based access. A staff member at Venue A can see Venue B's upcoming events and contact details. This leaks customer information and venue-specific booking data.
- **[dashboard · SECURITY] Overdue payments list queries all invoices system-wide without ownership check**
  - `src/actions/dashboard.actions.ts:230`
  - overduePayments query fetches invoices with dueDate < now and balanceDue > 0 from the entire database. No filtering by venue, organization, or user role. A finance coordinator can view all overdue invoices across all customers and venues, not just those they manage.
- **[gallery · SECURITY] IDOR: Gallery items can be modified/deleted by any authorized user, not just uploader**
  - `src/actions/gallery.actions.ts:187`
  - The updateGalleryItem function (line 187) and deleteGalleryItem function (line 268) only check role-based permissions (gallery:update and gallery:delete), but do not verify ownership via the uploadedById field. Any staff member with these permissions (e.g., SALES_EXEC, SALES_HEAD, EVENT_COORDINATOR) can modify or delete any gallery item, regardless of who originally uploaded it. The schema tracks 
- **[inquiries · DATA_CORRECTNESS] Race condition in processInquiry enables duplicate lead creation**
  - `src/actions/widget.actions.ts:104`
  - The processInquiry function checks if inquiry.isProcessed is true (line 104) but does not update the flag until line 165. Between this check and update, another concurrent request could pass the same check and create a duplicate lead and contact. This violates atomicity: two concurrent requests to process the same inquiry both pass the isProcessed check, both call createLead, and both create separ
- **[insurance · RBAC] Read operations lack insurance:read permission check**
  - `src/actions/insurance.actions.ts:19`
  - getInsurancePolicies() at line 19, getInsurancePolicyById() at line 87, getExpiringPolicies() at line 332, and getInsuranceStats() at line 376 all check for session.user but none check hasPermission(session.user.role, 'insurance:read'). Create/update/delete actions properly enforce this, but read actions do not. This creates an RBAC bypass where users without insurance:read permission can still qu
- **[insurance · VALIDATION] No ownership validation when linking policies to booking/venue**
  - `src/actions/insurance.actions.ts:174`
  - createInsurancePolicy() accepts bookingId and venueId without verifying they exist or are accessible to the user. A user with insurance:create permission could assign a policy to any booking or venue ID (even from other organizations) by guessing IDs. The form populates these from a limited list, but server action accepts arbitrary values. No existence check like 'prisma.booking.findUnique({where:
- **[insurance · VALIDATION] Update action does not validate booking/venue ownership**
  - `src/actions/insurance.actions.ts:261`
  - updateInsurancePolicy() at lines 261-262 directly updates bookingId and venueId without checking they exist or belong to an accessible context. A user could reassign a policy to an arbitrary booking/venue using a guessed ID.
- **[inventory · DATA_CORRECTNESS] Missing validation that availableQty <= totalQuantity**
  - `src/schemas/inventory.schema.ts:42`
  - The schema validates availableQty as a non-negative integer (lines 42-45), but does not validate that availableQty cannot exceed totalQuantity. A user can create or update an item with availableQty=100 and totalQuantity=50, resulting in invalid inventory state. Similarly, the createItem action (line 190) and updateItem action (line 266) directly assign the user-supplied values without server-side 
- **[kitchen · VALIDATION] Unvalidated covers input in NewPlanDialog allows negative numbers past browser validation**
  - `src/app/(dashboard)/kitchen/_components/kitchen-list.tsx:238`
  - The NewPlanDialog covers input (line 238) uses min={0} HTML attribute which is client-side only and can be bypassed. The form accepts a string covers value and passes Number(covers) to createKitchenPlan without client-side validation. While the server-side validation at kitchen.actions.ts line 282 checks covers > 0, the client should reject negative input to provide immediate feedback. Currently, 
- **[logistics · DATA_CORRECTNESS] Stock restoration logic doesn't validate inventory item still exists**
  - `src/actions/logistics.actions.ts:648`
  - In recordReturn(), when updating returnedQty and restoring inventory, the code fetches inv with findUnique but then silently skips restoration if inv is null (line 653: 'if (inv) { ... }'). This means if an inventoryItem is deleted between dispatch and return, the returned quantity never gets restored, leaving stock artificially low. The code also doesn't check if totalQuantity was modified betwee
- **[logistics · DATA_CORRECTNESS] Stock decrement race condition: concurrent dispatches can create asymmetry**
  - `src/actions/logistics.actions.ts:528`
  - In markDispatched(), the stock decrement loop (lines 551-562) is NOT atomic relative to the status flip. The code uses a conditional updateMany() to flip status only once (line 529-532), but then the subsequent stock decrements (lines 551-562) are inside the same transaction. If two requests call markDispatched() simultaneously on the same dispatch: (1) First request: status=PLANNED check passes, 
- **[logistics · DATA_CORRECTNESS] Missing validation: bookingId can be set to any non-existent ID in updateDispatch**
  - `src/actions/logistics.actions.ts:316`
  - In createDispatch() line 317-322, the code validates that a provided bookingId exists before creating the dispatch. However, in updateDispatch() line 372-378, the validation is conditional: it only checks existence if bookingId is truthy (non-empty). This is inconsistent. More critically, there is no check in either function to ensure the booking status is CONFIRMED before allowing the link, even 
- **[menu · SECURITY] IDOR vulnerability in saveBookingMenu - no booking ownership verification**
  - `src/actions/menu.actions.ts:317`
  - The saveBookingMenu function accepts a client-supplied bookingId and only verifies that a booking with that ID exists (line 341-347), but does not verify that the authenticated user has permission to edit that specific booking. An attacker can modify the menu for any booking by guessing or enumerating valid bookingIds. The function should validate booking ownership or check that the user has the r
- **[menu · RBAC] Missing permission checks in read-only menu actions**
  - `src/actions/menu.actions.ts:20`
  - The getMenuItems (line 20), getMenuItem (line 92), getBookingMenu (line 283), and calculateMenuTotal (line 445) functions check for authentication (auth()) but do NOT check for menu:read or menu:update permission. While middleware protects the /menu route, these actions can be called directly if an attacker discovers the action names, bypassing route-level protection. This is especially critical f
- **[notifications · ERROR_HANDLING] Unhandled errors in server actions break optimistic UI updates**
  - `src/app/(dashboard)/notifications/_components/notification-list.tsx:188`
  - The markAsRead(), markAllAsRead(), and deleteNotification() handlers wrap server action calls in startTransition() without error handling. If the server action throws (e.g., Unauthorized, Not found), the UI state is still updated optimistically (lines 191-196, 206-208, 216-218), leaving the UI in an inconsistent state with the server. The user sees a success when the operation failed.
- **[notifications · ERROR_HANDLING] Unhandled errors in popover notification handlers**
  - `src/components/layout/notification-popover.tsx:192`
  - Similar to the notifications list page, handleMarkAsRead (line 194) and handleMarkAllAsRead (line 205) await server actions without catching errors. Errors thrown by markAsRead/markAllAsRead are unhandled, and the queryClient.invalidateQueries will still execute, potentially showing stale/incorrect data to the user.
- **[owners · RBAC] SALES_EXEC users can be assigned to BD hall owners despite lacking permissions**
  - `src/app/(dashboard)/owners/[ownerId]/edit/page.tsx:26`
  - The edit page queries for bdOwnerId candidates with roles [SUPER_ADMIN, ADMIN, SALES_EXEC], but SALES_EXEC does not have 'owners:read' or any 'owners:*' permissions. This allows cross-domain assignment of users without appropriate BD module access to manage hall owner records. SALES_EXEC belongs to the Sales CRM domain, not the BD CRM domain, per the permission architecture.
- **[owners · RBAC] New owner page also allows SALES_EXEC assignment despite lacking permissions**
  - `src/app/(dashboard)/owners/new/page.tsx:18`
  - Same issue as edit page: bdUsers query filters for [SUPER_ADMIN, ADMIN, SALES_EXEC] but SALES_EXEC lacks owners:* permissions. A SALES_EXEC user appearing in the bdOwnerId dropdown would be a permission violation if selected.
- **[payouts · VALIDATION] No existence validation for vendor and booking associations in createPayout**
  - `src/actions/payout.actions.ts:139`
  - The createPayout action accepts vendorId and bookingId as optional foreign keys but does not validate that these records actually exist before creating the payout. The schema at line 36-37 of payout.schema.ts only checks that vendorId/bookingId are strings, never confirming the records exist. This allows creating orphaned payouts with references to non-existent vendors/bookings. Prisma will create
- **[people · ERROR_HANDLING] updateEmployee missing error handling for database constraints**
  - `src/actions/hr-employee.actions.ts:397`
  - The updateEmployee function (lines 397-405) calls prisma.$transaction without a try-catch block. If a Prisma error occurs (e.g., invalid foreign key when connecting to an entity/vertical/department/designation/manager that no longer exists), the error will propagate uncaught and crash the server. The function builds FK connections without validating they exist beforehand.
- **[performance · SECURITY] IDOR: getIndividualMetrics allows querying any user's metrics without ownership check**
  - `src/actions/performance.actions.ts:451`
  - getIndividualMetrics(userId) accepts any userId parameter and only checks if the caller has 'performance:read' permission. It does not validate that the requested userId belongs to the current user or is a subordinate/team member. This allows any user with performance:read permission to view detailed metrics (bookings, revenue, leads, tasks, ratings) for any other employee.
- **[performance · SECURITY] IDOR: getIndividualPerformanceDetail allows querying any user's performance data without ownership check**
  - `src/actions/performance-score.actions.ts:181`
  - getIndividualPerformanceDetail(userId) accepts any userId and only checks 'performance:read' permission without validating that the caller owns or manages that user. This allows unauthorized access to another user's performance scores, badges, and incentive data.
- **[procurement · SECURITY] IDOR: Item operations lack ownership check on PR**
  - `src/actions/procurement.actions.ts:321`
  - addPurchaseRequisitionItem, updatePurchaseRequisitionItem, and deletePurchaseRequisitionItem functions check procurement:write permission but do not verify the prId belongs to a PR the user has access to. A malicious user could obtain a prId from another user's PR and add/edit/delete items in it.
- **[procurement · SECURITY] IDOR: Project procurement actions lack projectId validation**
  - `src/actions/project-procurement.actions.ts:74`
  - createWorkPackage, updateWorkPackage, createPurchaseOrder, and getProjectProcurement functions accept a projectId but never verify it exists or is accessible to the current user. They only check role permissions (projects:manage). A user with that role could modify any project's procurement data.
- **[projects · SECURITY] IDOR on CapEx Projection actions via unscoped ID lookup**
  - `src/actions/projects.actions.ts:612`
  - Functions updateCapex (line 609), submitCapex (line 625), approveCapex (line 638), rejectCapex (line 659), and sendCapex (line 671) all take a CapEx ID and perform findUnique(id) without verifying the ID belongs to a project the user has permission to access. An authenticated user with projects:update, projects:create, or projects:approve permission can craft requests with arbitrary CapEx IDs from
- **[projects · SECURITY] IDOR on work package and purchase order mutations via unscoped ID**
  - `src/actions/project-procurement.actions.ts:97`
  - Functions updateWorkPackage (line 95) and updatePurchaseOrderStatus (line 113) accept only an ID parameter without a projectId. They fetch the record by ID alone and update it. A user with projects:manage permission (SUPER_ADMIN/ADMIN or hasPermission 'projects:manage') can craft requests with work package or PO IDs from projects they shouldn't access, allowing cross-project modification.
- **[referrals · SECURITY] Direct Prisma access in NewReferralPage without auth check**
  - `src/app/(dashboard)/referrals/new/page.tsx:14`
  - The NewReferralPage component directly calls prisma.contact.findMany() on line 14 to fetch the contact list without checking user authentication or permissions. While the page itself is behind the /referrals route (which requires 'referrals:read' per middleware), the direct Prisma call bypasses per-page permission validation. This could allow a user with 'referrals:read' but without 'contacts:read
- **[reports · SECURITY] IDOR: Client ledger lookup accepts arbitrary contact IDs**
  - `src/actions/report.actions.ts:883`
  - The getClientLedger(contactId: string) function accepts a client-supplied contact ID without verifying ownership or scope. Any user with analytics:read permission can query any contact's financial data: invoices, payments, email, and outstanding balance. The function only checks auth() and analytics:read permission, then blindly queries all invoices and payments for the supplied contactId.
- **[resources · RBAC] Read operations lack explicit permission checks**
  - `src/actions/resource.actions.ts:30`
  - getResources(), getResource(), checkConflicts(), and getResourceCalendar() functions only check session existence but do not verify 'resources:read' permission. While middleware provides route-level gating, server actions should independently enforce permissions as a defense-in-depth measure.
- **[staff · SECURITY] IDOR: Staff profile modification without ownership check**
  - `src/actions/staff.actions.ts:118`
  - The updateStaffProfile() function accepts a staff profile ID from the client and only validates role-based permissions. An admin or event coordinator can modify ANY staff member's profile including bank details, hourly/monthly rates, and emergency contacts. No ownership or approval chain verification exists.
- **[support · RBAC] assignTicket does not validate target user has support:write permission**
  - `src/actions/support.actions.ts:427`
  - The assignTicket function (lines 427-459) checks that the assigned user is active (line 444-448) but does not verify they have the support:write permission. A user with support:read can be assigned tickets even if they cannot modify them. The ASSIGNABLE_ROLES list at line 29 defines which roles should be assignable, but this is not enforced in the assignTicket action.
- **[surveys · SECURITY] Missing Survey Ownership Check (IDOR)**
  - `src/actions/survey.actions.ts:170`
  - The updateSurvey, deleteSurvey, getSurveyById, and getSurveyResults functions check user role permissions but do not verify survey ownership. The Survey model lacks a userId or organizationId field. This allows any user with surveys:update/delete permissions to modify or delete surveys created by other users. getSurveys() returns all surveys without any ownership filtering.
- **[vendors · SECURITY] IDOR: Package image operations lack ownership verification**
  - `src/actions/vendor-catalog.actions.ts:519`
  - Functions addPackageImage (line 519), setPackageCover (line 545), deletePackageImage (line 561), and reorderPackageImages (line 580) only check that the user has 'vendors:update' permission. They do not verify that the packageId belongs to a vendor the user is authorized to edit. A user with 'vendors:update' permission can modify images on any vendor package.
- **[whatsapp · DATA_CORRECTNESS] Incorrect delivery and read rate calculation excludes SENT messages**
  - `src/actions/whatsapp.actions.ts:344`
  - The deliveryRate and readRate are computed as (delivered + read) / (sent + delivered + read). However, this logic treats 'SENT' status as a complete state rather than an intermediate one. In the WhatsApp API, a message progresses: SENT -> DELIVERED -> READ. Including SENT in the denominator inflates the rate calculation. A message marked SENT (not yet delivered) should not be counted against the d

### MEDIUM

- **[_auth · SECURITY] Missing permission check in updateTask + updateTaskStatus + moveTask**
  - `src/actions/task.actions.ts:218`
  - updateTask (line 218), updateTaskStatus (line 311), and moveTask (line 348) all check hasPermission but none verify the task belongs to a booking the user can access. A user with 'tasks:update' permission can modify any task including changing status or reassigning tasks owned by other teams/bookings.
- **[_auth · SECURITY] IDOR in seating operations: createChart, updateChart, addTable not gating booking access**
  - `src/actions/seating.actions.ts:62`
  - createChart (line 62) and updateChart (line 135) check permissions but not booking ownership. Any operations user can create/update a seating chart for any booking ID. Similarly, addTable (line 199) and removeTable (line 379) verify chart exists but not user access to that booking.
- **[_auth · SECURITY] No task visibility boundary enforcement: team leads can see all tasks across all bookings**
  - `src/actions/task.actions.ts:14`
  - getTasks (line 14) filters by status/priority/assignee but not by booking or user's team/venue. A sales head or operations manager with 'tasks:read' can enumerate all tasks in the system by pagination/filtering, not just tasks from their team's bookings.
- **[_automation · DEAD_WIRING] notifyAdmins() function defined but never used**
  - `src/lib/notify.ts:69`
  - The notifyAdmins() function is exported (lines 69-76) but grep search shows it's never called anywhere in the codebase. The function iterates over adminIds and calls notify() without awaiting, which means it has the same fire-and-forget issue. This dead code should either be removed or updated to await notifications properly if it's intended for future use.
- **[_automation · ERROR_HANDLING] Cadence executor fire-and-forget email/WhatsApp sends lack error recovery**
  - `src/lib/cadence-executor.ts:140`
  - sendEmail() at line 140-144, sendWhatsApp() at line 180-184, and sendSms() at line 195-197 are all called with `.catch()` that only logs the error. In a serverless context where the cadence processing may freeze before external API requests complete, these fire-and-forget sends could silently fail without being retried. The DB rows are created first (Communication, WhatsAppMessage records), markin
- **[_automation · VALIDATION] Customer-360 rollup N+1 query pattern in loop**
  - `src/app/api/cron/customer-360/route.ts:46`
  - The route groups bookings by contactId (line 31-37) but then for each group, does a separate findUnique query to fetch the contact's vipCustomer flag (line 46-49). This is an N+1 pattern: if there are 1000 contacts, this does 1000 separate queries. The vipCustomer flag should be fetched in a single batch query after the groupBy, or the groupBy should be restructured to avoid this loop.
- **[_money · DATA_CORRECTNESS] Receipt number collision risk: non-unique field with race-condition window**
  - `src/actions/payment.actions.ts:218`
  - Payment.receiptNumber is NOT defined with @unique in the schema (line 882 of schema.prisma), yet the code generates receipt numbers (RCP-YYYY-NNNN) inside a retry loop expecting to catch P2002 unique violations. The comments at lines 209-213, 375-381, and in apply-capture.ts (108-112) acknowledge this gap. Under concurrent payment creation, two threads can both read the same max receiptNumber, inc
- **[_money · DATA_CORRECTNESS] Installment allocation idempotency depends on state truthfulness but can diverge if paidAmount regresses**
  - `src/lib/payments/apply-capture.ts:20`
  - allocatePaidAmountToInstallments() is marked idempotent (line 7), deriving state purely from the current paidAmount. It allocates amounts FIFO by dueDate and marks installments COMPLETED if remaining >= amt (with 0.01 paisa tolerance). However, if a payment is ever refunded or reversed (no such action exists today, but the schema allows payment.status = REFUNDED), paidAmount would regress and inst
- **[_money · DATA_CORRECTNESS] Rounding/precision drift in balance calculation: float math on Decimal fields**
  - `src/actions/payment.actions.ts:241`
  - At line 240-241, paidAmount and totalAmount (both Decimal in DB) are converted to JavaScript Number: const paid = Number(credited.paidAmount); const bal = Number(credited.totalAmount) - paid;. JavaScript Numbers are IEEE 754 floats, which lose precision on large currency values and accumulate rounding error over many operations. The 0.01 paisa tolerance (line 244) is a band-aid but doesn't prevent
- **[_rbac · RBAC] Missing users:delete Permission Enforcement**
  - `src/actions/user.actions.ts:197`
  - The toggleUserActive function uses the 'users:update' permission to deactivate/reactivate users (line 204). However, the permissions schema defines 'users:delete' as a separate permission. Deactivating a user is semantically closer to deletion than update. If the intended design is to require different permissions for these operations, the implementation diverges from the spec. While there is a gu
- **[analytics · RBAC] Forecast, Budget, and Agents analytics sub-pages lack page-level auth/permission guards**
  - `src/app/(dashboard)/analytics/forecast/page.tsx:31`
  - The forecast page (line 31), budget page, and agents page do not perform auth() or hasPermission() checks. They rely solely on the parent (dashboard) layout.tsx for auth. While the layout checks for user existence, these pages should have explicit permission checks (e.g., checking for 'forecast:read'). The anomalies page correctly checks auth and permissions (lines 19-26 of anomalies/page.tsx), bu
- **[approvals · VALIDATION] Delegation lacks validation for target user existence**
  - `src/actions/approval.actions.ts:879`
  - The delegateRequest() function checks that delegateToUserId is not empty (line 879), but does not verify that the user actually exists in the database. This allows delegating to non-existent user IDs, which would silently fail when trying to send notifications and would pollute the decision history with invalid delegations.
- **[approvals · VALIDATION] User can potentially delegate approval to themselves**
  - `src/actions/approval.actions.ts:859`
  - The delegateRequest() function does not prevent a user from delegating an approval to themselves. While the approverAuthError function prevents self-approval, it does not prevent self-delegation. This allows a user to create a delegate decision record with delegatedToId === session.user.id, which could be used to bypass segregation of duties checks.
- **[beo · SECURITY] Potential IDOR in resolveBeoIncident - incident ID not scoped to accessible BEO**
  - `src/actions/beo.actions.ts:416`
  - The resolveBeoIncident(id) action accepts only an incident ID and does not verify that the incident belongs to a BEO the user has access to. While the UI only exposes incident IDs from BEOs displayed on the current page, an attacker with beo:write permission could craft a direct call to resolveBeoIncident() with an incident ID from another BEO (if discovered via error messages, API responses, or I
- **[beo · VALIDATION] Covers field accepts negative numbers without validation**
  - `src/actions/beo.actions.ts:335`
  - The covers field is converted with Number(patch.covers) without checking if the value is negative, zero, or infinite. The UI input field has inputMode='numeric' but no min attribute. A user can submit negative covers (e.g., -100), which passes server validation and stores invalid data. The schema defines covers as Int? (nullable integer), which permits negatives, but semantically covers should nev
- **[campaigns · DATA_CORRECTNESS] Non-atomic sendCampaign state update with race condition risk**
  - `src/actions/campaign.actions.ts:336`
  - sendCampaign() performs two separate updates: first to SENDING (line 336), then to SENT (line 355). Between these two operations, concurrent requests or a failure could leave the campaign in SENDING state indefinitely. If the contact count query (line 351) fails or times out, the campaign is stuck in SENDING state and cannot be retried (SENDING status rejects all transitions).
- **[campaigns · VALIDATION] Missing datetime validation for scheduledAt**
  - `src/schemas/campaign.schema.ts:26`
  - scheduleCampaignSchema validates scheduledAt as a non-empty string but does not validate it as a valid ISO datetime. The frontend sends a datetime-local input value, but there is no server-side validation that it is a valid date format. A malformed string will be passed to `new Date(parsed.data.scheduledAt)` (campaign.actions.ts:287), which may parse to Invalid Date or an unintended timestamp.
- **[campaigns · DATA_CORRECTNESS] getCampaignStats reveals aggregate data without ownership filter**
  - `src/actions/campaign.actions.ts:447`
  - getCampaignStats() aggregates totalSent, totalOpened, totalClicked across ALL campaigns in the database without filtering by createdById. This exposes company-wide campaign metrics to any user with campaigns:read permission, even if they should only see their own campaigns' stats.
- **[campaigns · ERROR_HANDLING] Swallowed error in campaign send: contact count query may fail silently**
  - `src/actions/campaign.actions.ts:351`
  - The prisma.contact.count() query at line 351 has no error handling. If the Contact table doesn't exist, the query throws, gets caught by the outer try-catch, and returns 'Failed to send campaign' with no details about the actual failure. This makes debugging difficult and masks schema mismatches.
- **[commissions · PERFORMANCE] getCommissionEntries() loads all records without pagination**
  - `src/actions/commission.actions.ts:262`
  - findMany() has no limit, skip, or take parameters. This loads ALL commission entries into memory on every page load, then computes totals across all of them in commission-stats.tsx (line 31-35). At scale (thousands of entries), this becomes an N+1 and memory exhaustion issue.
- **[commissions · DATA_CORRECTNESS] Commission amount calculated using JavaScript floating-point arithmetic**
  - `src/actions/commission.actions.ts:339`
  - The calculation (invoiceAmount * percentage) / 100 uses JavaScript number types, which suffer from floating-point precision errors (e.g., 0.1 + 0.2 !== 0.3). The result is stored in Decimal(12,2), so it is rounded at storage time, but the calculation itself can produce incorrect intermediate values. Example: if invoice is ₹1000 and percentage is 7.15%, the calculation could yield 71.4999999... ins
- **[commissions · VALIDATION] calculateCommissionSchema includes unused invoiceAmount field**
  - `src/schemas/commission.schema.ts:54`
  - The schema requires a client-supplied invoiceAmount and validates it, but the server action (line 336 in commission.actions.ts) explicitly fetches invoiceAmount from the booking record and ignores the client value. This is good for security (doesn't trust client input), but the schema validation is wasted work and confusing to callers.
- **[contacts · ERROR_HANDLING] Unawaited logActivity promises in bulk operations**
  - `src/actions/bulk.actions.ts:56`
  - In bulkUpdateContacts (lines 55-64) and bulkDeleteContacts (lines 105-112), logActivity() is called without await. Since logActivity is async, these promises are created but not awaited, causing fire-and-forget behavior. The server action returns success before activity logging completes, risking silent failures and audit trail gaps. Additionally, this creates a potential race condition where the 
- **[contracts · VALIDATION] Contract expiry date not validated server-side on send**
  - `src/actions/contract.actions.ts:401`
  - sendContract does not validate that expiresAt (if set) is in the future. A contract with expiresAt in the past can be sent and will fail when the client tries to sign. The client-side calendar disables past dates (contract-form.tsx line 510) but server-side validation is missing.
- **[contracts · ERROR_HANDLING] Fire-and-forget email/esign errors are silently swallowed**
  - `src/actions/contract.actions.ts:456`
  - sendContract marks the contract as SENT and returns success even if sending the email or requesting e-signature fails (lines 457-474). If the signer never receives the email, the contract is left in SENT state with no way to know why. The user may believe the send succeeded when it silently failed.
- **[contracts · DATA_CORRECTNESS] Portal contract status transition updates DB without transactional safety**
  - `src/actions/contract.actions.ts:1041`
  - getPortalContract auto-updates contract status from SENT to VIEWED on read (line 1042-1046) without transaction. If two concurrent portal views occur, both see SENT and both attempt update, resulting in a race condition. Also, the status returned to client is inconsistent (line 1052 returns VIEWED even if the DB update fails silently).
- **[contracts · DATA_CORRECTNESS] Contract expiry check allows signing expired contracts in portal**
  - `src/actions/contract.actions.ts:1126`
  - portalSignContract checks expiry and returns error (line 1126-1135), but only sets status to EXPIRED; it does not prevent the signature from being stored if the date check is bypassed. The logic is correct here, but the error message could be more explicit and the status update should be atomic with the check.
- **[crm · VALIDATION] Missing validation that cadence is not ARCHIVED before allowing step mutations**
  - `src/actions/cadence.actions.ts:346`
  - createStep(), updateStep(), deleteStep(), and reorderSteps() do not check the cadence status. A user can modify steps on an ARCHIVED cadence, which should be immutable. This violates the state machine implicit in toggleCadenceStatus() which allows transitions out of ARCHIVED.
- **[crm · ERROR_HANDLING] Swallowed error in logActivity() call (fire-and-forget without await)**
  - `src/actions/cadence.actions.ts:381`
  - At line 381 in createStep(), logActivity() is called without await, so errors are silently swallowed. Same pattern at lines 431, 461, 499, etc. If activity logging fails, the user won't know.
- **[crm · DATA_CORRECTNESS] calculateNextExecuteAt() uses current time without respecting job execution time**
  - `src/actions/cadence.actions.ts:518`
  - calculateNextExecuteAt(delayDays, delayHours) at line 518 calculates the next execution from the time the enrollment is created. If a cadence is paused for hours and resumed, nextExecuteAt is recalculated from the current time, potentially causing delays longer than intended. The value should be based on the step's delays, not the current clock.
- **[crm · VALIDATION] stepBuilder and enrollmentsTable UI may display stale data if step/enrollment mutations fail silently**
  - `src/app/(dashboard)/crm/cadences/_components/step-builder.tsx`
  - The StepBuilder and EnrollmentsTable components fetch data on page load but do not have error boundaries. If a step mutation fails (e.g., due to IDOR check that should exist), the UI won't refetch or display an error.
- **[dashboard · DATA_CORRECTNESS] Monthly revenue aggregation sums Decimal fields but does not validate precision or detect stale balanceDue records**
  - `src/actions/dashboard.actions.ts:318`
  - last12MonthsPayments aggregates payment.amount (Decimal) into monthlyRevenue. If a payment is refunded but status remains COMPLETED (data corruption), the refunded amount is still counted as revenue. The dashboard will show inflated revenue. Additionally, Invoice.balanceDue is a denormalized field; if a payment updates paidAmount without updating balanceDue, the overdue-payment count will be stale
- **[dashboard · UX] Activity feed polls every 30s but does not show venue/org context or warn on cross-org data**
  - `src/app/(dashboard)/dashboard/_components/activity-feed.tsx:39`
  - The 30-second refetch interval (line 39) may cause excessive database load if many users are on the dashboard. The feed displays entity names and user names but does NOT show which venue or org the action occurred in, making it confusing if the user manages multiple venues. The UI does not indicate whether a log entry is from the current user's venue or not.
- **[dashboard · ERROR_HANDLING] getActivityLogs() silently catches and logs errors but returns generic error string**
  - `src/actions/activity.actions.ts:84`
  - On error, the function logs to console but returns { success: false, error: 'Failed to fetch activity logs' }. The ActivityFeed component receives this error and shows a generic message. If the error is a database connection failure, the user won't know if it's transient or critical, and the activity feed will appear stuck.
- **[dashboard · VALIDATION] getDashboardStats() does not validate date range params or handle timezone edge cases**
  - `src/actions/dashboard.actions.ts:112`
  - The action uses startOfMonth(now) and endOfMonth(now) based on server time, but the greeting uses Asia/Kolkata timezone (line 23 in page.tsx). If the server is in a different timezone, the 'this month' period may not align with the user's local calendar. Payments recorded at midnight UTC may be counted in the wrong month relative to IST.
- **[documents · PERFORMANCE] Unbounded query in getDocumentsByEntity without pagination**
  - `src/actions/document.actions.ts:327`
  - The getDocumentsByEntity() function executes a findMany() without any limit or pagination. If a venue, booking, or contact has thousands of documents, this query will retrieve and serialize all of them at once, potentially causing memory exhaustion and slow response times. The similar getDocuments() function at line 72-78 properly implements pagination with a default limit of 50.
- **[documents · UX] updateDocument is exported but never called from UI**
  - `src/actions/document.actions.ts:191`
  - The updateDocument() function is exported as a server action but is not invoked from any UI component. The document-list.tsx only calls deleteDocument(), not updateDocument(). This suggests either dead code or incomplete feature implementation. Either the UI for editing should be wired or the function should be removed.
- **[finance · DATA_CORRECTNESS] Payroll deduction amounts rounded to nearest rupee instead of paise**
  - `src/actions/finance-payroll.actions.ts:125`
  - In computeSlip(), PF deduction on line 125 is rounded as `Math.round(Math.min(basic, 15000) * 0.12)` without multiplying by 100 first. This rounds to the nearest rupee (e.g., 1999.50 becomes 2000) instead of to paise (nearest 0.01). The same issue appears in line 129 for ESI: `Math.round(esiWages * 0.0075)` rounds to rupees, not paise. Over many payroll runs, this compounds small rounding losses t
- **[finance · DATA_CORRECTNESS] Depreciation calculation rounds to nearest rupee, not paise**
  - `src/actions/finance-assets.actions.ts:192`
  - On line 192, depreciation amount is computed as `Math.round(Math.min(monthly, remaining) * 100) / 100;` which is correct. However, the accumulated depreciation on line 180 and the comparison on line 209 use floating-point arithmetic without sufficient precision guards. For assets with useful lives that don't divide evenly, accumulated depreciation over many months can drift by fractions of a paise
- **[inquiries · ERROR_HANDLING] Missing try-catch in handleDelete client action**
  - `src/components/widget/inquiry-table.tsx:174`
  - The handleDelete async function (lines 174-182) does not wrap the deleteInquiry call in a try-catch block. If deleteInquiry throws an exception (not a controlled error response), it will propagate unhandled. Other handlers (handleProcess, handleMarkDone) correctly use try-catch-finally. This inconsistency leaves the delete handler vulnerable to unhandled promise rejections.
- **[inquiries · UX] Delete action missing loading state feedback**
  - `src/components/widget/inquiry-table.tsx:174`
  - The handleDelete function does not set the loading state (unlike handleProcess and handleMarkDone), meaning the delete button does not show visual feedback during the operation. This allows rapid clicks to trigger multiple delete requests, and users receive no indication the operation is in progress. The loading state is initialized at line 138 but never used in handleDelete.
- **[insurance · DATA_CORRECTNESS] No atomic validation of booking/venue existence during creation**
  - `src/actions/insurance.actions.ts:165`
  - If a user provides a bookingId that no longer exists (deleted between form load and submission), the insurancePolicy.create() will silently succeed with a now-orphaned foreign key reference (or fail on the database constraint). The form does not handle or explain this edge case.
- **[inventory · DATA_CORRECTNESS] DAMAGED reservations incorrectly restore availableQty**
  - `src/actions/inventory.actions.ts:506`
  - In releaseReservation, when a reservation is marked as DAMAGED, the availableQty is incremented by the reserved quantity (line 506). This is semantically wrong: damaged items should not be counted as available stock and may need separate tracking. The reservation status check at line 487 correctly prevents double-release of RETURNED/DAMAGED items, but the increment logic treats DAMAGED the same as
- **[inventory · DATA_CORRECTNESS] Stale stock check in reserveForBooking allows race condition**
  - `src/actions/inventory.actions.ts:377`
  - The stock availability check (lines 377-390) reads the item outside the transaction. If two concurrent requests both pass the stock check but the total reserved quantity exceeds availableQty, the transaction will still succeed in updating availableQty to a negative value (via decrement at line 422). While Prisma does decrement atomically, the pre-check should be inside or wrapped by the transactio
- **[invoices · PERFORMANCE] Unbounded query in exportInvoices() can cause memory exhaustion**
  - `src/actions/export.actions.ts:26`
  - The exportInvoices() function fetches all invoices with `take: 10000`, loading potentially 10,000 records into memory at once. In a large deployment, this can exhaust memory and cause slowdowns or crashes. The query has no filtering or pagination to constrain the result set.
- **[leads · PERFORMANCE] Unbounded findMany with take: 500 in lead listing**
  - `src/actions/lead.actions.ts:114`
  - The getLeads function does not cap results at the limit parameter. Line 114 calls prisma.lead.findMany with take: limit but the default limit in the function signature (line 81) is 50. However, the calling page.tsx passes limit: 500 (line 22). With potentially 1000s of rows and nested contact+assignedTo relations, this could cause memory bloat or slow response times, especially with facet filterin
- **[leads · VALIDATION] No validation of WON status guard in updateLeadStatus for LOST→WON transitions**
  - `src/actions/lead.actions.ts:828`
  - The guard 'if (status === "WON" && !existing.assignedToId)' prevents marking a NEW/CONTACTED lead as WON without an owner. However, a lead that is already LOST (isLostStage=true) can theoretically be re-opened and moved directly to WON on the same call, bypassing the guard if the assignment happens in a different request. The syncPipelineDealForLead re-opens deals from lost state (line 752) but do
- **[leads · ERROR_HANDLING] Bulk assign and status change logs activity but does not validate assignee exists**
  - `src/actions/bulk.actions.ts:195`
  - bulkAssignLeads updates leads to assignedToId without verifying the user exists or is in an assignable role (like the single-action does via assigneeInvalid() in lead.actions.ts:47). A tampered assignedToId could reference a deleted user, a non-sales role (e.g. OPERATIONS), or a disabled account, creating orphaned assignments.
- **[loyalty · DATA_CORRECTNESS] Tier recalculation inconsistent on negative adjustments**
  - `src/actions/loyalty.actions.ts:525`
  - In adjustPoints(), when points is negative (subtracting), totalEarned is NOT decremented. This creates semantic inconsistency: if a user earned 100 points and you subtract 50, points becomes 50 but totalEarned remains 100. This contradicts the behavior of earnPoints() which increases totalEarned, and makes the 'lifetime earned' metric unreliable for reporting and tier calculations.
- **[loyalty · PERFORMANCE] getLoyaltyAccounts() has no pagination or limit**
  - `src/actions/loyalty.actions.ts:61`
  - The findMany() call loads all loyalty accounts into memory without take/skip parameters. With thousands of accounts, this will cause memory issues and slow page loads. The list page renders all results without pagination UI.
- **[marketing · RBAC] Incorrect permission check for canManage button visibility**
  - `src/app/(dashboard)/marketing/page.tsx:51`
  - The canManage variable at lines 51-54 checks for 'marketing:read' permission instead of 'marketing:manage'. This causes the 'Campaigns & spend' button to be shown to users with read-only access. While the campaigns page itself is properly gated at marketing:read, the button should only appear for users with 'marketing:manage' permission who can actually create/edit campaigns.
- **[menu · VALIDATION] Missing validation of menuItemId existence in saveBookingMenu selections**
  - `src/actions/menu.actions.ts:376`
  - In saveBookingMenu, when creating booking menu selections (lines 376-381 and 401-406), the code does not validate that the referenced menuItemIds actually exist in the database before attempting to create selections. The code directly creates selections with client-supplied menuItemIds. While Prisma will enforce FK constraints at the database level, explicitly validating item existence before use 
- **[my-work · DATA_CORRECTNESS] Timezone mismatch in overdue/dueToday date comparisons**
  - `src/actions/workqueue.actions.ts:31`
  - The code constructs 'todayEnd' using local timezone date parts (now.getFullYear(), now.getMonth(), now.getDate()) while 'now' and 't.dueDate' are UTC timestamps. For users in non-UTC timezones, tasks due at local midnight will be incorrectly categorized as overdue. Example: a task due at midnight IST (2026-06-27T00:00:00 local) = 2026-06-26T18:30:00 UTC, which will incorrectly fail the 't.dueDate 
- **[notifications · DEAD_WIRING] createNotification server action is exported but never called**
  - `src/actions/notification.actions.ts:128`
  - The createNotification() function (lines 128-166) is exported as a public server action but is never invoked anywhere in the codebase. All notification creation uses the internal notify()/notifyAwait() functions from lib/notify.ts instead. This exported function is reachable via RPC from the client and creates a dead-wiring point.
- **[notifications · VALIDATION] No input validation on notification text fields before rendering**
  - `src/app/(dashboard)/notifications/_components/notification-list.tsx:322`
  - The notification.title and notification.message are rendered directly (lines 322-326) without sanitization. While not using dangerouslySetInnerHTML, if an attacker could inject notification records with malicious content (via the createNotification RPC or internal notify call), XSS is possible through attributes like title tooltips or message parsing by third-party components.
- **[owners · DEAD_WIRING] moveHallOwnerStage() action is defined but never called**
  - `src/actions/hall-owner.actions.ts:164`
  - The moveHallOwnerStage(id, status) function exists but has zero references in the UI codebase. It's not called from the workspace, board view, or any other component. The function appears to be dead code left from earlier design or a planned feature that was never wired.
- **[owners · DEAD_WIRING] deleteHallOwner() action is defined but never called**
  - `src/actions/hall-owner.actions.ts:193`
  - The deleteHallOwner(id) function exists but has zero references in the UI codebase. There is no delete button or confirmation dialog visible in any owners page or component. The function is unreachable.
- **[packages · VALIDATION] Missing pagination bounds in getPackages**
  - `src/actions/package.actions.ts:35`
  - The getPackages function accepts pagination parameters without validation bounds. Users can specify arbitrarily large page/limit values, potentially causing database performance issues or memory exhaustion. The limit parameter has no upper bound (unlike vendor catalog which caps at 100).
- **[packages · VALIDATION] Unbounded items array in package schema**
  - `src/schemas/package.schema.ts:73`
  - The packageSchema allows an unbounded array of items (items: z.array(packageItemSchema).default([])). A user could create packages with thousands of items, causing performance degradation and UI rendering issues. The form UI will become unusable with very large arrays.
- **[payouts · DATA_CORRECTNESS] Empty string handling in schema allows falsy values to slip through**
  - `src/schemas/payout.schema.ts:36`
  - The schema uses z.string().optional().or(z.literal("")) for vendorId and bookingId, which accepts empty strings as valid. In payout-form.tsx (line 86), the form initializes these with empty strings as defaults. When a user leaves the optional field blank, an empty string is sent, passes validation, and then the action converts it to null via payoutData.vendorId || null (line 167 of actions). This 
- **[payouts · VALIDATION] No idempotency key or deduplication for createPayout beyond duplicate-payment warning**
  - `src/actions/payout.actions.ts:189`
  - The createPayout action generates a warning via findDuplicatePayouts (line 194-206) if a near-identical payout exists, but this is non-blocking. The action proceeds to create the payout even if a duplicate is detected. There is no transaction-level guard preventing the same payout from being created twice if the request is retried or duplicated. The duplicate warning is returned but not enforced, 
- **[payouts · ERROR_HANDLING] Silent failure of GL posting in markPayoutPaid**
  - `src/actions/payout.actions.ts:343`
  - When markPayoutPaid is called, it invokes postPayoutPaid() at line 343 without awaiting or checking the result. The .catch() swallows errors and only logs them. If the GL posting fails (e.g., Finance is not set up, accounts are missing), the payout is still marked as PAID in the database, but no GL entry is created. This creates an accounting gap: the payout status=PAID but no journal entry exists
- **[payouts · RBAC] generateVenueOwnerPayout action not referenced in UI or routes**
  - `src/actions/payout.actions.ts:477`
  - The generateVenueOwnerPayout function is exported and fully implemented with permission checks (payouts:create), but is not called from any visible UI. A grep search of the payouts module components and pages does not reveal any invocation. This function may be dead code, or it may be intended for a future booking-detail screen that hasn't been wired yet. If not used, it's a maintenance liability.
- **[people · PERFORMANCE] Unbounded query fetches all employee codes without limit**
  - `src/actions/hr-employee.actions.ts:305`
  - In createEmployee, line 305 loads ALL employee records without any limit or pagination just to extract their empCode values: `const existingCodes = await prisma.employee.findMany({ select: { empCode: true } })`. For an organization with thousands of employees, this loads potentially megabytes of data into memory just to compute the next code. This is especially problematic because the function is 
- **[people · VALIDATION] updateEmployee allows invalid FK references without pre-validation**
  - `src/actions/hr-employee.actions.ts:388`
  - When updating an employee's legalEntityId, businessVerticalId, departmentId, or designationId, the function directly constructs FK connections without validating that the target record exists. Line 288-291 shows the pattern used in createEmployee (validate FK before use), but updateEmployee skips this. The reportingManagerId is validated (line 361-363), but other FKs are not, creating an inconsist
- **[performance · DATA_CORRECTNESS] Inconsistent date filtering in getTeamPerformance conversion rate calculation**
  - `src/actions/performance.actions.ts:109`
  - The conversion rate calculation uses inconsistent date filters: wonLeads (line 101) filter by updatedAt (when lead became WON), while leadTotals for conversion denominator (line 113) filter by createdAt (when lead was assigned). This creates a mismatch—when date ranges are applied, conversion rates compare leads from different time periods, producing incorrect metrics.
- **[performance · DATA_CORRECTNESS] Inconsistent date filtering in getIndividualMetrics conversion rate calculation**
  - `src/actions/performance.actions.ts:482`
  - Same issue as above: leadsAssigned uses createdAt filter (line 485) while leadsConverted uses updatedAt filter (line 493). The conversion rate derived from these mismatched datasets will be incorrect when date ranges are specified.
- **[pricing · DEAD_WIRING] Missing delete operation for rate plans**
  - `src/actions/pricing.actions.ts`
  - There is no deleteRatePlan action exported in pricing.actions.ts, although there is a deletePricingRule action. The rate-plans-table UI only shows Edit in the dropdown menu (line 145-150 in rate-plans-table.tsx), with no Delete option. This creates inconsistency: pricing rules can be deleted, but rate plans cannot. If a rate plan needs to be removed, there is no UI or server action path to do so.
- **[procurement · DATA_CORRECTNESS] Reject PR incorrectly populates approvedAt timestamp**
  - `src/actions/procurement.actions.ts:449`
  - The rejectPR function sets approvedAt: new Date() when rejecting a PR. The schema has no rejectedAt field, only approvedAt. This creates semantic ambiguity - a rejected PR will have an approvedAt timestamp, making the approval history confusing.
- **[procurement · DEAD_WIRING] Item CRUD functions exported but never used**
  - `src/actions/procurement.actions.ts:321`
  - addPurchaseRequisitionItem (line 321), updatePurchaseRequisitionItem (line 350), and deletePurchaseRequisitionItem (line 384) are exported server actions but are never invoked by any UI component. The procurement-detail and procurement-list components do not call these functions.
- **[projects · SECURITY] Missing existence check on updateProjectMaster before mutation**
  - `src/actions/projects.actions.ts:247`
  - updateProjectMaster (line 228) performs an update on an AcqOnboardingProject without first checking if the project exists. If the ID doesn't exist, the update silently succeeds (updateMany returns 0 affected rows but doesn't error). While the RBAC is enforced, a non-existent project ID will silently fail without user feedback, or if the ID format is valid but doesn't exist, the update proceeds wit
- **[projects · SECURITY] Missing existence check on assignProjectManager before mutation**
  - `src/actions/projects.actions.ts:334`
  - assignProjectManager (line 331) updates a project without verifying it exists first. An attacker can send arbitrary project IDs and the update will silently succeed even if the project doesn't exist, creating confusing audit trails and potentially triggering notifications for non-existent projects.
- **[projects · VALIDATION] Photo URL byte check logic error in snag photos**
  - `src/actions/snags.actions.ts:163`
  - The check `photo.url.length > MAX_PHOTO_BYTES` (line 163) validates the string length of the URL against MAX_PHOTO_BYTES (7,000,000), not the actual image file size. A URL can be very short while the file it points to is huge. This doesn't prevent uploading massive images if they're referenced via HTTPS links.
- **[quality · DATA_CORRECTNESS] Trend sigma calculations use current timestamp for historical data**
  - `src/actions/quality.actions.ts:257`
  - The getQualityScorecard function uses the same 'now' value (current time) when computing defect counts for both the current month and previous month. For metrics like 'lead-sla' that check 'firstContactDue < now', this means items that were overdue in the previous month but are no longer overdue today will not be counted as defects in the historical trend. This causes inaccurate trendSigma values 
- **[quotations · SECURITY] HTML injection in email body via unescaped user data**
  - `src/actions/sales-quotation.actions.ts:493`
  - The sendSalesQuotation() function constructs an HTML email body by directly interpolating user-controlled fields without HTML escaping. Specifically, row.clientName and row.contact?.firstName are embedded in the template string via template literals. An attacker with access to create/edit quotations could inject malicious HTML/JavaScript by setting the client name to something like '<img src=x one
- **[recruitment · VALIDATION] scheduleInterview creates interview without validating candidate exists**
  - `src/actions/recruit-candidate.actions.ts:161`
  - The scheduleInterview action accepts candidateId without verifying the candidate exists. It only validates the date and mode. If a non-existent candidateId is passed, Prisma will create the interview record with a dangling FK reference due to no onDelete constraint being enforced.
- **[recruitment · VALIDATION] createOffer creates offer without validating candidate exists**
  - `src/actions/recruit-candidate.actions.ts:241`
  - The createOffer action does not validate that the candidateId exists before attempting to create the offer record. If a bogus candidateId is provided, the create will fail with a generic 'Could not create offer' error, which masks the real issue and provides poor UX.
- **[recruitment · VALIDATION] updateCandidateNotes does not verify candidate exists before updating**
  - `src/actions/recruit-candidate.actions.ts:297`
  - The updateCandidateNotes action calls prisma.recCandidate.update() with a where clause but does not check if the candidate exists first. The swallowed catch block (line 303-305) will silently fail with 'Could not save notes' if the ID is invalid. This provides no user feedback about the actual issue.
- **[recruitment · VALIDATION] createApplication does not validate candidate/job existence before linking**
  - `src/actions/recruit.actions.ts:244`
  - The createApplication action accepts candidateId and jobOpeningId but does not verify either exists. If invalid IDs are provided, the create fails and the generic catch block returns 'That candidate is already on this opening', which is misleading when the real issue is a missing candidate or job.
- **[recruitment · VALIDATION] CTC field in createOffer accepts any finite number, including very large values**
  - `src/actions/recruit-candidate.actions.ts:230`
  - The CTC validation only checks isFinite(ctc) && ctc > 0, with no upper bound. A user could enter an extremely large number (e.g., 999999999999) or negative zero after type coercion. The Decimal(18,2) schema column can store up to 16 digits before decimal, but no application-level ceiling is enforced.
- **[referrals · VALIDATION] processReferralRewards async function re-validates auth inside called action**
  - `src/actions/referral-engine.actions.ts:252`
  - The internal helper function processReferralRewards(referralId: string) at line 252 calls auth() and checks permissions (line 254-259) even though it's only called from trackReferralConversion which already validated the same permission. This is inefficient and creates a silent failure path if permission changes mid-transaction. The function returns an error object instead of throwing, which could
- **[referrals · DATA_CORRECTNESS] ReferralTable expects 'source' field not returned by getReferrals**
  - `src/app/(dashboard)/referrals/_components/referral-table.tsx:44`
  - The ReferralRow type includes source: string (line 44), and the table renders it in the Source column (lines 107-117). However, getReferrals() in /src/actions/referral.actions.ts does not include the source field in its select statement (lines 47-67). The Referral model has source as a ReferralSource enum field, but it's never fetched from the database, so the table will render 'undefined' for all
- **[referrals · ERROR_HANDLING] getReferralRewardPage silently fails on Prisma errors**
  - `src/app/(dashboard)/referrals/rewards/page.tsx:50`
  - The getRewards() function (lines 50-73) wraps the Prisma query in a try-catch that returns an empty array on any error (line 72). No user feedback is provided about the failure, and the error is not logged. The page displays an empty rewards list, making it indistinguishable from a genuine empty state.
- **[rentals · DATA_CORRECTNESS] Two conflicting inventory calculation methods can diverge**
  - `src/actions/rental.actions.ts:518`
  - rentItem() uses availableQty counter (decremented at line 423), but getAvailability() calculates availability by summing overlapping bookings (line 566: `const availableQty = item.quantity - bookedQty`). These can diverge if a RentalBooking is deleted without decrementing availableQty, or if quantity is edited. The form also allows users to directly edit availableQty when updating an item, which c
- **[rentals · DATA_CORRECTNESS] updateRentalItem() allows total quantity to drop below active rentals**
  - `src/actions/rental.actions.ts:202`
  - The update action only validates that availableQty <= quantity (line 230), but does not check whether the new quantity is less than the number of currently active (RESERVED/RENTED) rentals. A user can reduce quantity to 5 when there are 8 active rentals, creating an invalid state where sum of active quantities exceeds total.
- **[reports · DATA_CORRECTNESS] Revenue report KPI: averageBookingValue divides unmatched datasets**
  - `src/actions/report.actions.ts:369`
  - getRevenueReport calculates totalRevenue from COMPLETED payments in the date range (line 286-305), but calculates totalBookings from ALL bookings created in the range (line 308-317). Then averageBookingValue = totalRevenue / totalBookings (line 371). This metric is misleading: (1) bookings created before the range but paid during it are excluded, (2) the average divides completed payments by all b
- **[resources · DEAD_WIRING] allocateResource action never invoked by UI**
  - `src/actions/resource.actions.ts:304`
  - The allocateResource() function is fully implemented and exported but is never called by any UI component. The resource-detail.tsx only imports and uses deallocateResource(). This suggests either incomplete feature implementation or abandoned code.
- **[resources · DEAD_WIRING] checkConflicts and getResourceCalendar actions never invoked**
  - `src/actions/resource.actions.ts:450`
  - checkConflicts() and getResourceCalendar() are exported and used only for allocateResource() workflow, but since allocateResource is not wired to UI, these helper functions are also unreachable.
- **[resources · VALIDATION] No time format or logical ordering validation for allocations**
  - `src/schemas/resource.schema.ts:50`
  - The allocationSchema accepts startTime and endTime as plain strings with only min-length validation. There is no validation that: (1) times are in valid format (HH:mm), (2) startTime < endTime, or (3) the allocation doesn't overlap with existing ones (unique constraint only checks exact startTime match, not time ranges).
- **[resources · PERFORMANCE] No upper limit enforced on pagination limit parameter**
  - `src/actions/resource.actions.ts:36`
  - The getResources() function accepts user-supplied limit parameter without capping its maximum value. A client could request limit=999999 or higher, causing unbounded database queries and potential DoS.
- **[reviews · RBAC] getAverageRating missing permission check**
  - `src/actions/review.actions.ts:329`
  - The getAverageRating function checks authentication (session exists) but does not verify the user's authorization via hasPermission(role, 'reviews:read'). While the calling page is protected by the (dashboard) layout, the action itself should include explicit permission checks for consistency and defense-in-depth, as all other review actions (getReviews, approveReview, respondToReview) explicitly 
- **[settings · RBAC] Activity Log action lacks explicit permission check in server action layer**
  - `src/actions/activity.actions.ts:30`
  - The `getActivityLogs()` function only verifies that the user is authenticated (`session?.user` exists) but does NOT check for any specific permission (no `hasPermission()` call). While the middleware enforces `/settings` requires `settings:read` permission, the server action itself should also validate permissions for defense-in-depth, especially since activity logs contain sensitive organizationa
- **[staff · DATA_CORRECTNESS] Floating-point precision loss in payroll calculations**
  - `src/actions/staff.actions.ts:532`
  - Payroll calculations convert Decimal (12,2) database fields to JavaScript numbers, perform arithmetic, then store back. JavaScript numbers lose precision with large amounts. Example: hourlyRate * totalHours * 1.5 for overtime can accumulate rounding errors. The schema defines Decimal(12,2) precision but JS arithmetic undermines this.
- **[staff · VALIDATION] Time input format not validated; wraparound shifts not normalized**
  - `src/schemas/staff.schema.ts:70`
  - startTime and endTime are validated as strings with max length 10, but no regex or time format validation. The client-side UI enforces HH:MM format via <input type='time'>, but server accepts any string <= 10 chars. Additionally, the shift hours calculation in staff-schedule.tsx assumes times are in 24-hour format but never validates that startTime <= endTime (except via client logic).
- **[staff · VALIDATION] Unvalidated foreign key reference (bookingId)**
  - `src/actions/staff.actions.ts:279`
  - The createShift and updateShift functions accept bookingId from the client but do not verify that (1) the booking exists, (2) the booking belongs to a valid event/context, or (3) the shift date falls within the booking's event dates. This could allow linking shifts to deleted, invalid, or cross-organizational bookings.
- **[staff · DATA_CORRECTNESS] Missing validation that staff profile exists before shift assignment**
  - `src/actions/staff.actions.ts:272`
  - createShift accepts staffId but never verifies a StaffProfile with that ID exists. Prisma foreign key constraint will catch this at DB level (assuming FK exists), but returns a cryptic error to the user instead of a friendly 'staff member not found' message. If the FK constraint is missing, orphaned shifts are possible.
- **[staff · SECURITY] Sensitive bank details and emergency contact stored unencrypted as JSON**
  - `prisma/schema.prisma`
  - Bank account numbers, IFSC codes, and emergency contact phone numbers are stored as unencrypted JSON fields in the database. These are PII/sensitive financial data subject to data protection regulations. Any database breach or unauthorized query exposure reveals this information.
- **[staff · ERROR_HANDLING] Generic error message swallows actual validation failures**
  - `src/actions/staff.actions.ts:300`
  - The catch block in createShift logs '[CREATE_SHIFT_ERROR]' but returns only 'Failed to create shift' to the user. Database constraint violations (e.g., duplicate shift, invalid staffId, corrupted booking reference) are lumped into this generic message, making debugging hard and hiding real issues.
- **[support · VALIDATION] createTicket accepts contactId without validating it exists**
  - `src/actions/support.actions.ts:268`
  - The createTicket function accepts a contactId parameter (line 273) and directly assigns it to the ticket (line 308) without validating that the contact exists in the database. The Prisma schema for SupportTicket does not define a foreign key relationship for contactId. This allows orphaned references to be created.
- **[support · VALIDATION] createTicket accepts bookingId without validation**
  - `src/actions/support.actions.ts:268`
  - Similar to contactId, the bookingId parameter (line 274) is accepted without validating the booking exists. The Prisma schema lacks a foreign key constraint for bookingId on SupportTicket, allowing invalid references.
- **[support · PERFORMANCE] getTickets fetches all tickets without pagination**
  - `src/actions/support.actions.ts:116`
  - The getTickets function (line 116-163) calls findMany without any limit or pagination (no take/skip clauses). In a system with thousands of tickets, this will fetch and serialize all records into memory. The list is then sorted by updatedAt in descending order on the database side, but there's no upper bound.
- **[surveys · DEAD_WIRING] Question Mutation Functions Never Invoked**
  - `src/actions/survey.actions.ts:278`
  - Three server actions exist but are never called from the UI: addQuestion (line 278), updateQuestion (line 343), and deleteQuestion (line 404). The survey-form component manages questions purely client-side and uses createSurvey/updateSurvey which atomically recreate all questions. These orphaned actions should be removed to reduce dead code.
- **[surveys · PERFORMANCE] getSurveyResults Loads All Responses Without Pagination**
  - `src/actions/survey.actions.ts:526`
  - getSurveyResults fetches all responses, answers, and questions into memory without pagination or limits. With high-volume surveys, this can cause memory exhaustion and slow page loads. The include query joins all responses with nested answers and question objects unconditionally.
- **[surveys · DATA_CORRECTNESS] Survey Update Does Not Preserve Question Deletions Idempotently**
  - `src/actions/survey.actions.ts:198`
  - When updating a survey, the code deletes all existing questions with deleteMany then recreates them. If two clients submit conflicting updates simultaneously, the second update may delete questions from a concurrent third request. There is no optimistic concurrency check (e.g., version field) or transaction boundary to ensure idempotent updates.
- **[tasks · UX] Duplicate 'Edit' menu items in task list dropdown**
  - `src/app/(dashboard)/tasks/_components/task-list.tsx:223`
  - The dropdown menu has two separate menu items that both call onNavigate(task.id), resulting in 'View' and 'Edit' doing the same thing (navigate to /tasks/{id}). The 'Edit' item should navigate to /tasks/{id}/edit instead to match the actual edit page route, or one should be removed entirely.
- **[vendors · DATA_CORRECTNESS] Unbounded booking list on vendor detail page lacks tenant filtering**
  - `src/app/(dashboard)/vendors/[vendorId]/page.tsx:35`
  - The vendor detail page fetches available bookings for the assignment dialog without filtering by venue, org, or user context. The query `prisma.booking.findMany({ where: { status: { notIn: ["CANCELLED", "COMPLETED"] } } })` retrieves all non-cancelled/completed bookings across the system (capped at 100), then serves them to assign to a vendor. This may leak booking data to users who should not see
- **[whatsapp · VALIDATION] bulkSendWhatsApp lacks idempotency protection and partial failure logging**
  - `src/actions/whatsapp.actions.ts:360`
  - The bulkSendWhatsApp action sends messages to each contact in a loop (lines 392–449) without any idempotency key or deduplication. If the action is called twice with the same contactIds and templateName (e.g., due to a network retry or user clicking send twice), all contacts will receive duplicate messages. Additionally, the function reports success even if some/all sends fail—logActivity reports 
- **[whatsapp · ERROR_HANDLING] Silent error handling in message polling loop may hide persistent sync failures**
  - `src/app/(dashboard)/whatsapp/_components/inbox-chat-view.tsx:127`
  - The loadMessages function is polled every 10 seconds (line 127–130) but errors are silently swallowed: setLoading(false) is called in the finally block (line 103) regardless of success/failure. If getConversation consistently fails (e.g., due to a 403 or database error), the UI shows 'No messages' as if the conversation is empty, hiding the actual error. The user has no way to know the sync is bro
- **[whatsapp · UX] Missing empty state and loading feedback in message history**
  - `src/app/(dashboard)/whatsapp/_components/inbox-chat-view.tsx:214`
  - When messages are loading (line 214–216), the spinner is centered in the ScrollArea, which is visually unclear if there are no messages at all. The 'No messages yet' text (line 219) appears only after loading completes, so a user waiting for messages to load cannot distinguish between 'still loading' and 'no messages'. Additionally, if there are messages but the user scrolls to the bottom, there's

### LOW

- **[_auth · VALIDATION] payment.actions.ts: createRazorpayOrder trusts caller-supplied invoiceId without ownership check**
  - `src/actions/payment.actions.ts:457`
  - createRazorpayOrder (line 457) loads the invoice by ID but doesn't verify the user can access it (owns the booking, is the sales rep, etc.). A finance user with 'payments:create' can create payment orders for any invoice by guessing IDs.
- **[_money · DATA_CORRECTNESS] Missing round() on balanceDue update; negative balanceDue clamped post-hoc instead of prevented**
  - `src/actions/payment.actions.ts:244`
  - balanceDue is set to Math.max(0, bal) after computing bal from floating-point subtraction. While the clamp prevents negative rows, it doesn't round the value before storing it in the Decimal field. If bal = -0.000001 (a float precision artifact), Math.max(0, bal) produces 0, but if bal = 0.000001, it stores 0.000001 (one micropaisa) to the database, creating micro-balances that linger and confuse 
- **[campaigns · UX] Missing validation feedback for past scheduled datetime**
  - `src/app/(dashboard)/campaigns/[campaignId]/_components/campaign-actions.tsx:84`
  - The schedule dialog accepts any datetime via an HTML datetime-local input with no client-side validation. A user can select a past date/time and submit it; the server will parse it without rejecting past dates, allowing a campaign to be scheduled for a time that has already passed.
- **[commissions · UX] No unique constraint on (bookingId, ruleId) pair**
  - `prisma/schema.prisma:1992`
  - CommissionEntry lacks @@unique([bookingId, ruleId]). The code relies on Serializable transaction + findFirst check to prevent duplicates (comment at line 343-345 in actions), which works but is fragile. A concurrent race can still fail the serialization, and retries are not automatic. A unique constraint would be the database's enforced guarantee.
- **[contracts · UX] No empty state on contracts list when zero contracts exist**
  - `src/app/(dashboard)/contracts/page.tsx:80`
  - When no contracts exist, ContractsTable is called with empty data array. DataTable likely renders an empty table with 'No results' message, but a more helpful empty state (e.g., 'No contracts yet. Create your first contract.') would improve UX.
- **[contracts · PERFORMANCE] Contract detail pages fetch all contact, booking, template data on every view**
  - `src/actions/contract.actions.ts:144`
  - getContract includes full contact, booking, and template objects. For large datasets, this could be optimized to fetch only needed fields. Not critical for typical use but could add latency if many contracts are viewed in sequence.
- **[crm · UX] Inconsistent permission naming for cadences: uses 'settings:read' instead of 'cadences:read'**
  - `src/actions/cadence.actions.ts:139`
  - All cadence mutations use hasPermission(role, 'settings:read'), which is semantically misleading. The permission name suggests 'settings' management rather than 'cadences'. If the permission is also used for other settings, this is acceptable; otherwise, it should be 'cadences:write' or 'cadences:manage'.
- **[dashboard · UX] Empty states for upcoming events and overdue items could be more actionable**
  - `src/app/(dashboard)/dashboard/_components/upcoming-events.tsx:95`
  - The empty state for upcoming events shows 'Tap B to create a new booking' but pressing 'B' is only active in certain contexts (nav sidebar). If the user is on the dashboard, the shortcut may not trigger. The empty state is static and assumes the user wants to create a booking.
- **[dashboard · PERFORMANCE] getDashboardStats() loads 16 parallel queries; some could be combined or cached**
  - `src/actions/dashboard.actions.ts:146`
  - The Promise.all() fires 16 parallel queries (payments, bookings, leads, invoices, tasks, activity logs). If the database is under load or queries are unindexed, this could timeout. For example, Task.count() and Task.findMany() are separate calls; they could be combined into a single findMany with takecount.
- **[insurance · ERROR_HANDLING] Generic error message on DB constraint violation**
  - `src/actions/insurance.actions.ts:197`
  - If a constraint violation occurs (e.g., duplicate policyNumber uniqueness, or invalid bookingId/venueId FK), the catch block logs '[CREATE_INSURANCE_POLICY_ERROR]' and returns generic 'Failed to create insurance policy' without hint to user about what went wrong.
- **[loyalty · DEAD_WIRING] Unused getTransactions() server action**
  - `src/actions/loyalty.actions.ts:587`
  - The getTransactions() function is exported and includes permission checks, but is never called from any UI component. The detail page fetches transactions via getLoyaltyAccountById with an include clause instead.
- **[marketing · ERROR_HANDLING] Missing error feedback when attribution data fetch fails**
  - `src/app/(dashboard)/marketing/_components/marketing-dashboard.tsx:68`
  - In the applyRange() function (lines 61-71), when getChannelAttribution() or getCampaignAttribution() fail (success is false), the error is silently ignored with no user feedback. The same issue occurs in resetRange() at lines 81-82. Users receive no indication that their date range filter failed to apply.
- **[marketing · PERFORMANCE] Unbounded findMany queries in marketing campaign and attribution actions**
  - `src/actions/marketing-campaign.actions.ts:52`
  - The getMarketingCampaigns() function at line 52 uses findMany() without pagination, limit, or take parameters. Similarly, loadAttributions() in attribution-analytics.actions.ts at line 58 fetches all lead attributions for the entire date range without limit. At scale with thousands of attributions, this could cause memory exhaustion and slow queries.
- **[marketing · UX] Number input value handling in campaign form**
  - `src/app/(dashboard)/marketing/campaigns/_components/marketing-campaign-form.tsx:248`
  - The spendToDate input at line 248 uses onChange={(e) => field.onChange(e.target.value)}, passing a string value instead of parsing to number. While the schema coerces it with z.coerce.number(), this is implicit conversion rather than explicit. The form works correctly but the pattern is less clear about the data type being managed.
- **[my-work · ERROR_HANDLING] Unhandled exceptions in getMyWorkqueue could crash the page**
  - `src/actions/workqueue.actions.ts:34`
  - The Promise.all() at line 34-45 can throw if database queries fail (network timeout, constraint violation, etc.). The page.tsx only checks if 'data' is null, not if an exception occurred. A database error would crash the entire page instead of showing a graceful error message.
- **[my-work · UX] TaskRow lacks keyboard accessibility**
  - `src/app/(dashboard)/my-work/_components/workqueue.tsx:96`
  - The TaskRow component has an onClick handler to navigate to task details, but no onKeyDown handler. Users cannot navigate using keyboard (Enter/Space), making the row inaccessible to keyboard-only users.
- **[notifications · UX] No user feedback on server action errors**
  - `src/app/(dashboard)/notifications/_components/notification-list.tsx:188`
  - When markAsRead(), markAllAsRead(), or deleteNotification() fail (throw an error), the user receives no visual feedback. The isPending state only indicates the request is in flight, not success or failure. This leaves the user uncertain about whether their action succeeded.
- **[packages · VALIDATION] Misleading min validation message for basePrice**
  - `src/schemas/package.schema.ts:63`
  - The basePrice validation uses min(0) but the error message says 'Base price must be positive'. Zero is technically non-positive and the message is misleading. Either allow 0 explicitly or use min(0.01) with a corrected message.
- **[payouts · UX] Duplicate payment warning not actionable**
  - `src/app/(dashboard)/payouts/_components/payout-form.tsx:92`
  - In payout-form.tsx, the createPayout action is called and may return a duplicateWarning (from line 209 of actions), but the form does not display this warning to the user. The result.duplicateWarning is never shown in a toast, alert, or inline message. A user who creates a payout and receives a duplicate warning has no way to know that a warning was generated, defeating the purpose of the duplicat
- **[recruitment · ERROR_HANDLING] Generic catch blocks swallow specific validation errors**
  - `src/actions/recruit-candidate.actions.ts:254`
  - Multiple actions (createOffer, updateCandidateNotes, scheduleInterview, setInterviewOutcome, setOfferStatus) use bare catch blocks that return generic error messages. This masks constraint violations, FK errors, or other database issues, making debugging harder and user messaging less helpful.
- **[rentals · VALIDATION] No minimum validation on availableQty during edit**
  - `src/app/(dashboard)/rentals/_components/rental-item-form.tsx:275`
  - The form allows setting availableQty to any value <= quantity (HTML min=0), but on edit the user can manually set it to a value that doesn't match the current state. If an item was created with 10 available, then 3 rented, editing allows resetting availableQty to 10 again, which would recount inventory incorrectly.
- **[staff · UX] No confirmation or warning before editing staff profile with sensitive fields**
  - `src/app/(dashboard)/staff/_components/staff-profile-card.tsx:79`
  - The EditProfileDialog allows modification of bank details, hourly/monthly rates, and emergency contact with no explicit confirmation, audit trail display, or user notification. A manager could accidentally or maliciously change a staff member's hourly rate and immediately affect payroll calculations.
- **[staff · PERFORMANCE] N+1 query pattern in generatePayroll (shifts fetch per staff)**
  - `src/actions/staff.actions.ts:509`
  - The generatePayroll loop iterates over staffProfiles and issues a separate findMany() for each staff's shifts (line 509). For 100 staff, this is 100+ queries. With a large database, this could be slow.
- **[support · VALIDATION] createTicket does not validate contactId matches available contacts**
  - `src/app/(dashboard)/support/_components/support-list.tsx:248`
  - The NewTicketDialog in support-list.tsx fetches available contacts via getTicketFormOptions (line 234) which limits results to 500. However, a malicious client could submit a contactId outside this set via the createTicket action (line 248). There's no server-side validation that the contactId is from the allowed set.
- **[surveys · VALIDATION] No Maximum Length Enforced on Survey Options Array**
  - `src/schemas/survey.schema.ts:15`
  - The surveyQuestionSchema allows an unbounded array of options for MULTIPLE_CHOICE questions. While individual option strings are limited to non-empty, there is no max() constraint on the array itself. A malicious user could submit 10,000 options per question.
- **[tasks · VALIDATION] Status mutation in updateTaskStatus lacks enum validation**
  - `src/actions/task.actions.ts:325`
  - Similar to moveTask, the updateTaskStatus function (line 311) accepts an unvalidated string status parameter and uses 'as' type casting (line 325) without runtime validation. While the UI restricts options, a direct API call could pass invalid values.
- **[tasks · UX] Task list shows 'Edit' for both View and Edit operations**
  - `src/app/(dashboard)/tasks/_components/task-list.tsx:227`
  - The menu has redundant 'View' and 'Edit' options both performing navigation. This creates UI confusion and bloat. The intended flow should be clear: View goes to detail page (/tasks/{id}), Edit goes to edit form (/tasks/{id}/edit).
- **[whatsapp · UX] Conversation list does not indicate unseen messages**
  - `src/app/(dashboard)/whatsapp/_components/conversation-list.tsx:64`
  - The conversation list shows all conversations sorted by most recent, but there is no badge or visual indicator for unread/unseen messages. Users must open each conversation to see if there are new inbound messages, and the list does not highlight conversations with new activity.

## Fixes applied — Wave 1 (Critical + High)

**src/actions/cadence.actions.ts**
- Finding 1 (RBAC): Added hasPermission(session.user.role, 'settings:read') guard to both getCadences() and getCadence(), matching the permission required by every other cadence operation in the file. Used the existing 'settings:read' constant since no 'cadences:read' permission exists in src/lib/perm
- Finding 2 (IDOR createStep): Before creating the step, fetch the parent cadence via prisma.cadence.findUnique({where:{id: cadenceId}}) and return 'Cadence not found' if it does not exist, so steps can no longer be created against arbitrary/non-existent cadence IDs.
- Finding 3 (IDOR updateStep): Added an existence check — prisma.cadenceStep.findUnique({where:{id}}) — before the update, returning 'Step not found' when absent, so updates against non-existent step IDs are rejected instead of throwing.
- Finding 4 (IDOR deleteStep): Added the same existence check before deletion (findUnique then 'Step not found'), so deletes against non-existent step IDs are rejected cleanly.
- Finding 5 (IDOR reorderSteps): Before reordering, fetch prisma.cadenceStep.findMany({where:{cadenceId, id:{in: orderedIds}}}) and reject when the returned count != orderedIds.length ('One or more steps do not belong to this cadence'). Also tightened the per-id writes from update({where:{id}}) to upd

**src/actions/contract.actions.ts**
- Finding 2 (force-sign / state-transition): hardened markContractSigned so the SENT/VIEWED -> SIGNED transition is an atomic prisma.contract.updateMany guarded by WHERE status IN ('SENT','VIEWED'), then re-reads via findUniqueOrThrow. This keeps the existing rule that a DRAFT/EXPIRED/already-SIGNED c
- Finding 2 (accountability): when a staff member manually marks a contract signed without signatureData (legitimate offline/paper-signing path used by the wired contract-detail.tsx button), the action now appends an audit stamp to notes recording WHO marked it and WHEN, so faked compliance is attribu
- TOCTOU hardening (ALWAYS-FIX race-condition rule) on updateContract: replaced the read-then-update with an atomic updateMany guarded by status:'DRAFT'; returns 'Only draft contracts can be edited' if count===0, preventing a concurrent send/sign from being silently overwritten.
- TOCTOU hardening on deleteContract: replaced prisma.contract.delete with an atomic deleteMany guarded by status:'DRAFT' (count check), so a contract sent/signed concurrently can no longer be destroyed.
- TOCTOU hardening on sendContract: made the DRAFT -> SENT transition an atomic updateMany guarded by status:'DRAFT' (count check) then re-read, preventing double-send / racing a concurrent edit or delete.

**src/actions/logistics.actions.ts**
- Finding #3 (markDispatched stock-decrement race / TOCTOU): replaced the read-then-write decrement loop with an atomic conditional updateMany per inventory item (WHERE availableQty >= qty, data: { availableQty: { decrement: qty } }) inside the existing $transaction, and assert the affected count is 1
- Finding #2 (recordReturn silently skips stock restore when inventory item deleted): the restore now re-reads availableQty/totalQuantity inside the txn against current state, and if the linked inventoryItem is gone (findUnique returns null) it sets a missingInventory flag, throws to roll back the tra
- Finding #4 (booking-link validation inconsistency + no status gate): added a shared DISPATCHABLE_BOOKING_STATUSES whitelist (CONFIRMED, IN_PROGRESS, COMPLETED) and enforce it in BOTH createDispatch and updateDispatch — the booking must exist AND be in a committed status before the link is accepted. 

**src/actions/approval.actions.ts**
- Finding 1 (IDOR in getApprovalRequest): Added an authorization gate after fetching the request. Authentication alone no longer grants access. The request is returned only if the viewer is the submitter, any approver in the chain (USER matched by id or ROLE matched by role), a user who was delegated 
- Finding 2 (step advancement with non-contiguous orders): currentStep stores a step's `order` (confirmed by existing chain.find((s) => s.order === request.currentStep) lookups), so the old `const nextStepIndex = expectedStep + 1` was wrong. Replaced with `const nextStep = chain.find((s) => s.order > 
- Finding 3 (isLastStep using array length): Replaced `const isLastStep = nextStepIndex >= chain.length` with `const isLastStep = nextStep === null`, i.e. last step iff no chain step has order > expectedStep. Also fixed the dependent next-approver notification which previously did `const nextStep = ch

**src/actions/seating.actions.ts**
- getChart (Finding 1): added the genuinely-missing role permission guard. Previously getChart only checked `if (!session?.user)` and let ANY authenticated user read seating charts with no permission check at all. Tightened the auth check to `session?.user?.id` and added `if (!hasPermission(session.us

**src/actions/forecast.actions.ts**
- Finding 3 (getBudgets, ~line 23): Added `if (!hasPermission(session.user.role as string, "budget:read")) return { success: false, error: "Insufficient permissions" }` after the auth check, matching the pattern used by createBudget/updateBudget/deleteBudget.
- Finding 1 (getForecastEntries, ~line 248): Added `if (!hasPermission(session.user.role as string, "forecast:read")) ...` after the auth check, mirroring getAIDemandForecast/getVenueDemandHeatmap.
- Finding 2 (getVenuesForBudget, ~line 475): Added `if (!hasPermission(session.user.role as string, "budget:read")) ...` after the auth check (budget-related read, used by the budget form).

**src/actions/insurance.actions.ts**
- Finding 1 (RBAC): Added hasPermission(session.user.role, "insurance:read") guard immediately after the auth() check in all four read actions — getInsurancePolicies, getInsurancePolicyById, getExpiringPolicies, and getInsuranceStats — returning {success:false, error:"Insufficient permissions"} on fai
- Finding 2 (VALIDATION): In createInsurancePolicy, added existence checks after date validation — when policyData.bookingId is non-empty, verify prisma.booking.findUnique exists (else "Linked booking not found"); when policyData.venueId is non-empty, verify prisma.venue.findUnique exists (else "Linke
- Finding 3 (VALIDATION): Added the same booking/venue existence validation in updateInsurancePolicy before the prisma.insurancePolicy.update call, preventing reassignment of a policy to a non-existent booking/venue via a guessed ID.

**src/actions/user.actions.ts**
- Finding 1 (CRITICAL privilege escalation in updateUser, ~line 168): role changes are now gated behind hasPermission(role, 'users:manage-roles') and the target role is validated against an allowlist before assignment. Returns 'Cannot modify user roles without manage-roles permission' for unprivileged
- Finding 2 (HIGH unvalidated role in createUser, ~line 121): added a runtime isAssignableRole() allowlist check (returns 'Invalid role' on failure) and gated role assignment behind users:manage-roles, replacing the compile-time-only `as` cast with a type-safe narrowed value.
- Added a shared ASSIGNABLE_ROLES allowlist (all internal roles from ROLE_PERMISSIONS, excluding the CLIENT/VENDOR portal identities) plus an isAssignableRole type guard, reused by both actions.

**src/actions/document.actions.ts**
- updateDocument (finding #2, IDOR): after fetching the existing document and confirming it exists, added an ownership guard before prisma.document.update. The update now proceeds only if existing.uploadedById === session.user.id OR the caller's role is SUPER_ADMIN/ADMIN; otherwise it returns {success
- deleteDocument (finding #1, IDOR): after fetching the existing document and confirming it exists, added the same ownership guard before prisma.document.delete. Delete proceeds only if existing.uploadedById === session.user.id OR role is SUPER_ADMIN/ADMIN; otherwise returns {success:false, error:'You

**src/actions/task.actions.ts**
- Finding 1 (CRITICAL/VALIDATION): Added a module-level whitelist constant TASK_STATUSES = ['TODO','IN_PROGRESS','IN_REVIEW','DONE'] plus an isValidTaskStatus() type-guard. moveTask now rejects any newStatus not in the whitelist with {success:false,error:'Invalid task status'} before the Prisma update
- Finding 1 (consistency): Applied the same runtime status validation to updateTaskStatus(), which had the identical blind-cast flaw (`status as 'TODO'|...`). It now validates against the whitelist and writes the narrowed value.
- Hardening on the same untrusted path: moveTask now validates newOrder with Number.isInteger(newOrder) && newOrder >= 0, rejecting negative/non-integer order values before the update.

**src/actions/menu.actions.ts**
- Finding 2 (RBAC): Added hasPermission(role, "menu:read") guard to getMenuItems and getMenuItem after the auth() check, so permission is enforced at the action level, not just the /menu route middleware.
- Finding 2 (RBAC): Added a guard to getBookingMenu requiring either "menu:read" or "bookings:read" (matching the suggested fix), since the data is a booking-scoped menu read.
- Finding 2 (RBAC): Added hasPermission(role, "menu:read") guard to calculateMenuTotal.
- Finding 1 (IDOR/saveBookingMenu): Hardened the write guard to require BOTH "menu:update" AND "bookings:update" (previously only "menu:update"). Editing a booking's menu is a mutation on the booking, so it now correctly requires the booking-write permission too. The existing booking-existence check (

**src/actions/project-procurement.actions.ts**
- createWorkPackage: added projectId presence check + existence validation (fetch acqOnboardingProject, return 'Project not found.' if missing) before creating the work package, so a manager can no longer write a work package against a non-existent/garbage projectId. Also added budgetAmount >= 0 bound
- createPurchaseOrder: added projectId presence check + existence validation before create; additionally validated that a linked workPackageId (when supplied) belongs to the SAME project, preventing cross-project work-package linkage on a PO.
- updateWorkPackage: added id presence check + existence check (findUnique, return 'Work package not found.' if missing) before update, replacing the bare update-by-id that would surface a raw Prisma P2025 throw; also added budgetAmount >= 0 bound. Status whitelist was already present and kept.
- updatePurchaseOrderStatus: added id presence check + existence check before update; status whitelist already present and kept.

**src/actions/bulk.actions.ts**
- Added the WON-owner accountability guard to bulkChangeLeadStatus, mirroring the single-lead updateLeadStatus guard (SCRM-004). Before the bulk update, when status === 'WON', it runs prisma.lead.count({ where: { id: { in: ids }, assignedToId: null } }); if any selected lead is unassigned it returns {
- Removed the blind `as any` cast on the status field in the updateMany data (data: { status } instead of { status: status as any }). The bulkChangeLeadStatusSchema already validates status as a strict z.enum of the 7 lead statuses, so the untrusted-input cast was unnecessary and masked type safety.

**src/actions/rental.actions.ts**
- [CRITICAL TOCTOU race] rentItem(): made the inventory decrement the authoritative, race-safe guard. Inside prisma.$transaction (now an interactive callback), replaced the unconditional rentalItem.update({ decrement }) with a conditional tx.rentalItem.updateMany({ where: { id, availableQty: { gte: qu
- Added a non-exported sentinel class `RentalUnavailableError extends Error` after the imports, and a try/catch around the transaction that converts it into the existing user-facing { success:false, error } shape while re-throwing any genuine errors to the outer handler.
- Kept the pre-transaction availableQty check as a fast, friendly early-return (relabeled in a comment as a non-authoritative pre-check) so the common non-contended case still returns the precise 'Only N units available' message; correctness now no longer depends on it.

**src/lib/lead-pipeline.ts**
- Replaced fire-and-forget notify() with awaited notifyAwait() in escalateLeadSlaBreaches(): all per-recipient SLA-breach notifications are now collected and awaited via Promise.allSettled before the lead's slaEscalatedAt is updated, so serverless cron freeze cannot drop the writes.
- Replaced fire-and-forget notify() with awaited notifyAwait() in escalateOverdueTasks(): the overdue-task notification is now awaited before the task's escalatedAt is updated.
- Updated the import from `notify` to `notifyAwait` (notifyAwait is exported from @/lib/notify and returns Promise<void>); notify was the only usage so no dangling import remains.

**src/lib/acq/sla-escalation.ts**
- Finding 1 (HIGH/ERROR_HANDLING): Replaced fire-and-forget notify() calls with notifyAwait() in escalateAcqLeadSlaBreaches(). Both the owner-nudge (formerly line ~33) and the per-head leadership escalation (formerly line ~44) now push their returned promises into a `pending: Promise<void>[]` array, a
- Updated the import from `notify` to `notifyAwait` (both take the same NotifyParams; notifyAwait returns Promise<void>). No other imports affected.
- Used Promise.allSettled (not Promise.all) so one failed notification write does not abort the remaining ones or prevent the subsequent slaEscalatedAt stamping; matches the resilient fan-out pattern in the rules.

**src/app/(dashboard)/analytics/page.tsx**
- [HIGH/RBAC] Fixed silent permission masking: page now computes canViewAdvanced = hasPermission(role, 'analytics:advanced') and only calls getTopClients(10)/getCashflow() when that permission is held (otherwise resolves to null). This implements suggested-fix option (2): the analytics:read-gated page
- Updated data extraction to use optional chaining (topClientsRes?.success / cashflowRes?.success) so the null placeholders for non-advanced users are handled safely and fall back to empty arrays, matching the dashboard's existing TopClientData/CashflowData array props.

**src/app/(dashboard)/approvals/_components/approval-detail-card.tsx**
- Fixed step-progress comparison in Approval Chain Progress (lines ~86-93): changed `index < request.currentStep` to `step.order < request.currentStep` and `index === request.currentStep` to `step.order === request.currentStep`, plus the isApproved branch `index <= request.currentStep` to `step.order 
- Changed the step badge number display from `{index + 1}` to `{step.order + 1}` so the displayed step number reflects the step order value, consistent with the Decisions Timeline which already uses `decision.stepOrder + 1`.
- Added a clarifying comment explaining why order value is used instead of array index.

**src/app/(dashboard)/approvals/_components/approval-queue.tsx**
- Finding 1 (DATA_CORRECTNESS): Fixed incorrect step numbering. Replaced 'Step {request.currentStep + 1} of {chainLength}' which wrongly treated currentStep as an array index. Now resolves the display position from the order-sorted approverChain via findIndex(s => s.order === request.currentStep) + 1,

**src/actions/availability.actions.ts**
- Finding 1 (HIGH/VALIDATION): Added month/year validation at the start of getAvailabilityMonth, immediately after the requireRead() auth gate and before any Date.UTC math. Rejects non-integers, month<1 or month>12, and out-of-range years (year<1970 or year>9999) with { success: false, error: 'Invalid

**src/actions/commission.actions.ts**
- DEAD_WIRING fixed: calculateCommission() is now invoked from a real UI control. Created src/app/(dashboard)/commissions/_components/commission-calc-dialog.tsx, a client 'Calculate Commission' dialog with rule/beneficiary/booking pickers that calls calculateCommission(); the action's own permission c
- Wired the dialog into the Entries tab of src/app/(dashboard)/commissions/page.tsx: page now also fetches getUsers({limit:200}) and getBookings({limit:200}) (each self-gated by users:read / bookings:read) and passes mapped rule/user/booking options into the new dialog.
- Client handler is wrapped in try/catch with a sonner toast on both action-error and thrown-error paths, and the submit button is disabled while the transition is pending (no optimistic UI to revert).
- Dialog only offers active rules and rejects bookings whose total is not > 0 before calling the action, so the action's schema (which requires a positive invoiceAmount) is satisfied with a non-trusted value while the action still derives the true base from the booking server-side.

**src/actions/activity.actions.ts**
- Gated the userId filter in getActivityLogs() against personal-data IDOR/enumeration: a non-privileged employee may now only pass userId equal to their own session.user.id; filtering the feed by an arbitrary other user's id requires the users:read permission (people-admin roles). Otherwise returns {s
- Hardened/validated pagination inputs: page and limit are now coerced via Number(), floored, and clamped (page >= 1, limit between 1 and 100) so untrusted/oversized values can't be used to over-fetch or compute a negative/NaN skip.

**src/actions/gallery.actions.ts**
- IDOR in updateGalleryItem (~line 211): added an ownership guard after the existing-record fetch. Non-admin users may only update items where existing.uploadedById === session.user.id; SUPER_ADMIN and ADMIN bypass the check. Reuses the already-fetched 'existing' record and session, no extra query.
- IDOR in deleteGalleryItem (~line 278): added the same ownership guard before prisma.galleryItem.delete. Non-admins can only delete items they uploaded; SUPER_ADMIN/ADMIN bypass.

**src/actions/widget.actions.ts**
- Finding 1 (HIGH/DATA_CORRECTNESS, race condition in processInquiry): Replaced the racy non-atomic check-then-write pattern. Previously inquiry.isProcessed was checked at line ~104 but the flag was only set at line ~165, leaving a TOCTOU window where two concurrent requests could both pass the check 
- Removed the now-redundant late prisma.widgetInquiry.update({ data: { isProcessed: true } }) (former line ~165) since the flag is now set atomically up front.
- Added compensating reverts: if contact creation throws, or if createLead returns failure, the claim is released via updateMany({ where: { id, isProcessed: true }, data: { isProcessed: false } }) so a failed conversion does not leave the inquiry permanently marked processed-with-no-lead and it can be

**src/schemas/inventory.schema.ts**
- Finding 1 (HIGH/DATA_CORRECTNESS): Added a .refine() to inventoryItemSchema enforcing data.availableQty <= data.totalQuantity, with the error attached to the availableQty path. Because both the createItem and updateItem server actions parse user input through inventoryItemSchema, this single change 

**src/app/(dashboard)/kitchen/_components/kitchen-list.tsx**
- Added client-side validation in handleCreate (NewPlanDialog) before calling createKitchenPlan: when a covers value is entered, it is parsed with Number() and rejected with a 'Covers must be a positive number' toast (and early return) if it is not finite or is <= 0. This catches negative/NaN/Infinity

**src/app/(dashboard)/notifications/_components/notification-list.tsx**
- Finding 1 (ERROR_HANDLING): Wrapped markAsRead()/handleToggleRead in try/catch. It now snapshots `notifications`, applies the optimistic isRead=true update, awaits markAsRead inside try, and on throw (Unauthorized/Not found) reverts to the snapshot via setNotifications(snapshot) and shows toast.erro
- Finding 1 (ERROR_HANDLING): Wrapped markAllAsRead()/handleMarkAllAsRead the same way — snapshot, optimistic mark-all-read, awaited action in try/catch, rollback + toast.error on failure.
- Finding 1 (ERROR_HANDLING): Wrapped deleteNotification()/handleDelete the same way — snapshot, optimistic filter-out, awaited action in try/catch, rollback + toast.error on failure.
- Added `import { toast } from "sonner"` (sonner is installed and used app-wide) for user-facing error feedback.
- Added `notifications` to each handler's useCallback dependency array so the rollback snapshot always reflects current state.

**src/components/layout/notification-popover.tsx**
- Finding 1 (HIGH/ERROR_HANDLING): Wrapped handleMarkAsRead in try/catch. The await markAsRead(notificationId) and the subsequent queryClient.invalidateQueries are now inside the try block, so invalidation only runs on success (no stale-data refetch on failure). On error it logs via console.error and 
- Finding 1 (HIGH/ERROR_HANDLING): Wrapped handleMarkAllAsRead in try/catch with the same pattern - await markAllAsRead(userId) plus invalidateQueries inside try, console.error + toast.error on failure.
- Added `import { toast } from "sonner";` (the codebase-standard toast library, used in 266 files including the sibling layout component velos-chip.tsx).

**src/app/(dashboard)/owners/[ownerId]/edit/page.tsx**
- [HIGH/RBAC] Fixed cross-domain user assignment: changed the bdUsers candidate query role filter from [SUPER_ADMIN, ADMIN, SALES_EXEC] to [SUPER_ADMIN, ADMIN, BD_EXECUTIVE, BD_HEAD] (line 26). SALES_EXEC belongs to the Sales CRM domain and has no owners:* / BD module permissions, so it was incorrectl

**src/app/(dashboard)/owners/new/page.tsx**
- Finding 1 [HIGH/RBAC]: Changed the bdUsers role filter (line 18) from ["SUPER_ADMIN", "ADMIN", "SALES_EXEC"] to ["SUPER_ADMIN", "ADMIN", "BD_EXECUTIVE", "BD_HEAD"]. Verified in src/lib/permissions.ts that SALES_EXEC has NO owners:* permissions while BD_EXECUTIVE and BD_HEAD both hold owners:read/cre

**src/actions/payout.actions.ts**
- createPayout (finding #1, HIGH/VALIDATION): added existence validation for the optional vendorId and bookingId foreign keys before prisma.payout.create(). Now normalizes the empty-string-allowed schema values to null, then queries prisma.vendor.findUnique / prisma.booking.findUnique (select id only)

**src/actions/hr-employee.actions.ts**
- Finding 1 (ERROR_HANDLING): Wrapped the updateEmployee prisma.$transaction (formerly lines 397-400) in a try-catch, mirroring the createEmployee pattern. Prisma errors are now caught instead of propagating uncaught and crashing the server. Specifically handles PrismaClientKnownRequestError P2002 (du

**src/actions/performance.actions.ts**
- getIndividualMetrics (line ~451): Fixed personal-data IDOR. The function previously returned any employee's detailed metrics (bookings, revenue, leads, tasks, rating) to any caller holding only 'performance:read'. Added an ownership/role guard after the existing permission check: a caller may view m

**src/actions/performance-score.actions.ts**
- [HIGH/SECURITY] IDOR in getIndividualPerformanceDetail (line ~181): added an ownership/role guard after the existing performance:read check. Access to a target user's performance detail (scores, badges, incentive/bonus data) is now allowed only if userId === session.user.id OR the caller has the man

**src/app/(dashboard)/referrals/new/page.tsx**
- Finding 1 (HIGH/SECURITY): Removed the direct prisma.contact.findMany() call from NewReferralPage. Added a dedicated, permission-guarded server action getReferrerContactOptions() in src/actions/referral.actions.ts that (a) checks session auth, and (b) requires BOTH hasPermission(role, 'referrals:cre

**src/actions/report.actions.ts**
- getClientLedger (line ~891): added input validation that rejects a non-string or empty/whitespace contactId before any DB query (returns {success:false, error:'Invalid contact'}). This removes the blind use of an untrusted client-supplied string as a query key, per the input-validation FIX rule. Aut

**src/actions/resource.actions.ts**
- getResources(): added hasPermission(session.user.role, 'resources:read') guard immediately after the auth() session check (returns 'Insufficient permissions' on failure).
- getResource(): added the same 'resources:read' permission guard after auth().
- checkConflicts(): added the same 'resources:read' permission guard after auth().
- getResourceCalendar(): added the same 'resources:read' permission guard after auth().

**src/actions/staff.actions.ts**
- IDOR / personal-data write (updateStaffProfile, ~line 118): added an ownership + privilege gate. After the existing hasPermission(role,'staff:update') check, the function now resolves the StaffProfile by the client-supplied id (findUnique select id,userId; returns 'Staff profile not found' if missin
- Sensitive-field protection: hourlyRate, monthlyRate and bankDetails are now payroll-admin-only even on a self-edit. (1) A request that includes any of those fields when the actor is not a staff admin is rejected up front ('Only a payroll administrator can change pay rates or bank details'). (2) The 

**src/actions/support.actions.ts**
- Finding 1 [HIGH/RBAC] assignTicket: now validates that the target assignee actually carries support:write. Added role to the target user.findUnique select, and after the existing active-check, gate assignment with canWrite(target.role) (hasPermission(role, 'support:write')); returns 'Selected user c

**src/actions/vendor-catalog.actions.ts**
- addPackageImage (line ~519): added an existence check — `prisma.vendorPackage.findUnique({ where: { id: packageId }, select: { id: true } })` returning 'Package not found' before counting/creating the image, so the action no longer blindly creates against an unverified packageId.
- setPackageCover (line ~545): added the same package existence check before the image-belongs-to-package lookup and the cover update, returning 'Package not found' for nonexistent packages.
- deletePackageImage (line ~561): extended the existing findUnique to also select `id` and added a 'Package not found' guard, so a nonexistent package no longer silently no-ops and returns a false success.
- reorderPackageImages (line ~580): added the package existence check before the reorder transaction, returning 'Package not found' for nonexistent packages.

**src/actions/whatsapp.actions.ts**
- Finding 1 (DATA_CORRECTNESS, ~line 344): Fixed inflated deliveryRate/readRate in getWhatsAppStats. Previously the denominator was successTotal = sent + delivered + read, which counted SENT (an intermediate WhatsApp lifecycle state: SENT -> DELIVERED -> READ) as if its outcome were already known, und


## Fixes applied — Wave 2 (Medium + Low)

**src/actions/contract.actions.ts**
- Finding 1 (MEDIUM/VALIDATION): sendContract now validates expiry server-side. Added expiresAt to the existing-contract select and a guard that returns {success:false, error:'Contract has expired — update the expiry date before sending'} when expiresAt <= now, before the DRAFT->SENT transition.
- Finding 2 (MEDIUM/ERROR_HANDLING): sendContract no longer silently swallows delivery failures. Email and e-sign requests are now awaited (detached promises don't survive serverless responses anyway) inside try/catch; on missing recipient email or a failed sendEmail/requestSignature result, the actio
- Finding 3 (MEDIUM/DATA_CORRECTNESS): getPortalContract VIEWED auto-transition is now an atomic conditional update (updateMany where status:'SENT') wrapped in try/catch, and the client-facing status is derived from an effectiveStatus variable rather than blindly returning VIEWED — so a silently-faile
- Finding 4 (MEDIUM/DATA_CORRECTNESS): portalSignContract expiry and sign transitions are now atomic conditional updates. The EXPIRED transition uses updateMany guarded on status in [SENT,VIEWED]; the SIGNED transition uses updateMany guarded on status in [SENT,VIEWED] with a count==0 check returning 
- Finding 5 (LOW/PERFORMANCE): getContract trimmed `contact: true` to a select of only the fields actually consumed (id, firstName, lastName, email, phone, company); booking/template were already narrowed. Verified no contract UI references contact fields outside this set.

**src/actions/recruit-candidate.actions.ts**
- Finding 1 (scheduleInterview candidate validation): added prisma.recCandidate.findUnique existence check before creating the interview, returning 'Candidate not found.'; also validate input.applicationId (when provided) exists AND belongs to the same candidate, returning 'Application not found for t
- Finding 2 (createOffer candidate validation): added prisma.recCandidate.findUnique existence check before creating the offer, returning specific 'Candidate not found.' instead of the generic create failure.
- Finding 3 (updateCandidateNotes existence check): added prisma.recCandidate.findUnique guard before the update, returning 'Candidate not found.' for invalid IDs (mirrors setCandidateStage pattern).
- Finding 4 (CTC upper bound): added MAX_CTC = 50,000,000 ceiling; switched isFinite to Number.isFinite (rejects coerced NaN/non-number) and added 'CTC exceeds the allowed maximum.' guard alongside the existing >0 check.
- Finding 5 (narrowed catch blocks): scheduleInterview and createOffer now detect Prisma P2003 FK violations and return a specific not-found message; all five catch blocks (scheduleInterview, setInterviewOutcome, createOffer, setOfferStatus, updateCandidateNotes) now console.error the underlying error

**src/actions/staff.actions.ts**
- Finding 1 (Decimal precision in payroll): Rewrote the generatePayroll pay-calculation to run entirely through Prisma.Decimal (totalHoursWorked, totalOvertimeHours, base/overtime/net pay, including the 1.5x overtime multiplier) instead of JS Number arithmetic, then persisted via .toDecimalPlaces(2) t
- Finding 2 (unvalidated bookingId FK): In createShift, when bookingId is supplied, fetch the Booking and return 'Booking not found' if it does not exist before creating the shift. In updateShift, re-validate the bookingId on every update so a shift can never be re-pointed at a deleted/nonexistent boo
- Finding 3 (staff profile existence): In createShift, fetch the StaffProfile by shiftData.staffId before prisma.shift.create() and return a friendly 'Staff member not found' instead of a raw Prisma FK error.
- Finding 4 (generic error swallowing): Added up-front validation (staff + booking existence) so most validation failures surface specific messages, and extended the createShift catch block to map Prisma.PrismaClientKnownRequestError P2003 (FK violation) to 'Staff member or booking reference is invali
- Finding 5 (N+1 in generatePayroll): Replaced the per-staff existing-entry lookup and per-staff shift findMany with two batched queries using staffId: { in: staffIds } (payrollEntry + completed shifts for the whole month), grouped into Maps in memory, eliminating the 2-queries-per-staff pattern.

**src/actions/payment.actions.ts**
- Finding 1 (receipt collision): Replaced the read-then-generate generateReceiptNumber() + P2002 retry loop with allocateReceiptNumber(tx) that allocates RCP-YYYY-NNNN from a gapless FinSequence counter (entityId BILLION, series 'RCP') INSIDE the same transaction, mirroring ledger.ts allocateEntryNo. 
- Finding 2 (float drift on Decimal money): Added toPaise()/toRupees() helpers and converted all balance math to integer paise. recordPayment and verifyPaymentProof now compute balPaise = totalPaise - paidPaise and persist toRupees(Math.max(0,balPaise)); status uses balPaise <= 0 (no 0.01 band-aid). r
- Finding 3 (missing round / micro-balance): balanceDue is now derived from rounded integer paise (toRupees(Math.max(0,balPaise))), so no sub-paise micro-balances are ever written and negatives are clamped at the integer-paise level before conversion. Applied consistently in recordPayment and verifyPa
- Validation hardening (supports finding 4 + general): recordPayment now rejects non-finite amounts (!Number.isFinite || <= 0) so NaN/Infinity can't slip past the <=0 check; createRazorpayOrder adds a Number.isFinite(amount) guard and validates against balance in paise.

**src/actions/cadence.actions.ts**
- Finding 1 (ARCHIVED immutability): added an ARCHIVED-status guard to all four step-mutation actions. createStep() and reorderSteps() now load the parent cadence status and reject if ARCHIVED; updateStep() and deleteStep() now include the parent cadence via { cadence: { select: { status: true } } } a
- Finding 2 (fire-and-forget logActivity): awaited all 13 logActivity() calls in the file. logActivity already catches its own errors internally and never throws, so awaiting cannot break the success path; awaiting makes the audit write serverless-safe (completes before the action returns, matching th
- Finding 3 (calculateNextExecuteAt intent): documented the helper with a clear JSDoc block stating that nextExecuteAt is anchored to the current clock ('time from now') by design, that resume re-applies the current step's full delay to avoid firing immediately on resume, and that crediting elapsed ti

**src/actions/campaign.actions.ts**
- Finding 1 (race condition / stuck SENDING state): Replaced the blind two-step `update` to SENDING then SENT with an atomic conditional claim. sendCampaign now uses `updateMany({ where: { id, status: existing.status }, data: { status: SENDING } })` — only one concurrent request can claim the campaign
- Finding 3 (swallowed contact.count error + stuck SENDING): Wrapped `prisma.contact.count()` in its own try/catch. On failure it logs the real error under [SEND_CAMPAIGN_COUNT_ERROR], reverts the campaign from SENDING back to its prior DRAFT/SCHEDULED state via a guarded updateMany (logging [SEND_CAM
- Input validation hardening (sendCampaign): Replaced the `recipientFilter as any` + `contactWhere: any` casts with a typed shape and a whitelist — contactType is only applied when it strictly equals 'INDIVIDUAL' or 'CORPORATE' (the ContactType enum values), so a malformed recipientFilter cannot injec
- Input validation hardening (getCampaigns): Removed the `where: any` cast and added a VALID_STATUSES whitelist; the status filter is only applied when it is one of the five CampaignStatus enum values, guarding against arbitrary runtime values from untyped callers.

**src/actions/dashboard.actions.ts**
- Finding #2 (timezone): Added IST-anchored date helpers (istNow/istStartOfMonth/istEndOfMonth) using a fixed UTC+05:30 offset, and switched all 'this month / last month' period boundaries (thisMonthStart/End, lastMonthStart/End) plus the 12-month chart window bound to IST-anchored instants. Previousl
- Finding #2 (timezone, chart bucketing): Made the monthly-revenue chart bucket payments by IST month using a single istMonthKey() shift for both the seeded month buckets and the per-payment bucketing (eliminating the prior mix of UTC-shifted keys vs date-fns local-field reads). Also hardened the mont
- Finding #1 (revenue/balanceDue correctness): Hardened the overdue-payments read against a stale denormalized Invoice.balanceDue. Added totalAmount and paidAmount to the select, recompute balanceDue on read as max(0, totalAmount - paidAmount) (falling back to the stored balanceDue only if the compute
- Finding #3 (performance/bounding): Bounded the previously-unbounded upcomingEvents findMany (next-7-days) with take:50 (dashboard only renders a short preview), and bounded the last-12-months payments findMany with orderBy paidAt asc + take:5000 so a data anomaly can't pull an unbounded result set i
- Cleanup: Removed now-unused startOfMonth/endOfMonth imports from date-fns (replaced by IST helpers); verified subMonths/format/addDays remain used. File type-checks clean (tsc --noEmit, no errors for this file).

**src/actions/survey.actions.ts**
- Finding 1 (DEAD_WIRING): Removed the three orphaned server actions addQuestion, updateQuestion, and deleteQuestion. Confirmed via grep that no module imports them (the same-named helpers in survey-form.tsx are local client-side functions, and the form uses createSurvey/updateSurvey which atomically 
- Finding 3 (DATA_CORRECTNESS): Made updateSurvey atomic and concurrency-safe. The question deleteMany + survey.update are now wrapped in a single prisma.$transaction. Added an optimistic-concurrency guard: a conditional updateMany on { id, updatedAt: existing.updatedAt } bumps updatedAt and, if it ma
- Finding 2 (PERFORMANCE): Bounded getSurveyResults. The responses include now uses orderBy createdAt desc with take: 1000 (RESPONSE_SAMPLE_LIMIT) instead of loading every response/answer/question into memory. The true total is now obtained via a separate prisma.surveyResponse.count, and the result pa

**src/actions/loyalty.actions.ts**
- Finding 1 (adjustPoints tier/totalEarned semantics): Documented the intended behavior inline. totalEarned is a monotonic lifetime-earned metric driving tier calculation; positive adjustments increase it (mirroring earnPoints), negative adjustments are corrections to the spendable points balance only
- Finding 2 (getLoyaltyAccounts unbounded findMany): Added bounded pagination — page/pageSize params with a default page size of 50 and a hard max of 200, floored/clamped to >=1. Whitelisted the tier filter against VALID_TIERS instead of an untyped `any` where-object (removed the eslint-disable any ca
- Finding 3 (unused getTransactions): Removed the dead exported action. Confirmed via grep it was never called anywhere outside this file; the detail page fetches transactions through getLoyaltyAccountById's `transactions` include clause.

**src/actions/task.actions.ts**
- Finding 1 (operational hardening, not ownership): added existence checks (prisma.task.findUnique) to updateTaskStatus and moveTask before the prisma.task.update, matching the pattern already present in updateTask. Previously these two functions ran a blind update on a caller-supplied id, so a non-ex
- Finding 3 (enum validation in updateTaskStatus): already satisfied in the current file via the TASK_STATUSES whitelist + isValidTaskStatus type guard (line ~330), replacing the prior unvalidated 'as' cast. Verified present; no change needed.

**src/actions/resource.actions.ts**
- Finding 3 (PERFORMANCE): Capped pagination in getResources(). limit is now Math.min(Math.max(Math.floor(params?.limit ?? 50), 1), 500) and page is Math.max(Math.floor(params?.page ?? 1), 1), preventing unbounded findMany queries / DoS from a client-supplied limit like 999999 and guarding against non
- Finding 1 (DEAD_WIRING): Removed the unreachable allocateResource() server action. It was exported but never invoked by any UI (resource-detail.tsx only imports deallocateResource). Confirmed via grep that nothing else in src referenced it.
- Finding 2 (DEAD_WIRING): Removed the unreachable checkConflicts() and getResourceCalendar() server actions, which existed only to support the (now removed) allocation workflow and had no callers anywhere in the codebase.
- Cleaned up now-unused imports: removed allocationSchema and AllocationInput from the @/schemas/resource.schema import (they were only used by the removed allocateResource). Verified all remaining imports (revalidatePath, serialize, logActivity, notify, resourceSchema, ResourceInput, hasPermission, a

**src/actions/payout.actions.ts**
- Finding 1 (idempotency/dedup for createPayout): made the duplicate-payment check BLOCKING and moved it to run BEFORE prisma.payout.create. If findDuplicatePayouts returns any recent same-vendor/same-amount/same-type payout, createPayout now returns {success:false, error} instead of persisting a like
- Finding 2 (silent GL-posting failure in markPayoutPaid): kept the serverless-safe after() pattern (the codebase's established remediated approach) but made it await postPayoutPaid and inspect its BridgeResult. postPayoutPaid never throws and returns {posted:false, reason}; genuine failures (e.g. acc
- Finding 3 (dead generateVenueOwnerPayout): removed the function. Grep confirmed zero callers anywhere — no UI button, no action, no cron, no booking lifecycle handler references it (only OWNER_PAYOUT enum/label/badge usages exist, which are unaffected). Per the wire-or-remove rule and single-file sc

**src/actions/support.actions.ts**
- Finding 1 (VALIDATION): createTicket now validates contactId exists via prisma.contact.findUnique before persisting; returns 'Selected contact was not found' if missing. Trimmed/normalized the id and wired the validated value into the create data.
- Finding 2 (VALIDATION): createTicket now validates bookingId exists via prisma.booking.findUnique before persisting; returns 'Selected booking was not found' if missing. Both checks run only when the optional id is provided, preserving the ability to create unlinked tickets.
- Finding 3 (PERFORMANCE): getTickets is now bounded. Added DEFAULT_TICKET_LIMIT=100 and MAX_TICKET_LIMIT=200, an optional whitelisted/clamped `limit` param (positive finite numbers only, floored and capped at MAX), and a `take` clause on the findMany. Return shape stays Result<TicketRow[]> so the exi

**src/actions/projects.actions.ts**
- Finding 1 (updateProjectMaster, ~line 247): Added a findUnique existence check before the update transaction. Now returns {success:false, error:'Project not found'} for non-existent IDs, giving clear user feedback instead of an unhandled Prisma throw, and avoids an audit write for a non-existent pro
- Finding 2 (assignProjectManager, ~line 334): Added a findUnique existence check before the update. Now returns {success:false, error:'Project not found'} for non-existent project IDs, preventing a stray notify() to the assigned user and a misleading revalidatePath/success response when the project d

**src/actions/bulk.actions.ts**
- Finding 1 (ERROR_HANDLING): bulkUpdateContacts and bulkDeleteContacts now await activity logging via await Promise.all(ids.map(id => logActivity(...))) instead of fire-and-forget for-loops, so the audit trail completes before the action returns (serverless can freeze the function once the response i
- Finding 1 (consistency, same defect class): applied the same awaited Promise.all(...map(...)) pattern to the remaining unawaited logActivity loops in bulkUpdateLeads, bulkDeleteLeads, bulkEnrollInCadence, and bulkChangeLeadStatus, since the prompt's ALWAYS-FIX rule covers awaited fire-and-forget wri
- Finding 2 (ERROR_HANDLING/validation): bulkAssignLeads now validates the assignee before updateMany. Added a local ASSIGNABLE_ROLES constant and assigneeInvalid() helper mirroring lead.actions.ts (rejects deleted, inactive, or non-assignable-role users); returns a user-facing error and aborts the mu

**src/actions/activity.actions.ts**
- Finding 1 (ERROR_HANDLING): getActivityLogs() catch block now returns a structured error — added a machine-readable code:'FETCH_FAILED' field alongside a clearer, retry-oriented user-facing message ('Couldn't load activity right now. This is usually temporary — please retry in a moment.'). The exist

**src/schemas/package.schema.ts**
- Finding 1 (MEDIUM/VALIDATION, unbounded items array): added .max(100, 'Package cannot have more than 100 items') to the packageSchema items array before .default([]), bounding it to 100 items to prevent performance/UI degradation.
- Finding 2 (LOW/VALIDATION, misleading basePrice message): changed the basePrice min(0) error message from 'Base price must be positive' to 'Base price must be non-negative', accurately reflecting that 0 is allowed (free/included packages stay valid).

**src/actions/approval.actions.ts**
- Finding 2 (self-delegation): Added guard `if (delegateToUserId === session.user.id) return { success: false, error: 'You cannot delegate to yourself' }` in delegateRequest() before the existing-user check, preventing a user from creating a self-targeted DELEGATE decision that could bypass segregatio
- Finding 1 (target user existence): Added `prisma.user.findUnique({ where: { id: delegateToUserId }, select: { id: true } })` and a `User not found` early-return in delegateRequest(), so delegations to non-existent user IDs are rejected before creating a decision record / firing a notification.

**src/actions/procurement.actions.ts**
- Finding 1 (DATA_CORRECTNESS): rejectPR no longer stamps approvedById/approvedAt when rejecting. The schema has no rejectedAt/rejectedById field (cannot edit prisma/schema.prisma), so the correct minimal fix is to leave the approval columns untouched (null) on rejection. The rejector and reason are s
- Finding 2 (DEAD_WIRING): Removed the three exported-but-unused item-CRUD server actions (addPurchaseRequisitionItem, updatePurchaseRequisitionItem, deletePurchaseRequisitionItem). Confirmed via grep across src that no .ts/.tsx component invokes them. Also removed their two now-orphaned private helpe
- Housekeeping: kept sumItems (still used by createPurchaseRequisition) and refreshed its stale section comment that previously referenced the removed recomputeTotal.

**prisma/schema.prisma**
- Finding 2 (LOW/UX): Added @@unique([bookingId, ruleId]) to the CommissionEntry model (line ~1995). This gives a database-enforced idempotency guarantee for commission entries per (booking, rule) pair. Verified the intent in src/actions/commission.actions.ts createCommissionEntry, which currently rel

**src/actions/commission.actions.ts**
- Finding 1 (MEDIUM/PERFORMANCE) — getCommissionEntries() unbounded findMany + client-side totals: added bounded pagination (take/skip), validated and clamped to a hard cap of 500 rows (positive-integer guard, NaN-safe). Headline totals (count, total, pending, paid) are now computed SERVER-SIDE over t
- Finding 2 (MEDIUM/DATA_CORRECTNESS) — float-based commission math: replaced (invoiceAmount * Number(rule.percentage)) / 100 + flat float arithmetic with Prisma.Decimal arbitrary-precision math (invoice.mul(pct).div(100).add(flat).toDecimalPlaces(2)). The Decimal value is persisted directly into the 
- Replaced the `const where: any` cast with a typed Prisma.CommissionEntryWhereInput (removed blind `as any` / eslint-disable).

**src/actions/rental.actions.ts**
- Finding 2 (updateRentalItem allows total quantity below active rentals): Before updating, aggregate the sum of quantities across active RentalBookings (status in RESERVED/RENTED/OVERDUE) for the item. Reject the update with a clear error if the new total `quantity` is less than the committed (still-
- Finding 1 (divergence between availableQty counter and overlap-based computation): The primary divergence vector was the update form directly writing client-supplied `availableQty`. updateRentalItem now ignores the client `availableQty` and reconciles the counter as `quantity - committedQty` (commit

**src/actions/inventory.actions.ts**
- Finding 1 (releaseReservation DAMAGED restores availableQty): split the stock adjustment by status. RETURNED still increments availableQty (items re-enter circulation); DAMAGED now decrements totalQuantity instead (writes off the loss) and leaves availableQty untouched, since availableQty was alread
- Finding 2 (reserveForBooking stale stock check / race): moved the stock check inside the transaction. Replaced the read-then-decrement pattern with an interactive $transaction that performs a conditional updateMany (WHERE id = itemId AND availableQty >= quantity, decrement availableQty). If 0 rows m

**src/actions/document.actions.ts**
- Finding 1 (MEDIUM/PERFORMANCE): Added pagination to getDocumentsByEntity(). It previously ran an unbounded findMany() with no take/skip. Now accepts an optional params {page, limit}, sanitizes/bounds them (page>=1, limit 1..200, default 50, integer-coerced via Math.floor(Number(...))), guards agains
- Finding 2 (MEDIUM/UX dead-wiring): Removed the unused updateDocument() server action. Grep across src/ confirmed it is not referenced by any UI component or other module (document-list.tsx only calls deleteDocument). Per the finding's option (1), removed it to cut maintenance surface rather than bui

**src/actions/hall-owner.actions.ts**
- Finding 1 (DEAD_WIRING moveHallOwnerStage): removed the unreferenced moveHallOwnerStage() action. Confirmed zero call sites across the entire repo (only its own definition matched). The owners funnel board (src/app/(dashboard)/owners/_components/owners-workspace.tsx) renders stage columns as plain L
- Finding 2 (DEAD_WIRING deleteHallOwner): removed the unreferenced deleteHallOwner() soft-delete action. Confirmed zero call sites across the repo and no delete button/dialog in the owners list, detail, or any component. Removed as dead code.
- Cleanup: removed the now-orphaned hallOwnerStatusValues import from @/schemas/hall-owner.schema (moveHallOwnerStage was its only consumer in this file). Verified all other imports (HallOwnerStatus, revalidatePath, hasPermission, logActivity) remain in use.

**src/actions/insurance.actions.ts**
- Finding #2 (LOW/ERROR_HANDLING): Added explicit Prisma constraint-error handling to the createInsurancePolicy catch block. Imported `Prisma` from @prisma/client and mapped known request error codes to user-friendly messages: P2003/P2025 (FK violation — booking/venue deleted in the race window) -> 'T
- Applied the same constraint-error mapping to updateInsurancePolicy's catch block, since it shares the identical FK-race exposure (booking/venue can be deleted between the existence pre-check at lines ~280-297 and the prisma.update).

**src/app/(dashboard)/tasks/_components/task-list.tsx**
- [MEDIUM/UX] Fixed duplicate Edit/View dropdown actions: the 'Edit' menu item previously called onNavigate(task.id) which routed to /tasks/{id} (the detail page), identical to 'View'. Added a dedicated onEdit handler (router.push(`/tasks/${id}/edit`)) and wired the Edit item to it.
- [LOW/UX] Clarified the View vs Edit flow: View -> /tasks/{id} (detail page), Edit -> /tasks/{id}/edit (edit form). Verified the edit route exists at src/app/(dashboard)/tasks/[taskId]/edit/page.tsx, so the new path resolves correctly (dynamic segment is [taskId]).

**src/actions/lead.actions.ts**
- Finding 1 (MEDIUM/PERFORMANCE, getLeads ~line 80-82): Hard-capped page size. The leads page calls getLeads({ limit: 500 }), and with nested contact+assignedTo includes this can bloat memory / slow the response on large accounts. Replaced the raw `limit = params?.limit ?? 50` with `limit = Math.min(M
- Finding 2 (MEDIUM/VALIDATION, updateLeadStatus ~line 828/857): Made the 'Won needs an owner' guard (SCRM-004) race-safe. The existing guard only checked `existing.assignedToId` from a findUnique taken OUTSIDE the transaction, so a concurrent un-assign (or a re-open path) could let a lead be committe

**src/app/(dashboard)/notifications/_components/notification-list.tsx**
- Finding 1 (MEDIUM/VALIDATION): Added a local safeText(value, maxLength) helper and wired notification.title and notification.message through it on render (lines 375/378). It coerces non-string values to empty string (defends against non-string content slipping through the RPC type), strips ASCII con
- Finding 2 (LOW/UX): Verified the three handlers (handleToggleRead, handleMarkAllAsRead, handleDelete) already wrap their server-action calls in try/catch, revert the optimistic UI from a pre-action snapshot on failure, and surface toast.error with the server error message. No additional change requi

**src/components/widget/inquiry-table.tsx**
- Finding 1 (ERROR_HANDLING): Wrapped the deleteInquiry call in handleDelete with try/catch/finally so unexpected exceptions surface as a 'Failed to delete inquiry' toast instead of an unhandled promise rejection, consistent with handleProcess and handleMarkDone.
- Finding 2 (UX): Added setLoading(true) before the deleteInquiry call and setLoading(false) in the finally block. Since the menu trigger Button is already disabled={loading}, this provides loading feedback and prevents rapid double-click duplicate delete requests.

**src/app/(dashboard)/whatsapp/_components/inbox-chat-view.tsx**
- Finding 1 (ERROR_HANDLING): Added error state tracking. Wrapped loadMessages in try/catch/finally; on a non-success result or thrown error it now sets a user-visible error message instead of silently swallowing it. On success it clears the error and records lastSyncedAt. Added a dismissible-style re
- Finding 2 (UX): Improved loading and empty-state feedback. The loading state now shows an explicit 'Loading messages...' label under the spinner so users can distinguish 'still loading' from 'no messages'. The empty state now differentiates a genuine empty conversation ('No messages yet. Send the fi

**src/actions/workqueue.actions.ts**
- DATA_CORRECTNESS (line ~31): Rebuilt `todayEnd` using `Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23,59,59,999)` instead of local-timezone `now.getFullYear()/getMonth()/getDate()`. dueDate is stored as a UTC timestamp and compared against `now` (UTC), so the boundary must al
- ERROR_HANDLING (line ~34): Wrapped the `Promise.all([...])` of Prisma queries in try/catch; on failure it logs via console.error and returns `null`. The consuming page src/app/(dashboard)/my-work/page.tsx already renders a graceful fallback ('Couldn't load your workqueue.') when the action returns n

**src/actions/hr-employee.actions.ts**
- Finding 1 (PERFORMANCE, createEmployee ~line 305): replaced the unbounded `prisma.employee.findMany({ select: { empCode: true } })` that loaded every employee row with a bounded query ordered by empCode desc and `take: 5`. Because empCodes are zero-padded fixed width (PPG-0001), the lexicographicall
- Finding 2 (VALIDATION, updateEmployee ~line 388): added FK existence pre-validation for legalEntityId, businessVerticalId, departmentId, and designationId before building the connect operations, mirroring the pattern already used in createEmployee. Each check uses findUnique with select:{id:true} an

**src/actions/beo.actions.ts**
- Finding 1 (IDOR resolveBeoIncident): after loading the incident, added a parent-BEO existence/access guard `const beo = await prisma.beo.findUnique({ where: { id: i.beoId }, select: { id: true } }); if (!beo) return { success: false, error: 'Function sheet not found' };` before performing the resolv
- Finding 2 (covers validation in updateBeo): replaced the blind `Number(patch.covers)` assignment with validation that rejects non-integer and negative values, returning `{ success: false, error: 'Covers must be a non-negative whole number.' }`; null is still accepted to clear the field.

**src/actions/performance.actions.ts**
- Finding 1 (getTeamPerformance, ~line 101): Changed the WON-leads filter from updatedAt to createdAt so the conversion-rate numerator (wonLeads) and denominator (leadTotals groupBy, which filters createdAt) cover the same lead cohort. Added a comment documenting the cohort semantics (conversion rate 
- Finding 2 (getIndividualMetrics, ~line 504): Changed the leadsConverted count filter from updatedAt to createdAt so it matches the leadsAssigned count (which filters createdAt). Both now measure the same created-in-period cohort. Added a clarifying comment.

**src/actions/review.actions.ts**
- Added explicit reviews:read permission check to getAverageRating (after the session/auth check). Reads the role from session.user and returns { success: false, error: 'Insufficient permissions' } when the role is missing or lacks reviews:read, matching the defense-in-depth pattern already used by ge

**src/actions/snags.actions.ts**
- [MEDIUM/VALIDATION] addSnagPhoto: corrected the photo size-validation logic so the byte cap only applies where it is meaningful. Previously `photo.url.length > MAX_PHOTO_BYTES` (7MB) was applied uniformly, which is correct for base64 data-URLs (the string IS the payload) but meaningless for https li
- Trim hardening + consistency: validate on `photo.url?.trim()`, compute `photoUrl` once from the trimmed value, run `isSafeReceiptUrl` against it, and persist the trimmed `photoUrl` to the DB (previously the raw untrimmed `photo.url` was stored).

**src/app/(dashboard)/contracts/page.tsx**
- [LOW/UX] Added a dedicated empty state for the contracts list: when contracts.length === 0, the page now renders an EmptyState (icon, 'No contracts yet' title, helpful description) with a 'New Contract' CTA button linking to /contracts/new, instead of handing an empty array to ContractsTable/DataTab

**src/schemas/campaign.schema.ts**
- Finding 1 (MEDIUM/VALIDATION): scheduleCampaignSchema.scheduledAt now validates that the string parses to a real date (rejects 'Invalid Date') via .refine(() => !Number.isNaN(new Date(val).getTime())), and that the date is in the future via a second .refine(() => new Date(val).getTime() > Date.now()

**src/app/(dashboard)/campaigns/[campaignId]/_components/campaign-actions.tsx**
- [LOW/UX] Added client-side validation in handleSchedule to reject past/invalid scheduled datetimes before submission. The handler now parses scheduleDate, shows 'Please enter a valid date and time' for NaN dates, and 'Scheduled date and time must be in the future' when the selected time is at/before

**src/actions/menu.actions.ts**
- Finding 1 (MEDIUM/VALIDATION): In saveBookingMenu, added explicit existence + active validation of all referenced menuItemIds before creating booking menu selections. Before the upsert branch, the code now dedupes menuData.selections menuItemIds, fetches matching rows via prisma.menuItem.findMany({ 

**src/app/(dashboard)/dashboard/_components/activity-feed.tsx**
- Added an explicit error state. useQuery now also destructures isError, and the action's {success:false} resolution is detected (failed = isError || (data ? !data.success : false)). Previously any fetch failure or action error was silently rendered as the empty 'No recent activity yet' message, misle
- Reduced redundant DB polling load (the small perf win called out in the finding): bumped refetchInterval from 30s to 60s and set refetchOnWindowFocus:false (was true). The interval already keeps the feed live, so refetching on every window focus was duplicate load; with many staff on the dashboard t

**src/app/(dashboard)/dashboard/_components/upcoming-events.tsx**
- Replaced the misleading 'Tap B to create a new booking' empty-state hint with a direct, always-functional Link button to /bookings/new ('New booking'). The 'B' key is actually the sidebar-toggle shortcut (SIDEBAR_KEYBOARD_SHORTCUT = 'b' in src/components/ui/sidebar.tsx), not a booking-create shortcu

**src/actions/referral-engine.actions.ts**
- Finding 1 (MEDIUM/VALIDATION): Removed the redundant nested auth()/hasPermission('referrals:rewards') check inside the internal helper processReferralRewards. The only caller, trackReferralConversion, already validates auth() and the referrals:manage permission, so re-checking a different permission
- Changed processReferralRewards signature to processReferralRewards(referralId: string, actorUserId: string) and use the passed actorUserId for logActivity, since the function no longer fetches its own session.
- Checked the previously unchecked awaited result at the call site (line ~213): the helper result is now captured and, on failure, logged via console.error with the referral id and error so reward-processing failures are no longer silently swallowed. Note: a reward-processing failure does not roll bac

**src/app/(dashboard)/referrals/_components/referral-table.tsx**
- Hardened the Source column cell renderer (lines ~106-117) against a missing/null source: it now renders a '--' muted placeholder when source is falsy instead of calling row.original.source.toLowerCase() unconditionally (which would throw on null/undefined). Also switched .replace('_',' ') to .replac
- Relaxed the ReferralRow.source type from 'string' to 'string | null' (line 44) to honor the new null-safe rendering and avoid an unsafe non-null assumption in the row type.

**src/app/(dashboard)/referrals/rewards/page.tsx**
- Finding 1 (MEDIUM/ERROR_HANDLING): getRewards() no longer swallows Prisma errors into an empty array. It now returns a discriminated result tuple ({success:true,data} | {success:false,error}) and logs the error via console.error with a bracketed tag ([REFERRAL_REWARDS_FETCH_ERROR]) consistent with t
- Added a visible error state: when getRewards() fails, the page renders a red error banner Card (Failed to load referral rewards. Please refresh...) instead of showing an empty rewards list that is indistinguishable from a genuine empty state. On failure rewards falls back to [] so the rest of the pa
- Small perf hardening: bounded the previously-unbounded findMany with take: 500 to cap a worst-case unbounded read.

**src/lib/payments/apply-capture.ts**
- Input validation on paidAmount in allocatePaidAmountToInstallments(): added `const safePaid = Number.isFinite(paidAmount) && paidAmount > 0 ? paidAmount : 0;` and use it to seed `remaining`. A non-finite (NaN) or negative paidAmount previously poisoned the derived-state allocation loop — NaN compari
- Per-installment amount validation: replaced `const amt = Number(inst.amount)` with a guarded `const rawAmt = Number(inst.amount); const amt = Number.isFinite(rawAmt) && rawAmt > 0 ? rawAmt : 0;`. A malformed installment amount (NaN) made the coverage comparison always false and would silently revert

**src/actions/package.actions.ts**
- Finding 1 (getPackages pagination bounds): clamped page and limit at line ~35. page = Math.max(1, Math.floor(params?.page ?? 1)); limit = Math.min(100, Math.max(1, Math.floor(params?.limit ?? 50))). Caps limit at 100 (matching vendor catalog), enforces a floor of 1 on both, and floors to integers to

**src/lib/notify.ts**
- notifyAdmins() (MEDIUM/DEAD_WIRING): replaced the unawaited fire-and-forget loop `for (...) notify(...)` with `await Promise.all(adminIds.map((userId) => notifyAwait({ ...params, userId })))`. The function is exported and documented as a reusable system-wide admin-notification helper, so it was repa

**src/lib/cadence-executor.ts**
- [MEDIUM/ERROR_HANDLING] Awaited the previously fire-and-forget sendEmail() call in the SEND_EMAIL step (was line ~140) so the request completes before the serverless invocation can freeze; preserved the .catch handler so a send failure logs but does not break the cadence run.
- [MEDIUM/ERROR_HANDLING] Awaited the fire-and-forget sendWhatsApp() call in the SEND_WHATSAPP step (was line ~180) for the same serverless-completion reason; .catch handler preserved.
- [MEDIUM/ERROR_HANDLING] Awaited the fire-and-forget sendSms() call in the SEND_SMS step (was line ~195); .catch handler preserved (sendSms is already graceful when unconfigured).

**src/app/api/cron/customer-360/route.ts**
- Eliminated the N+1 VIP-flag lookup: replaced the per-group prisma.contact.findUnique (one query per contact, inside the loop at the former line ~46) with a single batched prisma.contact.findMany({ where: { id: { in: contactIds } }, select: { id, vipCustomer } }) executed once after the groupBy, then

**src/actions/sales-quotation.actions.ts**
- Finding 1 (HTML injection): Added a local escapeHtml() helper (same escaping pattern as src/lib/email-templates/invoice-sent.ts) and applied it to user-controlled fields interpolated into the default HTML email body in sendSalesQuotation(). row.clientName / row.contact?.firstName are now escaped via

**src/actions/recruit.actions.ts**
- createApplication (line ~244): Added findUnique existence checks for both candidateId and jobOpeningId (run concurrently via Promise.all) before creating the RecApplication. Returns specific errors ('That candidate no longer exists.' / 'That job opening no longer exists.') so the generic catch-block

**src/app/(dashboard)/crm/cadences/_components/step-builder.tsx**
- Wrapped handleCreate/handleUpdate/handleDelete in try/catch/finally. Previously, if a server action threw (network error, serverless cold-start, rejected promise) instead of returning {success:false}, the await rejected, setLoading(false) never ran (loading button stuck forever), the dialog stayed o
- Added router.refresh() on the failure path of every handler (previously refresh only happened on success). When a mutation is rejected server-side (e.g. cadence was archived/changed concurrently, or the step no longer exists per the action's existence check), the UI was left showing stale data. It n
- Hardened toast.error to fall back to a sensible message (result.error ?? 'Failed to <op>') so the user always sees actionable feedback even if the action returns an empty error string.
- On delete failure/error, close the confirmation dialog (setDeleting(null)) so the user isn't left staring at an open dialog over a now-refreshed (possibly already-gone) step.

**src/schemas/survey.schema.ts**
- Finding 1 (LOW/VALIDATION): Bounded the MULTIPLE_CHOICE options array in surveyQuestionSchema with .max(100, 'Maximum 100 options per question') to prevent submission of an unbounded number of options. Also added a per-option .max(200) length cap (each option string was previously only min(1), unbou

**src/app/(dashboard)/analytics/forecast/page.tsx**
- [MEDIUM/RBAC] Added explicit page-level auth + permission guard to forecast/page.tsx, matching the anomalies/page.tsx pattern. The page now calls auth(); redirects to /sign-in when there is no session user, and redirects to /not-authorized when hasPermission(role, 'forecast:read') is false. Used the
- Added required imports: redirect from next/navigation, auth from @/../auth, and hasPermission from @/lib/permissions.

**src/actions/pricing.actions.ts**
- Finding 1 (DEAD_WIRING): Added deleteRatePlan server action in src/actions/pricing.actions.ts mirroring the existing deletePricingRule. It auths the session, enforces hasPermission(role, 'pricing:manage'), validates the id, checks the RatePlan exists (returns 'Rate plan not found' otherwise), delete
- Wired Delete into src/app/(dashboard)/pricing/_components/rate-plans-table.tsx: added a Delete dropdown item (with DropdownMenuSeparator, red styling, Trash2Icon) gated behind an AlertDialog confirmation dialog. Added deletingId state, a handleDelete that calls deleteRatePlan with success/error toas
- Removed a dead import: the table previously imported updateRatePlan from pricing.actions but never used it (Edit is a Link to the edit page). Replaced it with the now-used deleteRatePlan import to keep imports valid and clean.

**src/schemas/staff.schema.ts**
- Added strict HH:MM 24-hour time-format validation to startTime/endTime in createShiftSchema (replacing the permissive max(10) string check) via regex /^([01]\d|2[0-3]):[0-5]\d$/, so the server no longer accepts arbitrary <=10-char strings. This guarantees the values are parseable by the shift-hours 
- Added the same HH:MM 24-hour regex validation to the optional startTime/endTime fields in updateShiftSchema, with a shared timeOfDayRegex constant and error message for consistency.

**src/app/(dashboard)/staff/_components/staff-profile-card.tsx**
- Finding 1 (LOW/UX): Added an explicit confirmation gate before saving payroll-sensitive changes. handleSubmit now diffs the submitted hourlyRate, monthlyRate, and bankDetails against the existing profile values; if any sensitive field changed, it shows a window.confirm with a human-readable before→a
- Error handling hardening (part of same finding): wrapped the updateStaffProfile call in try/catch/finally so a thrown/rejected action no longer leaves the dialog stuck in the 'Saving...' loading state; setLoading(false) now always runs in finally. Also replaced toast.error(result.error) with toast.e
- Moved setLoading(true) to after the confirmation prompt so cancelling the confirm dialog doesn't briefly flip the submit button into a disabled 'Saving...' state.

**src/schemas/commission.schema.ts**
- Finding 1 [MEDIUM/VALIDATION]: Removed the unused invoiceAmount field from calculateCommissionSchema. The server action (calculateCommission in src/actions/commission.actions.ts:388) derives invoiceAmount server-side from booking.totalAmount and never reads parsed.data.invoiceAmount, so validating a
- Required follow-on (keeps types/build valid): removed the now-excess invoiceAmount property from the single caller src/app/(dashboard)/commissions/_components/commission-calc-dialog.tsx so the object literal still matches the narrowed CalculateCommissionInput type. Kept the existing UI guard that bl

**src/schemas/resource.schema.ts**
- allocationSchema: added 24-hour HH:mm format validation via regex (/^([01]\d|2[0-3]):[0-5]\d$/) on both startTime and endTime, replacing the prior min-length-only check.
- allocationSchema: added a .refine() that parses HH:mm into minutes-since-midnight and enforces startTime < endTime, with the error surfaced on the endTime path so the form shows it sensibly.

**src/app/(dashboard)/rentals/_components/rental-item-form.tsx**
- Finding 1 (LOW/VALIDATION, availableQty on edit): On edit, the 'Available Quantity' input is now read-only/disabled with explanatory help text ('Recalculated automatically from total quantity and active rentals'). The field remains editable on create where the value is actually used. This closes the

**src/actions/report.actions.ts**
- Finding 1 (DATA_CORRECTNESS, averageBookingValue): Fixed the mismatched-dataset division in getRevenueReport. Previously averageBookingValue = totalRevenue (from COMPLETED payments in range) / totalBookings (ALL bookings created in range) — two unrelated populations. Now the denominator is the count

**src/actions/quality.actions.ts**
- DATA_CORRECTNESS (finding 1): Fixed historical trend/control-series defect counts being evaluated against the live wall clock. Introduced an `asOf` reference time inside countCtq: `const asOf = end <= now ? end : now;`. For the in-progress current month `range.end` is in the future so `asOf === now`
- Replaced `now` with `asOf` in the time-based overdue predicates of the four affected CTQs inside countCtq: lead-sla (`firstContactDue < asOf`), payment-punctuality (`dueDate < asOf`), task-on-time (`dueDate < asOf`), and handover-snag (`dueDate < asOf`). This fixes both getQualityScorecard (previous

**src/actions/user.actions.ts**
- Finding 1 [MEDIUM/RBAC]: toggleUserActive (deactivate/reactivate) now requires the 'users:delete' permission instead of 'users:update'. Deactivation is a soft-delete that revokes a user's access, so it is semantically deletion, not a routine update. In the permission model, the ADMIN role intentiona
- Added input validation on the 'id' argument (reject non-string / empty) before any DB access, replacing the implicit trust of the raw string parameter.

**src/actions/finance-payroll.actions.ts**
- Finding 1 (DATA_CORRECTNESS): PF deduction in computeSlip() now rounds to paise instead of rupees — changed `Math.round(Math.min(basic, 15000) * 0.12)` to `Math.round(Math.min(basic, 15000) * 0.12 * 100) / 100`.
- Finding 1 (DATA_CORRECTNESS): ESI deduction now rounds to paise instead of rupees — changed `Math.round(esiWages * 0.0075)` to `Math.round(esiWages * 0.0075 * 100) / 100` (ceiling condition preserved).

**src/actions/finance-assets.actions.ts**
- DATA_CORRECTNESS (depreciation drift): Converted all depreciation arithmetic in runDepreciation() to integer paise. cost/salvage/accumulatedDep are now converted via toPaise() up front; depreciableBaseP, remainingP, and the monthly charge (monthlyP = Math.round(depreciableBaseP / usefulLifeMonths)) 
- Removed the float epsilon fudge in the fully-depreciated check: replaced `Math.round((accumulated + amount) * 100) / 100 >= depreciableBase - 0.005` with an exact integer comparison `accumulatedP + amountP >= depreciableBaseP`.
- Kept the rupee `amount` (amountP / 100) as the value posted to the GL, the FinDepreciationEntry, the asset accumulatedDep increment, and the return payload, so the persisted amount is always a clean 2-decimal figure.

**src/actions/export.actions.ts**
- exportInvoices(): replaced the unbounded-feeling take: 10000 with an explicit EXPORT_MAX_ROWS=5000 cap and added a prisma.invoice.count() pre-check that returns a clear user-facing error (with the actual count and the limit) when the dataset exceeds the cap, instead of silently truncating. This prev

**src/schemas/payout.schema.ts**
- [MEDIUM/DATA_CORRECTNESS] vendorId/bookingId no longer let blank values slip through. Replaced `z.string().optional().or(z.literal(""))` with `z.string().optional().transform((v) => (v && v.trim() !== "" ? v : undefined))` for both fields. Empty strings (and whitespace-only) coming from the form's `

**src/actions/notification.actions.ts**
- DEAD_WIRING (finding 1): Removed the exported createNotification server action (formerly lines 128-166). Confirmed via grep that it had ZERO callers anywhere in src/ — all real notification creation goes through the internal helpers notify()/notifyAwait()/notifyAdmins() in src/lib/notify.ts, which a
- Removed the now-unused `import { Prisma } from "@prisma/client"` import (it was only referenced by createNotification's Prisma.InputJsonValue / Prisma.JsonNull), keeping imports valid. The separate `import type { NotificationType }` is retained since it's still used by the NotificationItem type.

**src/app/(dashboard)/marketing/page.tsx**
- [MEDIUM/RBAC] Changed the canManage permission check from 'marketing:read' to 'marketing:manage' (line ~53). The 'Campaigns & spend' button now only renders for users who can actually create/edit campaigns, matching the variable name's intent and the inline comment that spend entry lives under marke

**src/app/(dashboard)/marketing/_components/marketing-dashboard.tsx**
- [LOW/ERROR_HANDLING] applyRange(): added toast.error feedback when getChannelAttribution()/getCampaignAttribution() return success:false. Previously the failure branch was silently ignored, leaving the user with no indication the date-range filter failed. Now surfaces the server-provided error messa
- [LOW/ERROR_HANDLING] resetRange(): same fix applied — toast.error on the failure branch of both attribution fetches with server error message and fallback.
- Added `import { toast } from "sonner";` (the established toast import used across the marketing module, e.g. marketing-campaign-form.tsx and marketing-campaign-table.tsx).

**src/actions/marketing-campaign.actions.ts**
- Bounded the unbounded findMany in getMarketingCampaigns() (line ~52) by adding take: 1000. The existing orderBy is [{isActive:'desc'},{createdAt:'desc'}], so the cap keeps active campaigns and the most recent rows, covering all real use cases while preventing memory exhaustion / slow queries at scal

**src/app/(dashboard)/marketing/campaigns/_components/marketing-campaign-form.tsx**
- Finding 1 [LOW/UX]: spendToDate number input now explicitly parses the input to a number. Changed onChange={(e) => field.onChange(e.target.value)} to onChange={(e) => field.onChange(Number(e.target.value) || 0)} at line 248. This makes the managed data type explicit (number, not string), and the `||

**src/actions/whatsapp.actions.ts**
- Idempotency/dedup guard (Finding 1): bulkSendWhatsApp now de-duplicates the incoming contactIds (Set) so a contact repeated in the same request is messaged once, AND adds a 60s recent-duplicate guard — before sending it queries WhatsAppMessage for existing OUTBOUND rows with the same (contactId, tem
- Partial/all/none outcome distinction (Finding 1): the response now returns an `outcome: 'all'|'partial'|'none'` discriminator plus `duplicateSkipped`, computed from sent vs failed among attempted contacts, so callers can tell apart full success, partial failure, and total failure instead of always s
- Template whitelist validation: bulkSendWhatsApp now rejects any templateName not present in WHATSAPP_TEMPLATES ('Unknown WhatsApp template') instead of forwarding an arbitrary template to the provider.
- Bounded input: bulkSendWhatsAppSchema.contactIds capped at max 500 to prevent an unbounded send loop / runaway request.
- Awaited fire-and-forget write: changed `logActivity(...)` to `await logActivity(...)` so the audit-log write completes before the serverless function returns (prevents dropped activity rows).
- Caller UX (bulk-whatsapp-dialog.tsx): updated SendResult type (added optional duplicateSkipped, outcome) and the toast logic to show an error toast when all sends failed, a warning toast on partial success (sent X, Y failed), and success only when sends actually succeeded — previously it showed only

**src/app/(dashboard)/whatsapp/_components/conversation-list.tsx**
- [LOW/UX] Added an unread/needs-reply indicator to the conversation list using data already present on ConversationSummary (lastDirection). When the last message is INBOUND and the conversation is not the currently selected one (needsReply), the item now shows: a small emerald dot before the contact 

**src/app/(dashboard)/my-work/_components/workqueue.tsx**
- [LOW/UX] TaskRow keyboard accessibility: Added onKeyDown handler to the clickable TableRow so Enter and Space trigger onOpen() (with preventDefault on Space to avoid page scroll). Also made the row focusable (tabIndex={0}), gave it role="button" semantics, an aria-label ("Open task: <title>"), and a

