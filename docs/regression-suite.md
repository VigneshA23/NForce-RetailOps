# NForce RetailOps — Regression Suite

Baseline: branch `Maheshwar/dev-work` @ `f3e65707` (2026-11-19). Covers every shipped area from the original checklist through the latest cash work (RTS-291 to RTS-298, RTS-550/551 and the cash flag/history change).

**Roles:** SA = Super Admin, OA = Owner/Admin, EMP = Employee.
**Auto** = covered by an existing automated test (class/file named). **Manual** = needs a human or a new test.
**Priority:** P0 = release blocker, P1 = must pass before release, P2 = run each sprint.

Run order: automated suites first (section 0), then the **Smoke pack** (P0 rows), then the area packs for whatever changed, then the full pack before a release.

**How the "Cover" column was built:** the "Auto" test names were matched from the test files that exist in the repo (class names), not verified row by row against each assertion. Treat them as pointers and confirm when a row is first executed.

## Baseline run, 2026-11-19

| Gate | Result |
|---|---|
| 0.1 `tsc -b` typecheck | Pass |
| 0.2 `vitest run` | 729 / 729 pass |
| 0.3 `mvn test` | 1068 / 1068 pass |
| 0.5 Migrations on PostgreSQL | Not run |

The first run on `f3e65707` had 28 failing tests; all were test-side or a flaky sort, fixed afterwards:
- **Task tests (25):** `requireOwnedTask` needs a live store link (`7d7dd52e`). `TaskServiceTest` now stubs it; `TaskResponseTypePersistenceTest` creates a store and link for its owner.
- **Missed End of Day (2):** counted answers re-sync the order list, so the tests now verify that instead of asserting no interaction.
- **DailyCash future date (1):** the date field is a calendar button capped at today, so the test now checks future days are disabled in the picker.
- **Flaky `MeHistoryServiceTest` correction order:** two corrections in the same instant tied. `ChecklistHistoryService` now breaks the tie by id (a small production change).

---

## 0. Automated gate

| # | Check | Command | Pass criteria |
|---|---|---|---|
| 0.1 | Frontend typecheck + build | `cd frontend && npm run build` | exit 0 |
| 0.2 | Frontend unit/component | `cd frontend && npm test` | 0 failures |
| 0.3 | Backend unit/integration (H2, Flyway off) | `cd backend && mvn test` | 0 failures |
| 0.4 | Checklist contract | `mvn test -Dtest=TodayChecklistContractTest` | passes (fails by design if the checklist DTO changes) |
| 0.5 | Migrations apply to a real PostgreSQL | `mvn spring-boot:run` against a scratch DB | Flyway reaches V122, app boots, `validate` passes. **Tests use H2 with Flyway off, so SQL migrations (V117, V118–V122) are not exercised by 0.3.** |

---

## 1. Authentication, sessions, account (P0)

| ID | Scenario | Role | Expected | Cover |
|---|---|---|---|---|
| AUTH-01 | Login with valid credentials | all | Lands on the role's root screen | Auto `AuthControllerTest`, `Login.test` |
| AUTH-02 | Wrong password x N | all | Generic error, then rate-limited | Auto `LoginRateLimitTest` |
| AUTH-03 | "Remember me" ticked / unticked | all | Token in localStorage / sessionStorage, never both | Auto `authStorage.test` |
| AUTH-04 | Logout, then replay old token | all | 401 (server-side session revoked) | Auto `SessionServiceTest` |
| AUTH-05 | Deactivate a user while logged in | EMP/OA | Next request rejected immediately | Manual |
| AUTH-06 | Forgot password → email link → set new password | all | Token single-use, old password stops working | Auto `PasswordResetFlowTest`, `PasswordResetConcurrencyTest` |
| AUTH-07 | `mustResetPassword` user | all | Only reset screen reachable; other APIs blocked | Auto `AuthControllerTest` |
| AUTH-08 | Reset/welcome emails | all | Ked's Ice Cream branding, ". Please do not reply." wording (RTS-549) | Auto `MailServiceTest`; visual Manual |
| AUTH-09 | Internal job endpoint without/with wrong secret | n/a | 401/403 without `X-Internal-Job-Secret` | Auto `InternalJobSecretRateLimitTest` |
| AUTH-10 | Change email / uniqueness across tables | OA/EMP/SA | Duplicate email refused | Auto `EmailUniquenessServiceTest`, `AccountEmailChangeServiceTest` |

## 2. Roles, store scope, navigation (P0)

| ID | Scenario | Expected | Cover |
|---|---|---|---|
| SCOPE-01 | OA with one store, no `X-Store-Id` | Works | Auto `OwnerStoreScopeTest` |
| SCOPE-02 | OA with several stores | Store picker shown; no header → 404 `STORE_SCOPE_INVALID` | Auto `MultiStoreAdminTest` |
| SCOPE-03 | Header naming a store the OA no longer holds | 404, UI returns to picker | Auto `RevokedStoreLinkAccessTest`, `App.ownerStores.test` |
| SCOPE-04 | EMP hitting another store's data | 404 (masked), not 403 | Auto `MeControllerTest` |
| SCOPE-05 | EMP with no store / several stores / inactive store | `NoStoreAssigned` / `StorePicker` / blocked for deactivated store | Auto `StorePicker.test`, `App.test` |
| SCOPE-06 | Role gates: EMP calling OA/SA endpoints; OA calling SA endpoints | 403 | Auto `CategoryControllerRoleAccessTest`, `SuperAdminAccountControllerTest` |
| NAV-01 | Reload keeps active tab/overlay | Restored from `navigationStorage` | Auto `navigationStorage.test` |
| NAV-02 | A saved owner tab of `cash-target` | Ignored, falls back to home (RTS-550) | Auto `navigationStorage.test`; confirm Manual |
| NAV-03 | Notification click routes to the right tab | Incl. `/cash?date=` → employee Daily Cash | Auto `notificationRoutes.test` |

## 3. Daily checklist and tasks (P0)

| ID | Scenario | Expected | Cover |
|---|---|---|---|
| CHK-01 | Today's checklist is derived at read time | Tomorrow starts fresh; no rollover job | Auto `TodayChecklistContractTest`, `TaskServiceTest` |
| CHK-02 | Task schedule: daily/weekly/monthly/date range | Matches `TaskScheduleMatcher` for live and history | Auto `TaskServiceTest` |
| CHK-03 | SINGLE completion: two employees race | First wins, second gets conflict | Auto `TaskResponsePersistenceTest` |
| CHK-04 | MULTIPLE completion | Needs ≥2 distinct responders | Auto `TaskResponseTypePersistenceTest` |
| CHK-05 | Undo a response | `active=false`, `undoneAt` set, never deleted | Auto `TaskServiceTest` |
| CHK-06 | Create/edit/deactivate/reorder tasks and categories | Persist; deactivated task still in history | Auto `CategoryService*Test`, `TaskFormModal.test` |
| CHK-07 | Task past end date | Deactivated by sweep | Auto `TaskExpirationSweepTest` |
| CHK-08 | Vacant store (admin released) | Employees still see the tasks (`last_owner_id`) | Auto `OwnerDeactivationReassignmentTest` |
| CHK-09 | Checklist load error | Retry button shown | Auto `EmployeeDashboard.test` |
| HIST-01 | Checklist history for a past day | Reconstructed incl. deactivated tasks | Auto `ChecklistHistoryServiceTest` |
| HIST-02 | Employee history view | Shows only own entries | Auto `EmployeeHistory.test`, `MeHistoryServiceTest` |

## 4. Missed tasks, corrections, issues, notifications (P1)

| ID | Scenario | Expected | Cover |
|---|---|---|---|
| MISS-01 | Move a missed task | Lookback 7d / ahead 7d; no auto carry-forward | Auto `TaskMakeupLinkServiceTest`, `MissedTasksControllerTest` |
| MISS-02 | Stale moves | Expire at 3am job | Auto `TaskExpirationSweepTest` |
| CORR-01 | Admin corrects a response | In-place change + immutable `admin_corrections` row | Auto `AdminCorrectionControllerTest` |
| ISS-01 | Raise issue → escalate → resolve | Statuses and unread badge correct | Auto `RaisedIssueServiceTest`, `EmployeeIssues.test`, `AdminIssues.test` |
| ISS-02 | Resolved issues >7 days old | Purged by job | Manual |
| NOT-01 | Bell count, mark read, list | Correct per recipient | Auto `NotificationControllerTest`, `NotificationBell.test` |
| NOT-02 | Notification triggers (issue, flag, etc.) | Right recipient only | Auto `NotificationTriggerTest` |
| JOB-01 | Each of 7 scheduled jobs has a twin `/internal/jobs/**` endpoint | Both run the same service | Manual (checklist in code review) |
| ALERT-01 | SA alerts: zero activity 8pm, overdue issues 9am, owner vacancy hourly | Raised once per condition | Auto `SuperAdminAlertServiceTest` |

## 5. Stock checks and End of Day (P0)

| ID | Scenario | Expected | Cover |
|---|---|---|---|
| STK-01 | Save Start of Day (SOD) | One row per store+item+day; usable = available − dead | Auto `StockCheckServiceTest`, `StockCheckRepositoryTest` |
| STK-02 | Re-save SOD or EOD | Row updated in place; previous values appended to `stock_check_corrections`; first save writes none | Auto `StockCheckServiceTest` |
| STK-03 | EOD save | Order list entry created/synced against tomorrow's minimum (`required_tomorrow`) | Auto `OrderListServiceTest`, `StockCheckServiceTest` |
| STK-04 | Dead stock > available | Rejected | Auto `StockCheckSubmitRequestTest` |
| STK-05 | Yesterday SOD with no EOD | `MISSED_END_OF_DAY` notification once per recipient on first load | Auto `NotificationServiceMissedEndOfDayTest` |
| STK-06 | Answer missed EOD with a count | Saved as normal EOD, entered-by recorded, order list re-synced | Auto `StockCheckServiceMissedEndOfDayTest`, `MissedEndOfDayPanel.test` |
| STK-07 | Answer with "could not count" | Reason ≥5 words; EOD stays null; first responder wins | Auto `MissedEndOfDayServiceTest` |
| STK-08 | Today's SOD while yesterday unanswered | 409 `MissedEndOfDayPendingException`; popup shown first | Auto `StockCheckServiceMissedEndOfDayTest` |
| STK-09 | Stock-check history (OA, date-bounded) and SA history/correction | Filters, pagination, export columns match grid (RTS-303) | Auto `StockCheckHistory.test`, `SuperAdminStockCheckHistory.test`, `stockCheckHistoryExport.test`, `StockCheckServiceSuperAdminCorrectionTest` (RTS-305/306) |
| STK-10 | Stock comparison, select an item | No error (RTS-290) | Auto `StockLevelComparison.test` |
| STK-11 | EOD supplier report | Grouped correctly | Auto `EodSupplierReport.test` |

## 6. Inventory catalogue, suppliers, orders (P1)

| ID | Scenario | Expected | Cover |
|---|---|---|---|
| INV-01 | Add item; duplicate name in same store | Rejected (RTS-301) | Auto `StoreInventoryItemServiceTest`, `InventoryCatalogControllerTest` |
| INV-02 | Add item without preferred supplier | Rejected (RTS-302) | Auto `StoreInventoryItemFormModal.test` |
| INV-03 | Image picker (Unsplash) as OA and SA | Search, select, stored in DB (RTS-299) | Auto `InventoryImagePicker.test`, `InventoryImageControllerTest` |
| INV-04 | Catalogue categories | CRUD, per-store | Auto `InventoryCategoryServiceTest` |
| SUP-01 | Supplier CRUD, store assignment, delete with history | Ownership enforced; delete blocked/handled | Auto `SupplierServiceTest`, `SupplierDeleteIntegrationTest`, `StoreSupplierOwnershipTest` |
| SUP-02 | SA suppliers page and categories-by-store view | Lists/filters correct | Manual |
| ORD-01 | New shortage creates "Needs Ordering" entry | One entry per item/store slot | Auto `OrderListServiceTest` |
| ORD-02 | Advance Needs Ordering → Ordered → Received (RTS-289) | Outstanding entry survives day change; Received frees slot | Auto `ChangeOrderStatusModal.test`, `OrderListControllerTest` |
| ORD-03 | Receive stock / approval | Quantities and approvals correct | Auto `StockReceiptServiceTest`, `StockReceiptApprovalServiceTest` |
| ORD-04 | Orders page for SA; outstanding orders | Matches data | Auto `SuperAdminOperationsServiceOutstandingOrdersTest`, `SuperAdminOrders.test` |
| ORD-05 | Export order list (plain text by supplier) and purchase reports | Content matches grid | Auto `orderListExport.test`, `SupplierPurchaseReport.test` |

## 7. Super Admin: owners, stores, employees (P0)

| ID | Scenario | Expected | Cover |
|---|---|---|---|
| SA-01 | Create store | Store code generated; unowned until assigned | Auto `StoreServiceTest`, `StoreCodeGeneratorTest` |
| SA-02 | Duplicate store name+location | 409 | Auto `StoreServiceTest` |
| SA-03 | Create owner, assign store | Welcome email; link row created | Auto `OwnerManagementServiceAddOwnerTest`, `OwnerProvisioningServiceTest` |
| SA-04 | One OA holds several stores (V116) | Allowed | Auto `MultiStoreAdminTest` |
| SA-05 | Assign a store that has an active admin | 409 `StoreAdminConflictException`; race is serialised | Auto `ConcurrentStoreAssignmentTest` |
| SA-06 | Unassign / deactivate / delete owner | Link soft-released, `last_owner_id` kept | Auto `OwnerDeactivationReassignmentTest` |
| SA-07 | Edit Owner manages the admin's stores (replaces remove icon) | Add/remove works from the modal | Auto `OwnerEditModal.test` |
| SA-08 | Deactivate store | Employees lose access; inactive stores still shown in Edit Employee | Auto `StoreDeactivationReassignmentTest` |
| SA-09 | Search: stores by Store ID, owners by admin ID, top-right search | Match found | Auto `SuperAdminStoreTable.test`, `OwnerTable.test`; Manual for top-right |
| SA-10 | Employee create/edit/status/email | Provisioning and validation | Auto `EmployeeService*Test`, `EmployeeControllerTest` |
| SA-11 | SA checklist and home with no store picked | Stats show dashes | Auto `SuperAdminChecklist.test`, `SuperAdminHome.test` |
| SA-12 | Activity log | Entries recorded and filtered | Auto `ActivityLogControllerTest` |

## 8. Cash — Daily Cash (four fields) (P0)

| ID | Scenario | Role | Expected | Cover |
|---|---|---|---|---|
| CASH-01 | Enter an entry with the four fields only | OA/SA/EMP | Fields: opening drawer, cash removed, cash remaining, other adjustments (signed, optional; blank = 0). The others are required, ≥0, 2 dp | Auto `DailyCashEntryRequestTest`, `DailyCashEntryServiceTest`, `DailyCash.test` |
| CASH-02 | Expected = opening − removed + other; variance = remaining − expected | all | One implementation only | Auto `CashCalculationServiceTest` |
| CASH-03 | Concurrent saves same store/day | all | One row, no duplicate | Auto `CashSaveConcurrencyTest` |
| CASH-04 | Edit a saved day | all | Row updated; old+new appended to `daily_cash_entry_corrections`; first save writes none | Auto `DailyCashCorrectionTest` |
| CASH-05 | OA/SA correction without a reason | OA/SA | Rejected | Auto `DailyCashCorrectionTest` |
| CASH-06 | EMP edits **today's** entry (no reason needed) | EMP | Allowed; other dates → 403 | Auto `MeCashControllerTest` |
| CASH-07 | Pre-V119 entry | all | `entered_by` shown as "Unknown" | Manual |
| CASH-08 | Expected cash on hand as of viewed date | OA/SA | Running sum as of that date; "No data yet" distinct from $0.00 (RTS-295/296) | Auto `ExpectedCashOnHandTest`, `ExpectedCashControllerTest`, `DailyCash.test` |
| CASH-09 | EMP never sees expected cash | EMP | Absent in UI and response | Auto `MeCashControllerTest`; confirm Manual |
| CASH-10 | Dead columns `total_cash_sales`, `bank_deposits` | n/a | Not read or written by the app | Manual (grep) |
| CASH-11 | Money inputs | all | Rejects non-numeric, >2 dp, negative where disallowed | Auto `amountInput.test`, `currency.test` |

### 8a. Cash target (RTS-297, RTS-298, RTS-550)

| ID | Scenario | Expected | Cover |
|---|---|---|---|
| TGT-01 (297 AC1) | SA creates store with Cash target blank | Validation error, save blocked | Auto `StoreFormCashTargetTest`, `StoreCashTargetField.test` |
| TGT-02 (297 AC2) | Negative, non-numeric, 3 decimal places | Error; nothing saved | Auto same |
| TGT-03 (297 AC1) | Valid `0`, `100`, `100.5`, `100.25` | Accepted | Auto same |
| TGT-04 (297 AC3) | Edit store shows saved target and changes it | Value pre-filled; change persists | Auto `StoreFormCashTargetTest`, `SuperAdminStoreTable.test` |
| TGT-05 (297 AC4) | Create store where target save fails | No store row created (single transaction) | Auto `StoreFormCashTargetTest` |
| TGT-06 (297 AC5) | Store details view shows target | Present | Manual (verify in `StoreDetail` / table) |
| TGT-07 | Edit store name only (no `cashTarget` in body) | Target unchanged | Auto `StoreFormCashTargetTest` |
| TGT-08 | Every target change appends `store_cash_target_changes` | Actor recorded | Auto `StoreCashTargetServiceTest` |
| TGT-09 (550) | Cash target tile read-only on Daily Cash for OA and SA; absent for EMP | Visible/hidden correctly | Auto `DailyCash.test`, `SuperAdminCash.test` |
| TGT-10 (550) | Old PUT endpoints removed | PUT → 405/404; GET still works for OA/SA | Manual (only GET mappings found in both controllers) |
| TGT-11 (550) | No Cash Target page, modal or nav entry for any role | Absent | Manual |
| MIG-01 (298 AC1) | Run V117 on a DB with custom targets and a store with no row | All stores = 100.00; missing rows inserted | **Manual on PostgreSQL** (H2 tests don't run migrations) |
| MIG-02 (298 AC2) | Run V117 twice | Same result; backup table not overwritten | Manual on PostgreSQL |
| MIG-03 (298 AC3) | Create store without target | Rejected (see TGT-01) | Auto |
| MIG-04 (298 AC4) | `store_cash_targets_backup_v117` holds pre-reset values | Exists with old amounts | Manual |
| MIG-05 | New row with no amount | Default 100.00 (not V109's 150.00) | Auto `StoreCashTargetPersistenceTest`; confirm on PostgreSQL |

### 8b. Cash flags, resolution, history (latest change, V122)

| ID | Scenario | Expected | Cover |
|---|---|---|---|
| FLAG-01 | OA flags an entry, comment ≥5 words | Flag stored; one open flag per entry | Auto `CashFlagLifecycleTest` |
| FLAG-02 | SA flags via the review screen | Same rules | Auto `SuperAdminCashReviewServiceTest`, `CashFlagLifecycleTest` |
| FLAG-03 | Comment <5 words | Rejected | Auto `CashFlagLifecycleTest` |
| FLAG-04 | Second flag on an already flagged entry | Rejected | Auto `CashFlagLifecycleTest` |
| FLAG-05 | Flag when `entered_by` is unknown / not an employee / inactive / unassigned | Refused | Auto `CashFlagLifecycleTest` |
| FLAG-06 | Flag notifies only the `entered_by` employee, link `/cash?date=` | Correct recipient and tab | Auto `CashFlagLifecycleTest`, `notificationRoutes.test` |
| FLAG-07 | While flagged, only that employee may edit (any date); others 403 | Enforced | Auto `CashFlagLifecycleTest` |
| FLAG-08 | Employee saves → flag resolved `EMPLOYEE_FIXED` (+ optional note) | Resolved | Auto same |
| FLAG-09 | Admin corrects flagged entry → `CORRECTED`; entry removed → `REMOVED` | Resolved | Auto same |
| FLAG-10 | Unflagged entry, EMP edits a past date | 403 | Auto `MeCashControllerTest` |
| HIST-C1 | History shows created / employee edit / admin correction / flag events in order | Built at read time, no write path | Auto `CashFlagLifecycleTest`; UI Manual (`CashHistoryPanel`) |
| HIST-C2 | EMP history only for entries they entered; never sees expected cash | Enforced | Auto `CashFlagLifecycleTest` |
| HIST-C3 | Super Admin review: pick store, view entries, correct, flag | Works end to end | Auto `SuperAdminCashReviewServiceTest`, `SuperAdminCash.test` |

### 8c. Month-End Cash and combined summary (P1)

> Traceability note: commit `f596cfd9` is labelled **RTS-297** but implements Month-End Cash. In Jira RTS-297 is "Cash target on store creation and edit". Month-End Cash needs its own ticket reference.

| ID | Scenario | Expected | Cover |
|---|---|---|---|
| MEC-01 | OA month summary for own store | Flow lines are month totals; expected/actual/variance are the last recorded day | Auto `MonthlyCashSummaryServiceTest`, `MonthlyCashSummary.test` |
| MEC-02 | SA sees every store plus Combined; defaults to All Stores | Combined = sum of stores | Auto `SuperAdminCombinedCashSummaryControllerTest`, `StoreCashSummaryView.test`, `StoreBreakdownTable.test` |
| MEC-03 | Store with no entries | No figures (not $0.00) | Auto `MonthlyCashSummaryServiceTest` |
| MEC-04 | Per-day breakdown reconciles to closing figures | Sums match | Auto `DailyCashBreakdownTable.test` |
| MEC-05 | Month picker, calendar month/year views | Selecting changes data | Auto `MonthPickerPopover.test`, `CalendarPopover.test` |
| MEC-06 | Summary agrees with Daily Cash after the five-field change | Same numbers | Manual |

## 9. UI and cross-cutting (P2)

| ID | Scenario | Expected | Cover |
|---|---|---|---|
| UI-01 | Light/dark theme, header logo panel | Contrast OK; theme toggle in Profile | Auto `Header.test`, `Profile.test`; visual Manual |
| UI-02 | Mobile widths (≤ 480px) for each role | No horizontal page scroll; wide tables scroll with visible bar | Manual |
| UI-03 | No em dashes in UI text (all roles) | None | Manual (grep for "—") |
| UI-04 | Stat card palette and tile colours consistent | Consistent | Manual |
| UI-05 | Help & Guidance content | Current | Manual |
| UI-06 | Pagination / search / select helpers | Work | Auto `usePagedList.test`, `search.test`, `SearchableSelect.test` |
| UI-07 | Report export (Excel, PDF) | Opens and matches grid | Manual |
| UI-08 | 60-second polling | Updates without full reload | Manual |

---

## Smoke pack (run on every build, ~30 min)

AUTH-01, AUTH-04, SCOPE-02, SCOPE-04, CHK-01, CHK-03, STK-01, STK-03, ORD-02, SA-01, SA-05, CASH-01, CASH-02, CASH-06, TGT-01, TGT-04, TGT-09, FLAG-01, FLAG-07, MEC-01, plus section 0.1 to 0.3.

## Release pack additions

Section 0.5 and MIG-01 to MIG-05 on a PostgreSQL copy of production, and a full pass of every P0 row for all three roles.

## Known gaps in automation

1. SQL migrations are never executed by tests (H2, Flyway off). V117 to V122 depend on manual verification.
2. No ESLint; `npm run lint` fails.
3. Scheduled jobs and their `/internal/jobs/**` twins are not asserted to match one another.
4. No end-to-end browser tests; role navigation across shells is only covered by component tests.
5. Visual and mobile layout have no automated checks.
