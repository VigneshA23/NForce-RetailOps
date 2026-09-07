# Daily Checklist + History Merge — Design Document

**Branch:** vigneshdev  
**Date:** 2026-09-05  
**Status:** Design only — no code changes

---

## Summary & Recommendation

The merge is already ~60% done by accident. **History is not a nav item** — it lives as a header overlay (clock icon → `setOverlay('history')`), the same way Profile and Settings do. The sidebar nav only has: Home, Daily Checklist, Employees, Categories, Tasks. History has never competed with Daily Checklist for a nav slot.

The merge therefore means:

1. **Absorb History's export/print capability** into Daily Checklist as an inline "Export" menu — no separate page needed.
2. **Elevate Daily Checklist** with date navigation, per-employee breakdown, Admin Corrections UI (already built at backend/API level, zero frontend wiring), and professional additions.
3. **Delete History.tsx** and remove its overlay wiring from DashboardShell.
4. **Net navigation change:** Remove the clock/history icon from the header. One fewer entry point, simpler mental model.

No new backend endpoints needed. Both existing endpoints already support everything this design requires.

---

## Part 1 — Skills

No `/mnt/skills` directory exists in this environment. Project-level skills loaded for this session:
- `nforce-engineering-conventions` — data integrity, audit trails, soft-delete
- `frontend-design` — aesthetic direction
- `ui-ux-pro-max:design` — UX patterns, layout
- `mobile-design`, `micro-interactions`, `web-design-guidelines` (previously installed)

No additional skills were installed for this task — all relevant patterns are already covered.

---

## Part 2 — What Each Page Currently Does (Exhaustive)

### StoreDetail.tsx — current "Daily Checklist" (sidebar nav tab)

**Access:** Sidebar nav item `key: 'store-detail'`, label "Daily Checklist". Always visible.

**Data source:** `GET /api/checklist-history/detail?storeId={id}&date={YYYY-MM-DD}`  
Returns `ChecklistHistoryDetail`: `{ storeId, storeName, date, hasChecklist, categories[] }` where each category has `tasks[]` and each task has `responses[]`.

**What it shows:**

| Section | Detail |
|---|---|
| Stat chips | Total Tasks, Completed, No Response, Issues, Completion % |
| Category badges | `{Name} {completed}/{total}` per category — green if complete, outline otherwise |
| Task table | Category · Task (name + frequency label) · Response (display value) · Employee(s) + time · Status badge |
| MULTIPLE-completion tasks | All responders shown as separate `div` entries in the Employee cell |
| Filter chips | ALL / COMPLETE / OPEN / ISSUE — toggle on/off |
| Date picker | `<input type="date">`, max = today, defaults to today |

**What it does NOT show despite having the data:**
- `latestCorrection` field on each response — returned by API, rendered nowhere
- Admin Corrections UI (no button, no indicator, no modal)
- `currentlyActive` flag on tasks (deactivated-but-has-history tasks are silently mixed in)
- `empId` (EMP-xxx identifier)
- Per-employee contribution breakdown
- Export / CSV / Print
- Live polling (data loads once on storeId/date change — no 15s refresh like EmployeeDashboard)

**"Today" definition:** `new Date().toISOString().slice(0, 10)` — local machine date in ISO format.

**Category-by-category breakdown:** Exists as badge strip (count/total). Not clickable, not expandable.

**Per-employee breakdown:** Absent. Employees appear per-task in table rows, never aggregated by person.

**Admin Corrections:** Not wired. API functions (`correctResponse`, `getCorrectionHistory`), backend service (`AdminCorrectionService`), and full TypeScript types (`AdminCorrectionEntry`, `AdminCorrectionApplyResponse`) all exist. Frontend renders nothing.

---

### History.tsx — "Daily Operations Summary" (header overlay, NOT a nav item)

**Access:** Header clock icon → `setOverlay('history')` in DashboardShell. Also reachable via notification navigation path `/history`. Never appears in sidebar or bottom nav.

**Data source:** `GET /api/checklist-history/operations-summary?startDate={}&endDate={}`  
Returns `{ summary: ChecklistHistorySummaryRow[], details: ChecklistHistoryTaskDetailRow[] }`.  
Note: deliberately takes **no storeId** — backend resolves the caller's authorized store(s).

**What it shows:**

| Section | Detail |
|---|---|
| Summary table | Store · Scheduled · Completed · Completion% · Issues — aggregated across the full date range |
| Task Details table | Store · Date · Category · Task · Status badge · Response · User · Completion Time |
| Date range | Two date inputs (From / To), both default to today, max = today |
| Client-side filters | Category (cascades to) → Task, Status, Response value, User — all built from actual fetched rows |
| CSV export | `buildOperationsReportCsv()` — includes summary block + details block, both in one file |
| Print | `window.print()` with `.history-page__no-print` / `.history-page__print-only` CSS classes |
| Generate Report | Explicit button — does not auto-trigger on date change (prevents accidental large fetches) |
| Date range cap | `MAX_RANGE_DAYS = 92` client-side guard, mirrors backend's `InvalidDateRangeException` |

**Store selection:** None. Correct — backend auto-scopes to the owner's store(s). No picker needed or present.

**Admin Corrections:** Not accessible. No corrections data appears in this view at all.

---

### Exact Overlap Between the Two Pages

| Data / Feature | StoreDetail | History | Overlap? |
|---|---|---|---|
| Task completion data for admin's store | ✅ | ✅ | YES — different shapes |
| Category-level breakdown | ✅ (badges) | ❌ | No |
| Single-day task table | ✅ (rich) | ✅ (flat, as "Task Details") | YES — same data, different format |
| Multi-day range | ❌ | ✅ | No |
| Aggregate summary (Scheduled/Completed/Issues) | ✅ (stat chips) | ✅ (summary table) | YES — same numbers, different UI |
| Per-employee attribution | ✅ (per-task in table) | ✅ (User column in Task Details) | Partial |
| CSV export | ❌ | ✅ | No |
| Print | ❌ | ✅ | No |
| Admin Corrections | ❌ | ❌ | Neither has it |
| Filter by task status | ✅ (chips) | ✅ (dropdown) | Both, different UI |
| Date picker | ✅ (single day) | ✅ (range) | Overlapping |

**Core duplication:** A user viewing today's data in History (start=end=today) sees the same underlying data as StoreDetail — just flatter (no category grouping in the table, Date column added). The stat numbers in History's summary row for today = the stat chips in StoreDetail.

**What is NOT duplicated:** Category progress badges, filter chips, MULTIPLE-completion task responders, metadata frequency labels — all unique to StoreDetail. CSV export, Print, multi-day range, dependent filters — all unique to History.

---

### Current Navigation Confirmed

- `NavTabKey` = `'home' | 'store-detail' | 'employees' | 'categories' | 'tasks'` — History is absent.
- `OWNER_NAV_ITEMS` = 5 items, no History.
- Merging means removing the History overlay entry from DashboardShell's `Overlay` type and the `onHistoryClick` handler from AppShell — no NavTabKey changes.

---

## Part 3 — PRD Requirement #15 / Daily Completion Status

**Clarification on numbering:** In `docs/phase1-audit.md`, item #9 is "Daily completion status — visible at category and overall level" (✅ Fully Implemented). Item #15 is "HTTPS in production." The user's internal PRD may use a different numbering. Based on the described example (per-employee category breakdown), this corresponds to audit item #9 extended with employee attribution — a genuine PRD intent even if the numbering differs.

### What the PRD example means vs. what the data model supports

**PRD example:** "Allen — Preparation: 8/10, Cleaning: 7/8, Closing: 5/6, Overall: 20/24"

This implies: for each employee, count how many tasks they completed (numerator) vs. how many were scheduled that day (denominator), broken down by category.

**The data model reality:**

```
ChecklistHistoryDetail
  └── categories[]
        └── tasks[]
              ├── completionType: 'SINGLE' | 'MULTIPLE'
              └── responses[]
                    ├── employeeFullName
                    ├── employeeUserId
                    └── booleanValue / numericValue / textValue
```

**SINGLE tasks:** At most one response. Attribution is clean — one employee submitted it, or nobody did.

**MULTIPLE tasks:** Multiple responses, each from a different employee. Both Alice and Bob can each submit a response to "Check fridge temp." The task shows as COMPLETE when sufficient responses exist. Neither Alice nor Bob "completed the task" alone; both contributed.

**The problem with the PRD's literal fraction model:** For a MULTIPLE task with 3 responses from 3 employees, whose fraction count does it go into? If it counts for all three, the denominator becomes ambiguous (the task appears in each person's count). If it counts for only the first responder, the others get no credit.

**Recommended interpretation — "Employee Contribution" not "Employee Task Completion":**

Track what each employee actually **submitted**, not abstract "task completion." For each employee:
- **Responses submitted today** (total across all categories)
- **Responses with Issues** (YES_NO answered No)
- **Responses by category** (how many responses they submitted per category)
- **First/last activity time** (when they started and last submitted)

This is meaningful, honest, and fully computable from the existing data with no backend changes. It answers the manager's real question: "Who worked today and how much did they do?"

**What NOT to show:** A denominator like "8/10" implying the employee was supposed to do 10 tasks — because SINGLE tasks completed by someone else don't belong in another employee's denominator. The only honest denominator is MULTIPLE tasks (where each employee is expected to contribute), which varies per task. A clean fraction "X tasks contributed to, Y were issues" is more truthful than a forced "8/10" fraction.

---

## Part 4 — Proposed Merged Page Structure

### Overall Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER (AppShell header)                                        │
│  "Daily Checklist" · "River Way — Store 2"    [Export ▾]        │
├─────────────────────────────────────────────────────────────────┤
│  DATE NAVIGATION BAR                                             │
│  [← Prev Day]  [ Thu, Sep 5, 2026 ▾ ]  [Next Day →]           │
│  [Yesterday]  [Last Week]  [Today]                              │
├─────────────────────────────────────────────────────────────────┤
│  MODE BADGE                                                      │
│  ● LIVE — updates every 60s          OR  📋 Historical · read-only │
│                                                                   │
│  STAT CHIPS (existing)                                           │
│  [Total] [Completed] [Open] [Issues] [%]                        │
│                                                                   │
│  CATEGORY PROGRESS BADGES (existing)                             │
│  Prep 3/5 ·  Cleaning 5/5 ✓ · Closing 1/3                      │
│                                                                   │
│  TREND INDICATOR (new, when data available)                      │
│  ↑ 15% ahead of yesterday's pace at this time                   │
├─────────────────────────────────────────────────────────────────┤
│  OUTSTANDING TASKS (new, today-only, collapsible)                │
│  "3 tasks still open"                                            │
│  ▸ Preparation — Check fridge temp  [Open]                      │
│  ▸ Closing — Lock back entrance     [Issue]                     │
├─────────────────────────────────────────────────────────────────┤
│  EMPLOYEE CONTRIBUTIONS (new, PRD #9 extension)                  │
│  Allen     ████████░░  12 responses · 1 issue                   │
│  Priya     ██████░░░░   9 responses · 0 issues                  │
│  [Expand for category breakdown]                                 │
├─────────────────────────────────────────────────────────────────┤
│  FULL TASK TABLE (existing + corrections wired)                  │
│  Filter: [ALL] [COMPLETE] [OPEN] [ISSUE]                        │
│                                                                   │
│  Category | Task | Response | Employee | Status | [✎ Correct]   │
│  ── Preparation ──────────────────────────────────────────────  │
│  Check fridge  Yes  Allen · 9:12am  ✓ Complete  [✎]            │
│  ← row with correction: ⚠ Corrected · [history icon]           │
└─────────────────────────────────────────────────────────────────┘
```

### Section-by-section specification

**1. Date Navigation Bar**

- Left/right arrows for ±1 day. Right arrow disabled when on today.
- Date picker dropdown (replaces current bare `<input type="date">`). Display: `"Thu, Sep 5, 2026"`.
- Quick-jump pills: "Yesterday" and "Last Week" (same weekday, 7 days back). Both resolve to named dates, not relative. "Today" pill shown when not on today.
- On tab mount: default to today. Browser URL does not change (no routing); state is local.

**2. Mode Badge (today vs. past)**

- TODAY: green "● Live" badge + silent 60-second polling (matches EmployeeDashboard's existing pattern, just at 60s interval for admin).
- PAST DATE: muted "📋 Historical" label. No polling. Clearly signals read-only for submissions; corrections remain fully available.
- "Read-only for submissions" does NOT mean corrections are blocked — Admin Corrections are explicitly for fixing historical records.

**3. Stat Chips + Category Badges**

Unchanged from StoreDetail. These work well.

**4. Trend Indicator**

A single line below category badges, shown only when comparison data is available:
- Fetches yesterday's `detail` for the same store in parallel (second lightweight API call, reuses existing endpoint).
- Computes: `currentPercent - yesterdayPercentAtSameHour`. Not possible to compute "same time yesterday" exactly without response timestamps per category, so approximate: show overall comparison and note "vs. yesterday's final".
- If data unavailable (yesterday had no checklist, or is the store's first day): hide silently.
- Text examples: `↑ Ahead of yesterday (78% vs 63%)` · `↓ Behind yesterday's pace (42% vs 61%)` · `≈ On pace with yesterday`.

**5. Outstanding Tasks (Today only)**

- Shown only when: viewing today AND at least one task is OPEN or ISSUE.
- Collapsible (open by default when issue count > 0, closed when only open tasks remain).
- Sorted: ISSUE tasks first, then OPEN, alphabetical within each group.
- Each item: category name · task name · status badge.
- Clicking a row scrolls to that row in the full task table below (anchor scroll).
- Disappears entirely when viewing a past date (no "outstanding" concept for historical records).

**6. Employee Contributions Section**

One row per employee who submitted at least one response on the viewed date.

Each row:
- Employee name
- Horizontal activity bar (proportional to their response count vs. the day's highest responder)
- Response count + issue count: "12 responses · 1 issue"
- Expand arrow → shows per-category breakdown: "Preparation: 4 responses · Cleaning: 5 · Closing: 3"

**No fraction denominator** — see Part 3 analysis. "12 responses" is honest; "12/15 tasks" is not because MULTIPLE tasks don't have a per-employee target.

For MULTIPLE-completion tasks: each employee who responded gets their response counted. This is correct — they each did work.

Employees with zero responses today (never showed up / no tasks yet): hidden from this section. The outstanding tasks section handles "what's not done"; this section is about who IS working.

**7. Full Task Table (existing + corrections wired)**

Same table as StoreDetail's current StoreDetailTable, with two additions:

*Correction button:* Every row with at least one response gets a small pencil icon button at the right edge. Opens a modal:
- Pre-filled with current response value
- Input for corrected value (same type as original — YES_NO shows toggle, NUMERIC shows number input)
- Required reason textarea
- "Save Correction" → calls `PATCH /checklist-history/responses/{responseId}/correct`
- On success: row updates inline with new display value + correction indicator

*Correction indicator:* Rows where `latestCorrection !== null` show a small amber "Corrected" badge. Click/hover shows: corrected by name, at time, original value → corrected value, reason. Full history accessible via "View all corrections" link inside the indicator (calls `GET /checklist-history/responses/{responseId}/corrections`).

*Repeat-offender flag:* If a task has been OPEN or ISSUE on 3+ of the last 7 applicable days, show an amber warning dot beside the task name. Requires fetching 7 days of detail data on page load — this is a separate parallel call, results cached for the session. Skip if the store has been open < 7 days.

---

## Part 5 — Export Functionality

**Recommendation: inline "Export" menu in the page header, replacing History entirely.**

The Export button (top-right of page) opens a small dropdown:

```
Export ▾
├── Export this day (CSV)
├── Export date range…
│     From: [date]  To: [date]  → Download CSV
└── Print this day
```

**"Export this day (CSV)":** Immediately downloads using the existing `buildOperationsReportCsv()` function. Uses `getChecklistHistoryOperationsReport({ startDate: date, endDate: date })` to get the structured export data (which has the correct shape for the CSV builder — the `/detail` endpoint returns a richer shape not suited for multi-day CSV). No UI needed — one click to download.

**"Export date range…":** Shows a compact inline form: From date + To date (max 92 days) + Download button. Uses the same `getChecklistHistoryOperationsReport` call History currently makes. This is where weekly/monthly reports come from.

**"Print this day":** `window.print()` with print-specific CSS showing a clean report layout for the currently-viewed day's data.

**Why date-range export still belongs here:** A store admin's weekly owner meeting happens every Monday morning. They want "last week's data." The natural flow is: open Daily Checklist, click Export, choose "Export date range…", pick Mon–Sun, download. Having to navigate to a separate History page to do this is an extra step with no benefit.

**Multi-day summary vs. single-day detail in CSV:** The current `buildOperationsReportCsv()` already handles both — it includes a SUMMARY block (per-store totals across the range) and a DETAILS block (per-task rows). This is correct and should be kept as-is.

---

## Part 6 — Date-Range Summary View: Keep or Drop?

**Recommendation: Drop as a standalone view. Absorb into Export.**

History's summary table (Store · Scheduled · Completed · Completion% · Issues, aggregated across a date range) has real value — but its natural habitat is a **downloaded report**, not a screen view. The admin reviews it in Excel or sends it to someone.

Keeping it as a screen view inside the merged page would require a second "mode" (date-range view vs. single-day view), complicating the UI with a mode toggle. The single-day view is the natural primary mode; the range summary is a reporting artifact.

**What genuinely replaces the range summary on-screen:** The trend indicator (Part 4, #4) gives the most useful at-a-glance comparison without requiring a separate range view. For deeper multi-day analysis, the CSV export is the right tool.

**Exception if overruled:** If the user wants to keep the summary table visible on screen, add it as a collapsible "Weekly Summary" section in the Export dropdown showing the last 7 days as a mini table — don't make it a page mode.

---

## Part 7 — Professional Additions Beyond PRD

### 1. Completion Pace Trend Indicator *(high value, low effort)*

**What:** "↑ 15% ahead of yesterday's pace" shown below stat chips.

**Why it matters at small-retail scale:** A store owner doing a mid-day check (e.g., 2pm) doesn't just want to know "42% done" — they want to know if that's good or bad for 2pm. If yesterday at 2pm they were at 55%, today is behind. If yesterday they finished at 61%, today at 42% is a problem worth acting on now, not at end of day.

**Implementation:** Parallel `getChecklistHistoryDetail` for yesterday's date on page mount. Compare completion percentages. No backend changes.

### 2. Outstanding Tasks Section *(high value, already computable)*

**What:** Collapsible section above the full table showing only OPEN and ISSUE tasks when viewing today.

**Why it matters:** The full table can have 30+ tasks. A manager doing a quick check doesn't want to scroll past 25 complete tasks to find the 3 that need attention. "What still needs doing" is the most actionable question an admin has during the workday.

**Implementation:** Pure client-side filter of the already-fetched rows. Zero additional API calls.

### 3. Quick-Jump Date Pills *(medium value, zero effort)*

**What:** "Yesterday" and "This Day Last Week" buttons below the date picker.

**Why it matters:** The two most common historical comparisons a store owner makes are "how did we do yesterday?" (daily review) and "how did the same day last week go?" (weekly pattern analysis). Making them one-click instead of calendar-picker reduces friction from ~5 seconds to ~1 second. Consistent with how calendar apps handle frequent navigation.

### 4. Repeat-Offender Task Flag *(high value, medium effort)*

**What:** Amber warning dot on tasks that have been OPEN/ISSUE on 3+ of the last 7 applicable days.

**Why it matters:** A task missed once is a busy day. Missed three times in a week is either a training gap, an understaffing pattern, or a task nobody knows how to do. At a small retail store (2–10 employees), a manager can't see this pattern without manually reviewing multiple days. This surfaces it automatically, turning passive history data into actionable insight.

**Implementation:** 7 parallel `getChecklistHistoryDetail` calls for the past 7 days (or fewer if store is new). Results cached in session state. Flag computed client-side. Backend unchanged.

**UX note:** Flag is subtle (dot + tooltip), not alarming. "This task has been open 3 of the last 7 days" in the tooltip, not a red warning. Pattern awareness, not blame assignment.

### 5. Employee Activity Summary Expansion *(medium value, fulfills PRD intent)*

**What:** Per-employee contribution card (Part 4, #6) with one-click expansion to per-category breakdown.

**Why it matters at small-retail scale:** With 3–8 employees per shift, a manager needs a quick "who did what" without reading every row of the task table. "Allen: 12 responses (Prep: 4, Cleaning: 5, Closing: 3) · 1 issue" takes 2 seconds to scan. The full task table takes 30 seconds. For a daily end-of-shift review this is the difference between a manager checking every day vs. only when something is obviously wrong.

**Bonus:** This also shows at a glance if any employee hasn't submitted anything yet today (they won't appear in the section), giving the manager a natural prompt to follow up.

---

## Part 8 — File Impact & Implementation Order

### Files affected

| File | Action | Notes |
|---|---|---|
| `frontend/src/pages/StoreDetail.tsx` | Substantially rewritten | Absorbs all new sections |
| `frontend/src/pages/StoreDetail.css` | Extended | New section styles |
| `frontend/src/components/StoreDetailTable.tsx` | Extended | Correction button + indicator + repeat-offender flag |
| `frontend/src/components/StoreDetailTable.css` | Extended | Correction affordance styles |
| `frontend/src/pages/History.tsx` | **Deleted** | After export confirmed working |
| `frontend/src/pages/History.css` | **Deleted** | |
| `frontend/src/pages/History.test.tsx` | **Deleted or migrated** | Key assertions move to StoreDetail.test.tsx |
| `frontend/src/layouts/DashboardShell.tsx` | Modified | Remove `history` from Overlay type, remove `onHistoryClick`; add `headerActions` with Export button |
| `frontend/src/types/navigation.ts` | No changes | History was never a NavTabKey |
| `frontend/src/api/checklistHistory.ts` | No changes | All four endpoints already exist and correct |
| `frontend/src/types/checklistHistory.ts` | No changes | All types already exist |
| `frontend/src/utils/checklistHistoryOptions.ts` | Minor additions | Date navigation helpers (yesterday(), lastWeekSameDay()) |
| `frontend/src/utils/operationsReportExport.ts` | No changes | Used as-is for Export |
| `frontend/src/components/Header.tsx` | Modified | Remove history/clock icon trigger |

### Backend: No changes needed

All four required endpoints already exist:
1. `/checklist-history/detail?storeId&date` — single-day rich view (main page data)
2. `/checklist-history/operations-summary?startDate&endDate` — range export (CSV)
3. `/checklist-history/responses/{responseId}/correct` — corrections (PATCH)
4. `/checklist-history/responses/{responseId}/corrections` — correction history (GET)

### Safe Implementation Order

**Step 1 — Wire Admin Corrections UI** *(lowest risk, pure addition)*  
Add pencil button to StoreDetailTable rows that have responses. Wire `correctResponse` and `getCorrectionHistory` API calls. Add correction modal component. Add amber "Corrected" indicator badge. This is purely additive — no existing behaviour changes. Test on a past date to avoid interfering with live data.

**Step 2 — Date Navigation** *(replace date input, backwards compatible)*  
Replace the bare `<input type="date">` with the arrow + date display + quick-jump pills. Functionally equivalent — still sets a date string state and triggers the same load. Add `yesterday()` and `lastWeekSameDay()` helpers to `checklistHistoryOptions.ts`.

**Step 3 — Today vs. Past Mode Badge + Polling**  
Add the LIVE/Historical mode badge. Add 60-second polling when viewing today (`useEffect` with `setInterval`, cancel on date change or unmount).

**Step 4 — Employee Contributions Section** *(new section, no existing code touched)*  
Compute from already-fetched `detail.categories[].tasks[].responses[]`. No additional API calls. Add collapsible per-category expansion.

**Step 5 — Outstanding Tasks Section** *(pure client-side computation)*  
Filter the existing rows for OPEN/ISSUE. Add the collapsible section above the task table. Add scroll-to-row behavior on item click.

**Step 6 — Trend Indicator** *(requires additional parallel API call)*  
On page mount when viewing today: fetch yesterday's detail in parallel. Compare percentages. Show/hide based on data availability.

**Step 7 — Repeat-Offender Flag** *(7 parallel API calls, cached)*  
On page mount: fetch past 7 days' details in parallel. Compute per-task open/issue counts. Store in session-scoped state (does not re-fetch on date navigation within the same session). Apply amber dot to task table rows.

**Step 8 — Export Menu** *(absorbs History functionality)*  
Add "Export ▾" button to page header via DashboardShell's `headerActions` prop (already supported by AppShell). Wire "Export this day (CSV)" and "Export date range…" using existing `getChecklistHistoryOperationsReport` + `buildOperationsReportCsv`. Wire "Print this day" via `window.print()` with print CSS.

**Step 9 — Remove History overlay** *(final cleanup — do last)*  
Only after Step 8 is confirmed working in production. Remove `history` from `Overlay` type in DashboardShell. Remove `onHistoryClick` prop and clock icon from Header. Delete `History.tsx`, `History.css`, `History.test.tsx`. Migrate any surviving test assertions to `StoreDetail.test.tsx`.

---

## Key Decisions Logged

| Decision | Rationale |
|---|---|
| No fraction denominator in employee breakdown | MULTIPLE tasks make per-employee denominators semantically wrong; contribution count is honest |
| Export absorbs History, not a separate page | Range export is a reporting artifact, not a daily-use view; inline export menu has lower friction |
| No standalone date-range summary view | CSV export replaces it; trend indicator covers the on-screen comparison need |
| 60s polling for today-mode | Matches existing EmployeeDashboard polling cadence; admin view is less time-sensitive than employee |
| Corrections available on past dates | This is the explicit purpose of Admin Corrections — fixing historical mistakes |
| Repeat-offender: 3+ of 7 days threshold | Low enough to surface real patterns; high enough to avoid false alarms from one bad week |
| 7 parallel detail calls for repeat-offender | Acceptable at 2-store scale; cached for session; reconsider if store count grows significantly |
