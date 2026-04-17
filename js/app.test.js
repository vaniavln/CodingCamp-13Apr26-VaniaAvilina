// @vitest-environment jsdom
// Feature: expense-budget-visualizer
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  validateTransaction,
  validateCategoryName,
  getTotalBalance,
  getSpendingByCategory,
  addTransactionToList,
  deleteTransactionFromList,
  saveTransactions,
  loadTransactions,
  loadCategories,
  saveCategories,
  DEFAULT_CATEGORIES,
  VALID_CATEGORIES,
} from './logic.js';
import { renderTransactionList } from './app.js';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------
const validName = fc.string({ minLength: 1 }).map(s => s.trim()).filter(s => s.length > 0);
const validAmount = fc
  .float({ min: Math.fround(0.01), max: Math.fround(1_000_000), noNaN: true, noDefaultInfinity: true })
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
        const byCategory = getSpendingByCategory(list, VALID_CATEGORIES);
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
          const byCategory = getSpendingByCategory(list, VALID_CATEGORIES);
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

// ---------------------------------------------------------------------------
// Task 2.1: loadCategories — unit tests
// Validates: Requirements 1.1, 1.8
// ---------------------------------------------------------------------------
describe('loadCategories', () => {
  function makeMockStorage(value) {
    return {
      getItem: (key) => (key === 'expense-visualizer-categories' ? value : null),
    };
  }

  it('returns only defaults when key is missing', () => {
    const result = loadCategories(makeMockStorage(null));
    expect(result).toEqual(DEFAULT_CATEGORIES);
  });

  it('returns only defaults on malformed JSON', () => {
    const result = loadCategories(makeMockStorage('not-json{{{'));
    expect(result).toEqual(DEFAULT_CATEGORIES);
  });

  it('returns only defaults when stored value is not an array', () => {
    const result = loadCategories(makeMockStorage(JSON.stringify({ cat: 'Rent' })));
    expect(result).toEqual(DEFAULT_CATEGORIES);
  });

  it('merges custom categories with defaults on valid data', () => {
    const custom = ['Rent', 'Gym'];
    const result = loadCategories(makeMockStorage(JSON.stringify(custom)));
    expect(result).toEqual([...DEFAULT_CATEGORIES, ...custom]);
  });

  it('always includes all three default categories', () => {
    const custom = ['Subscriptions'];
    const result = loadCategories(makeMockStorage(JSON.stringify(custom)));
    expect(result).toContain('Food');
    expect(result).toContain('Transport');
    expect(result).toContain('Fun');
  });

  it('does not directly reference localStorage (pure function via injected storage)', () => {
    let called = false;
    const fakeStorage = {
      getItem: (key) => { called = true; return null; },
    };
    loadCategories(fakeStorage);
    expect(called).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 2.2: saveCategories — unit tests
// Validates: Requirements 1.2, 1.6
// ---------------------------------------------------------------------------
describe('saveCategories', () => {
  function makeMockStorage() {
    const store = {};
    return {
      setItem: (key, value) => { store[key] = value; },
      getItem: (key) => store[key] ?? null,
      _store: store,
    };
  }

  it('persists only custom categories (filters out defaults)', () => {
    const storage = makeMockStorage();
    saveCategories(storage, [...DEFAULT_CATEGORIES, 'Rent', 'Gym']);
    const saved = JSON.parse(storage.getItem('expense-visualizer-categories'));
    expect(saved).toEqual(['Rent', 'Gym']);
  });

  it('writes an empty array when all categories are defaults', () => {
    const storage = makeMockStorage();
    saveCategories(storage, [...DEFAULT_CATEGORIES]);
    const saved = JSON.parse(storage.getItem('expense-visualizer-categories'));
    expect(saved).toEqual([]);
  });

  it('uses the correct localStorage key', () => {
    const storage = makeMockStorage();
    saveCategories(storage, ['Rent']);
    expect(storage.getItem('expense-visualizer-categories')).not.toBeNull();
  });

  it('swallows storage quota errors silently', () => {
    const badStorage = {
      setItem: () => { throw new DOMException('QuotaExceededError'); },
    };
    expect(() => saveCategories(badStorage, ['Rent'])).not.toThrow();
  });

  it('does not write default categories to storage', () => {
    const storage = makeMockStorage();
    saveCategories(storage, [...DEFAULT_CATEGORIES, 'Subscriptions']);
    const saved = JSON.parse(storage.getItem('expense-visualizer-categories'));
    DEFAULT_CATEGORIES.forEach((def) => expect(saved).not.toContain(def));
  });
});

// ---------------------------------------------------------------------------
// Task 2.3: validateCategoryName — unit tests
// Validates: Requirements 1.3, 1.4
// ---------------------------------------------------------------------------
describe('validateCategoryName', () => {
  it('returns invalid for empty string', () => {
    const result = validateCategoryName(['Food'], '');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Category name is required.');
  });

  it('returns invalid for whitespace-only string', () => {
    const result = validateCategoryName(['Food'], '   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Category name is required.');
  });

  it('returns invalid for case-insensitive duplicate', () => {
    const result = validateCategoryName(['Food', 'Transport'], 'food');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Category already exists.');
  });

  it('returns invalid for exact-case duplicate', () => {
    const result = validateCategoryName(['Rent'], 'Rent');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Category already exists.');
  });

  it('returns valid for a unique name', () => {
    const result = validateCategoryName(['Food', 'Transport', 'Fun'], 'Rent');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns valid for empty category list', () => {
    const result = validateCategoryName([], 'Anything');
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 2.4: addCategory — unit tests
// Validates: Requirements 1.2, 1.3, 1.4
// ---------------------------------------------------------------------------
import { addCategory } from './logic.js';

describe('addCategory', () => {
  it('returns ok:false with error for empty name', () => {
    const result = addCategory(['Food'], '');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Category name is required.');
  });

  it('returns ok:false with error for whitespace-only name', () => {
    const result = addCategory(['Food'], '   ');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Category name is required.');
  });

  it('returns ok:false with error for case-insensitive duplicate', () => {
    const result = addCategory(['Food', 'Transport'], 'food');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Category already exists.');
  });

  it('returns ok:true with updated categories on valid name', () => {
    const result = addCategory(['Food', 'Transport', 'Fun'], 'Rent');
    expect(result.ok).toBe(true);
    expect(result.categories).toEqual(['Food', 'Transport', 'Fun', 'Rent']);
  });

  it('trims the new name before appending', () => {
    const result = addCategory(['Food'], '  Gym  ');
    expect(result.ok).toBe(true);
    expect(result.categories).toContain('Gym');
    expect(result.categories).not.toContain('  Gym  ');
  });

  it('does not mutate the input array', () => {
    const original = ['Food', 'Transport'];
    const copy = [...original];
    addCategory(original, 'Rent');
    expect(original).toEqual(copy);
  });

  it('works with an empty category list', () => {
    const result = addCategory([], 'Rent');
    expect(result.ok).toBe(true);
    expect(result.categories).toEqual(['Rent']);
  });
});

// ---------------------------------------------------------------------------
// Task 2.5: Property 1 — Duplicate category names are rejected (case-insensitive)
// Feature: expense-visualizer-enhancements, Property 1: Duplicate category names are rejected (case-insensitive)
// Validates: Requirements 1.3
// ---------------------------------------------------------------------------
describe('Feature: expense-visualizer-enhancements, Property 1: Duplicate category names are rejected (case-insensitive)', () => {
  it('addCategory returns { ok: false } for any case variant of an existing category name', () => {
    fc.assert(
      fc.property(
        // Generate a non-empty array of category strings
        fc.array(
          fc.string({ minLength: 1 }).map(s => s.trim()).filter(s => s.length > 0),
          { minLength: 1 }
        ),
        // Pick an index to select a name from the list
        fc.integer({ min: 0, max: 99 }),
        // Generate a case-variation seed: 0 = uppercase, 1 = lowercase, 2 = mixed
        fc.integer({ min: 0, max: 2 }),
        (categories, idx, caseVariant) => {
          const picked = categories[idx % categories.length];
          let variedName;
          if (caseVariant === 0) {
            variedName = picked.toUpperCase();
          } else if (caseVariant === 1) {
            variedName = picked.toLowerCase();
          } else {
            // Mixed: alternate upper/lower per character
            variedName = picked
              .split('')
              .map((ch, i) => (i % 2 === 0 ? ch.toUpperCase() : ch.toLowerCase()))
              .join('');
          }
          const result = addCategory(categories, variedName);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 2.7: Property 2 — Custom category add/delete is a round trip
// Feature: expense-visualizer-enhancements, Property 2: Custom category add/delete is a round trip
// Validates: Requirements 1.2, 1.6
// ---------------------------------------------------------------------------
import { deleteCategory } from './logic.js';

describe('Feature: expense-visualizer-enhancements, Property 2: Custom category add/delete is a round trip', () => {
  it('adding then deleting a valid new category returns the original list', () => {
    fc.assert(
      fc.property(
        // Generate a category list starting from defaults, optionally with custom ones
        fc.array(
          fc.string({ minLength: 1 }).map(s => s.trim()).filter(s => s.length > 0),
          { minLength: 0, maxLength: 5 }
        ).map(custom => [...DEFAULT_CATEGORIES, ...custom])
          .map(arr => [...new Set(arr)]),
        // Generate a valid new name: non-empty, non-whitespace
        fc.string({ minLength: 1 }).map(s => s.trim()).filter(s => s.length > 0),
        (categories, newName) => {
          // Precondition: newName must not be a case-insensitive duplicate
          fc.pre(!categories.some(c => c.toLowerCase() === newName.toLowerCase()));

          // Add the new category
          const addResult = addCategory(categories, newName);
          expect(addResult.ok).toBe(true);

          // Delete the newly added category (it was trimmed by addCategory)
          const addedName = newName.trim();
          const deleteResult = deleteCategory(addResult.categories, addedName);
          expect(deleteResult.ok).toBe(true);

          // Final list should equal the original
          expect(deleteResult.categories).toEqual(categories);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 3.2: Property 5 — Validator accepts and rejects based on current category list
// Feature: expense-visualizer-enhancements, Property 5: Validator accepts and rejects based on current category list
// Validates: Requirements 1.1, 1.5
// ---------------------------------------------------------------------------
describe('Feature: expense-visualizer-enhancements, Property 5: Validator accepts and rejects based on current category list', () => {
  const nonEmptyString = fc.string({ minLength: 1 }).map(s => s.trim()).filter(s => s.length > 0);
  const categoriesList = fc.array(nonEmptyString, { minLength: 1 });

  it('returns valid:true when category IS in the list', () => {
    fc.assert(
      fc.property(
        categoriesList,
        fc.integer({ min: 0, max: 99 }),
        validName,
        validAmount,
        (categories, idx, name, amount) => {
          const category = categories[idx % categories.length];
          const result = validateTransaction({ name, amount, category }, categories);
          expect(result.errors.some(e => e.field === 'category')).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns valid:false with category error when category is NOT in the list', () => {
    fc.assert(
      fc.property(
        categoriesList,
        nonEmptyString,
        validName,
        validAmount,
        (categories, category, name, amount) => {
          // Only test when the generated category is not in the list
          fc.pre(!categories.includes(category));
          const result = validateTransaction({ name, amount, category }, categories);
          expect(result.errors.some(e => e.field === 'category')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 3.4: Property 6 — getSpendingByCategory sums to total balance
// Feature: expense-visualizer-enhancements, Property 6: getSpendingByCategory sums to total balance
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------
describe('Feature: expense-visualizer-enhancements, Property 6: getSpendingByCategory sums to total balance', () => {
  it('sum of all category values equals getTotalBalance for any transaction list and categories array', () => {
    // Build a combined arbitrary: first generate a non-empty deduplicated
    // categories array, then use fc.chain to generate transactions whose
    // category is always drawn from that same array so every amount is counted.
    const categoriesArb = fc
      .array(
        fc.string({ minLength: 1 }).map(s => s.trim()).filter(s => s.length > 0),
        { minLength: 1 }
      )
      .map(arr => [...new Set(arr)])
      .filter(arr => arr.length > 0);

    const categoriesAndTransactionsArb = categoriesArb.chain(categories =>
      fc.tuple(
        fc.constant(categories),
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: validName,
            amount: validAmount,
            category: fc.constantFrom(...categories),
            createdAt: fc.date().map(d => d.toISOString()),
          })
        )
      )
    );

    fc.assert(
      fc.property(
        categoriesAndTransactionsArb,
        ([categories, transactions]) => {
          const byCategory = getSpendingByCategory(transactions, categories);
          const categorySum = Object.values(byCategory).reduce((s, v) => s + v, 0);
          const total = getTotalBalance(transactions);
          expect(categorySum).toBeCloseTo(total, 10);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 2.8: Property 3 — Category storage round trip preserves defaults
// Feature: expense-visualizer-enhancements, Property 3: Category storage round trip preserves defaults
// Validates: Requirements 1.1, 1.8
// ---------------------------------------------------------------------------
describe('Feature: expense-visualizer-enhancements, Property 3: Category storage round trip preserves defaults', () => {
  it('saveCategories then loadCategories returns exactly defaults plus custom names', () => {
    // Custom category names: non-empty strings, not duplicates of defaults
    const customCategoryName = fc
      .string({ minLength: 1 })
      .map(s => s.trim())
      .filter(s => s.length > 0 && !DEFAULT_CATEGORIES.some(d => d.toLowerCase() === s.toLowerCase()));

    const customCategoriesArb = fc
      .array(customCategoryName, { minLength: 0, maxLength: 8 })
      .map(arr => [...new Set(arr)]);

    fc.assert(
      fc.property(customCategoriesArb, (customCategories) => {
        const fakeStorage = (() => {
          const store = {};
          return {
            getItem: (key) => (key in store ? store[key] : null),
            setItem: (key, value) => { store[key] = value; },
          };
        })();

        const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];
        saveCategories(fakeStorage, allCategories);
        const loaded = loadCategories(fakeStorage);

        // All three defaults must be present
        DEFAULT_CATEGORIES.forEach(def => {
          expect(loaded).toContain(def);
        });

        // All custom names must be present
        customCategories.forEach(custom => {
          expect(loaded).toContain(custom);
        });

        // No extra items beyond defaults + custom names
        expect(loaded.length).toBe(DEFAULT_CATEGORIES.length + customCategories.length);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 2.9: Property 4 — Default categories cannot be deleted
// Feature: expense-visualizer-enhancements, Property 4: Default categories cannot be deleted
// Validates: Requirements 1.7
// ---------------------------------------------------------------------------
describe('Feature: expense-visualizer-enhancements, Property 4: Default categories cannot be deleted', () => {
  it('deleteCategory returns { ok: false } for any default category name, regardless of the category list', () => {
    // Arbitrary category list that always includes the three defaults
    const categoriesArb = fc
      .array(
        fc.string({ minLength: 1 }).map(s => s.trim()).filter(s => s.length > 0),
        { minLength: 0, maxLength: 5 }
      )
      .map(custom => [...new Set([...DEFAULT_CATEGORIES, ...custom])]);

    fc.assert(
      fc.property(
        categoriesArb,
        fc.constantFrom('Food', 'Transport', 'Fun'),
        (categories, target) => {
          const result = deleteCategory(categories, target);
          expect(result.ok).toBe(false);
          expect(result.error).toBeTruthy();
          // The category list must be unchanged (no categories field, or same as input)
          if (result.categories !== undefined) {
            expect(result.categories).toEqual(categories);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 4.2: Property 9 — sortTransactions is a permutation
// Feature: expense-visualizer-enhancements, Property 9: sortTransactions is a permutation
// Validates: Requirements 3.1, 3.2, 3.3, 3.4
// ---------------------------------------------------------------------------
import { sortTransactions } from './logic.js';

describe('Feature: expense-visualizer-enhancements, Property 9: sortTransactions is a permutation', () => {
  it('returns an array with the same length and same elements for any sort key', () => {
    const transactionArb = fc.record({
      id: fc.uuid(),
      name: validName,
      amount: validAmount,
      category: validCategory,
      createdAt: fc.date().map(d => d.toISOString()),
    });

    fc.assert(
      fc.property(
        fc.array(transactionArb),
        fc.constantFrom('newest', 'amount-asc', 'amount-desc', 'category-az'),
        (transactions, sortKey) => {
          const result = sortTransactions(transactions, sortKey);

          // Same length
          expect(result.length).toBe(transactions.length);

          // Same elements (by id) — no additions, no omissions, no duplicates
          const inputIds = transactions.map(t => t.id).sort();
          const resultIds = result.map(t => t.id).sort();
          expect(resultIds).toEqual(inputIds);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 4.3: Property 10 — sortTransactions produces correctly ordered output
// Feature: expense-visualizer-enhancements, Property 10: sortTransactions produces correctly ordered output
// Validates: Requirements 3.1, 3.2, 3.3, 3.4
// ---------------------------------------------------------------------------
describe('Feature: expense-visualizer-enhancements, Property 10: sortTransactions produces correctly ordered output', () => {
  const transactionArb = fc.record({
    id: fc.uuid(),
    name: validName,
    amount: validAmount,
    category: validCategory,
    createdAt: fc.date().map(d => d.toISOString()),
  });

  it('amount-asc: each consecutive pair satisfies a.amount <= b.amount', () => {
    fc.assert(
      fc.property(fc.array(transactionArb), (transactions) => {
        const result = sortTransactions(transactions, 'amount-asc');
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].amount).toBeLessThanOrEqual(result[i + 1].amount);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('amount-desc: each consecutive pair satisfies a.amount >= b.amount', () => {
    fc.assert(
      fc.property(fc.array(transactionArb), (transactions) => {
        const result = sortTransactions(transactions, 'amount-desc');
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].amount).toBeGreaterThanOrEqual(result[i + 1].amount);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('category-az: each consecutive pair satisfies a.category.toLowerCase() <= b.category.toLowerCase()', () => {
    fc.assert(
      fc.property(fc.array(transactionArb), (transactions) => {
        const result = sortTransactions(transactions, 'category-az');
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].category.toLowerCase() <= result[i + 1].category.toLowerCase()).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('newest: each consecutive pair satisfies a.createdAt >= b.createdAt', () => {
    fc.assert(
      fc.property(fc.array(transactionArb), (transactions) => {
        const result = sortTransactions(transactions, 'newest');
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].createdAt >= result[i + 1].createdAt).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 4.5: Property 7 — groupByMonth is exhaustive, non-overlapping, and chronologically ordered within groups
// Feature: expense-visualizer-enhancements, Property 7: groupByMonth is exhaustive, non-overlapping, and chronologically ordered within groups
// Validates: Requirements 2.1, 2.3
// ---------------------------------------------------------------------------
import { groupByMonth } from './logic.js';

describe('Feature: expense-visualizer-enhancements, Property 7: groupByMonth is exhaustive, non-overlapping, and chronologically ordered within groups', () => {
  const transactionWithDateArb = fc.record({
    id: fc.uuid(),
    name: validName,
    amount: validAmount,
    category: validCategory,
    createdAt: fc.date().map(d => d.toISOString()),
  });

  it('union of all group transactions equals the input (exhaustiveness)', () => {
    fc.assert(
      fc.property(fc.array(transactionWithDateArb), (transactions) => {
        const groups = groupByMonth(transactions);
        const allGroupedTxs = groups.flatMap(g => g.transactions);

        // Same length — no additions or omissions
        expect(allGroupedTxs.length).toBe(transactions.length);

        // Same ids — no duplicates, no omissions
        const inputIds = transactions.map(t => t.id).sort();
        const groupedIds = allGroupedTxs.map(t => t.id).sort();
        expect(groupedIds).toEqual(inputIds);
      }),
      { numRuns: 100 }
    );
  });

  it('each transaction appears in the group matching its createdAt month/year label', () => {
    fc.assert(
      fc.property(fc.array(transactionWithDateArb), (transactions) => {
        const groups = groupByMonth(transactions);

        groups.forEach(group => {
          group.transactions.forEach(tx => {
            const d = new Date(tx.createdAt);
            const expectedLabel = d.toLocaleString('default', { month: 'long', year: 'numeric' });
            expect(group.label).toBe(expectedLabel);
          });
        });
      }),
      { numRuns: 100 }
    );
  });

  it('within each group, transactions are in chronological order (createdAt ascending)', () => {
    fc.assert(
      fc.property(fc.array(transactionWithDateArb), (transactions) => {
        const groups = groupByMonth(transactions);

        groups.forEach(group => {
          for (let i = 0; i < group.transactions.length - 1; i++) {
            const a = group.transactions[i].createdAt;
            const b = group.transactions[i + 1].createdAt;
            expect(a <= b).toBe(true);
          }
        });
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 4.6: Property 8 — groupByMonth group totals equal the sum of amounts in each group
// Feature: expense-visualizer-enhancements, Property 8: groupByMonth group totals equal the sum of amounts in each group
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------
describe('Feature: expense-visualizer-enhancements, Property 8: groupByMonth group totals equal the sum of amounts in each group', () => {
  const transactionWithDateArb = fc.record({
    id: fc.uuid(),
    name: validName,
    amount: validAmount,
    category: validCategory,
    createdAt: fc.date().map(d => d.toISOString()),
  });

  it('each group total equals the sum of its transaction amounts', () => {
    fc.assert(
      fc.property(fc.array(transactionWithDateArb), (transactions) => {
        const groups = groupByMonth(transactions);

        groups.forEach(group => {
          const expectedTotal = group.transactions.reduce((sum, t) => sum + t.amount, 0);
          expect(group.total).toBeCloseTo(expectedTotal, 10);
        });
      }),
      { numRuns: 100 }
    );
  });
});
