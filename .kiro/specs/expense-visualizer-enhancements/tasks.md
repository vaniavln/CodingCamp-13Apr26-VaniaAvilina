# Implementation Plan: expense-visualizer-enhancements

## Overview

Incrementally extend the Expense & Budget Visualizer with three features — Custom Categories, Monthly Summary View, and Sort Transactions — while keeping all changes within plain HTML/CSS/Vanilla JS and the existing `logic.js` / `app.js` split.

## Tasks

- [x] 1. Add `createdAt` timestamp to transactions
  - [x] 1.1 Update `addTransaction` in `js/app.js` to accept an optional `timestampFn` parameter (defaults to `() => new Date().toISOString()`) and stamp each new transaction object with `createdAt`
    - Legacy transactions loaded from storage that lack `createdAt` should fall back to `'1970-01-01T00:00:00.000Z'` in sort/grouping logic (handle in callers, not here)
    - _Requirements: 3.1_

- [ ] 2. Implement Category Manager pure functions in `js/logic.js`
  - [x] 2.1 Implement `loadCategories(storage)` — reads `expense-visualizer-categories` from storage, parses the JSON array of custom names, merges with `DEFAULT_CATEGORIES = ['Food','Transport','Fun']`, and returns the full list; returns defaults only on missing key or malformed JSON
    - _Requirements: 1.1, 1.8_
  - [x] 2.2 Implement `saveCategories(storage, allCategories)` — filters out defaults, persists remaining custom names as a JSON array to `expense-visualizer-categories`; swallows storage quota errors silently
    - _Requirements: 1.2, 1.6_
  - [x] 2.3 Implement `validateCategoryName(currentCategories, name)` — returns `{ valid: false, error }` for empty/whitespace input or for a case-insensitive duplicate; returns `{ valid: true }` otherwise
    - _Requirements: 1.3, 1.4_
  - [x] 2.4 Implement `addCategory(currentCategories, newName)` — calls `validateCategoryName`, returns `{ ok: false, error }` on failure or `{ ok: true, categories }` with updated list on success
    - _Requirements: 1.2, 1.3, 1.4_
  - [x] 2.5 Write property test for `addCategory` duplicate rejection (Property 1)
    - **Property 1: Duplicate category names are rejected (case-insensitive)**
    - **Validates: Requirements 1.3**
    - Generate existing category list and pick a name from it (varying case); assert `addCategory` returns `{ ok: false }`
  - [x] 2.6 Implement `deleteCategory(currentCategories, name)` — returns `{ ok: false, error }` when `name` is a default category; returns `{ ok: true, categories }` with the name removed otherwise
    - _Requirements: 1.6, 1.7_
  - [x] 2.7 Write property test for `addCategory`/`deleteCategory` round trip (Property 2)
    - **Property 2: Custom category add/delete is a round trip**
    - **Validates: Requirements 1.2, 1.6**
    - Generate a category list and a valid new name; add then delete; assert result equals original list
  - [x] 2.8 Write property test for category storage round trip (Property 3)
    - **Property 3: Category storage round trip preserves defaults**
    - **Validates: Requirements 1.1, 1.8**
    - Generate custom category array; call `saveCategories` then `loadCategories`; assert all three defaults present plus saved custom names, nothing extra
  - [x] 2.9 Write property test for default categories undeletable (Property 4)
    - **Property 4: Default categories cannot be deleted**
    - **Validates: Requirements 1.7**
    - Use `fc.constantFrom('Food','Transport','Fun')` as target; assert `deleteCategory` returns `{ ok: false }`

- [ ] 3. Update `validateTransaction` and `getSpendingByCategory` to use dynamic categories
  - [x] 3.1 Change `validateTransaction` signature in `js/app.js` to `validateTransaction({ name, amount, category }, validCategories)` and replace the hardcoded `VALID_CATEGORIES` check with a lookup against the passed-in array; update all call sites
    - _Requirements: 1.1, 1.5_
  - [x] 3.2 Write property test for dynamic validator (Property 5)
    - **Property 5: Validator accepts and rejects based on current category list**
    - **Validates: Requirements 1.1, 1.5**
    - Generate a categories list and a category string; assert `validateTransaction` returns `valid: true` iff the string is present in the list
  - [x] 3.3 Move `getSpendingByCategory` to `js/logic.js` as a pure function `getSpendingByCategory(transactions, categories)` that builds a zero-initialised result for every entry in `categories` then accumulates amounts; remove the hardcoded version from `js/app.js` and update the call site
    - _Requirements: 1.1, 2.2_
  - [x] 3.4 Write property test for `getSpendingByCategory` sums to total (Property 6)
    - **Property 6: `getSpendingByCategory` sums to total balance**
    - **Validates: Requirements 2.2**
    - Generate transaction list and categories array; assert sum of all values equals `getTotalBalance` result

- [ ] 4. Implement `sortTransactions` and `groupByMonth` pure functions in `js/logic.js`
  - [x] 4.1 Implement `sortTransactions(transactions, sort)` — accepts a `SortKey` (`'newest' | 'amount-asc' | 'amount-desc' | 'category-az'`), returns a new sorted array without mutating the input; missing `createdAt` falls back to `'1970-01-01T00:00:00.000Z'`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 4.2 Write property test for `sortTransactions` is a permutation (Property 9)
    - **Property 9: `sortTransactions` is a permutation**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - Generate transaction list × `fc.constantFrom('newest','amount-asc','amount-desc','category-az')`; assert same length, same elements
  - [x] 4.3 Write property test for `sortTransactions` ordering invariants (Property 10)
    - **Property 10: `sortTransactions` produces correctly ordered output**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - For each sort key assert pairwise ordering invariant across consecutive result pairs
  - [x] 4.4 Implement `groupByMonth(transactions)` — groups by `"Month YYYY"` label derived from `createdAt`, returns `MonthGroup[]` sorted newest-month-first, transactions within each group in chronological order; empty input returns `[]`
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 4.5 Write property test for `groupByMonth` exhaustiveness and ordering (Property 7)
    - **Property 7: `groupByMonth` is exhaustive, non-overlapping, and chronologically ordered within groups**
    - **Validates: Requirements 2.1, 2.3**
    - Generate transaction list with random ISO `createdAt` values; assert union of all group transactions equals input; each transaction in correct month group; within-group chronological order
  - [x] 4.6 Write property test for `groupByMonth` group totals (Property 8)
    - **Property 8: `groupByMonth` group totals equal the sum of amounts in each group**
    - **Validates: Requirements 2.2**
    - Same generator; for every group assert `total === sum(group.transactions.map(t => t.amount))`

- [x] 5. Checkpoint — Ensure all logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Add HTML structure for new controls in `index.html`
  - [x] 6.1 Add `<section class="categories-section">` before the form section containing: `<input id="new-category-input">`, `<button id="add-category-btn">Add</button>`, `<ul id="category-list">`, and `<span class="error-msg" data-field="category-name">`
    - _Requirements: 1.2, 1.3, 1.4, 1.6, 1.7_
  - [x] 6.2 Add `<button id="toggle-view-btn">Monthly Summary</button>` in the `.list-section` header area and a `<select id="sort-control">` with options `newest`, `amount-asc`, `amount-desc`, `category-az` above `#transaction-list`
    - _Requirements: 2.1, 2.6, 3.1, 3.5, 3.6_

- [ ] 7. Wire up Category Manager DOM handlers in `js/app.js`
  - [x] 7.1 On `init`, call `loadCategories(localStorage)` to populate an in-memory `categories` array; call a `renderCategoryList()` helper that rebuilds `#category-list` items (each with a Delete button for custom categories only) and refreshes the `#category` dropdown options
    - _Requirements: 1.1, 1.5, 1.8_
  - [x] 7.2 Add click handler for `#add-category-btn`: read `#new-category-input`, call `addCategory`, on success update `categories`, call `saveCategories`, call `renderCategoryList` and `renderAll`; on failure show error in `[data-field="category-name"]`
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
  - [x] 7.3 Add delegated click handler on `#category-list` for Delete buttons: call `deleteCategory`, on success update `categories`, call `saveCategories`, call `renderCategoryList` and `renderAll`; on failure show inline error
    - _Requirements: 1.6, 1.7_

- [ ] 8. Wire up Sort and Monthly Summary toggle in `js/app.js`
  - [x] 8.1 Add module-level state variables `let currentSort = 'newest'` and `let isMonthlySummaryActive = false`; update `renderAll` to branch on `isMonthlySummaryActive` — calling `renderMonthlySummary` or `renderTransactionList(sortTransactions(transactions, currentSort))` accordingly; hide/show `#sort-control` based on the toggle state
    - _Requirements: 2.1, 2.4, 2.6, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [x] 8.2 Add `change` handler for `#sort-control`: update `currentSort`, call `renderAll`
    - _Requirements: 3.2, 3.3, 3.4_
  - [x] 8.3 Add `click` handler for `#toggle-view-btn`: flip `isMonthlySummaryActive`, update button text, call `renderAll`
    - _Requirements: 2.1, 2.6_

- [ ] 9. Implement `renderMonthlySummary` and update `renderChart` in `js/app.js`
  - [x] 9.1 Implement `renderMonthlySummary()` in `js/app.js` — calls `groupByMonth(transactions)`, renders each `MonthGroup` as a section header (`<li>` with month label + total) followed by individual transaction rows; shows placeholder when result is empty
    - _Requirements: 2.2, 2.3, 2.5_
  - [x] 9.2 Update `renderChart` to accept a `categories` parameter and use the dynamic `CUSTOM_COLORS` palette (`['#4BC0C0','#9966FF','#FF9F40','#C9CBCF','#E7E9ED','#71B37C','#F77825','#D62728']`) for custom categories assigned by index modulo palette length, while keeping the three defaults' existing colors (`#FF6384`, `#36A2EB`, `#FFCE56`)
    - _Requirements: 1.1_

- [ ] 10. Add CSS for new controls in `css/styles.css`
  - [x] 10.1 Add styles for `.categories-section` (card layout matching existing sections), `#new-category-input` / `#add-category-btn` (inline row), `#category-list` items with their delete buttons, `#toggle-view-btn`, `#sort-control`, and `.month-group-header` (bold label + total)
    - _Requirements: 1.2, 2.1, 3.1_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties defined in the design document
- Unit tests and property tests are complementary — both should be in `js/app.test.js`
- All logic functions are pure (no DOM, no localStorage dependency injected via parameter) and should live in `js/logic.js`
