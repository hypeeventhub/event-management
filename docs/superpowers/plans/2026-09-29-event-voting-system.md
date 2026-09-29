# Event Voting System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build event-scoped voting with admin subject management, QR-backed public ballots, one vote per registration per subject, and a private full-screen live leaderboard.

**Architecture:** Laravel owns voting integrity, opaque-slug lookup, lifecycle transitions, vote validation, and result aggregation. Next.js provides standalone admin management and leaderboard pages plus a public mobile ballot; SWR polls the lightweight result endpoint every three seconds only while voting is active and the page is visible.

**Tech Stack:** Laravel/PHP, Eloquent, Sanctum role middleware, Pest, Next.js 16 App Router, React 19, SWR, Axios, Tailwind CSS, shadcn/ui, `qrcode`, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-29-event-voting-system-design.md`

## Global Constraints

- All admin voting screens are full-page routes without the dashboard sidebar or navbar.
- Only the owning admin may manage an event's voting subjects or see results; scanners and other admins are denied.
- Every confirmed registration for the subject's event may vote regardless of check-in status.
- Each registration may vote once per voting subject; database uniqueness is authoritative.
- Public routes use 64-character opaque SHA-256 slugs and never expose counts, rankings, registration data, or admin state.
- Subjects transition `draft -> active -> closed`; reopening is not included.
- Public voting accepts one contestant per submission and stores `registration_id`, never a copied registration code.
- The leaderboard polls every three seconds only when active and visible, preserves stale results on a polling error, and stops when closed.
- Use the existing `qrcode` dependency; add no real-time or QR dependency.
- Follow TDD for every behavior and preserve unrelated working-tree changes.

## Review Focus

- Registration codes containing lowercase letters or surrounding whitespace normalize to the valid code; Task 3 pins this with a public vote test.
- Simultaneous duplicate submissions cannot create two votes; Task 3 pins this with the database constraint and conflict response test.
- A contestant ID from another subject is rejected without leaking that contestant; Task 3 pins this with a validation test.
- Equal vote totals retain equal counts/percentages and deterministic display order; Task 4 pins this with a tie-ranking test.
- A tab hidden during active voting stops requests and resumes at the three-second cadence when visible; Task 8 pins this with polling-policy tests.

---

### Task 1: Voting Persistence and Relationships

**Files:**
- Create: `../event-api/database/migrations/2026_09_29_010000_create_voting_tables.php`
- Create: `../event-api/app/Models/VotingSubject.php`
- Create: `../event-api/app/Models/VotingContestant.php`
- Create: `../event-api/app/Models/VotingVote.php`
- Modify: `../event-api/app/Models/Event.php`
- Modify: `../event-api/app/Models/Registration.php`
- Test: `../event-api/tests/Feature/VotingManagementTest.php`

**Interfaces:**
- Produces: `Event::votingSubjects(): HasMany`, `Registration::votingVotes(): HasMany`.
- Produces: `VotingSubject::{event,contestants,votes}`, `VotingContestant::{subject,votes}`, and `VotingVote::{subject,contestant,registration}` relationships.
- Produces: statuses `VotingSubject::STATUS_DRAFT`, `STATUS_ACTIVE`, and `STATUS_CLOSED`.

- [ ] **Step 1: Write the failing persistence test**

Add `an event persists ordered contestants and one vote per registration per subject`. Assert relationship traversal, `display_order`, cascade behavior, and that a second vote for the same `(voting_subject_id, registration_id)` raises a unique-constraint error while the same registration can vote in another subject.

- [ ] **Step 2: Run the focused test and verify RED**

Run from `event-api`: `php artisan test --filter="an event persists ordered contestants"`

Expected: FAIL because the voting tables and models do not exist.

- [ ] **Step 3: Add the migration**

Create the three tables specified in the design. Use foreign keys, `display_order` defaulting to `0`, indexed subject status, an index on `(voting_subject_id, voting_contestant_id)`, and a unique index on `(voting_subject_id, registration_id)`.

- [ ] **Step 4: Add models and relationships**

Define fillable attributes and relationship return types. `VotingSubject::getRouteKeyName(): string` returns `slug`; status remains a string field. Add the two parent relationships without changing existing event or registration behavior.

- [ ] **Step 5: Run the focused and full backend tests**

Run: `php artisan test --filter=VotingManagementTest`

Expected: PASS.

Run: `php artisan test`

Expected: existing and new tests PASS.

- [ ] **Step 6: Commit backend persistence**

```bash
git add database/migrations/2026_09_29_010000_create_voting_tables.php app/Models/VotingSubject.php app/Models/VotingContestant.php app/Models/VotingVote.php app/Models/Event.php app/Models/Registration.php tests/Feature/VotingManagementTest.php
git commit -m "feat: add event voting persistence"
```

### Task 2: Admin Subject Management and Lifecycle API

**Files:**
- Create: `../event-api/app/Http/Controllers/VotingSubjectController.php`
- Create: `../event-api/app/Http/Requests/StoreVotingSubjectRequest.php`
- Create: `../event-api/app/Http/Requests/UpdateVotingSubjectRequest.php`
- Modify: `../event-api/routes/api.php`
- Modify: `../event-api/tests/Feature/VotingManagementTest.php`

**Interfaces:**
- Consumes: voting relationships and status constants from Task 1.
- Produces: `GET|POST /api/events/{event:slug}/voting-subjects`.
- Produces: `GET|PATCH|DELETE /api/events/{event:slug}/voting-subjects/{subject:slug}`.
- Produces: `POST .../{subject:slug}/activate` and `POST .../{subject:slug}/close`.
- Produces subject JSON `{id,slug,title,status,contestant_count,total_votes,contestants,public_url}` as appropriate for list/detail responses.

- [ ] **Step 1: Write failing authorization, validation, CRUD, and lifecycle tests**

Cover owner success, scanner `403`, another admin `404`, cross-event subject `404`, title trimming, at least two unique contestant names, case-insensitive duplicate rejection, 255-character limits, hashed slug shape, ordered contestant replacement while draft, and valid `draft -> active -> closed` transitions.

Also assert active/closed subjects cannot be edited or deleted and activation requires at least two contestants.

- [ ] **Step 2: Run the management tests and verify RED**

Run: `php artisan test --filter=VotingManagementTest`

Expected: FAIL with missing routes/controller responses.

- [ ] **Step 3: Add request validation**

`StoreVotingSubjectRequest::rules(): array` and `UpdateVotingSubjectRequest::rules(): array` accept `title: required|string|max:255` and `contestants: required|array|min:2|max:250`, with each `name` required, trimmed, and at most 255 characters. Add post-validation case-insensitive uniqueness after trimming.

- [ ] **Step 4: Implement owner-scoped CRUD**

Create `VotingSubjectController::{index,store,show,update,destroy}`. Generate slugs with `hash('sha256', Str::random(64))` and retry on collision. Resolve subjects through `$event->votingSubjects()` to prevent cross-event access. Store/update the subject and ordered contestants in a transaction.

- [ ] **Step 5: Implement lifecycle endpoints**

Add `activate()` and `close()` using a locked subject row and exact current-state checks. Return `409` for invalid transitions and stable messages. Never implement reopening.

- [ ] **Step 6: Register admin routes and run tests**

Place routes inside the existing `auth:sanctum` plus `role:Admin` group.

Run: `php artisan test --filter=VotingManagementTest`

Expected: PASS.

Run: `vendor/bin/pint --test app/Http/Controllers/VotingSubjectController.php app/Http/Requests/StoreVotingSubjectRequest.php app/Http/Requests/UpdateVotingSubjectRequest.php app/Models/VotingSubject.php app/Models/VotingContestant.php app/Models/VotingVote.php routes/api.php`

Expected: PASS.

- [ ] **Step 7: Commit the admin API**

```bash
git add app/Http/Controllers/VotingSubjectController.php app/Http/Requests/StoreVotingSubjectRequest.php app/Http/Requests/UpdateVotingSubjectRequest.php routes/api.php tests/Feature/VotingManagementTest.php
git commit -m "feat: add voting subject management API"
```

### Task 3: Public Ballot and Transactional Vote Submission

**Files:**
- Create: `../event-api/app/Http/Controllers/PublicVotingController.php`
- Create: `../event-api/app/Http/Requests/SubmitVoteRequest.php`
- Modify: `../event-api/routes/api.php`
- Create: `../event-api/tests/Feature/PublicVotingTest.php`

**Interfaces:**
- Consumes: subject/contestant/vote models from Task 1.
- Produces: `GET /api/voting/{subject:slug}` returning only `{title,contestants:[{id,name}]}` for active subjects.
- Produces: `POST /api/voting/{subject:slug}/votes` consuming `{registration_code:string, contestant_id:int}` and returning `201 {message:"Your vote has been recorded."}`.

- [ ] **Step 1: Write failing public payload and eligibility tests**

Assert active subject lookup contains no status, event internals, totals, percentages, votes, or registration data. Draft/closed/unknown slugs return the same public `404` response.

Assert a confirmed event registration can vote without a check-in; lowercase and whitespace around its code normalize successfully; a registration from another event and a cancelled registration receive the same `422` invalid-code message.

- [ ] **Step 2: Write failing integrity tests**

Assert another subject's contestant is rejected, a second vote in the same subject returns `409`, the same registration may vote in another subject, and a close occurring before the locked insert prevents submission. Exercise the unique constraint path so concurrent duplicate attempts still produce one row and a `409`, not a `500`.

- [ ] **Step 3: Run public tests and verify RED**

Run: `php artisan test --filter=PublicVotingTest`

Expected: FAIL because public voting routes do not exist.

- [ ] **Step 4: Implement sanitized subject lookup**

`PublicVotingController::show(VotingSubject $subject): JsonResponse` returns only the approved public fields when active. Use a shared private inactive/not-found response so lifecycle information is not disclosed.

- [ ] **Step 5: Implement transactional vote submission**

`PublicVotingController::store(SubmitVoteRequest $request, VotingSubject $subject): JsonResponse` normalizes with `Str::upper(trim(...))`, locks and rechecks the subject, resolves the contestant through the subject, and resolves a `confirmed` registration through the subject event. Convert the unique-index violation into the stable duplicate `409` response.

- [ ] **Step 6: Register throttled public routes and verify**

Register the two routes outside `auth:sanctum` with Laravel throttling; set stricter throttling on POST than GET without using user-controlled host data.

Run: `php artisan test --filter=PublicVotingTest`

Expected: PASS.

Run: `php artisan test`

Expected: all backend tests PASS.

- [ ] **Step 7: Commit public voting**

```bash
git add app/Http/Controllers/PublicVotingController.php app/Http/Requests/SubmitVoteRequest.php routes/api.php tests/Feature/PublicVotingTest.php
git commit -m "feat: add public event voting"
```

### Task 4: Private Leaderboard Aggregation API

**Files:**
- Create: `../event-api/app/Http/Controllers/VotingResultController.php`
- Modify: `../event-api/routes/api.php`
- Create: `../event-api/tests/Feature/VotingResultsTest.php`

**Interfaces:**
- Consumes: owner-scoped event and subject relationships.
- Produces: `GET /api/events/{event:slug}/voting-subjects/{subject:slug}/results`.
- Produces JSON `{event,subject,total_votes,total_registrations,participation_percentage,contestants:[{id,name,display_order,votes,percentage}]}`.

- [ ] **Step 1: Write failing aggregation and privacy tests**

Create literal fixtures and assert exact totals and percentages, including zero votes, 0% participation, a tie, deterministic ordering by votes descending then `display_order` then ID, and all registered attendees in the participation denominator. Assert owner-only access, scanner `403`, other admin/cross-event `404`.

- [ ] **Step 2: Run result tests and verify RED**

Run: `php artisan test --filter=VotingResultsTest`

Expected: FAIL with missing endpoint.

- [ ] **Step 3: Implement one aggregated result query**

`VotingResultController::show(Request $request, Event $event, string $subject): JsonResponse` resolves the owned subject and uses `withCount('votes')` for contestants. Calculate percentages with zero-safe division and two-decimal rounding; do not load raw vote or registration records.

- [ ] **Step 4: Register route and verify query behavior**

Register inside the admin role group. Use a query-count assertion or query log in the large-fixture test to ensure the endpoint does not issue one query per contestant.

Run: `php artisan test --filter=VotingResultsTest`

Expected: PASS.

- [ ] **Step 5: Commit result aggregation**

```bash
git add app/Http/Controllers/VotingResultController.php routes/api.php tests/Feature/VotingResultsTest.php
git commit -m "feat: add private voting leaderboard API"
```

### Task 5: Voting Navigation, Route Authorization, and Standalone Layouts

**Files:**
- Create: `lib/voting-navigation.mjs`
- Create: `tests/voting-navigation.test.mjs`
- Modify: `lib/role-routing.mjs`
- Modify: `tests/role-routing.test.mjs`
- Modify: `components/dashboard/event-cards.js`
- Modify: `app/page.js`
- Modify: `components/dashboard/event-dialogs.js`
- Create: `app/events/[id]/voting/layout.js`
- Create: `app/events/[id]/voting/[subject]/leaderboard/layout.js`
- Create: `app/vote/[slug]/layout.js`

**Interfaces:**
- Produces: `getVotingHref(event): string|null` using `event.sourceId`.
- Produces: admin route authorization for `/events/:slug/voting` and nested leaderboard routes.
- Produces metadata titles `Voting`, `Voting Leaderboard`, and `Vote`.

- [ ] **Step 1: Write failing navigation and authorization tests**

Assert saved events map to `/events/{encodedSourceId}/voting`, unsaved events return `null`, admins may access voting routes, and scanners may not. Preserve all existing role-routing expectations.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/voting-navigation.test.mjs tests/role-routing.test.mjs`

Expected: FAIL because the helper and route rules are missing.

- [ ] **Step 3: Implement routing helpers and dashboard link**

Replace the voting icon's modal callback with a Next.js `Link` only when `getVotingHref(event)` is non-null. Remove `operationType="voting"`, the placeholder `VotingPanel`, and voting dialog metadata while preserving unrelated event dialogs.

- [ ] **Step 4: Add standalone metadata layouts**

Each layout returns `children` directly; do not import sidebar or top-header components.

- [ ] **Step 5: Verify frontend routing changes**

Run: `node --test tests/voting-navigation.test.mjs tests/role-routing.test.mjs`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit navigation**

```bash
git add lib/voting-navigation.mjs tests/voting-navigation.test.mjs lib/role-routing.mjs tests/role-routing.test.mjs components/dashboard/event-cards.js app/page.js components/dashboard/event-dialogs.js app/events/[id]/voting/layout.js app/events/[id]/voting/[subject]/leaderboard/layout.js app/vote/[slug]/layout.js
git commit -m "feat: add standalone voting routes"
```

### Task 6: Admin Voting Subject Management and QR Download

**Files:**
- Create: `lib/voting-subjects.mjs`
- Create: `tests/voting-subjects.test.mjs`
- Create: `components/voting/voting-subject-form.js`
- Create: `components/voting/voting-subject-card.js`
- Create: `components/voting/voting-qr-dialog.js`
- Create: `app/events/[id]/voting/page.js`

**Interfaces:**
- Consumes: Task 2 admin endpoints and Task 5 admin route gate.
- Produces: `normalizeContestants(values): string[]`, `validateVotingSubject(input): Record<string,string>`, and `getVotingSubjectActions(status): string[]`.
- Produces: create/edit, activate, close, delete, QR download, and leaderboard navigation UI.

- [ ] **Step 1: Write failing domain-helper tests**

Assert whitespace removal, empty-name removal, case-insensitive duplicate errors, minimum two contestants, maximum 250 contestants, maximum 255-character title/name, and exact action sets for draft/active/closed states.

- [ ] **Step 2: Run helper tests and verify RED**

Run: `node --test tests/voting-subjects.test.mjs`

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement pure subject helpers**

Keep validation and status/action decisions outside React. Match backend limits and return field-level messages the form can display.

- [ ] **Step 4: Build the full-screen management page**

Use `RoleGate`, `useParams`, SWR, and the authenticated `api` client. Render event title, back control, create action, responsive subject cards, explicit loading/empty/error states, and action-specific busy states. Revalidate after successful mutations while retaining dialog input on failure.

- [ ] **Step 5: Build create/edit and lifecycle confirmations**

Use existing shadcn dialog/button/input primitives, not SweetAlert. Support repeatable contestant rows with accessible add/remove controls. Only draft subjects expose edit/delete. Require an in-page confirmation dialog for activate, close, and delete.

- [ ] **Step 6: Build QR display and download**

Use `QRCode.toDataURL(public_url, {width: 320, margin: 2})`, render the canonical URL, and download a PNG named from a sanitized subject title. Handle QR-generation failure in the dialog without closing it.

- [ ] **Step 7: Verify management UI**

Run: `node --test tests/voting-subjects.test.mjs`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 8: Commit admin management**

```bash
git add lib/voting-subjects.mjs tests/voting-subjects.test.mjs components/voting/voting-subject-form.js components/voting/voting-subject-card.js components/voting/voting-qr-dialog.js app/events/[id]/voting/page.js
git commit -m "feat: add voting subject management UI"
```

### Task 7: Public Mobile Voting Page

**Files:**
- Create: `lib/public-voting.mjs`
- Create: `tests/public-voting.test.mjs`
- Create: `app/vote/[slug]/page.js`

**Interfaces:**
- Consumes: Task 3 public lookup and vote endpoints.
- Produces: `normalizeRegistrationCode(value): string` and `getPublicVoteError(error): {message:string,field?:string}`.

- [ ] **Step 1: Write failing normalization and response-mapping tests**

Assert uppercase/trim normalization and distinct mappings for invalid registration `422`, invalid contestant `422`, duplicate `409`, inactive/not-found `404`, rate limit `429`, and network failure. Ensure mapped messages contain no model names, SQL details, registration existence, totals, or rankings.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/public-voting.test.mjs`

Expected: FAIL because public voting helpers do not exist.

- [ ] **Step 3: Implement pure public-voting helpers**

Return stable, actionable messages and field targeting without depending on React or Axios internals beyond `error.response?.status` and the sanitized API message.

- [ ] **Step 4: Build the public ballot page**

Load `/api/voting/{slug}` without `RoleGate`. Render the title, labeled registration-code input, contestant select, and submit action. Disable submission during the request, preserve user input after recoverable errors, and replace the form with a success card after `201`.

- [ ] **Step 5: Verify public privacy and responsiveness**

Confirm the component never renders totals, percentages, ranks, attendee data, or admin controls. Use the existing orange/cream palette, mobile-first spacing, and keyboard-visible focus states.

Run: `node --test tests/public-voting.test.mjs`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit the public ballot**

```bash
git add lib/public-voting.mjs tests/public-voting.test.mjs app/vote/[slug]/page.js
git commit -m "feat: add public voting ballot"
```

### Task 8: Private Full-Screen Live Leaderboard

**Files:**
- Create: `lib/voting-leaderboard.mjs`
- Create: `tests/voting-leaderboard.test.mjs`
- Create: `components/voting/leaderboard-row.js`
- Create: `app/events/[id]/voting/[subject]/leaderboard/page.js`

**Interfaces:**
- Consumes: Task 4 results response and Task 2 lifecycle endpoints.
- Produces: `getLeaderboardRefreshInterval({status,visibilityState}): 3000|0` and `getRankedContestants(contestants): RankedContestant[]` preserving backend tie order.

- [ ] **Step 1: Write failing ranking and polling tests**

Assert descending vote order, deterministic preservation for equal totals, zero-vote percentages, first/second/third visual rank metadata, active-visible interval `3000`, and interval `0` for hidden or closed subjects.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/voting-leaderboard.test.mjs`

Expected: FAIL because leaderboard helpers do not exist.

- [ ] **Step 3: Implement leaderboard helpers**

Treat the backend ordering and percentages as authoritative. Add only presentation metadata and polling policy; never recalculate vote totals from private records.

- [ ] **Step 4: Build the full-screen leaderboard**

Use `RoleGate`, SWR, and `refreshInterval` driven by subject status plus `document.visibilityState`. Render event/subject titles, status, total votes, registration participation, progress bars, podium styling for the first three positions, and the zero-vote empty state. Do not import dashboard navigation components.

- [ ] **Step 5: Preserve stale results during polling errors**

Keep the last SWR data visible, show a connection warning, and allow automatic retry. Provide activate/close controls only for valid states and return to subject management with a clear back action.

- [ ] **Step 6: Verify leaderboard behavior**

Run: `node --test tests/voting-leaderboard.test.mjs`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 7: Commit the leaderboard**

```bash
git add lib/voting-leaderboard.mjs tests/voting-leaderboard.test.mjs components/voting/leaderboard-row.js app/events/[id]/voting/[subject]/leaderboard/page.js
git commit -m "feat: add private live voting leaderboard"
```

### Task 9: End-to-End Verification and Documentation Alignment

**Files:**
- Modify if required by verified defects only: voting files created in Tasks 1–8
- Verify: `docs/superpowers/specs/2026-09-29-event-voting-system-design.md`

**Interfaces:**
- Consumes: the complete backend and frontend voting feature.
- Produces: a verified implementation with no placeholder voting modal and no public result leakage.

- [ ] **Step 1: Run the complete backend suite**

Run from `event-api`: `php artisan migrate --pretend`

Expected: the new forward migration generates valid SQL without modifying or deleting the developer database. Migration execution itself is covered on the isolated test database by the feature suite.

Run: `php artisan test`

Expected: all tests PASS with zero failures.

Run scoped Pint over every new/modified PHP file, then `vendor/bin/pint --test` if the existing repository baseline permits it.

- [ ] **Step 2: Run the complete frontend suite**

Run from `event-management`: `node --test tests`

Expected: all tests PASS with zero failures.

Run: `npm run lint`

Expected: PASS with zero errors.

Run: `npm run build`

Expected: the production build succeeds and lists the voting management, leaderboard, and public vote routes.

- [ ] **Step 3: Perform the manual acceptance flow**

With local Laravel and Next.js services running, verify: owner creates three subjects; QR downloads and opens the matching public form; a registered but unchecked-in attendee votes; duplicate vote is rejected; the same code votes in another subject; leaderboard updates within three seconds; attendee cannot see results; closing blocks new votes; scanner/other admin cannot access admin pages.

- [ ] **Step 4: Check privacy, accessibility, and responsive states**

Inspect public network responses and UI for result leakage. Keyboard-test dialogs/forms, verify focus return and labels, test narrow mobile ballot layout, test full-screen leaderboard without sidebar/navbar, and confirm hidden-tab polling pauses.

- [ ] **Step 5: Review the final diff against the spec**

Run `git diff --check` in both repositories. Confirm every acceptance criterion maps to passing automation or the manual acceptance record, and ensure unrelated user changes are not included.

- [ ] **Step 6: Commit verified integration fixes, if any**

```bash
git add <only voting files changed during verification>
git commit -m "test: verify event voting flow"
```
