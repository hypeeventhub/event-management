# Event Voting System Design

**Date:** 2026-09-29  
**Status:** Approved design  
**Reference:** [Shared Voting System Plan](https://chatgpt.com/share/6abb71b0-31f4-83ec-8f29-14b85233fcb6)

## Objective

Add an event-scoped voting system that lets administrators create multiple voting subjects, publish a separate QR-backed voting form for each subject, and privately monitor a live ranked leaderboard. Every attendee registered for the event may vote, whether or not they have checked in. Each registration may vote once per voting subject.

## Scope

The first version includes:

- Multiple voting subjects for each event.
- Free-text contestant management within each subject.
- Draft, active, and closed subject states.
- A hashed public slug and QR code for every subject.
- Public registration-code validation and one vote per subject.
- A private, full-screen admin leaderboard with periodic updates.
- Subject management, result viewing, opening, and closing for admins.
- No public vote totals or leaderboard.

The first version excludes weighted voting, multiple selections per subject, scheduled opening or closing, anonymous voting, and WebSocket infrastructure.

## Access and Page Structure

All admin voting pages are full-screen pages without the dashboard sidebar or navbar. They retain a clear back-to-dashboard control and use the existing admin authorization rules.

- `/events/{eventSlug}/voting` — admin subject list and management.
- `/events/{eventSlug}/voting/{subjectSlug}/leaderboard` — private full-screen leaderboard.
- `/vote/{subjectSlug}` — public mobile-first voting form reached from the QR code.

The event dashboard voting icon links to the event voting page instead of opening the current placeholder modal. Scanner accounts and unauthenticated visitors cannot access admin voting routes. The public voting route requires no account session.

## Domain Model

### `voting_subjects`

- `id`
- `event_id` foreign key with cascade deletion
- `slug`, a unique non-sequential hashed public identifier
- `title`
- `status`: `draft`, `active`, or `closed`
- timestamps

### `voting_contestants`

- `id`
- `voting_subject_id` foreign key with cascade deletion
- `name`
- `display_order`
- timestamps

### `voting_votes`

- `id`
- `voting_subject_id` foreign key with cascade deletion
- `voting_contestant_id` foreign key with restricted deletion after voting begins
- `registration_id` foreign key tied to the existing event registration
- timestamp
- unique constraint on `(voting_subject_id, registration_id)`

The vote stores the existing `registration_id`, not a copied registration code. This preserves referential integrity and connects the vote to the subject's event while avoiding duplicated attendee data.

## Voting Rules and Integrity

Every registration belonging to the voting subject's event is eligible. Check-in status does not affect eligibility.

A public vote request contains the registration code and selected contestant. The backend normalizes the code and verifies that:

1. The subject exists and is active.
2. The contestant belongs to that subject.
3. The registration code belongs to the same event.
4. The registration has not voted in the subject.

Vote submission runs in a database transaction. It locks or rechecks the voting subject before insertion, and the unique database constraint is the final defense against concurrent duplicate submissions. A subject that becomes closed during a request does not accept the vote.

Draft subjects may be freely edited. Once a subject has votes, contestants cannot be deleted or moved in a way that invalidates existing results. Closing is reversible only if the product explicitly supports reopening; for this first version, the admin can transition draft to active and active to closed, with reopening omitted to protect result integrity.

## Backend API

Admin endpoints require authentication and the admin role:

- List voting subjects for an event with contestant count and total votes.
- Create a subject and its contestants.
- View a subject with contestants and status.
- Update a draft subject and contestants.
- Activate a draft subject.
- Close an active subject.
- Retrieve QR/link information.
- Retrieve aggregated leaderboard results.

Public endpoints:

- Retrieve an active subject's title and contestant choices by hashed slug.
- Submit a vote using a registration code and contestant ID.

Public responses never expose vote totals, rankings, registration records, attendee details, or admin-only state. Vote submission is rate limited. Error responses use stable public messages for inactive voting, invalid registration codes, invalid contestants, duplicate votes, and temporary failures.

## Admin Subject Management Page

The full-screen event voting page shows:

- Event title and back-to-dashboard action.
- Create Voting Subject action.
- Cards or rows for all event subjects.
- Subject title, status, contestant count, and total votes.
- Edit, QR, leaderboard, activate, and close actions when valid for the current state.

The create/edit experience accepts a subject title and a repeatable free-text contestant list. It validates a non-empty title, at least two unique non-empty contestants, and practical maximum lengths. The interface prevents accidental duplicate contestant names after trimming and case normalization.

The QR view shows the subject's public URL and a Download QR action. QR generation uses the canonical frontend public URL containing the hashed subject slug.

## Private Leaderboard

The leaderboard is a standalone admin-only full-screen page without the application sidebar or navbar. It contains:

- Event and subject titles.
- Current voting status.
- Total votes.
- Participation percentage based on unique subject votes divided by total event registrations.
- Ranked contestants with position, name, vote count, percentage, and progress bar.
- Visual distinction for first, second, and third place.
- An empty state before any votes are recorded.
- Valid activate or close controls for the current subject state.

Results are ordered by vote count descending, then contestant display order and ID for deterministic ties. Equal vote counts remain visibly equal even though a stable display order is required.

The page refreshes the result endpoint every three seconds while visible and while the subject is active. It slows or pauses when the tab is hidden and stops polling when the subject is closed. Polling failures preserve the last successful leaderboard, show a non-destructive connection warning, and retry on the next interval.

## Public Voting Page

The public page is mobile-first and visually follows the existing event color palette. It shows only:

- Voting title.
- Registration-code field.
- Contestant dropdown.
- Submit Vote action.

After a successful submission, the form is replaced by a clear success state. The attendee does not see totals, percentages, rankings, or other voter information. Duplicate votes, invalid codes, inactive subjects, and network failures receive distinct and actionable messages without leaking registration details.

The submit action disables while processing. Client-side validation improves usability, but all eligibility and duplicate enforcement remains on the backend.

## Frontend Data Flow

The admin subject page loads event-scoped management data through the authenticated API client. Mutations revalidate the subject list after success.

The leaderboard uses a dedicated aggregation endpoint and SWR polling at three-second intervals while active. Ranking and vote percentages are calculated by the backend so all clients see the same deterministic result.

The public page uses a public API client path without authentication redirects. The page first loads the sanitized subject payload, then sends the normalized registration code and contestant selection to the vote endpoint.

## Error Handling and Security

- Admin authorization is enforced server-side and mirrored by the frontend role gate.
- Subject lookup uses hashed slugs rather than sequential database IDs on public routes.
- Public payloads expose the minimum information needed to vote.
- Rate limiting applies to subject lookup and vote submission.
- Registration codes are normalized consistently and never written to application logs.
- Database foreign keys, transactions, status checks, and the unique vote constraint enforce integrity.
- API validation prevents cross-event registration or contestant use.
- Leaderboard queries use aggregation and indexes rather than loading individual vote records.
- QR URLs are derived from configured application origins, not request-controlled hosts.

## Performance

Leaderboard endpoints return aggregated contestant rows rather than raw votes. Indexes cover subject status, contestant ownership, vote subject/contestant grouping, and the unique subject/registration pair. Polling one lightweight result endpoint every three seconds is sufficient for the first version and avoids new real-time infrastructure.

## Testing Strategy

Backend feature tests cover:

- Admin-only subject management and leaderboard access.
- Subject ownership by event.
- Draft, active, and closed transitions.
- Event-specific registration-code eligibility regardless of check-in status.
- Invalid and cross-event registrations.
- Contestant ownership validation.
- One vote per registration per subject.
- The same registration voting in different subjects.
- Concurrent duplicate protection through the unique constraint.
- Rejection after closing.
- Aggregated counts, percentages, deterministic ranking, ties, and participation.
- Public payload privacy and rate limiting.
- Hashed-slug resolution and QR URLs.

Frontend tests cover:

- Event voting navigation.
- Subject form normalization and validation.
- State-specific actions.
- Private route and role behavior.
- QR download link construction.
- Leaderboard ranking presentation and polling decisions.
- Hidden-tab and closed-subject polling behavior.
- Public form success and each expected error state.
- Absence of vote totals from public screens.
- Responsive and accessible labels, focus behavior, and loading states.

## Acceptance Criteria

The feature is complete when an admin can create multiple voting subjects for one event, add contestants, activate a subject, download its QR code, and privately view a full-screen leaderboard that refreshes during voting. Any attendee registered for that event can use the QR page and cast exactly one vote in each subject using their registration code. The public interface never exposes results, non-admin users cannot access management or leaderboard pages, and closing a subject prevents further votes.
