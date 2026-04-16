// Pure logic module — no DOM, no localStorage dependencies
// Feature: expense-budget-visualizer

export const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];

export function validateTransaction({ name, amount, category }) {
  const errors = [];

  if (!name || name.trim() === '') {
    errors.push({ field: 'name', message: 'Item name is required.' });
  }

  const numericAmount = Number(amount);
  if (!isFinite(numericAmount) || numericAmount <= 0) {
    errors.push({ field: 'amount', message: 'Amount must be a number greater than 0.' });
  }

  if (!VALID_CATEGORIES.includes(category)) {
    errors.push({ field: 'category', message: 'Category must be one of: Food, Transport, Fun.' });
  }

  return { valid: errors.length === 0, errors };
}

export function getTotalBalance(transactions) {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

export function getSpendingByCategory(transactions) {
  const result = { Food: 0, Transport: 0, Fun: 0 };
  transactions.forEach((t) => { result[t.category] += t.amount; });
  return result;
}

export function addTransactionToList(transactions, { name, amount, category }, idFn = () => String(Date.now())) {
  const transaction = { id: idFn(), name, amount, category };
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
