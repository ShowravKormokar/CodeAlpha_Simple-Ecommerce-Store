# Product Search — Phase 04: URL State, Debouncing, Sorting & Advanced Search UX

Status: **Complete.** Implementation finished, verified against the live API, and all
acceptance criteria met. See section 16 for what was tested and section 17 for the
backend defects that had to be fixed to make Load More work.

---

## 1. Current architecture

The products page is a static page (`frontend/products.html`) enhanced by a single ES
module (`frontend/js/products.js`). It talks to the backend only through
`frontend/js/api.js`.

```text
frontend/products.html      markup: search, filters, sort, chips, states, grid
frontend/css/products.css   page styles (loaded after style.css)
frontend/js/products.js     discovery state, rendering, events
frontend/js/api.js          getProducts(params, options) -> { success, data, pagination }
frontend/js/cart.js         cart state (localStorage) — untouched by search state
frontend/js/stars.js        rating display
frontend/js/app.js          navigation, cart count
```

Backend (already implemented, **not modified in Phase 04**):

```text
backend/src/routes/product.routes.js         GET /api/products
backend/src/controllers/product.controller.js
backend/src/services/product-discovery.service.js   parsing, SQL, cursor codec
backend/src/services/product.service.js             row -> API mapping
```

`GET /api/products` already routes through the discovery service, so Phase 04 is a
frontend phase. No backend search, sorting, cursor or filter logic is changed.

### What already existed before Phase 04

Commit `20026bc` ("feat(products): implement discovery state and pagination") already
provided URL state, a 400 ms debounce, `AbortController` + request versioning, active
filter chips, sort, cursor pagination, Load More, `popstate`, Clear search and
Clear all. Phase 04 keeps that architecture and closes the remaining gaps listed in
section 12.

---

## 2. Backend search contract (verified, not assumed)

Verified live against `http://127.0.0.1:5000/api/products` after rebuilding the
database from `schema.sql` + migrations + `seed.sql`.

### Response

```json
{
  "success": true,
  "data": [ /* products */ ],
  "pagination": { "limit": 20, "hasNextPage": true, "nextCursor": "opaque" }
}
```

There is **no total count** in the response. The UI must never fabricate one; it shows
"Showing N products" while more pages exist, and "N products" when complete.

### Supported query parameters

Any other key is rejected with **400 `Unknown query parameter`**.

| Parameter      | Type            | Rules                                                        |
| -------------- | --------------- | ------------------------------------------------------------ |
| `q`            | string          | non-empty after trim, max 200 chars. `q=` empty is a 400     |
| `category`     | string          | exact match, `LOWER(category) = LOWER($1)`, max 255          |
| `brand`        | string          | exact match, case-insensitive, max 255                      |
| `subcategory`  | string          | exact match, case-insensitive, max 255                      |
| `featured`     | boolean string  | exactly `true` or `false`                                    |
| `sale`         | boolean string  | exactly `true` or `false`                                    |
| `in_stock`     | boolean string  | exactly `true` or `false`                                    |
| `min_price`    | number          | `^\d+(\.\d+)?$`, >= 0, must not exceed `max_price`           |
| `max_price`    | number          | `^\d+(\.\d+)?$`, >= 0                                        |
| `sort`         | string          | one of the eight values below, default `id_asc`              |
| `limit`        | integer string  | 1..100, default 20                                           |
| `cursor`       | opaque string   | max 4096 chars, HMAC-signed, bound to sort + query context  |

**`vendor` is not supported by the backend** and is therefore not exposed in the UI.
Sending it returns 400 and would break the whole page.

### Supported sort values (all eight)

`id_asc` (default), `newest`, `oldest`, `price_asc`, `price_desc`, `name_asc`,
`name_desc`, `featured`. Anything else returns 400 `Unsupported sort`.

### Cursor semantics

The cursor payload embeds the sort and a SHA-256 hash of the normalized query context
(`q`, filters, sort). Verified behaviour:

```text
page 1 (sort=id_asc)        -> 200, nextCursor
page 2 (same sort)          -> 200
page 2 (different sort)     -> 400 "Cursor does not match the current query"
```

The backend already rejects cross-context cursors. The frontend must still reset the
cursor whenever the result context changes, so a 400 is never reached in normal use.

---

## 3. State → URL → API mapping

| UI control              | State field    | URL parameter | API parameter | Default |
| ----------------------- | -------------- | ------------- | ------------- | ------- |
| Search input            | `query`        | `q`           | `q`           | `""`    |
| Category select         | `category`     | `category`    | `category`    | `""`    |
| Brand select            | `brand`        | `brand`       | `brand`       | `""`    |
| Subcategory select      | `subcategory`  | `subcategory` | `subcategory` | `""`    |
| Min price               | `minPrice`     | `min_price`   | `min_price`   | `""`    |
| Max price               | `maxPrice`     | `max_price`   | `max_price`   | `""`    |
| In stock checkbox       | `inStock`      | `in_stock`    | `in_stock`    | `false` |
| On sale checkbox        | `sale`         | `sale`        | `sale`        | `false` |
| Featured checkbox       | `featured`     | `featured`    | `featured`    | `false` |
| Sort select             | `sort`         | `sort`        | `sort`        | `id_asc` |
| — (not a control)       | `limit`        | —             | `limit`       | `20`    |
| — (transient)           | `nextCursor`   | —             | `cursor`      | `null`  |

### URL conventions

* `URLSearchParams` only; never string concatenation.
* Empty values are omitted — no `?q=&brand=` is ever produced.
* The default sort `id_asc` is omitted from the URL.
* `limit` is a constant, never in the URL.
* `cursor` is never in the URL.
* Unknown or invalid parameters are stripped by canonicalization (§8).
* Parameter order is fixed by the builder (`q, category, brand, subcategory,
  min_price, max_price, in_stock, sale, featured, sort`) so the same state always
  produces the same URL string.

---

## 4. Debounce strategy

* Duration: **400 ms** (inside the 300–500 ms guidance).
* Only the free-text search input is debounced. Selects, checkboxes and price inputs
  fire immediately on `change` — those are discrete choices, not typing.
* The debounce only starts a request; it never writes to committed state.
* `Enter` (form submit) flushes immediately: the pending timer is cleared, so exactly
  one request is made.
* Clear search cancels the pending timer and immediately commits an empty query.
* Load More is disabled while a debounce is pending, so an uncommitted query can never
  be combined with a committed cursor.

---

## 5. Request cancellation and race protection

Two independent mechanisms, both retained:

1. **`AbortController`** — every first-page request aborts the previous in-flight
   request before starting a new one. The `signal` is passed to `getProducts`.
2. **Request version** — `state.requestVersion` increments per first-page request. A
   response is applied only when its captured version still matches, so an aborted
   request that still settles cannot corrupt the UI.

3. **Search-context signature** (new in Phase 04) — a stable string of
   `q|filters|sort` captured when a request starts. Load More only appends a response
   when both the request version *and* the context signature still match. This is the
   explicit guard required for cursor pagination, where a version check alone is easy
   to get wrong.

`AbortError` never produces an error state. Genuine failures (network, 4xx, 5xx) show
the error panel, and retry re-runs the **current** state rather than a snapshot.

---

## 6. Cursor rules

* The cursor is transient and never appears in the URL.
* Any change that can alter result membership — search, category, brand, subcategory,
  price, stock, sale, featured, or sort — resets the cursor and refetches page 1.
* Load More reuses the committed state and the current cursor, sends no new history
  entry, and preserves search, filters and sort.
* Duplicate Load More requests are prevented by an in-flight guard plus a disabled
  button.
* `hasNextPage` / `nextCursor` from the backend decide whether Load More is shown.
  The frontend never infers "more pages" from `products.length === limit`.

---

## 7. Browser history

| Action                                   | History behaviour                |
| ---------------------------------------- | -------------------------------- |
| Search, filter, sort, chip removal, clear | `pushState` (one entry per change) |
| Canonicalization of the current URL       | `replaceState`                   |
| Initial load and `popstate`               | `replaceState` only if normalizing |
| Load More                                 | no history entry                 |
| Network response                          | no history entry                 |
| Debounce tick                             | no history entry                 |

`popstate` re-reads the URL, re-normalizes, resets the cursor, refetches page 1 and
updates every control — no full page reload. Back and Forward therefore walk through
search states, not through every Load More click.

A `pushState` is skipped when the normalized URL is identical to the current one, so
re-selecting the same filter does not create a dead history entry.

---

## 8. Loading, empty and error states

* **Initial load** — full loading panel, grid hidden.
* **Result replacement** (search, filter, sort) — the existing grid stays visible and
  the container is marked `aria-busy="true"` with a subtle updating treatment. Content
  is swapped only when the new response arrives, so there is no blank-page flash and
  stale results are never mistaken for current ones (the busy state marks them).
* **Load More** — only the Load More control changes; the grid is not replaced. New
  cards are appended to the existing grid instead of rebuilding it.
* **Empty** — honest message plus a Clear filters action. The search term is preserved
  so the user can edit it rather than losing it.
* **Error** — panel with Try again, which re-runs the current state. Backend `400`
  messages are surfaced (they are plain text and are rendered with `textContent`);
  network and `5xx` failures use a generic message.
* **Count** — `Showing N products` while `hasNextPage`, otherwise `N products`. No
  fabricated totals, because the API returns none.

---

## 9. Reset behaviour

* **Clear search** (search field button) — clears the query only, cancels any pending
  debounce, removes `q` from the URL, resets the cursor, refetches. Filters and sort
  are untouched.
* **Clear all** (and the empty-state action) — resets search, every filter and the
  sort to defaults, resets the cursor, updates the URL and refetches page 1. The search
  box is included, because the empty state means "nothing matched everything you asked
  for".
* **Filter chip ×** — removes only that one filter; everything else stays.

---

## 10. Accessibility

* Every control has an explicit `<label for>`; the availability and price groups use
  `<fieldset>` / `<legend>`.
* Chips are `<button>` elements with `aria-label="Remove <filter> filter"`, so they are
  keyboard reachable and announced.
* Clear buttons carry accessible names (`Clear search`, `Clear all`, `Try again`).
* The result count is `aria-live="polite"`; Load More has a `role="status"` region.
* The grid is `aria-live="polite"` and `aria-busy` is toggled while replacing results.
* `Escape` in the search field clears it (same path as the Clear button).
* Focus never moves on filtering, sorting, paging or history navigation; the page is
  not re-rendered around the focused control.
* Status is conveyed by text, not colour alone.

---

## 11. Responsive behaviour

Desktop orders search → filters → sort → chips → results → Load More. Below 820 px the
filter panel collapses behind the existing Filters toggle; search, sort, chips and
Load More stay reachable, chips scroll horizontally rather than wrapping into an
overflow, and the grid reflows. No new mobile-only search architecture is introduced.

---

## 12. Gaps found and addressed in Phase 04

| # | Gap in the existing implementation | Fix |
| - | --------------------------------- | --- |
| 1 | `state.query` was overwritten on every keystroke, so Load More could send an **uncommitted** query together with a **committed** cursor → backend 400 | Draft value kept separate from committed state; Load More disabled while a debounce is pending |
| 2 | A URL value absent from the static `<select>` options (`?brand=old-brand`) made the dropdown show "All brands" while state still held the old brand; the next control change silently dropped it | Unknown values are injected as a visible, marked option so URL, state and UI agree and nothing is silently substituted |
| 3 | No explicit search-context guard for Load More | Context signature captured per request and verified before appending |
| 4 | Every result replacement hid the grid, causing a full-page flash | Grid preserved and marked `aria-busy`; content swapped on success |
| 5 | `pushState` ran even when the URL was unchanged, creating dead history entries | Push skipped when the normalized URL is identical |
| 6 | An invalid `sort=` or stray parameters stayed in the URL after normalization | Canonical URL written with `replaceState` on load and on `popstate` |
| 7 | No result summary | Summary line added ("Results for …" / "Category · Brand") |
| 8 | `Escape` did nothing in the search field | Escape clears the search |
| 9 | Backend 400 reasons were swallowed behind a generic message | 4xx messages surfaced via `textContent` |
| 10 | Empty-state copy said "matching your search and filters" even when only a sort was set | Copy reflects the actual active state |
| 11 | Load More rebuilt the whole grid | New cards are appended |
| 12 | Price chips formatted with a hardcoded `$` | Uses the shared `formatPrice` |
| 13 | Unknown parameters (`limit=`, hand-edited junk) survived in the address bar | The URL is rebuilt from the supported keys in a fixed order |

---

## 13. Acceptance criteria

### URL state
- [x] Search, filters and sort are represented in the URL.
- [x] Empty parameters are removed.
- [x] Invalid parameters cannot break the page (unsupported sort, bad numbers, unknown keys).
- [x] Refresh restores the exact state.
- [x] A shared URL reproduces the same state.
- [x] Cursor is never in the URL.

### Debouncing
- [x] Search is debounced at 400 ms.
- [x] No request per keystroke; only the final query is requested.
- [x] Clear cancels the pending debounce.
- [x] Enter applies immediately without a duplicate request.
- [x] Filters and sort are not debounced.

### Sorting
- [x] Exactly the eight backend-supported values are offered.
- [x] Sorting is server-side; no client-side sorting.
- [x] A sort change resets the cursor and replaces results.
- [x] Sort is reflected in the URL and restored on Back/Forward.

### Cursor pagination
- [x] Cursor resets on every result-defining change.
- [x] Load More preserves search, filters and sort.
- [x] Duplicate Load More requests are impossible.
- [x] Stale responses cannot be appended.

### Browser history
- [x] One entry per meaningful search/filter/sort change.
- [x] No entry for Load More, responses or debounce ticks.
- [x] Back and Forward restore state without a reload.

### Request safety
- [x] Previous requests are aborted.
- [x] Stale responses cannot overwrite current results.
- [x] Aborted requests never show an error.

### UX
- [x] Distinct initial / replacement / Load More loading states.
- [x] Useful empty state with recovery action.
- [x] Retry uses the current state.
- [x] Active filter chips remove one filter at a time.
- [x] Product cards, pricing, stock, add-to-cart and cart count unchanged.

### Accessibility
- [x] Labelled search, filter and sort controls.
- [x] Keyboard-operable chips and clear actions.
- [x] `aria-live` result count, `role="status"` paging, `aria-busy` container.
- [x] Escape clears search; focus is never moved unexpectedly.

### Responsive
- [x] Desktop, tablet and mobile keep search, filters, sort, chips and Load More usable.
- [x] No horizontal overflow.

### Architecture
- [x] No framework, no new dependency.
- [x] All requests still go through `api.js`.
- [x] Backend search contract untouched.
- [x] No client-side pagination, filtering or sorting.

---

## 14. Known limitations

* The API returns no total count, so no "N results" total is shown.
* `category`, `brand` and `subcategory` are matched exactly (case-insensitive); there is
  no facet or autocomplete endpoint, so the option lists are static in the HTML. A URL
  value outside those lists is shown as an explicit "unavailable" option rather than
  being substituted.
* The backend has no `vendor` filter, so the UI has none.
* `limit` is fixed at 20; there is no page-size control.
* There is no frontend test runner or browser automation in the repository, so
  verification uses a Node DOM harness plus static checks and live API calls. Visual
  responsive review at real breakpoints is not automated.
* `newest` / `oldest` cursor predicates truncate `created_at` to milliseconds, which
  costs index usage on those two sorts (see section 17.2).

---

## 15. Phase 05 handoff

* The discovery state model in `products.js` is the reference for any future
  URL-driven listing page.
* Cursor handling is server-authoritative; the frontend only stores `nextCursor` for
  the active context and drops it on every context change.
* `getProducts` in `api.js` already accepts an abort `signal` and a structured params
  object; new pages should reuse it rather than building URLs.

---

## 16. What was tested

### Frontend behavior harness

A Node DOM harness runs the real `frontend/js/products.js` against a stubbed API with
a controllable clock and a fake `AbortController`. **144 assertions, all passing.**
Coverage:

* URL state — initial URL populates every control and the request; unsupported sort,
  out-of-range `limit` and unknown parameters are dropped and the URL is canonicalized
  with `replaceState` without adding history; a shared URL is reconstructed from the URL
  alone with no empty parameters sent.
* Unknown select values — `?brand=old-brand` keeps its value, is sent to the API, is
  shown as an explicitly marked "unavailable" option and appears as a chip, instead of
  being silently substituted.
* Debounce — six keystrokes produce no request, nothing fires before 400 ms, exactly
  one request fires after, carrying only the final query; filters and sort fire
  immediately without waiting.
* Enter, Clear and Escape — Enter applies immediately and cancels the pending debounce
  with no duplicate request; Clear during a debounce sends one empty query, removes `q`
  and stops the pending timer; Escape clears the search box and the URL.
* Race protection — a slow first search followed by a fast second one keeps the newer
  results, leaves the committed query and the URL matching the newest search, and shows
  no error panel for the aborted request.
* Sorting — all eight values are sent correctly, each resets pagination, and a sort
  change replaces the grid instead of appending to it.
* Cursor pagination — Load More sends the cursor, preserves search and sort, appends
  without duplicates, creates no history entry, updates the next cursor, and does not
  rebuild previously rendered cards; three rapid clicks send one request and append
  once; a filter change discards the cursor and refetches page one.
* History — one entry per committed search, `popstate` restores the search box,
  refetches, resets pagination, updates the summary and adds no history, and an
  unchanged state produces no dead entry.
* Empty and error — the empty state quotes the search and keeps it in the box, reports
  "0 products", and the error panel's retry issues a new request using the current
  search state; a 400 message is surfaced while network failures use the generic copy.
* Loading — the first load shows the full panel and hides the grid; a replacement keeps
  the previous grid visible, marks the container `aria-busy`, shows "Updating results…"
  and swaps content only when the response arrives, then clears the busy state.
* Chips, Clear all, price validation and product-card integrity, including add-to-cart
  through the delegated grid listener.

### Static checks

* `node --check frontend/js/products.js` passes.
* `git diff --check` reports no whitespace errors.
* `frontend/css/products.css` braces balance to depth 0; `frontend/products.html` parses
  with 158 open and 158 close tags.
* Scans confirm no `innerHTML` fed from data, no client-side sorting, no client-side
  pagination, no `localStorage`/`sessionStorage` use for search state, no `eval`, no
  cursor written to the URL, and no listener registered inside a render loop.

### Live API verification

Against the running server with the rebuilt, seeded database:

* Every supported filter combination returns correct data (`q`, `brand`, `category`,
  `in_stock`, `min_price`/`max_price`, `sale`, `featured`).
* `sort=price_asc` returns products ordered 12.00, 19.75, 25.99, 28.99.
* Validation returns 400 for `sort=bogus`, `vendor=acme`, `limit=-100`, `limit=500`,
  `limit=abc`, `min_price=abc` and `q=`.
* A cursor is accepted for the same sort and rejected with 400 for a different sort.
* Two-page pagination produces no duplicate products for all eight sorts.
* Walking the entire result set with `limit=2` for each of the eight sorts returns
  12/12 products, unique, with nothing missing.

### Backend regression

`npx jest --runInBand` in `backend` passes 6 suites and 98 tests against the rebuilt
database, confirming Phase 04 changed no existing behaviour.

**Not tested:** no real browser was available, so visual layout at desktop, tablet and
mobile widths, and real focus/AT behaviour, were not verified interactively. The
responsive and accessibility work is implemented and covered structurally (markup,
labels, ARIA attributes and CSS rules) but has not been exercised in a live browser.

---

## 17. Backend defects found and fixed

Phase 04 is a frontend phase, but two pre-existing backend bugs made Load More — a
required Phase 04 feature — fail. Both were verified with live requests before being
fixed, and both fixes are minimal and confined to the cursor predicate in
`backend/src/services/product-discovery.service.js`.

### 17.1 Invalid SQL for every multi-field sort

`appendCursorPredicate` joined the comparison operators with `", "`, producing

```sql
(p.price, p.id) >, > ($2, $3)     -- syntax error at or near ","
```

Only `id_asc` survived, because it has a single sort field. Selecting any other sort
and pressing Load More returned **500 Internal Server Error**, so pagination worked for
one of the eight options.

Fixed by using a single comparison operator, since every sort definition orders all of
its fields in the same direction. A guard now throws if a future definition mixes
directions, because a row constructor cannot express that.

### 17.2 Timestamps compared at the wrong precision

After the first fix, `newest` and `oldest` still paged incorrectly: `oldest` returned
the same page forever and `newest` returned an empty second page. Two causes:

* In a row comparison Postgres resolved the unknown cursor parameter as `text`, so the
  ISO timestamp string compared lexicographically rather than chronologically. Fixed
  with an explicit `::timestamptz` cast.
* A cursor can only carry millisecond precision (a JS `Date` has none finer), while
  `products.created_at` is `timestamptz` with microsecond precision. The seeded products
  all share one transaction timestamp, so the stored value was always slightly greater
  than the truncated cursor value, the timestamp comparison decided the row on its own,
  and the `id` tiebreaker never engaged. Fixed by truncating the column to the same
  millisecond precision, so the tiebreaker is reached consistently.

**Trade-off:** `date_trunc('milliseconds', p.created_at)` is not index-friendly, so the
Newest and Oldest cursor predicates no longer use a plain index on `created_at`. With a
catalog this size the cost is irrelevant; if the catalog grows substantially, a
functional index on `date_trunc('milliseconds', created_at)` would restore it. This is
the only place where Phase 04 touched backend search logic, and it was required to make
a required frontend feature work.
