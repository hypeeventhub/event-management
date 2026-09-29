# Event Name Picker Raffle Design

## Purpose

Replace the current wheel raffle experience with an admin-only, full-screen Name Picker for a specific event. The picker must visually follow the supplied [Random Name Picker reference](https://pinkylam.me/playground/random-name-picker/): a distraction-free full-page picker, large animated selected-name stage, concise primary draw controls, and visible winner state. Its Settings screen must visually follow the supplied purple Settings image. It is a page, never a modal, and it deliberately renders without the dashboard navigation or sidebar.

## Scope

- A dedicated event raffle page at `/events/{event-slug}/raffle` using the existing hashed event slug.
- Admin-only access enforced by the existing authenticated Admin guard and event ownership checks; hiding the navigation is not the authorization mechanism.
- A persistent, event-specific name pool that an Admin can type, paste, import, edit, and reuse after a page refresh.
- Import from attendee exports: `.xlsx` uses the `All Registrants` worksheet and `.csv` uses the same All Registrants row format. Both import only the `Name` column.
- A name-picker animation with a server-reserved proposed winner and an explicit **Confirm Winner** action.
- Event-scoped winner history with winner name and event ID only; no `registration_id`/`registrants_id` field in winner history.
- Settings for names, import, remove-winners behavior, raffle speed, theme, and winner history.

Out of scope: prize names, public raffle access, scanner access, arbitrary registration form data in raffle storage, dashboard sidebar/top-header rendering on the raffle page, and changing existing attendee export columns.

## Page and Authorization

The raffle remains reachable from the existing ongoing-event raffle icon. The route keeps the event slug:

`/events/{event-slug}/raffle`

The standalone page has no dashboard `Sidebar` or `TopHeader`. It uses a full-viewport raffle shell with a compact event context/back action only. The frontend `RoleGate` redirects non-Admin accounts, while every raffle API endpoint verifies that the authenticated Admin owns the requested event. A direct URL cannot bypass those backend checks.

## Visual Design

The page must use the supplied Random Name Picker as its visual interaction reference, rather than the prior orange dashboard-card design:

- a full-height, distraction-free picker stage with no dashboard shell;
- a large, readable selected-name display and name-changing animation as the visual focal point;
- concise, high-contrast draw controls beneath or adjacent to the stage;
- a clear winner result with **Confirm Winner** and **Draw Again** after the animation;
- no navigation chrome competing with the draw controls;
- responsive layout that preserves the reference hierarchy on mobile.

Selecting Settings opens a dedicated full-height settings view within the raffle route. It must match the supplied purple Settings image: purple background, large “Settings” heading, paired “Names” and “Import CSV” labels, prominent white names textarea, Remove Winners toggle, Raffle Speed slider, circular theme swatches, and white/neutral Winners history rows. The Settings view does not use a modal.

The default theme matches the supplied purple reference. Theme selection changes only the raffle presentation and is persisted per event. The picker respects reduced-motion preferences by shortening the animation while preserving the confirmation step.

## Name Pool

Each event owns an ordered name pool. An Admin may paste one name per line, edit names in the textarea, or import an attendee export. Saving settings persists the complete current pool, so reloads and later sessions restore it.

For imports:

- Excel import accepts `.xlsx`, finds the exact `All Registrants` worksheet, finds its `Name` header, and imports non-empty values from that column only.
- CSV import accepts a header row with `Name` and imports non-empty values from that column only.
- Unsupported files, missing sheets, missing `Name` headers, and files with no usable names surface a clear error without replacing the saved pool.
- Imported names append to the editable textarea/pool in file order. Blank lines are ignored. Repeated names remain separate entries because a name-only source cannot safely determine they are the same person.

The existing attendee page offers both downloads: the three-sheet `.xlsx` and an All Registrants `.csv`. The raffle importer consumes those formats; it does not alter their attendee columns.

## Settings

Settings are event-scoped and persist after refresh:

- **Names:** the full editable, ordered name pool.
- **Import CSV:** accepts `.csv` and `.xlsx` attendee exports as described above.
- **Remove Winners:** default on. When enabled, confirming a winner removes only the selected pool entry; when disabled, the pool is unchanged and the same entry can be drawn again.
- **Raffle Speed:** a bounded slow-to-fast duration value used by the picker animation.
- **Themes:** a fixed, accessible palette of purple-compatible theme options, with the selected key persisted.
- **Winners:** newest-first history for the current event, showing names and win time; a full history endpoint remains paginatable rather than loading unbounded history.

## Data Model

Replace the original registration-backed raffle schema with name-pool storage:

- `raffle_entries`
  - `id`, `event_id`, `name`, `position`, timestamps;
  - index on `(event_id, position)`;
  - duplicate name values are allowed.
- `event_raffle_settings`
  - `id`, unique `event_id`, `remove_winners` boolean, `speed` bounded integer, `theme` string, timestamps.
- `raffle_draws`
  - `id`, `event_id`, `raffle_entry_id`, `status` (`pending`, `confirmed`, `cancelled`), `selected_by`, timestamps, `expires_at`;
  - used only to reserve the server-selected entry until it is confirmed or released.
- `raffle_winners`
  - `id`, `event_id`, `name`, `won_at`, timestamps;
  - explicitly contains no registration/registrant reference and no attendee answers.

Winner history records the displayed name and event ID only. The draw’s internal entry reference is not copied into `raffle_winners`. If Remove Winners is enabled, confirmation deletes the selected entry in the same transaction that inserts the winner-history record.

## Draw Lifecycle

1. The Admin loads the event raffle state: event context, settings, current ordered entries, active pending draw (if any), and winner history.
2. The Admin starts a draw. The backend locks the event, clears expired pending draws, chooses one entry with server-side secure randomness, and saves a pending draw. It returns the selected name and draw ID.
3. The client performs the visual random-name animation toward that returned name. The browser never chooses the winner.
4. The Admin clicks **Confirm Winner**. The backend atomically records `{ event_id, name, won_at }` in `raffle_winners`, confirms the draw, and deletes the selected entry only when Remove Winners is enabled.
5. **Draw Again** cancels an unconfirmed draw and leaves its entry in the pool. Expired pending draws release automatically.

Only one pending draw can exist for an event. The pending reservation expires after ten minutes, preventing abandoned browser tabs from blocking later draws.

## API Contract

All endpoints use the existing authenticated Admin route group and `{event:slug}` binding:

- `GET /api/events/{event:slug}/raffle` returns event context, persisted settings, ordered entries, active pending draw, and paginated winner history.
- `PUT /api/events/{event:slug}/raffle/settings` validates and atomically replaces the ordered name pool plus persisted settings.
- `POST /api/events/{event:slug}/raffle/draws` reserves one server-selected name entry.
- `POST /api/events/{event:slug}/raffle/draws/{draw}/confirm` confirms the proposed winner.
- `DELETE /api/events/{event:slug}/raffle/draws/{draw}` cancels an unconfirmed draw.

The API never receives or returns registration answers. Cross-event draw IDs, non-Admin requests, and non-owner requests are rejected without exposing raffle data.

## Scale, Validation, and Recovery

The page must remain responsive with 1,000+ names. It displays one animated name rather than a DOM list for every name; the settings textarea/import may manage the full list. API reads select only the needed name fields and paginate history.

Names are trimmed, constrained to a documented maximum length, and empty names are removed. Saving an empty pool is valid but disables drawing. API failures keep current local settings visible until a successful save; a failed confirm retains the proposed winner so the Admin can retry; failed cancellation reports that the draw may remain reserved and reloads authoritative state.

## Test Coverage

Backend tests cover Admin/event-owner authorization, settings persistence, ordered name replacement, `.xlsx`/CSV import parser behavior where it belongs, name-only winner rows, no winner registration reference, draw/confirm/cancel behavior, remove-winner enabled and disabled paths, duplicate names, stale draw cleanup, cross-event protection, and a pool of at least 1,000 entries.

Frontend tests cover import parsing and validation, name serialization, speed/theme defaults, reducer lifecycle behavior, settings save/reload state, confirmed-winner display, safe error copy, and a large name pool that does not create one DOM node per entrant. Production verification includes lint, build, full backend tests, frontend node tests, and direct authorization smoke checks.
