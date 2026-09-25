# Phase 02 — Product Discovery Frontend Design

## Existing frontend architecture

The frontend is a static HTML/CSS/Vanilla JavaScript application under `frontend/`. Each page owns its page-specific module while shared API and cart utilities are imported as ES modules. `frontend/js/api.js` is the only fetch boundary; `frontend/js/products.js` owns the product listing page and already creates product cards, preserves product details links, handles add-to-cart feedback, and updates the shared cart count. Shared navigation and authentication state are handled by `frontend/js/app.js` and `#nav-links`.

The Product page will retain this architecture. No framework, router, state library, UI library, or new dependency will be added. Product card creation and cart behavior will remain in `products.js`; discovery state, URL synchronization, API pagination, and page interactions will be added there.

## Authoritative Phase 01 contract

The frontend consumes the actual `GET /api/products` endpoint. It sends only supported parameters:

- `q`
- `category`
- `brand`
- `subcategory`
- `featured`
- `sale`
- `min_price`
- `max_price`
- `in_stock`
- `sort`
- `limit`
- `cursor`

The default limit is 20 and the server maximum is 100. Supported sort values are `id_asc`, `newest`, `oldest`, `price_asc`, `price_desc`, `name_asc`, `name_desc`, and `featured`. A successful response is `{ success: true, data: Product[], pagination: { limit, hasNextPage, nextCursor } }`. Errors use `{ success: false, message }`; the UI will not expose raw backend details.

Category and brand values come from the existing expanded seed catalog because Phase 01 has no filter-options endpoint. The controls are selects with an All option, and the active values are sent exactly as stored. New backend metadata can later replace the static option lists without changing the request contract.

## State model

The page uses one focused state object:

```javascript
{
  query: "",
  category: "",
  brand: "",
  subcategory: "",
  minPrice: "",
  maxPrice: "",
  inStock: false,
  sale: false,
  featured: false,
  sort: "id_asc",
  products: [],
  nextCursor: null,
  hasNextPage: false,
  loading: false,
  loadingMore: false,
  requestVersion: 0
}
```

Cursor and page request state are intentionally not persisted in the shareable URL. URL state contains discovery intent only: `q`, supported filters, and `sort`. URL parsing initializes the controls before the first request.

## URL and history flow

`URLSearchParams` is used to parse and build URLs. Empty values are omitted. The `cursor` parameter is never written to the URL. Meaningful changes use `history.pushState`; `popstate` parses the URL, updates controls, clears products and cursor, and requests the first page. Initial load never starts from a URL cursor.

## Search and request coordination

Search input updates are debounced for 400ms. The debounce resets pagination and updates state/URL once the stable value is committed. A clear action immediately cancels the pending timer and starts the default listing.

Each discovery request receives a monotonically increasing request version. `AbortController` cancels the previous discovery request when a newer request starts. Results are committed only if the response version is current. Load More uses a separate loading state, keeps existing cards visible, and is disabled during its request. Product IDs are deduplicated when appending and unexpected duplicates are logged in non-production development only.

## Filters and sorting

The filter panel exposes exactly the Phase 01 parameters: category, brand, subcategory, price range, in stock, sale, and featured. Price values are validated before requesting. Sort exposes the exact server enum. Every constraint or sort change resets products and cursor, pushes the new discovery URL, and fetches the first page once.

Active filter chips are rendered with `textContent` and buttons. Removing one chip updates the same state flow. Clear all resets every discovery control, removes discovery parameters from the URL while preserving unrelated parameters, and requests the default listing.

## Pagination

The first request replaces the result list. Load More sends the current `pagination.nextCursor` with the current discovery parameters, appends unique products, and updates `nextCursor` and `hasNextPage`. The button is hidden when no next page exists. There is no client-side offset, page number, or full-catalog filtering.

## UI states and accessibility

The existing loading, empty, and error states are adapted for discovery. Initial/filter refresh shows a loading state without displaying stale cards. Load More shows a local progress state while preserving the grid. Empty results provide a contextual message and Clear filters action. Errors provide Try Again and a user-facing message only.

The page uses semantic labels for search and every control, native checkboxes/selects/inputs, keyboard-operable buttons, visible focus styles, `aria-live` result updates, explicit filter toggle state on mobile, and text labels alongside color/status. On small screens the filter panel becomes a compact disclosure panel; no modal dependency is introduced.

## Responsive and regression behavior

Desktop uses a filter panel above the product grid. Tablet keeps the panel fluid and the existing two-column grid. Mobile stacks the search/filter/sort controls, keeps controls within the viewport, and preserves the existing single-column product cards. Shared navigation, product detail links, cart localStorage shape, checkout, orders, account, and authentication modules are not redesigned.

## Verification and Phase 03 handoff

Verification covers API query construction, URL parsing/history, debounce, cancellation, filter composition, sort changes, empty/error states, Load More append behavior, duplicate prevention, responsive markup, JavaScript syntax, and existing backend regression tests where applicable. Phase 03 may add filter metadata management, richer mobile filter UX, or analytics without changing the established discovery contract.
