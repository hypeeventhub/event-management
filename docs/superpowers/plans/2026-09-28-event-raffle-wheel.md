# Event Raffle Wheel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated, admin-only Wheel of Names page that securely draws and confirms one winner at a time from 1,000+ confirmed event registrations and prevents same-event repeat winners.

**Architecture:** Laravel owns eligibility, cryptographic selection, pending reservations, confirmation, and winner history. Next.js renders a canvas wheel and animates only toward the backend-selected result; it never chooses a winner. `raffle_draws` stores the draw lifecycle while uniquely constrained `raffle_winners` is the authoritative exclusion/history table.

**Tech Stack:** Laravel 12, Eloquent, Pest, MySQL/SQLite-compatible migrations, Next.js 16 App Router, React 19, SWR, Axios, Canvas 2D, Node test runner, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-28-raffle-wheel-design.md`

## Global Constraints

- The raffle is a dedicated page at `/events/{event-slug}/raffle`, never a modal.
- Only the authenticated Admin who owns the event may read or operate its raffle.
- Eligibility means confirmed registration; check-in is not required.
- Winners are excluded only from later draws for the same event.
- One unexpired pending draw is allowed per event and expires after exactly ten minutes.
- The backend uses `random_int`; the browser must not choose a winner.
- No prize-name field or prize configuration is added.
- The page must match the current orange `#F6671E`, cream `#FFF4EE`, white-card dashboard design.
- The wheel must remain responsive with at least 1,000 registrations and must not render one DOM element per attendee.
- Preserve unrelated changes in both repositories.

## Review Focus

- Simultaneous spin requests for one event must resolve to one pending reservation, not two winners; Task 3 exercises this under the event-row lock.
- A pending draw expiring exactly at the ten-minute boundary must stop blocking the pool; Task 3 pins the boundary with a frozen clock.
- A draw ID from another event must never expose or mutate its attendee; Task 3 tests confirm and cancel cross-event rejection.
- A selected winner omitted by large-pool visual sampling must still be inserted into the displayed segments and receive a valid landing angle; Task 4 tests this explicitly.
- A failed confirm or cancel request must retain a recoverable page state without locally removing the attendee; Task 5 tests reducer/state transitions.

---

### Task 1: Raffle Persistence Model

**Files:**
- Create: `../event-api/database/migrations/2026_09_28_000000_create_raffle_tables.php`
- Create: `../event-api/app/Models/RaffleDraw.php`
- Create: `../event-api/app/Models/RaffleWinner.php`
- Modify: `../event-api/app/Models/Event.php`
- Modify: `../event-api/app/Models/Registration.php`
- Test: `../event-api/tests/Feature/RaffleManagementTest.php`

**Interfaces:**
- Produces: `Event::raffleDraws()`, `Event::raffleWinners()`, `Registration::raffleDraws()`, and `Registration::raffleWinner()` relationships.
- Produces: `RaffleDraw` statuses `pending`, `confirmed`, and `cancelled`, plus datetime casts for lifecycle fields.
- Produces: unique database constraint `raffle_winners(event_id, registration_id)`.

- [ ] **Step 1: Write failing persistence tests**

Add tests named:

- `an event stores raffle draw lifecycle records` — create an event/registration, persist a pending draw, and assert relationships and datetime casts;
- `an event registration can only be a raffle winner once` — insert two winner records for the same event/registration and expect a database uniqueness exception;
- `the same attendee can win raffles in different events` — use distinct registrations for the attendee and assert both winner rows persist.

- [ ] **Step 2: Run the new test file and verify RED**

Run: `php artisan test tests/Feature/RaffleManagementTest.php`

Expected: FAIL because the raffle tables/models/relationships do not exist.

- [ ] **Step 3: Implement the migration and models**

Create `raffle_draws` with event, registration, selecting user, lifecycle status/timestamps, and `expires_at`. Create `raffle_winners` with event, registration, unique draw, confirming user, `won_at`, and unique `(event_id, registration_id)`. Add fillable fields, casts, constants, and relationships without changing existing event behavior.

- [ ] **Step 4: Run persistence tests and formatting**

Run:

```powershell
php artisan test tests/Feature/RaffleManagementTest.php
vendor\bin\pint --test app/Models/RaffleDraw.php app/Models/RaffleWinner.php app/Models/Event.php app/Models/Registration.php database/migrations/2026_09_28_000000_create_raffle_tables.php tests/Feature/RaffleManagementTest.php
```

Expected: all Task 1 tests pass and Pint reports `passed`.

- [ ] **Step 5: Commit Task 1 in `event-api`**

```powershell
git add app/Models/RaffleDraw.php app/Models/RaffleWinner.php app/Models/Event.php app/Models/Registration.php database/migrations/2026_09_28_000000_create_raffle_tables.php tests/Feature/RaffleManagementTest.php
git commit -m "feat: add raffle draw persistence"
```

---

### Task 2: Raffle State and Eligibility API

**Files:**
- Create: `../event-api/app/Http/Controllers/RaffleController.php`
- Modify: `../event-api/routes/api.php`
- Modify: `../event-api/tests/Feature/RaffleManagementTest.php`

**Interfaces:**
- Produces: `GET /api/events/{event:slug}/raffle`.
- Produces response `{ data: { event, eligible_attendees, eligible_count, pending_draw, winners } }`.
- Attendee item: `{ registration_id: number, first_name: string, last_name: string, masked_email: string }`.
- Winner item: `{ id, registration_id, first_name, last_name, masked_email, won_at }`.

- [ ] **Step 1: Write failing state-endpoint tests**

Add tests named:

- `the event owner can load confirmed raffle eligibility without check in` — include confirmed checked-in and non-checked-in registrations, rejected/cancelled registrations, a confirmed winner, and an unexpired pending reservation; assert only the two genuinely eligible confirmed registrations are returned;
- `raffle state masks attendee email and omits registration answers` — assert `j***@example.com` and absence of email/answers keys;
- `a non owner and scanner cannot read raffle state` — assert not-found for another Admin and forbidden for Scanner according to route middleware;
- `raffle state supports more than one thousand eligible registrations` — create 1,005 registrations and assert count, unique registration IDs, and bounded query count;
- `raffle state returns winner history newest first` — assert confirmed winners and timestamps in descending order.

- [ ] **Step 2: Run the endpoint tests and verify RED**

Run: `php artisan test tests/Feature/RaffleManagementTest.php --filter="raffle state|raffle eligibility|cannot read"`

Expected: FAIL with route-not-found or 404 because the endpoint is absent.

- [ ] **Step 3: Implement `RaffleController::show(Request $request, Event $event): JsonResponse`**

Add the Admin route. Authorize ownership with the same not-found behavior as `EventController`. Query only confirmed registrations not present in `raffle_winners` and not held by an unexpired pending draw. Select only identity fields, mask emails server-side, return one event-level pending draw, and bound winner history to 100 newest entries.

- [ ] **Step 4: Run endpoint tests and formatting**

Run:

```powershell
php artisan test tests/Feature/RaffleManagementTest.php
vendor\bin\pint --test app/Http/Controllers/RaffleController.php routes/api.php tests/Feature/RaffleManagementTest.php
```

Expected: all Task 1–2 tests pass.

- [ ] **Step 5: Commit Task 2 in `event-api`**

```powershell
git add app/Http/Controllers/RaffleController.php routes/api.php tests/Feature/RaffleManagementTest.php
git commit -m "feat: expose raffle eligibility state"
```

---

### Task 3: Secure Draw, Confirm, and Cancel API

**Files:**
- Modify: `../event-api/app/Http/Controllers/RaffleController.php`
- Modify: `../event-api/routes/api.php`
- Modify: `../event-api/tests/Feature/RaffleManagementTest.php`

**Interfaces:**
- Produces: `POST /api/events/{event:slug}/raffle/draws` returning `{ data: { draw, attendee } }` with HTTP 201.
- Produces: `POST /api/events/{event:slug}/raffle/draws/{draw}/confirm` returning a confirmed winner.
- Produces: `DELETE /api/events/{event:slug}/raffle/draws/{draw}` returning HTTP 200 with cancelled draw state.
- Produces: `RaffleController::PENDING_MINUTES = 10`.
- Consumes: Task 1 models/constraints and Task 2 attendee/winner serializers.

- [ ] **Step 1: Write failing draw-lifecycle tests**

Add tests named:

- `an owner creates one server selected pending draw` — assert selected registration belongs to the eligible set, `selected_by`, `expires_at = selected_at + 10 minutes`, and no winner row yet;
- `a second spin returns the existing unexpired pending draw` — post twice and assert one pending row and the same draw/registration;
- `an expired pending draw is cancelled and releases its registration` — freeze time at exactly ten minutes, spin again, and assert the old draw is cancelled and its registration is eligible unless newly selected;
- `confirming a pending draw records and excludes one winner` — confirm, reload state, and assert the winner appears once and is absent from eligibility;
- `cancelling a pending draw releases the registration` — delete, reload, and assert it is eligible;
- `confirmed winners cannot win again in the same event` — draw repeatedly and assert distinct registration IDs;
- `a winner remains eligible in another event` — confirm in event A and assert inclusion in event B;
- `cross event confirm and cancel are rejected` — use event A route with event B draw and assert not-found with unchanged rows;
- `completed or expired draws cannot be confirmed twice` — assert HTTP 409 and no duplicate winner;
- `an exhausted raffle returns a safe conflict response` — assert HTTP 409 and no model exception text;
- `competing spin requests cannot create two active reservations` — exercise two requests against the same locked event and assert one unexpired pending row.

- [ ] **Step 2: Run lifecycle tests and verify RED**

Run: `php artisan test tests/Feature/RaffleManagementTest.php --filter="pending draw|spin|confirm|cancel|winner|exhausted|competing"`

Expected: FAIL because lifecycle routes/actions do not exist.

- [ ] **Step 3: Implement transactional lifecycle actions**

Add exact controller methods:

- `store(Request $request, Event $event): JsonResponse`;
- `confirm(Request $request, Event $event, RaffleDraw $draw): JsonResponse`;
- `destroy(Request $request, Event $event, RaffleDraw $draw): JsonResponse`.

Each action first verifies ownership and draw/event association. `store` locks the event row, cancels pending draws where `expires_at <= now()`, returns an existing unexpired pending draw, computes eligible IDs, selects with `random_int(0, count - 1)`, and creates the ten-minute reservation. `confirm` inserts `raffle_winners` and transitions the draw in one transaction. `destroy` only cancels pending draws.

- [ ] **Step 4: Run all raffle and existing API tests**

Run:

```powershell
php artisan test tests/Feature/RaffleManagementTest.php
php artisan test
vendor\bin\pint --test app/Http/Controllers/RaffleController.php routes/api.php tests/Feature/RaffleManagementTest.php
```

Expected: raffle tests and the complete Laravel suite pass; Pint reports `passed`.

- [ ] **Step 5: Commit Task 3 in `event-api`**

```powershell
git add app/Http/Controllers/RaffleController.php routes/api.php tests/Feature/RaffleManagementTest.php
git commit -m "feat: add secure raffle draw lifecycle"
```

---

### Task 4: Large-Pool Wheel Model and Canvas

**Files:**
- Create: `lib/raffle-wheel.mjs`
- Create: `tests/raffle-wheel.test.mjs`
- Create: `components/raffle/raffle-wheel.js`

**Interfaces:**
- Produces: `buildWheelSegments(attendees, selectedRegistrationId = null, maxSegments = 120)`.
- Produces: `getWinnerRotation(segments, selectedRegistrationId, completedTurns = 6)`.
- Produces: `formatWheelName(attendee)`.
- Produces: `<RaffleWheel attendees selectedRegistrationId spinning onSpinEnd />` canvas component.

- [ ] **Step 1: Write failing pure-function tests**

Test these behaviors with literal expectations:

- fewer than 120 attendees remain unchanged and in order;
- 1,005 attendees produce exactly 120 evenly sampled segments with unique registration IDs;
- a selected registration absent from the sample replaces one segment and is present exactly once;
- `getWinnerRotation` centers the selected segment after six positive complete turns;
- unknown selected IDs return a safe zero rotation rather than `NaN`;
- formatted labels use first and last name without exposing email.

- [ ] **Step 2: Run wheel tests and verify RED**

Run: `node --test tests/raffle-wheel.test.mjs`

Expected: FAIL because `lib/raffle-wheel.mjs` does not exist.

- [ ] **Step 3: Implement deterministic wheel utilities**

Use index-stride sampling; do not use random client selection. Ensure selected inclusion is deterministic and all return values remain stable across rerenders.

- [ ] **Step 4: Run utility tests and verify GREEN**

Run: `node --test tests/raffle-wheel.test.mjs`

Expected: all wheel utility tests pass.

- [ ] **Step 5: Implement the Canvas component**

Draw segments, abbreviated labels, center hub, pointer, and empty state on a high-DPI Canvas. Animate the containing wheel with CSS transform toward `getWinnerRotation`; invoke `onSpinEnd` once after the transition. Render one canvas element regardless of pool size and respect `prefers-reduced-motion` by shortening—not skipping—the result transition.

- [ ] **Step 6: Run frontend lint and commit Task 4**

Run:

```powershell
node --test tests/raffle-wheel.test.mjs
npm run lint
```

Expected: tests and ESLint pass.

```powershell
git add lib/raffle-wheel.mjs tests/raffle-wheel.test.mjs components/raffle/raffle-wheel.js
git commit -m "feat: add scalable raffle wheel canvas"
```

---

### Task 5: Dedicated Raffle Page and State Flow

**Files:**
- Create: `lib/raffle-state.mjs`
- Create: `tests/raffle-state.test.mjs`
- Create: `app/events/[id]/raffle/layout.js`
- Create: `app/events/[id]/raffle/page.js`
- Modify: `components/dashboard/sidebar.js` only if its active-item behavior needs a Raffle label; do not add a global raffle navigation item.

**Interfaces:**
- Produces reducer states: `loading`, `ready`, `drawing`, `spinning`, `pending`, `confirming`, `confirmed`, `cancelling`, `empty`, `exhausted`, and `error`.
- Consumes Task 2 state endpoint, Task 3 lifecycle endpoints, and Task 4 `RaffleWheel`.

- [ ] **Step 1: Write failing raffle-state tests**

Test:

- state payload with registrations becomes `ready`, zero total registrations becomes `empty`, and zero remaining with winner history becomes `exhausted`;
- draw success stores the backend-selected attendee and enters `spinning`, then animation completion enters `pending`;
- confirm success removes only the confirmed registration and adds the returned winner;
- confirm failure keeps the provisional winner and enables retry;
- cancellation success clears pending selection and restores eligibility;
- cancellation failure preserves pending selection and exposes a safe message;
- raw model lookup text is replaced with a generic recovery message;
- duplicate actions in drawing/spinning/confirming/cancelling states are rejected by `canStartDraw`, `canConfirm`, and `canCancel` selectors.

- [ ] **Step 2: Run state tests and verify RED**

Run: `node --test tests/raffle-state.test.mjs`

Expected: FAIL because the state module is absent.

- [ ] **Step 3: Implement `lib/raffle-state.mjs`**

Export `createRaffleState`, `raffleReducer`, `canStartDraw`, `canConfirm`, `canCancel`, and `getRaffleErrorMessage`. Keep server responses authoritative; never locally manufacture a winner.

- [ ] **Step 4: Run state tests and verify GREEN**

Run: `node --test tests/raffle-state.test.mjs`

Expected: all raffle state tests pass.

- [ ] **Step 5: Build the dedicated page**

Use `RoleGate` for Admin, `Sidebar`, `TopHeader`, SWR, the shared API client, and Task 4 Canvas component. Match the dashboard palette and spacing. Desktop uses wheel/control columns with history below; mobile stacks them. Add back-to-dashboard, remaining count, Spin Wheel, Confirm Winner, Draw Again, loading/error/empty/exhausted states, and newest-first history. Attempt cancellation with the authenticated API client during explicit Draw Again and page cleanup; rely on server expiry if cleanup cannot complete.

- [ ] **Step 6: Add metadata and run page verification**

Set page metadata title to `Raffle`. Run:

```powershell
node --test tests/raffle-wheel.test.mjs tests/raffle-state.test.mjs
npm run lint
npm run build
```

Expected: unit tests, ESLint, and Next.js production build pass with dynamic route `/events/[id]/raffle`.

- [ ] **Step 7: Commit Task 5 in `event-management`**

```powershell
git add lib/raffle-state.mjs tests/raffle-state.test.mjs app/events/[id]/raffle/layout.js app/events/[id]/raffle/page.js components/dashboard/sidebar.js
git commit -m "feat: add event raffle page"
```

---

### Task 6: Dashboard Navigation and Modal Removal

**Files:**
- Create: `lib/raffle-navigation.mjs`
- Create: `tests/raffle-navigation.test.mjs`
- Modify: `components/dashboard/event-cards.js`
- Modify: `components/dashboard/event-dialogs.js`
- Modify: `app/page.js`

**Interfaces:**
- Consumes: Task 5 route `/events/{event.sourceId}/raffle`.
- Produces: `getRaffleHref(event)` returning the dedicated route or `null` for an unsaved event.
- Produces: ongoing-event raffle icon as an accessible link with `aria-label="Open raffle"` and title `Raffle`.

- [ ] **Step 1: Write a failing navigation behavior test**

Create tests for `getRaffleHref(event)`. Assert a persisted event with `sourceId = "hashed-slug"` produces `/events/hashed-slug/raffle`, while an event without a backend source ID returns `null`.

- [ ] **Step 2: Run the navigation test and verify RED**

Run: `node --test tests/raffle-navigation.test.mjs`

Expected: FAIL because the helper/route behavior is absent.

- [ ] **Step 3: Replace modal launch with page navigation**

Implement `getRaffleHref(event)` in `lib/raffle-navigation.mjs` and render the raffle icon as a Next.js `Link` only when it returns a route. Remove `RafflePanel`, raffle dialog metadata, and raffle conditional rendering from `event-dialogs.js`. Ensure `app/page.js` no longer sets `operationType = "raffle"`; preserve voting and other dialogs.

- [ ] **Step 4: Run final verification**

Backend:

```powershell
php artisan test
vendor\bin\pint --test app database/migrations routes tests
```

Frontend:

```powershell
node --test tests/*.test.mjs
npm run lint
npm run build
```

Expected: all backend/frontend tests pass, Pint reports `passed`, ESLint exits 0, and Next.js build exits 0.

- [ ] **Step 5: Perform security and scale smoke checks**

Using seeded/local test data, verify:

- Scanner cannot open the API/page;
- another Admin cannot access the event raffle;
- 1,005 registrations render one canvas and remain interactive;
- two browser tabs show the same active pending draw;
- confirmation removes the winner after refresh;
- the raffle icon never opens a modal.

- [ ] **Step 6: Commit Task 6 in `event-management`**

```powershell
git add lib/raffle-navigation.mjs tests/raffle-navigation.test.mjs components/dashboard/event-cards.js components/dashboard/event-dialogs.js app/page.js
git commit -m "feat: route ongoing events to raffle page"
```

---

### Final Review

- [ ] Request an independent whole-change review against the approved specification.
- [ ] Fix every Critical or Important finding test-first.
- [ ] Rerun the complete backend and frontend verification commands after the final fix.
- [ ] Confirm `git diff --check` in both repositories and report any unrelated pre-existing working-tree changes without modifying them.
