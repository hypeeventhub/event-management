# Event Name Picker Raffle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the registration-backed wheel with an admin-only, event-slug Name Picker that persists an editable name pool and records name-only winner history.

**Architecture:** Laravel owns the event-scoped name entries, settings, server-random pending draw, confirmation, and winner history. Next.js renders a full-viewport name picker without dashboard navigation chrome and a separate in-route Settings screen. The browser parses attendee exports locally and sends only names to the API.

**Tech Stack:** Laravel 12, Eloquent, Pest, Next.js 16, React 19, SWR, Axios, Node test runner, Tailwind CSS, `xlsx` browser parser.

**Spec:** `docs/superpowers/specs/2026-09-29-name-picker-raffle-design.md`

## Global Constraints

- Keep `/events/{event-slug}/raffle`; no raffle modal or public raffle route.
- Only the owning Admin can view or mutate raffle data; Scanner users are denied.
- The raffle page renders neither `Sidebar` nor `TopHeader`; its picker layout follows `https://pinkylam.me/playground/random-name-picker/` as the visual and interaction reference.
- The dedicated Settings screen follows the user-supplied purple Settings image: purple field, large heading, paired Names/Import CSV labels, white textarea, toggle, slider, circular theme swatches, and winner rows.
- Names, remove-winners preference, speed, and theme are persisted per event.
- Import only `Name` from `.xlsx` `All Registrants` and CSV exports.
- `raffle_winners` contains `event_id`, `name`, and win timestamp; it has no registration/registrant column.
- Remove Winners defaults on. Duplicate names remain independent entries.
- Winner history changes only after Confirm Winner. Selection remains server authoritative.
- Preserve unrelated working-tree changes.

## Review Focus

- A malformed workbook or CSV never overwrites saved names.
- Duplicate names can be drawn independently even though history stores only names.
- Remove Winners removes exactly the confirmed entry only when enabled.
- Scanner and non-owner direct URLs never expose raffle data.
- 1,000+ names do not create 1,000+ animated DOM nodes.

---

### Task 1: Replace registration raffle schema with name-pool persistence

**Files:**
- Create: `../event-api/database/migrations/2026_09_29_000000_replace_raffle_with_name_pool.php`
- Create: `../event-api/app/Models/RaffleEntry.php`
- Create: `../event-api/app/Models/EventRaffleSetting.php`
- Modify: `../event-api/app/Models/RaffleDraw.php`, `../event-api/app/Models/RaffleWinner.php`, `../event-api/app/Models/Event.php`
- Test: `../event-api/tests/Feature/RaffleManagementTest.php`

**Interfaces:** `RaffleEntry { id, event_id, name, position }`; `EventRaffleSetting { event_id, remove_winners, speed, theme }`; `RaffleWinner { id, event_id, name, won_at }`; `RaffleDraw` references `raffle_entry_id`, not a registration.

- [ ] Write persistence tests for ordered duplicate entries, persisted settings, and a winner row with no registration reference.
- [ ] Run `php artisan test tests/Feature/RaffleManagementTest.php` and observe the missing-schema failure.
- [ ] Add a new forward-only migration (never edit the deployed original raffle migration). Create `raffle_entries` and `event_raffle_settings`, convert draw references to entries, and replace winner registration fields with name/event fields. Add event relationships, casts, indexes, and constraints.
- [ ] Re-run the feature test and `vendor\bin\pint --test app/Models database/migrations/2026_09_29_000000_replace_raffle_with_name_pool.php tests/Feature/RaffleManagementTest.php`.
- [ ] Commit: `feat: persist event raffle name pools`.

### Task 2: Rebuild the admin-only raffle state/settings API

**Files:**
- Modify: `../event-api/app/Http/Controllers/RaffleController.php`, `../event-api/routes/api.php`, `../event-api/tests/Feature/RaffleManagementTest.php`

**Interfaces:**
- `GET /api/events/{event:slug}/raffle` returns event, settings, ordered entries, one pending draw, and paginated newest-first name-only winners.
- `PUT /api/events/{event:slug}/raffle/settings` accepts `{ names, remove_winners, speed, theme }`.

- [ ] Test owning Admin access; Scanner/other-admin denial; trimming/blank omission; duplicate/order retention; and settings surviving a reload.
- [ ] Run `php artisan test tests/Feature/RaffleManagementTest.php --filter="raffle.*settings|raffle.*state|owner|scanner"` and observe failure against the legacy registration payload.
- [ ] Reuse existing event ownership rules. Validate fixed theme keys, bounded speed, name maximum, and atomically upsert settings plus replace ordered entries when no pending draw exists. Return no attendee answers or registration fields.
- [ ] Run the feature tests and Pint for controller, routes, and test file.
- [ ] Commit: `feat: manage event raffle settings`.

### Task 3: Implement name-based draw, confirmation, and cancellation

**Files:**
- Modify: `../event-api/app/Http/Controllers/RaffleController.php`, `../event-api/routes/api.php`, `../event-api/tests/Feature/RaffleManagementTest.php`

**Interfaces:**
- `POST /api/events/{event:slug}/raffle/draws` returns a pending draw and `{ id, name }` entry.
- `POST /api/events/{event:slug}/raffle/draws/{draw}/confirm` returns `{ id, name, won_at }`.
- `DELETE /api/events/{event:slug}/raffle/draws/{draw}` cancels one pending draw.

- [ ] Test one pending reservation per event, ten-minute expiry, empty-pool conflict, cross-event rejection, duplicate entry behavior, and both remove-winner paths.
- [ ] Run the focused lifecycle tests and observe the old registration-specific failure.
- [ ] In transactions, lock the event, release expired pending draws, select an entry using `random_int`, and reserve it. Confirm inserts only a name/event winner and conditionally deletes that selected entry. Cancellation only releases the entry.
- [ ] Run `php artisan test`, relevant Pest tests, and Pint; include a 1,000-entry fixture.
- [ ] Commit: `feat: draw raffle winners from name pools`.

### Task 4: Replace frontend raffle domain state

**Files:**
- Modify: `lib/raffle-state.mjs`, `tests/raffle-state.test.mjs`
- Create: `lib/raffle-themes.mjs`, `tests/raffle-themes.test.mjs`

**Interfaces:** State uses entries `{ id, name }`, persisted settings, pending draw, and name-only winner history. Theme helpers export `RAFFLE_THEMES`, `DEFAULT_RAFFLE_THEME`, `DEFAULT_RAFFLE_SPEED`, and `getRaffleTheme(key)`.

- [ ] Replace registration fixtures with name-entry fixtures; test lifecycle transitions, server-authoritative confirmation, retry states, and theme/speed defaults.
- [ ] Run the test files and observe failure before implementation.
- [ ] Remove registration-specific client state and introduce the fixed purple-compatible theme palette/speed bounds.
- [ ] Re-run tests and commit: `refactor: model raffle name picker state`.

### Task 5: Add export-compatible name import and full-screen Settings

**Files:**
- Modify: `package.json`, package lock, `app/events/[id]/raffle/page.js`
- Create: `lib/raffle-name-import.mjs`, `tests/raffle-name-import.test.mjs`, `components/raffle/raffle-settings.js`

**Interfaces:** `parseRaffleNamesFromCsv(text)` and `parseRaffleNamesFromWorkbook(arrayBuffer)` return only ordered name strings. `RaffleSettings` is a full-height in-route screen, never a dialog.

- [ ] Write literal CSV/workbook tests for the exact `All Registrants` sheet and `Name` header, blanks, duplicates, file order, missing headers, missing worksheets, and ignored non-name columns.
- [ ] Run parser tests and observe failure because parser/dependency are absent.
- [ ] Install browser-safe `xlsx`. Parse `.xlsx` only from `All Registrants`; parse CSV only from `Name`. Build the purple Settings screen: name textarea, import action, remove-winners switch, speed slider, theme circles, and name-only winner history. Import appends to the local pool but never auto-saves or replaces data on error.
- [ ] Run parser/state tests, lint, and production build.
- [ ] Commit: `feat: import and configure raffle names`.

### Task 6: Replace the wheel page with a standalone Name Picker

**Files:**
- Modify: `app/events/[id]/raffle/layout.js`, `app/events/[id]/raffle/page.js`, `components/raffle/raffle-wheel.js`, `lib/raffle-navigation.mjs`, `tests/raffle-navigation.test.mjs`
- Create: `components/raffle/name-picker.js`, `tests/name-picker.test.mjs`

**Interfaces:** `NamePicker` receives entries, a server-selected pending entry, speed, and animation callback. It presents loading, empty, ready, animating, pending confirmation, confirmed, and recoverable-error states.

- [ ] Test a bounded visual model for 1,005 names, backend-selected animation completion, reduced-motion confirmation, and unchanged `/events/{slug}/raffle` navigation.
- [ ] Run these tests and observe failure against the registration wheel.
- [ ] Render a full-viewport picker that follows the supplied Random Name Picker reference: a distraction-free animated name stage, concise control hierarchy, prominent current result, and no dashboard shell. Add only compact event context/back and Settings actions around that reference layout. Keep Confirm Winner and Draw Again as the post-animation state; do not import dashboard navigation components. Keep `RoleGate` plus backend authorization.
- [ ] Run frontend tests, lint, build, and manual Admin/Scanner/other-admin access checks.
- [ ] Commit: `feat: add standalone raffle name picker`.

### Task 7: Migration, security, and flow review

**Files:** only test-failure/review-finding files.

- [ ] Run migration compatibility from existing raffle tables and a fresh database; confirm winner history has no registration reference.
- [ ] Run `php artisan test`, Pint, `node --test tests`, `npm run lint`, and `npm run build`.
- [ ] Smoke-test `.xlsx` and CSV imports, refresh persistence, both Remove Winners paths, confirm-before-history, 1,000+ names, no sidebar/top header, and direct URL/API denial for Scanner/other Admin. Perform a visual comparison against the supplied Random Name Picker page and Settings image: picker hierarchy, selected-name emphasis, control placement, purple Settings surface, textarea, switch, speed slider, theme circles, and winner rows must all be recognizable matches.
- [ ] Commit only scoped review fixes after preserving unrelated user work.
