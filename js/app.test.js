// @vitest-environment jsdom
// Feature: expense-budget-visualizer
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  validateTransaction,
  getTotalBalance,
  getSpendingByCategory,
  addTransactionToList,
  deleteTransactionFromList,
  saveTransactions,
  loadTransactions,
  VALID_CATEGORIES,
} from './logic.js';
import { renderTransactionList } from './app.js';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------
const validName = fc.string({ minLength: 1 }).map(s => s.trim()).filter(s => s.length > 0);
const validAmount = fc
  .float({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true })
  .filter(n => n > 0 && isFinite(n));
const validCategory = fc.constantFrom(...VALID_CATEGORIES);

const validTransaction = fc.record({
  id: fc.uuid(),
  name: validName,
  amount: validAmount,
  category: validCategory,
});

const validTransactionList = fc.array(validTransaction);

// ---------------------------------------------------------------------------
// Feature: expense-budget-visualizer, Property 1: Validator rejects all invalid inputs
// Validates: Requirements 1.4, 1.5
// ---------------------------------------------------------------------------
describe('Property 1: Validator rejects all invalid inputs', () => {
  it('rejects empty or whitespace-only name', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(''), fc.string().map(s => s.replace(/\S/g, ' '))),
        validAmount,
        validCategory,
        (name, amount, category) => {
          const result = validateTransaction({ name, amount, category });
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.field === 'name')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects non-positive or non-numeric amount', () => {
    fc.assert(
      fc.property(
        validName,
        fc.oneof(
          fc.constant(0),
          fc.constant(-1),
          fc.constant(NaN),
          fc.constant(Infinity),
          fc.constant(-Infinity),
          fc.integer({ max: 0 })
        ),
        validCategory,
        (name, amount, category) => {
          const result = validateTransaction({ name, amount, category });
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.field === 'amount')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects invalid category', () => {
    fc.assert(
      fc.property(
        validName,
        validAmount,
        fc.string().filter(s => !VALID_CATEGORIES.includes(s)),
        (name, amount, category) => {
          const result = validateTransaction({ name, amount, category });
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.field === 'category')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Adding a transaction grows the list
// Validates: Requirements 1.2
// ---------------------------------------------------------------------------
describe('Property 2: Adding a transaction grows the list', () => {
  it('list length increases by 1 and new entry is present', () => {
    fc.assert(
      fc.property(
        validTransactionList,
        fc.record({ name: validName, amount: validAmount, category: validCategory }),
        (list, newTx) => {
          const result = addTransactionToList(list, newTx);
          expect(result.length).toBe(list.length + 1);
          const added = result[result.length - 1];
          expect(added.name).toBe(newTx.name);
          expect(added.amount).toBe(newTx.amount);
          expect(added.category).toBe(newTx.category);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Deletion removes exactly one transaction
// Validates: Requirements 3.2, 3.3
// ---------------------------------------------------------------------------
describe('Property 3: Deletion removes exactly one transaction', () => {
  // Feature: expense-budget-visualizer, Property 3: Deletion removes exactly one transaction
  it('list length decreases by 1 and id is absent', () => {
    fc.assert(
      fc.property(
        fc.array(validTransaction, { minLength: 1 }),
        fc.integer({ min: 0, max: 99 }),
        (list, idx) => {
          const target = list[idx % list.length];
          const result = deleteTransactionFromList(list, target.id);
          expect(result.length).toBe(list.length - 1);
          expect(result.some(t => t.id === target.id)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Balance equals sum of amounts
// Validates: Requirements 4.1, 4.2, 4.3, 4.4
// ---------------------------------------------------------------------------
describe('Property 4: Balance equals sum of amounts', () => {
  it('getTotalBalance equals reduce sum', () => {
    fc.assert(
      fc.property(validTransactionList, (list) => {
        const expected = list.reduce((s, t) => s + t.amount, 0);
        expect(getTotalBalance(list)).toBeCloseTo(expected, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('returns 0 for empty array', () => {
    expect(getTotalBalance([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Property 5: Spending by category sums to total balance
// Validates: Requirements 5.1, 5.2, 5.3, 5.4
// ---------------------------------------------------------------------------
describe('Property 5: Spending by category sums to total balance', () => {
  it('sum of category values equals total balance', () => {
    fc.assert(
      fc.property(validTransactionList, (list) => {
        const byCategory = getSpendingByCategory(list);
        const categorySum = Object.values(byCategory).reduce((s, v) => s + v, 0);
        const total = getTotalBalance(list);
        expect(categorySum).toBeCloseTo(total, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('empty categories have value 0', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ id: fc.uuid(), name: validName, amount: validAmount, category: fc.constant('Food') })
        ),
        (list) => {
          const byCategory = getSpendingByCategory(list);
          expect(byCategory.Transport).toBe(0);
          expect(byCategory.Fun).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Local Storage round-trip
// Validates: Requirements 6.1, 6.2, 6.3
// ---------------------------------------------------------------------------
describe('Property 6: Local Storage round-trip', () => {
  // Feature: expense-budget-visualizer, Property 6: Local Storage round-trip
  it('save then load returns deeply equal array', () => {
    fc.assert(
      fc.property(validTransactionList, (list) => {
        const mockStorage = (() => {
          const store = {};
          return {
            getItem: (key) => (key in store ? store[key] : null),
            setItem: (key, value) => { store[key] = value; },
          };
        })();
        saveTransactions(mockStorage, list);
        const loaded = loadTransactions(mockStorage);
        expect(loaded).toEqual(list);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: expense-budget-visualizer, Property 7: Transaction list renders all required fields and delete control
// Validates: Requirements 2.1, 3.1
// ---------------------------------------------------------------------------
describe('Property 7: Transaction list renders all required fields and delete control', () => {
  beforeEach(() => {
    // Set up a mock #transaction-list element in the jsdom document
    document.body.innerHTML = '<ul id="transaction-list"></ul>';
  });

  it('renders name, amount, category, and delete control with data-id for each transaction', () => {
    fc.assert(
      fc.property(
        fc.array(validTransaction, { minLength: 1 }),
        (transactions) => {
          renderTransactionList(transactions);
          const list = document.getElementById('transaction-list');

          transactions.forEach((tx) => {
            // Name is present in the list (check textContent to handle HTML-escaped chars)
            const nameSpans = Array.from(list.querySelectorAll('.transaction-name'));
            expect(nameSpans.some(el => el.textContent === tx.name)).toBe(true);

            // Amount is present (rendered via toFixed(2))
            expect(list.innerHTML).toContain(tx.amount.toFixed(2));

            // Category is present (check textContent to handle HTML-escaped chars)
            const metaSpans = Array.from(list.querySelectorAll('.transaction-meta'));
            expect(metaSpans.some(el => el.textContent === tx.category)).toBe(true);

            // Delete control with data-id attribute is present
            const deleteBtn = list.querySelector(`[data-id="${tx.id}"]`);
            expect(deleteBtn).not.toBeNull();
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
