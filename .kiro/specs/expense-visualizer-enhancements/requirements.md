# Requirements Document

## Introduction

This document defines requirements for three optional enhancements to the existing Expense & Budget Visualizer web application. The enhancements are:

1. **Custom Categories** — Allow users to define their own spending categories beyond the fixed set of Food, Transport, and Fun.
2. **Monthly Summary View** — Allow users to view transactions grouped and summarized by calendar month.
3. **Sort Transactions** — Allow users to sort the transaction list by amount or category.

The app remains a client-side-only application with no backend, built with plain HTML, CSS, and Vanilla JavaScript, with all data persisted in the browser's Local Storage.

## Glossary

- **App**: The Expense & Budget Visualizer web application
- **Transaction**: A single expense entry consisting of an item name, amount, category, and timestamp
- **Category**: A user-defined or default spending label assigned to a Transaction
- **Default_Categories**: The three built-in categories shipped with the app: Food, Transport, and Fun
- **Custom_Category**: A user-defined category created at runtime and stored in Local_Storage
- **Category_Manager**: The logic component responsible for managing the list of available categories (both default and custom)
- **Transaction_List**: The scrollable UI component that displays all recorded transactions
- **Monthly_Summary**: A read-only view that groups and aggregates transactions by calendar month
- **Sort_Control**: The UI control that allows the user to select the current sort order for the Transaction_List
- **Input_Form**: The UI form component used to create new transactions
- **Balance_Display**: The UI component showing the total sum of all transaction amounts
- **Chart**: The pie chart component that visualizes spending distribution by category
- **Local_Storage**: The browser's built-in client-side key-value storage API
- **Validator**: The logic component responsible for checking form input correctness before submission

---

## Requirements

### Requirement 1: Manage Custom Categories

**User Story:** As a user, I want to create and delete my own spending categories, so that I can track expenses in ways that match my personal budget.

#### Acceptance Criteria

1. THE Category_Manager SHALL maintain a list of available categories that includes the Default_Categories (Food, Transport, Fun) plus any Custom_Categories created by the user.
2. WHEN the user submits a non-empty, unique category name, THE Category_Manager SHALL add it to the available category list and persist it to Local_Storage.
3. IF the user submits a category name that already exists (case-insensitive), THEN THE Validator SHALL reject the submission and display an inline error message.
4. IF the user submits an empty or whitespace-only category name, THEN THE Validator SHALL reject the submission and display an inline error message.
5. WHEN a Custom_Category is added, THE Input_Form category dropdown SHALL update immediately to include the new category.
6. WHEN the user deletes a Custom_Category, THE Category_Manager SHALL remove it from the available category list and update Local_Storage.
7. IF the user attempts to delete a Default_Category, THEN THE Category_Manager SHALL reject the deletion and display an inline error message.
8. WHEN the App loads, THE Category_Manager SHALL read any previously saved Custom_Categories from Local_Storage and restore them alongside the Default_Categories.

---

### Requirement 2: Monthly Summary View

**User Story:** As a user, I want to see my transactions grouped and totalled by month, so that I can understand how my spending changes over time.

#### Acceptance Criteria

1. THE App SHALL provide a Monthly_Summary view that groups all Transactions by their calendar month and year (e.g. "April 2025").
2. WHEN the user activates the Monthly_Summary view, THE App SHALL display each month as a section header with the total spending amount for that month below it.
3. WHEN the user activates the Monthly_Summary view, THE App SHALL display the individual Transactions under each month section in chronological order.
4. WHEN a Transaction is added or deleted, THE Monthly_Summary SHALL update automatically to reflect the current data.
5. WHEN no transactions exist, THE Monthly_Summary SHALL display a placeholder message indicating that no data is available.
6. THE App SHALL allow the user to toggle between the standard Transaction_List view and the Monthly_Summary view without losing any data.

---

### Requirement 3: Sort Transactions

**User Story:** As a user, I want to sort my transaction list by amount or category, so that I can quickly find and compare my expenses.

#### Acceptance Criteria

1. THE Sort_Control SHALL offer the following sort options: default order (date added, newest first), amount ascending, amount descending, and category name (A–Z).
2. WHEN the user selects a sort option, THE Transaction_List SHALL re-render immediately in the chosen order.
3. WHEN a new Transaction is added while a non-default sort is active, THE Transaction_List SHALL re-render in the currently selected sort order after the addition.
4. WHEN a Transaction is deleted while a non-default sort is active, THE Transaction_List SHALL re-render in the currently selected sort order after the deletion.
5. THE Sort_Control SHALL default to the default order (date added, newest first) when the App loads.
6. WHEN the user switches to the Monthly_Summary view, THE Sort_Control SHALL be hidden, as sorting applies to the Transaction_List view only.
