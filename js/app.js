'use strict';

// =============================================================================
// InputForm
// =============================================================================

function getFormValues() {
  return {
    name: document.getElementById('item-name').value,
    amount: document.getElementById('amount').value,
    category: document.getElementById('category').value,
  };
}

function resetForm() {
  document.getElementById('item-name').value = '';
  document.getElementById('amount').value = '';
  document.getElementById('category').value = '';
}

function showFormError(field, message) {
  const errorSpan = document.querySelector(`.error-msg[data-field="${field}"]`);
  if (errorSpan) {
    errorSpan.textContent = message;
  }
  const inputMap = { name: 'item-name', amount: 'amount', category: 'category' };
  const inputId = inputMap[field];
  if (inputId) {
    const input = document.getElementById(inputId);
    if (input) input.classList.add('invalid');
  }
}

function clearFormErrors() {
  document.querySelectorAll('.error-msg').forEach((span) => {
    span.textContent = '';
  });
  document.querySelectorAll('#item-name, #amount, #category').forEach((input) => {
    input.classList.remove('invalid');
  });
}

// =============================================================================
// Validator
// =============================================================================

const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];

function validateTransaction({ name, amount, category }) {
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

// =============================================================================
// State Manager
// =============================================================================

let transactions = [];

function addTransaction({ name, amount, category }) {
  const transaction = {
    id: crypto.randomUUID(),
    name,
    amount,
    category,
  };
  transactions.push(transaction);
  saveTransactions(transactions);
  renderAll();
}

function deleteTransaction(id) {
  transactions = transactions.filter((t) => t.id !== id);
  saveTransactions(transactions);
  renderAll();
}

function getTransactions() {
  return transactions;
}

function getTotalBalance() {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

function getSpendingByCategory() {
  const result = { Food: 0, Transport: 0, Fun: 0 };
  transactions.forEach((t) => { result[t.category] += t.amount; });
  return result;
}

// =============================================================================
// Storage
// =============================================================================

const STORAGE_KEY = 'expense-visualizer-transactions';

function saveTransactions(transactions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (e) {
    // Storage unavailable (e.g. private browsing quota); continue in-memory only
  }
}

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    return JSON.parse(raw);
  } catch (e) {
    // Missing key or malformed JSON — fall back to empty array
    return [];
  }
}

// =============================================================================
// Transaction List Renderer
// =============================================================================

export function renderTransactionList(transactions) {
  const list = document.getElementById('transaction-list');
  list.innerHTML = '';

  if (transactions.length === 0) {
    const placeholder = document.createElement('li');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'No transactions added yet.';
    list.appendChild(placeholder);
    return;
  }

  transactions.forEach((transaction) => {
    const item = document.createElement('li');
    item.className = 'transaction-item';

    const info = document.createElement('div');
    info.className = 'transaction-info';

    const name = document.createElement('span');
    name.className = 'transaction-name';
    name.textContent = transaction.name;

    const meta = document.createElement('span');
    meta.className = 'transaction-meta';
    meta.textContent = transaction.category;

    info.appendChild(name);
    info.appendChild(meta);

    const amount = document.createElement('span');
    amount.className = 'transaction-amount';
    amount.textContent = `$${transaction.amount.toFixed(2)}`;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.dataset.id = transaction.id;

    item.appendChild(info);
    item.appendChild(amount);
    item.appendChild(deleteBtn);

    list.appendChild(item);
  });
}

// =============================================================================
// Balance Display Renderer
// =============================================================================

function renderBalance(total) {
  const display = document.getElementById('balance-display');
  if (display) {
    display.textContent = `$${total.toFixed(2)}`;
  }
}

// =============================================================================
// Pie Chart Renderer
// =============================================================================

function renderChart(spendingByCategory) {
  const canvas = document.getElementById('spending-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const COLORS = { Food: '#FF6384', Transport: '#36A2EB', Fun: '#FFCE56' };
  const LEGEND_ITEM_HEIGHT = 24;
  const LEGEND_SWATCH = 14;
  const LEGEND_PADDING = 12;
  const categories = Object.keys(COLORS);

  const total = Object.values(spendingByCategory).reduce((s, v) => s + v, 0);

  // Resize canvas to fit pie + legend
  const legendHeight = LEGEND_PADDING + categories.length * LEGEND_ITEM_HEIGHT + LEGEND_PADDING;
  const chartSize = 300;
  canvas.width = chartSize;
  canvas.height = chartSize + legendHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (total === 0) {
    // Empty-state placeholder
    ctx.fillStyle = '#aaa';
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No spending data yet', canvas.width / 2, chartSize / 2);
  } else {
    // Draw pie slices
    const cx = chartSize / 2;
    const cy = chartSize / 2;
    const r = Math.min(cx, cy) * 0.8;
    let startAngle = -Math.PI / 2; // start at top

    categories.forEach((cat) => {
      const val = spendingByCategory[cat] || 0;
      if (val === 0) return;
      const slice = (val / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fillStyle = COLORS[cat];
      ctx.fill();
      startAngle += slice;
    });
  }

  // Draw legend below the chart
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '14px system-ui, sans-serif';

  categories.forEach((cat, i) => {
    const x = LEGEND_PADDING;
    const y = chartSize + LEGEND_PADDING + i * LEGEND_ITEM_HEIGHT + LEGEND_ITEM_HEIGHT / 2;

    // Color swatch
    ctx.fillStyle = COLORS[cat];
    ctx.fillRect(x, y - LEGEND_SWATCH / 2, LEGEND_SWATCH, LEGEND_SWATCH);

    // Label
    ctx.fillStyle = '#333';
    ctx.fillText(cat, x + LEGEND_SWATCH + 8, y);
  });
}

// =============================================================================
// App Controller
// =============================================================================

function handleDeleteTransaction(id) {
  deleteTransaction(id);
}

function handleAddTransaction() {
  clearFormErrors();
  const { name, amount, category } = getFormValues();
  const { valid, errors } = validateTransaction({ name, amount, category });

  if (!valid) {
    errors.forEach(({ field, message }) => showFormError(field, message));
    return;
  }

  addTransaction({ name: name.trim(), amount: parseFloat(amount), category });
  resetForm();
  clearFormErrors();
}

function renderAll() {
  renderTransactionList(getTransactions());
  renderBalance(getTotalBalance());
  renderChart(getSpendingByCategory());
}

function init() {
  transactions = loadTransactions();
  renderAll();

  document.getElementById('add-btn').addEventListener('click', handleAddTransaction);

  document.getElementById('transaction-list').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-id]');
    if (btn) {
      handleDeleteTransaction(btn.dataset.id);
    }
  });
}

// Only attach the DOMContentLoaded listener when running in a real browser context,
// not when the module is imported by a test runner (e.g. vitest/jsdom).
if (typeof window !== 'undefined' && typeof process === 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}
