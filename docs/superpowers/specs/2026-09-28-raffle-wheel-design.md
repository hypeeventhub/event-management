# Event Raffle Wheel Design

## Purpose

Add a dedicated, admin-only Wheel of Names page for each event. The raffle uses all confirmed registrations, selects exactly one provisional winner per spin, and permanently excludes confirmed winners from later draws for the same event. The implementation must remain responsive with more than 1,000 registered attendees and must follow the existing dashboard's visual system.

## Scope

This feature includes:

- a dedicated raffle page reached from the raffle icon on an ongoing event;
- a server-authoritative random draw;
- an explicit winner-confirmation step;
- cancellation and release of an unconfirmed selection;
- event-scoped winner history;
- persistent exclusion of confirmed winners from later draws;
- efficient handling of 1,000 or more confirmed registrations.

This feature does not include prize names, configurable prizes, public raffle access, scanner access, or cross-event winner exclusions.

## Roles and Authorization

Only an authenticated Admin may access raffle endpoints or the raffle page. The Admin must own the event. Unauthorized users and owners of other events receive a not-found response, matching existing event authorization behavior.

The raffle icon is available on an ongoing-event card and navigates to:

`/events/{event-slug}/raffle`

The current modal-based raffle simulator is no longer used by event cards.

## Eligibility Rules

A registration is eligible when all of the following are true:

- it belongs to the selected event;
- its status is `confirmed`;
- it is not attached to a confirmed raffle draw for that event;
- it is not reserved by another pending draw for that event.

Check-in is not required. The pool contains all confirmed registrations, including attendees who have not checked in.

A winner is excluded only from later draws for the same event. Winning does not affect eligibility in unrelated events.

## Data Model

Add a `raffle_draws` table with:

- `id`;
- `event_id`, foreign key with cascade deletion;
- `registration_id`, foreign key with cascade deletion;
- `selected_by`, nullable foreign key to users with null-on-delete behavior;
- `status`: `pending`, `confirmed`, or `cancelled`;
- `selected_at`;
- nullable `confirmed_at`;
- nullable `cancelled_at`;
- `expires_at` for pending-reservation cleanup;
- timestamps.

Add a `raffle_winners` table with:

- `id`;
- `event_id` and `registration_id` foreign keys with cascade deletion;
- `raffle_draw_id`, a unique foreign key to the confirming draw;
- `confirmed_by`, a nullable foreign key to users;
- `won_at`;
- timestamps;
- a unique constraint on `event_id` and `registration_id`.

`raffle_draws` retains the complete pending/cancelled/confirmed draw audit trail. `raffle_winners` is the authoritative exclusion and winner-history table; its unique constraint provides database-level duplicate-winner protection. Indexes on event/status/expiry and event/registration support pool and history queries.

## Draw Lifecycle

### Load raffle state

The page requests the event summary, eligible attendee pool, the event's current unexpired pending draw if one exists, and confirmed winner history.

Attendee payloads contain only:

- registration identifier;
- first name;
- last name;
- masked email.

Registration answers and private attendee fields are not returned.

### Spin

The browser requests a new draw. Laravel starts a database transaction, locks the event and relevant draw records, expires any pending draw older than ten minutes, recomputes eligibility, and uses cryptographically secure server-side randomness to select one registration. An event may have only one unexpired pending draw at a time; another request receives the current pending state instead of creating a competing reservation.

The selected registration is saved immediately as a `pending` reservation. The API returns the pending draw identifier and selected attendee. The browser cannot nominate or override the selected registration.

### Animate

The frontend animates the wheel toward the server-selected attendee. The animation is presentation only; it never determines the winner.

### Confirm

The Admin clicks **Confirm Winner**. Laravel locks the event, pending draw, and registration, verifies that the draw is unexpired and confirmable, inserts the uniquely constrained `raffle_winners` record, and atomically changes the draw to `confirmed` with `confirmed_at` set.

The winner then disappears from the eligible pool and appears in winner history.

### Draw again or leave

Choosing **Draw Again** before confirmation cancels the pending draw, sets `cancelled_at`, and returns that registration to the pool. The page also attempts to cancel an unresolved pending draw when navigating away. A pending draw expires after ten minutes, defined by one backend constant and tested at its boundary, so an abandoned tab cannot block the event indefinitely.

## API Design

All routes are within the existing authenticated Admin route group.

- `GET /api/events/{event:slug}/raffle`
  - returns event information, eligible attendees, eligible count, pending draw if present, and confirmed winner history;
- `POST /api/events/{event:slug}/raffle/draws`
  - securely creates one pending draw and returns the selected attendee;
- `POST /api/events/{event:slug}/raffle/draws/{draw}/confirm`
  - confirms the pending winner;
- `DELETE /api/events/{event:slug}/raffle/draws/{draw}`
  - cancels a pending draw and releases the attendee.

The backend rejects draw identifiers belonging to another event. Repeated confirmation or cancellation uses explicit conflict responses rather than silently changing completed records.

When no eligible registrations remain, the draw endpoint returns a conflict response with a safe, user-facing message.

## Frontend Page

The page reuses the existing Admin shell:

- `Sidebar` with Dashboard navigation behavior;
- `TopHeader` with the authenticated user and logout;
- cream page background;
- white cards with the existing radius and subtle borders/shadows;
- orange `#F6671E` primary actions;
- cream `#FFF4EE` supporting surfaces;
- existing typography, spacing, button, card, and dialog primitives.

### Desktop layout

The header shows a back action, event title, and remaining eligible count. The main content uses a two-column layout:

- left: the large Wheel of Names canvas;
- right: instructions, draw controls, and provisional/confirmed winner state.

Winner history appears in a full-width card below.

### Mobile layout

The layout becomes a single column: event summary, wheel, controls, and history. Controls remain large enough for stage operation and retain clear loading/disabled states.

### Wheel rendering

The wheel is rendered with Canvas rather than one DOM node per registration. The complete eligible pool remains available to the page, but visual labels are sampled or abbreviated when the number of segments would be unreadable. The center result panel always shows the full server-selected name.

The client may animate deceleration and final positioning, but it must derive the landing position from the backend result. It must not call `Math.random()` to select a winner.

### Page states

The page clearly distinguishes:

- loading the raffle;
- ready to spin;
- requesting a secure draw;
- animating;
- awaiting confirmation;
- confirming;
- confirmed winner;
- no registrations;
- no remaining eligible attendees;
- recoverable API failure.

Buttons are disabled while requests or animation are active. Duplicate submissions are guarded in both the client and backend.

## Performance

The eligible API selects only necessary columns and eager-loads attendee identity in a bounded query count. The page holds a compact attendee array and uses Canvas, avoiding 1,000+ interactive DOM elements.

Winner history may initially return the most recent confirmed winners with pagination or a reasonable bounded limit. Eligibility and random selection occur in the database transaction and do not depend on rendering every attendee server-side into HTML.

The implementation will include a test fixture with at least 1,000 confirmed registrations to validate response completeness, uniqueness, and draw behavior.

## Error Handling and Recovery

- A draw failure leaves the current eligible pool and controls recoverable.
- A confirmation failure keeps the provisional result visible and permits retry when safe.
- A cancellation failure warns the Admin that the reservation remains pending.
- A stale or already-finalized draw triggers state refresh.
- Authorization and cross-event draw attempts do not expose event or attendee data.
- No raw framework/model lookup messages are shown in the frontend.

## Testing

### Backend

Feature tests cover:

- event-owner authorization and scanner denial;
- confirmed-registration eligibility;
- exclusion of cancelled/rejected registrations;
- inclusion regardless of check-in status;
- secure creation of one pending draw;
- exclusion of pending reservations;
- confirmation and permanent same-event exclusion;
- cancellation and release back into the pool;
- same attendee eligibility in another event;
- cross-event draw protection;
- repeated confirmation/cancellation conflicts;
- stale pending-reservation cleanup;
- exhausted-pool behavior;
- two competing draw requests not reserving the same registration;
- a pool of at least 1,000 registrations.

### Frontend

Tests cover:

- transforming a large attendee pool into bounded visual wheel labels;
- positioning the wheel on the backend-selected registration;
- state transitions from ready through pending and confirmed;
- disabling duplicate actions;
- draw-again cancellation;
- empty and exhausted pools;
- safe API error messages.

Verification includes the full Laravel test suite, PHP formatting, frontend tests, ESLint, and a Next.js production build.

## Success Criteria

- The raffle opens as a dedicated page, never a modal.
- Only the owning Admin can operate it.
- All confirmed event registrations are eligible without requiring check-in.
- Each spin has one server-selected provisional winner.
- A winner is persisted only after **Confirm Winner**.
- Confirmed winners cannot win again in that event.
- The interface stays responsive with 1,000+ registrations.
- The page clearly matches the current dashboard design.
