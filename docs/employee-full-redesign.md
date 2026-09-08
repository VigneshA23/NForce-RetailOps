# Employee Experience — Full Redesign Analysis

> **Scope:** Analysis and design only. No code changes. Covers EmployeeDashboard (today/checklist tab), EmployeeHistory (audits tab), EmployeeIssues (issues tab), navigation structure, and cross-cutting consistency gaps versus the Admin/SA design system.

---

## Part 1 — Skills Check

Searched for relevant open-source skills before starting:

- `npx skills find "employee checklist mobile"` — no relevant results
- `npx skills find "progress tracking PWA"` — no relevant results
- `npx skills find "issue reporting workflow"` — no relevant results

No installed skills apply to this domain. Proceeding with direct analysis.

---

## Part 2 — Current State Mapping

### EmployeeShell (`layouts/EmployeeShell.tsx`)

Three nav tabs rendered as bottom-tab bar on mobile, sidebar on desktop:

| Key | Label | Icon | Component |
|-----|-------|------|-----------|
| `today` | Home | CalendarCheck | `EmployeeDashboard` |
| `audits` | Audit | ClipboardList | `EmployeeHistory` |
| `issues` | My Issues | MessageSquareWarning | `EmployeeIssues` |

Additional overlays (not nav tabs): Profile, Help, Settings, Notifications. Switch Store button appears in header if employee is assigned to multiple stores. `EmployeeSearchDropdown` is available in header context.

### EmployeeDashboard (`pages/EmployeeDashboard.tsx` + `.css`)

This IS the "Home" tab — there is no separate landing page. The checklist renders directly. Key characteristics:

- **Layout:** `max-width: 900px; margin: 0 auto` — centered, generous width
- **StatCards (4):** Completion %, Tasks Done, Remaining, Flags/Issues — using shared `StatCard` component with correct tone mapping (success, info, warning, primary)
- **Categories:** `<details>` accordion elements, all open by default. Each has a category-level progress badge.
- **Task controls:** Three rendering branches by `responseType`: BOOLEAN (Yes/No buttons), NUMERIC (number input + submit), TEXT (textarea + submit). Each has an Undo button when `canUndo` is true.
- **Flagged tasks:** Show `MessageSquareWarning` icon + `flagReason` text inline. Flagged responses do not count toward completion.
- **MULTIPLE completion tasks:** Show "X/Y Completed By" info tooltip with list of responder names. Click/hover/focus toggles tooltip.
- **FAB:** "Raise an Issue" button portaled to `document.body`, always visible. Opens a modal with a textarea. Calls `raiseIssue()` API.
- **No polling.** Checklist loads once on mount (`store.id` change triggers reload). No 15s/60s interval — employee must refresh manually or re-navigate.

### EmployeeHistory (`pages/EmployeeHistory.tsx` + `.css`)

- **Layout:** `max-width: 720px; margin: 0 auto` — narrower than Dashboard
- **Filters:** Date picker (CalendarPopover) + store selector (SearchableSelect). Sticky filter bar at top.
- **Data shape:** `ShiftHistory` — contains categories with tasks, each task having a `TaskStatus` (YES/NO/NOT_ANSWERED).
- **Category icons:** Hardcoded `CATEGORY_ICONS` record keyed by lowercase category name (`preparation → Sunrise`, `cleaning → Sparkles`, `closing → Lock`). Falls back to `Clock`. This is brittle — any owner-defined category name outside these three gets a generic clock icon.
- **Category tones:** Same brittle mapping (`preparation → warning`, `cleaning → success`, `closing → purple`). No `purple` tone exists in `StatCard.css` — this is a CSS class that silently does nothing.
- **Issues in history:** Shown inline within history entries (from `ShiftHistory`).
- **No StatCards.** Just date + store filter + accordion.

### EmployeeIssues (`pages/EmployeeIssues.tsx` + `.css`)

- **Layout:** `max-width: 700px; margin: 0 auto` (from CSS)
- **Tab UI:** Three tabs (Active, Resolved, All) — custom CSS tabs, not shared component
- **Card layout:** `IssueCard` component per issue — shows date, status badge, note text, and resolution text when resolved
- **Custom badge classes:** `emp-issue-badge--open`, `emp-issue-badge--acknowledged`, `emp-issue-badge--resolved` — completely custom CSS, does not use the shared `badge` component
- **Design accent: BLUE (`#2563eb`)** — diverges from Admin/SA red accent (`--color-badge-icon-primary-fg`)
- **No StatCards.** No count tiles. No search.
- **Status info:** ACKNOWLEDGED issues show "The admin has seen this issue and is looking into it." inline hint.

### Cross-Cutting Inconsistencies vs Admin/SA Design System

| Dimension | Admin/SA | Employee (current) | Gap |
|-----------|----------|--------------------|-----|
| Accent color | Red (`--color-badge-icon-primary-fg`) | Blue (`#2563eb`) in Issues | Diverges entirely |
| Badge component | Shared `.badge` classes | Custom `emp-issue-badge--*` classes | Parallel system |
| StatCard tiles | Present on every data page (Home, Issues, Store Detail) | Only on EmployeeDashboard | Missing on History, Issues |
| Tab navigation (filter) | None — SA/Admin use filter pills or native selects | Custom tab markup in EmployeeIssues | No shared pattern |
| Category icons in history | N/A (Admin has no history view) | Brittle name-keyed lookup | Will silently degrade |
| Layout max-width | Varies by page intent | Inconsistent: 900px/720px/700px across three pages | Cosmetic inconsistency |
| Search on issues | Admin Issues has SearchInput | Employee Issues has no search | Missing on employee side |

---

## Part 3 — Home vs. Daily Task: Merge Decision

**Recommendation: keep the merge — no separate Home landing page.**

The merge is already the de facto reality: `'today'` tab renders `EmployeeDashboard`, which IS the checklist. There is no separate landing page component, no "welcome" screen, no quick-access tiles. The employee's job when they open the app is to work their checklist. Interposing a home screen with summary tiles would add a tap and serve no new information that the checklist header doesn't already provide (completion % StatCard is already there).

**What "Home" should mean for an employee:** The checklist, opened instantly, ready to interact. This is correct today. The label "Home" in the nav is appropriate — it is the employee's primary workspace.

**What should improve within the merged page:** The existing checklist page has room for a better "start-of-shift" and "end-of-shift" moment (see Part 4: Daily Task Redesign).

---

## Part 4 — Daily Task Page (EmployeeDashboard) Redesign

### 4.1 Completion Celebration State

**Problem:** When all tasks are done, the page shows 100% in the stat tile and nothing else changes. There is no signal that the employee is finished for the shift. This is a motivational miss — the checklist feels like a task list that never acknowledges completion.

**Proposal:** When `completedTasks === totalTasks && totalTasks > 0`, replace the category accordion list with an "All Done" state:

```
┌─────────────────────────────────────────────────┐
│  ✓  All Done for Today                          │
│     Every task completed. Good shift, [Name].   │
│                                                 │
│  [View History]    [Raise an Issue]             │
└─────────────────────────────────────────────────┘
```

- Displayed below the stat cards, in place of the category list
- Green tone (`--color-badge-icon-success-fg`), large CheckCircle2 icon
- "View History" navigates to the `audits` tab via `setActiveTab('audits')` callback (prop to EmployeeDashboard)
- "Raise an Issue" opens the existing raise-issue modal (same FAB behavior, no FAB needed in this state)
- If a task gets flagged after this state appears, the flagged task causes `completedTasks < totalTasks` → celebration state disappears, category list re-renders with just the flagged category visible

**Implementation note:** The `flagCount` state already tracks flags — but the actual completion-state logic should derive from `completedTasks === totalTasks`, not from `flagCount === 0` alone (flagged tasks already reduce `completedTasks` in the existing `useMemo`).

### 4.2 Progress Bar in Category Header

**Problem:** Category-level progress is shown as a text badge `(2/5)` in the `<summary>` element. On mobile this is small and hard to read at a glance while scrolling quickly.

**Proposal:** Add a thin progress bar below the category title in the `<summary>` element:

```
▼  Preparation          (2/5)
   ████████░░░░░░░░░░░  40%
```

- Same `var(--color-badge-icon-success-fg)` green fill, neutral track
- 4px height, `border-radius: 2px`
- Animates from 0 to actual width on mount (CSS `transition: width 0.3s ease`)
- No new component needed — inline `<div>` inside the existing summary markup

### 4.3 Floating Action Button — Remove or Relocate

**Problem:** The current FAB is portaled to `document.body` and always floats at bottom-right. On mobile with the bottom tab bar, it overlaps the nav rail and can be obscured. The "Raise an Issue" action is conceptually an Issues feature, not a checklist feature.

**Proposal A (preferred):** Remove the FAB from EmployeeDashboard entirely. Move "Raise an Issue" into the EmployeeIssues page as a prominent header action button — same position as the "New Employee" button in the Admin Employees page. The Issues tab becomes the single place for all issue actions (raise + view).

**Proposal B (fallback):** Keep FAB but move it to the shell level with a fixed `bottom: calc(var(--bottom-bar-height) + 16px)` so it clears the nav rail. Add `z-index` ordering so it never overlaps the bottom bar.

Proposal A is better UX: it collapses a cross-cutting concern into the dedicated Issues tab. Only implement B if there is a product reason to keep issue-raising accessible from the checklist directly (e.g., the task that caused the issue is still visible).

### 4.4 Shift-Aware Category Ordering

**Problem:** Categories render in whatever order the API returns them. There is no employee-facing signal about which category is most urgent for the current time of day.

**Proposal:** Do not sort client-side — the owner controls category order for a reason (it reflects their store's workflow). However, add a subtle "Current" indicator to the category whose name matches the employee's shift (e.g., if the employee is on a Morning shift and there's a "Preparation" category, it gets a pill label "Your Shift" or "Active Now").

This requires:
- The employee's shift type available in `EmployeeDashboardProps` (already has `store`, not explicit shift — would need to come from the auth user or a separate field)
- A simple `SHIFT_TO_CATEGORY` mapping (configurable, not hardcoded)

**Assessment:** This is a nice-to-have and introduces coupling between shift names and category names. Defer to a later phase unless shift data is already available in the employee auth context.

### 4.5 No Polling — Add Manual Refresh

**Problem:** The checklist loads once. If another employee completes a MULTIPLE task, the current employee's view is stale until they re-navigate.

**Proposal:** Add a "Refresh" icon button in the category header area (top-right of the task list, not in the app bar). On tap, calls `loadChecklist()`. Show a brief loading indicator. This is less disruptive than silent polling and avoids race conditions with in-flight task submissions.

Alternative: add 60s polling, cancelling any in-flight poll while `pendingTaskId != null`. This matches the pattern used elsewhere in the app (Admin Home uses 60s polling). Either approach is valid.

---

## Part 5 — History Page (EmployeeHistory) Redesign

### 5.1 Replace Brittle Category Icon Lookup

**Problem:** `CATEGORY_ICONS` and `CATEGORY_TONES` are keyed by lowercase category name. Three names are handled (`preparation`, `cleaning`, `closing`). Any other name gets `Clock` and a neutral tone. The `purple` tone referenced for `closing` doesn't exist in the shared CSS — it silently produces no accent color.

**Proposal:**
- Remove the name-based lookup entirely
- Use a single generic icon for all categories in history: `ClipboardList` or `FolderOpen`
- Use `info` tone for all history categories (blue, which exists in StatCard.css as `stat-card--info`)
- If category-specific theming is desired in the future, add it to the category data model (a `color` or `icon` field set by the owner) rather than inferring it from the name client-side

### 5.2 Add StatCards Row

**Problem:** The history page opens to just a filter bar and a blank accordion. There is no immediate summary of what the selected day/date-range contained.

**Proposal:** After the filter bar and before the category accordion, render a 3-tile stat row:

| Tile | Value | Tone |
|------|-------|------|
| Tasks Complete | count of YES across all categories | success |
| Flagged | count of NO | warning |
| Not Answered | count of NOT_ANSWERED | primary (red) |

These derive from the already-loaded `ShiftHistory` data — no additional API call. Use the shared `StatCard` component and `stat-card-row` grid.

### 5.3 Date Display and Empty State

**Problem:** When no history exists for the selected date, the page shows nothing below the filter bar. No empty state illustration or guidance.

**Proposal:** Add an empty state below the filter bar when the history API returns empty or null:

```
No activity recorded for this date.
Tasks only appear here after at least one response has been submitted.
```

Simple `<p>` with `color: var(--color-text-muted)` centered in the content area. Match the pattern used in Admin Issues and other empty states.

### 5.4 Sticky Filter Bar — Mobile Refinement

The filter bar is already sticky (from `EmployeeHistory.css`). On very small screens it can take up too much vertical space when both the date picker and store selector are visible. No structural change needed now, but if the filter bar grows (e.g., adding a shift filter), consider collapsing to a single "Filters" button that expands a drawer — same pattern as the admin's filter-bar on mobile.

---

## Part 6 — Issues Page (EmployeeIssues) Redesign

This is the highest-priority consistency gap. EmployeeIssues is the only employee page that uses a completely different design language from the rest of the app.

### 6.1 Drop the Blue Accent — Align to Design System

Replace all instances of `#2563eb` and the `emp-issue-badge--*` custom classes with the shared badge system. The Issues page should use the same token-driven color system as Admin Issues.

Mapping:
- OPEN → `badge badge--warning` (amber), matching AdminIssues
- ACKNOWLEDGED → `badge badge--info` (blue) is acceptable here since it's status-driven, not an accent color choice
- RESOLVED → `badge badge--success` (green)

Remove `EmployeeIssues.css` custom tab CSS entirely. Replace tab UI with filter pills or a native select (see 6.2).

### 6.2 Replace Custom Tab UI with StatCard Filter Tiles

**Current:** Custom tab bar (Active / Resolved / All) with hardcoded blue active state.

**Proposed:** Three clickable StatCard tiles at the top — same pattern as Admin Issues (Open / Acknowledged / Resolved) — that also act as filters:

| Tile | Value | Tone | Filter Effect |
|------|-------|------|---------------|
| Open | count of OPEN issues | primary (red) | Shows OPEN only |
| Acknowledged | count of ACKNOWLEDGED | info (blue) | Shows ACKNOWLEDGED only |
| Resolved | count of RESOLVED | success (green) | Shows RESOLVED only |

Clicking an already-active tile deselects it (shows all). This is the exact pattern AdminIssues uses. The `stat-card--active` modifier already exists in `StatCard.css` for this purpose.

**Total count context:** Add a small "X issues total" line above the tile row if total > 0.

### 6.3 Replace Card Layout with Table on Desktop

**Current:** Card-per-issue stacked layout. Works on mobile but wastes space on desktop.

**Proposed:** On desktop (≥ 768px), use a data table matching AdminIssues:

| Column | Content |
|--------|---------|
| Date | `formatDate(raisedDate)` |
| Note | Issue text (truncated at 80 chars with title tooltip for full text) |
| Status | Shared badge |
| Admin Response | Response text if RESOLVED, "—" otherwise |

On mobile, keep the card layout (it's appropriate for narrow viewports). Use CSS `@media (--mobile)` to switch between table and cards — same technique used in Admin's employee/owner tables.

### 6.4 Add Raise Issue Button in Page Header

Move issue-raising out of the EmployeeDashboard FAB (see Part 4.3) and into the EmployeeIssues header:

```
[My Issues]                          [+ Raise Issue]
```

Same position and style as "New Employee" in the Admin Employees page. This makes the Issues tab self-contained — an employee comes here both to raise issues and to track them.

The existing raise-issue modal can be reused unchanged.

### 6.5 Add Search

A plain text input filtering by issue note content (client-side, same `SearchInput` component used in Admin pages). Single line above the stat tiles or integrated into the filter bar. Low value on small issue counts, but completes the visual parity with AdminIssues.

---

## Part 7 — Navigation Structure

### 7.1 Current 3-Tab Structure is Correct

The current three tabs — Home (checklist), Audit (history), My Issues — map cleanly to the three things an employee does in the app. A fourth tab (e.g., Profile) is not warranted: profile access via the header avatar/initials is sufficient and matches the Admin/SA pattern.

**No structural change to tab count or shell navigation.**

### 7.2 Label Improvements

| Current | Proposed | Reason |
|---------|----------|--------|
| Home | Checklist | "Home" is vague; "Checklist" tells the employee exactly what they'll see |
| Audit | History | "Audit" sounds formal and external; "History" is clearer to non-accounting staff |
| My Issues | Issues | Saves bottom nav space; possessive "My" is implicit from the scoped data |

Caveat: these are UI label changes only — `EmployeeNavTabKey` values (`'today'`, `'audits'`, `'issues'`) stay unchanged to avoid touching the exhaustive switch and navigation handlers.

**Implementation files:**
- `layouts/EmployeeShell.tsx` — `NAV_ITEMS` array labels
- `types/navigation.ts` — `PAGE_TITLES` if used for header

### 7.3 Notification Badge on Issues Tab

**Problem:** When an admin resolves an employee's issue, the employee has no in-app signal. The notification system handles this but the Issues tab itself has no badge.

**Proposal:** The `useUnreadCount` hook is already in EmployeeShell. Extend it (or add a separate `useOpenIssueCount` hook) to show a badge on the Issues tab when there are ACKNOWLEDGED or RESOLVED issues the employee hasn't "seen" (i.e., issues whose status changed since last visit to the Issues tab). Persist the "last seen" timestamp in localStorage, compare against issue `updatedAt`.

This is a medium-complexity addition — track as a separate, later feature.

---

## Part 8 — Additional Features

### Feature A: "All Done" Shift Completion Moment (High Value)

Described in Part 4.1. Replaces the accordion with a congratulatory state when all tasks are complete. The completion state should also show the final stats (% complete, tasks done, time of completion). Tapping "View History" navigates to the History tab — requires `onNavigate` callback prop added to `EmployeeDashboard`.

**Effort:** Low. No new API call. Pure derived-state rendering.

### Feature B: Persistent Text Draft

**Problem:** TEXT-type tasks have a textarea where an employee types a response. If they navigate away mid-entry (switch tabs, get interrupted), the draft is lost. The employee must retype.

**Proposal:** When `drafts[task.id]` is non-empty and the task has no confirmed response, write it to `localStorage` under key `draft:${store.id}:${task.id}:${todayDate}`. On mount, seed `drafts` from localStorage. Clear the key when the response is submitted or undone.

This is purely additive localStorage hygiene. Does not touch the API. Auto-clears on date rollover because the key includes the date.

**Effort:** Low. ~15 lines of change in `EmployeeDashboard.tsx`.

### Feature C: Category Completion Progress Summary in Header

**Problem:** The page header / stat tiles show total completion, but when the checklist is long (many categories), an employee can't tell at a glance which categories are fully done vs. still need work without scrolling through all accordions.

**Proposal:** Add a compact "category overview" row between the StatCards and the first category accordion:

```
Preparation  ████████████ 3/3  ✓
Cleaning     ████████░░░░ 2/4
Closing      ░░░░░░░░░░░░ 0/3
```

- Thin horizontal bar per category, labeled with category name
- Done categories get a `✓` and green color; in-progress show amber; untouched show neutral
- On mobile, collapse to just icon dots (●●●○) if more than 4 categories exist

**Effort:** Medium. New sub-component `CategoryProgressBar`. Derives from `categories` state already in scope.

---

## Part 9 — File Impact List

Files that will need changes by feature area:

### Issues Redesign (Part 6)

| File | Change |
|------|--------|
| `pages/EmployeeIssues.tsx` | Replace tab UI with StatCard filter tiles; add search; add Raise Issue button; desktop table layout |
| `pages/EmployeeIssues.css` | Replace entirely — remove all `emp-issue-badge--*` and `emp-issues-tab--*` classes; add table layout rules |
| `layouts/EmployeeShell.tsx` | Remove FAB from EmployeeDashboard (if Proposal A taken in Part 4.3) |

### History Redesign (Part 5)

| File | Change |
|------|--------|
| `pages/EmployeeHistory.tsx` | Remove `CATEGORY_ICONS`/`CATEGORY_TONES` lookup; add StatCards row; add empty state |
| `pages/EmployeeHistory.css` | Minor — may need adjustment for StatCards row spacing |

### Daily Task Improvements (Part 4)

| File | Change |
|------|--------|
| `pages/EmployeeDashboard.tsx` | Add "All Done" state; add progress bar per category; remove FAB (if Part 4.3 Proposal A); add `onNavigate` prop for "View History" button |
| `pages/EmployeeDashboard.css` | Add `.employee-dashboard__all-done` block; `.category-progress-bar` styles |
| `layouts/EmployeeShell.tsx` | Pass `onNavigate` callback to EmployeeDashboard if "View History" navigates to audits tab |

### Navigation Label Changes (Part 7.2)

| File | Change |
|------|--------|
| `layouts/EmployeeShell.tsx` | Update `NAV_ITEMS` labels: Home → Checklist, Audit → History, My Issues → Issues |
| `types/navigation.ts` | Update `PAGE_TITLES` for employee nav keys if referenced |

### Text Draft Persistence (Feature B)

| File | Change |
|------|--------|
| `pages/EmployeeDashboard.tsx` | Seed `drafts` from localStorage on mount; write to localStorage on `drafts` change; clear on submit/undo |

No new files need to be created for Part 5/6 assuming EmployeeIssues.css is replaced in-place. Feature A (All Done) and Feature C (Category Progress) may warrant small sub-components but can also live inline in EmployeeDashboard.tsx.

---

## Part 10 — Phased Implementation Order

### Phase 1 — Critical Consistency (do first, highest ROI)

Fixes the design system divergence in EmployeeIssues. No new features, just alignment.

1. **EmployeeIssues redesign** (Part 6.1–6.4)
   - Drop blue accent + custom badge CSS
   - Add StatCard filter tiles (Open / Acknowledged / Resolved)
   - Add desktop table layout
   - Move "Raise Issue" button into Issues page header
   - Remove FAB from EmployeeDashboard
2. **History brittle icon fix** (Part 5.1)
   - Remove `CATEGORY_ICONS`/`CATEGORY_TONES` lookup
   - Use generic icon + `info` tone for all history categories
3. **Nav label updates** (Part 7.2)
   - Home → Checklist, Audit → History, My Issues → Issues

Estimated files touched: 4 (EmployeeIssues.tsx, EmployeeIssues.css, EmployeeHistory.tsx, EmployeeShell.tsx)

### Phase 2 — UX Improvements to Core Checklist

Improves the daily task experience with high-value, low-risk additions.

4. **"All Done" completion state** (Part 4.1, Feature A)
   - Conditional render when `completedTasks === totalTasks`
   - Add `onNavigate` prop to EmployeeDashboard
5. **Category progress bars** (Part 4.2)
   - Thin bar in each category `<summary>` element
6. **History StatCards row** (Part 5.2)
   - 3-tile row (Complete / Flagged / Not Answered) above accordion
7. **History empty state** (Part 5.3)
   - Plain empty message when no history data

Estimated files touched: 3 (EmployeeDashboard.tsx, EmployeeDashboard.css, EmployeeHistory.tsx)

### Phase 3 — Polish and Power Features

Adds persistence and notification features. Lower urgency, higher implementation complexity.

8. **Text draft persistence** (Feature B)
   - localStorage seeding + write + clear on submit/undo
9. **Category progress summary row** (Feature C)
   - Optional overview strip between StatCards and category list
10. **Issues tab notification badge** (Part 7.3)
    - Unread badge on Issues nav tab when issue status changes

Estimated files touched: 2–3 (EmployeeDashboard.tsx, EmployeeShell.tsx, potentially a new `useIssueStatusChange` hook)

---

## Summary

The employee experience has one critical gap (EmployeeIssues uses an entirely different design language) and several quality-of-life gaps (no completion celebration, no history summary tiles, brittle category icon lookup). The navigation structure is sound and should stay at three tabs. Phase 1 alone makes the app feel coherent. Phases 2–3 move from "consistent" to "polished."
