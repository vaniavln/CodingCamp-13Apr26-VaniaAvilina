# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a fully client-side single-page web application using plain HTML, CSS, and Vanilla JavaScript. The app allows users to add/delete expense transactions, view a running balance, and see a pie chart of spending by category. All data is persisted in Local Storage. No frameworks, no build tools, no backend.

## Tasks

- [x] 1. Set up project file structure and HTML skeleton
  - Create `index.html` with the full page layout: input form section, balance display, transaction list, and canvas element for the chart
  - Create `css/styles.css` with base styles (layout, form, list, canvas, error messages)
  - Create `js/app.js` as an empty module scaffold with section comments for each logical module
  - Wire `index.html` to load `css/styles.css` and `js/app.js`
  - _Requirements: 9.1, 9.2_

- [x] 2. Implement the Validator module
  - [x] 2.1 Write the `validateTransaction` function in `js/app.js`
    - Validate `name` is non-empty after trimming
    - Validate `amount` is a finite number greater than 0
    - Validate `category` is one of `['Food', 'Transport', 'Fun']`
    - Return `{ valid: boolean, errors: [{ field, message }] }`
    - _Requirements: 1.4, 1.5_

  - [x] 2.2 Write property test for Validator (Property 1)
    - **Property 1: Validator rejects all invalid inputs**
    - Use fast-check to generate combinations with empty/whitespace name, non-positive/non-numeric amount, or invalid category
    - Verify validator returns `valid: false` and identifies the offending fields
    - **Validates: Requirements 1.4, 1.5**

- [x] 3. Implement the Storage module
  - [x] 3.1 Write `saveTransactions` and `loadTransactions` functions in `js/app.js`
    - `saveTransactions`: JSON-serialize and write to `localStorage` key `"expense-visualizer-transactions"`; wrap in `try/catch`
    - `loadTransactions`: read and `JSON.parse` from the same key; fall back to `[]` on missing key or malformed JSON
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 3.2 Write property test for Storage round-trip (Property 6)
    - **Property 6: Local Storage round-trip**
    - Generate random transaction arrays; call `saveTransactions` then `loadTransactions` with a mock `localStorage`; verify deep equality
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 4. Implement the State Manager module
  - [x] 4.1 Write the in-memory state and `addTransaction`, `deleteTransaction`, `getTransactions` functions in `js/app.js`
    - Initialize `transactions` array; hydrate from `loadTransactions()` on startup
    - `addTransaction`: push a new Transaction object (with `crypto.randomUUID()` id), call `saveTransactions`, then `renderAll`
    - `deleteTransaction`: filter out by id, call `saveTransactions`, then `renderAll`
    - _Requirements: 1.2, 3.2, 6.1, 6.2_

  - [x] 4.2 Write property test for addTransaction (Property 2)
    - **Property 2: Adding a transaction grows the list**
    - Generate random valid transactions and existing lists; verify list length is +1 and the new entry is present
    - **Validates: Requirements 1.2**

  - [x] 4.3 Write property test for deleteTransaction (Property 3)
    - **Property 3: Deletion removes exactly one transaction**
    - Generate random lists with a known id; call `deleteTransaction`; verify count is -1 and id is absent
    - **Validates: Requirements 3.2, 3.3**

  - [x] 4.4 Write `getTotalBalance` function in `js/app.js`
    - Sum all `amount` values in the transactions array; return 0 for empty array
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 4.5 Write property test for getTotalBalance (Property 4)
    - **Property 4: Balance equals sum of amounts**
    - Generate random transaction arrays; compare `getTotalBalance()` to `array.reduce((s,t) => s + t.amount, 0)`
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [x] 4.6 Write `getSpendingByCategory` function in `js/app.js`
    - Group and sum amounts by category; return `{ Food: number, Transport: number, Fun: number }` with 0 for empty categories
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 4.7 Write property test for getSpendingByCategory (Property 5)
    - **Property 5: Spending by category sums to total balance**
    - Generate random transaction arrays; verify sum of `getSpendingByCategory()` values equals `getTotalBalance()`
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [x] 5. Checkpoint — Ensure all pure-logic tests pass
  - Ensure all tests pass for Validator, State Manager, and Storage modules; ask the user if questions arise.

- [x] 6. Implement DOM renderers
  - [x] 6.1 Write `renderTransactionList(transactions)` function in `js/app.js`
    - If empty, render a placeholder message inside `#transaction-list`
    - For each transaction, render name, amount, category, and a delete button with `data-id` attribute
    - Apply `.transaction-item`, `.transaction-info`, `.transaction-name`, `.transaction-meta`, `.transaction-amount`, and `.delete-btn` CSS classes per the existing stylesheet
    - _Requirements: 2.1, 2.2, 2.3, 3.1_

  - [x] 6.2 Write property test for renderTransactionList (Property 7)
    - **Property 7: Transaction list renders all required fields and delete control**
    - Generate random non-empty transaction arrays; call `renderTransactionList`; verify name, amount, category, and `data-id` delete control are present for each entry
    - **Validates: Requirements 2.1, 3.1**

  - [x] 6.3 Write `renderBalance(total)` function in `js/app.js`
    - Update the text content of `#balance-display` with the formatted total (e.g. `$25.00`)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.4 Write `renderChart(spendingByCategory)` function in `js/app.js`
    - Draw a pie chart on `#spending-chart` using the Canvas 2D API (no external library)
    - Use fixed colors: Food → `#FF6384`, Transport → `#36A2EB`, Fun → `#FFCE56`
    - If all values are zero, render an empty-state placeholder text on the canvas
    - Draw a legend below the chart
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7. Implement the Input Form module
  - [x] 7.1 Write `getFormValues`, `resetForm`, `showFormError`, and `clearFormErrors` functions in `js/app.js`
    - `getFormValues`: read values from `#item-name`, `#amount`, `#category`
    - `resetForm`: clear all input fields back to defaults
    - `showFormError(field, message)`: display inline error text in the `[data-field]` `.error-msg` span for the given field; add `.invalid` class to the input
    - `clearFormErrors`: hide/clear all `.error-msg` spans and remove `.invalid` classes
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

- [x] 8. Implement the App Controller and wire everything together
  - [x] 8.1 Write `renderAll` function in `js/app.js`
    - Call `renderTransactionList(getTransactions())`, `renderBalance(getTotalBalance())`, and `renderChart(getSpendingByCategory())`
    - _Requirements: 3.3, 4.2, 4.3, 5.2, 5.3_

  - [x] 8.2 Write `handleAddTransaction` function in `js/app.js`
    - Call `getFormValues`, run `validateTransaction`
    - On invalid: call `showFormError` for each error field and return
    - On valid: call `addTransaction` (which saves and re-renders), then `resetForm` and `clearFormErrors`
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 8.3 Write `handleDeleteTransaction(id)` function in `js/app.js`
    - Call `deleteTransaction(id)` (which saves and re-renders)
    - _Requirements: 3.2, 3.3_

  - [x] 8.4 Write `init` function and attach event listeners in `js/app.js`
    - On `DOMContentLoaded`: call `loadTransactions` to hydrate state, then call `renderAll`
    - Attach click listener on `#add-btn` → `handleAddTransaction`
    - Attach delegated click listener on `#transaction-list` for delete buttons → `handleDeleteTransaction`
    - _Requirements: 6.3, 6.4_

- [x] 9. Final checkpoint — Ensure all tests pass and app is functional
  - Run all property-based and unit tests
  - Verify the app opens correctly from the file system (`file://`) in Chrome, Firefox, Edge, and Safari
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 7.1, 7.2, 8.1, 8.2_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use **fast-check** with a minimum of 100 iterations per property
- Each property test file should include a comment: `// Feature: expense-budget-visualizer, Property N: <property_text>`
- The Storage module tests should use a mock `localStorage` object to avoid real browser dependency
- All state mutations flow through the State Manager — renderers are always called after state changes
