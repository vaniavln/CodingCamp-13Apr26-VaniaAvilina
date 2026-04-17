// Pure logic module — no DOM, no localStorage dependencies
// Feature: expense-budget-visualizer

export const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];

// Feature: expense-visualizer-enhancements — Category Manager
export const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

export function saveCategories(storage, allCategories) {
  const custom = allCategories.filter((c) => !DEFAULT_CATEGORIES.includes(c));
  try {
    storage.setItem('expense-visualizer-categories', JSON.stringify(custom));
  } catch (e) {
    // swallow quota errors silently
  }
}

export function loadCategories(storage) {
  try {
    const raw = storage.getItem('expense-visualizer-categories');
    if (raw === null) return [...DEFAULT_CATEGORIES];
    const custom = JSON.parse(raw);
    if (!Array.isArray(custom)) return [...DEFAULT_CATEGORIES];
    return [...DEFAULT_CATEGORIES, ...custom];
  } catch (e) {
    return [...DEFAULT_CATEGORIES];
  }
}

export function validateCategoryName(currentCategories, name) {
  if (!name || name.trim() === '') {
    return { valid: false, error: 'Category name is required.' };
  }
  const lower = name.trim().toLowerCase();
  const duplicate = currentCategories.some((c) => c.toLowerCase() === lower);
  if (duplicate) {
    return { valid: false, error: 'Category already exists.' };
  }
  return { valid: true };
}

export function addCategory(currentCategories, newName) {
  const validation = validateCategoryName(currentCategories, newName);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }
  return { ok: true, categories: [...currentCategories, newName.trim()] };
}

export function deleteCategory(currentCategories, name) {
  if (DEFAULT_CATEGORIES.includes(name)) {
    return { ok: false, error: 'Default categories cannot be deleted.' };
  }
  return { ok: true, categories: currentCategories.filter((c) => c !== name) };
}

export function validateTransaction({ name, amount, category }, validCategories = VALID_CATEGORIES) {
  const errors = [];

  if (!name || name.trim() === '') {
    errors.push({ field: 'name', message: 'Item name is required.' });
  }

  const numericAmount = Number(amount);
  if (!isFinite(numericAmount) || numericAmount <= 0) {
    errors.push({ field: 'amount', message: 'Amount must be a number greater than 0.' });
  }

  if (!validCategories.includes(category)) {
    errors.push({ field: 'category', message: `Category must be one of: ${validCategories.join(', ')}.` });
  }

  return { valid: errors.length === 0, errors };
}

export function getTotalBalance(transactions) {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

export function getSpendingByCategory(transactions, categories) {
  const result = {};
  categories.forEach((cat) => { result[cat] = 0; });
  transactions.forEach((t) => {
    if (Object.prototype.hasOwnProperty.call(result, t.category)) {
      result[t.category] += t.amount;
    }
  });
  return result;
}

export function addTransactionToList(
  transactions,
  { name, amount, category },
  idFn = () => String(Date.now()),
  timestampFn = () => new Date().toISOString()
) {
  const transaction = { id: idFn(), name, amount, category, createdAt: timestampFn() };
  return [...transactions, transaction];
}

export function deleteTransactionFromList(transactions, id) {
  return transactions.filter((t) => t.id !== id);
}

export function saveTransactions(storage, transactions) {
  try {
    storage.setItem('expense-visualizer-transactions', JSON.stringify(transactions));
  } catch (e) {}
}

export function loadTransactions(storage) {
  try {
    const raw = storage.getItem('expense-visualizer-transactions');
    if (raw === null) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

/**
 * Sort a transactions array by the given SortKey.
 * Returns a new array; never mutates the input.
 * @param {Array} transactions
 * @param {'newest'|'amount-asc'|'amount-desc'|'category-az'} sort
 * @returns {Array}
 */
export function sortTransactions(transactions, sort) {
  const FALLBACK_DATE = '1970-01-01T00:00:00.000Z';
  const copy = [...transactions];

  copy.sort((a, b) => {
    switch (sort) {
      case 'newest': {
        const da = (a.createdAt ?? FALLBACK_DATE);
        const db = (b.createdAt ?? FALLBACK_DATE);
        return da < db ? 1 : da > db ? -1 : 0;
      }
      case 'amount-asc':
        return a.amount - b.amount;
      case 'amount-desc':
        return b.amount - a.amount;
      case 'category-az': {
        const ca = (a.category ?? '').toLowerCase();
        const cb = (b.category ?? '').toLowerCase();
        return ca < cb ? -1 : ca > cb ? 1 : 0;
      }
      default:
        return 0;
    }
  });

  return copy;
}

/**
 * Groups transactions by calendar month/year.
 * Returns MonthGroup[] sorted newest-month-first; transactions within each
 * group are in chronological order (oldest first).
 * @param {Array} transactions
 * @returns {Array<{ label: string, total: number, transactions: Array }>}
 */
export function groupByMonth(transactions) {
  if (!transactions || transactions.length === 0) return [];

  const FALLBACK_DATE = '1970-01-01T00:00:00.000Z';
  const map = new Map();

  transactions.forEach((tx) => {
    const iso = tx.createdAt ?? FALLBACK_DATE;
    const d = new Date(iso);
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    // Use a sortable key (YYYY-MM) to order groups later
    const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(label)) {
      map.set(label, { label, sortKey, total: 0, transactions: [] });
    }
    const group = map.get(label);
    group.total += tx.amount;
    group.transactions.push(tx);
  });

  // Sort transactions within each group chronologically (oldest first)
  map.forEach((group) => {
    group.transactions.sort((a, b) => {
      const da = a.createdAt ?? FALLBACK_DATE;
      const db = b.createdAt ?? FALLBACK_DATE;
      return da < db ? -1 : da > db ? 1 : 0;
    });
  });

  // Sort groups newest-month-first
  const groups = Array.from(map.values());
  groups.sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0));

  // Strip internal sortKey before returning
  return groups.map(({ label, total, transactions }) => ({ label, total, transactions }));
}
