const API_BASE = window.BORROW_MONEY_API_BASE || "/api";

const signupForm = document.querySelector("#signupForm");
const form = document.querySelector("#borrowForm");
const moneyForm = document.querySelector("#moneyForm");
const ledgerBody = document.querySelector("#ledgerBody");
const moneyLedgerBody = document.querySelector("#moneyLedgerBody");
const emptyState = document.querySelector("#emptyState");
const moneyEmptyState = document.querySelector("#moneyEmptyState");
const searchInput = document.querySelector("#searchInput");
const moneySearchInput = document.querySelector("#moneySearchInput");
const clearDataBtn = document.querySelector("#clearDataBtn");
const signOutBtn = document.querySelector("#signOutBtn");
const shopLabel = document.querySelector("#shopLabel");
const tabButtons = document.querySelectorAll(".tab-btn");
const appSections = document.querySelectorAll(".app-section");
const appAddressLabels = document.querySelectorAll(".appAddress");

const borrowedCount = document.querySelector("#borrowedCount");
const pendingAmount = document.querySelector("#pendingAmount");
const customerCount = document.querySelector("#customerCount");
const creditTotal = document.querySelector("#creditTotal");
const debitTotal = document.querySelector("#debitTotal");
const cashBalance = document.querySelector("#cashBalance");

let profile = null;
let entries = [];
let moneyEntries = [];
let activeTab = "overview";

function setAppAddress() {
  appAddressLabels.forEach((label) => {
    label.textContent = window.location.host || "127.0.0.1:5601";
  });
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Backend request failed");
  }

  return data;
}

function showSignup() {
  document.body.classList.add("is-signup");
  document.body.classList.remove("is-app");
}

function showApp() {
  shopLabel.textContent = profile?.shopName ? profile.shopName : "Shop ledger";
  document.body.classList.add("is-app");
  document.body.classList.remove("is-signup");
  setTodayMoneyDate();
  showTab(activeTab);
  renderMoneyLedger();
  renderLedger();
}

function showTab(tabName) {
  activeTab = tabName;

  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  appSections.forEach((section) => {
    section.classList.toggle("is-hidden", section.dataset.section !== tabName);
  });
}

function formatMoney(value) {
  const amount = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0
  }).format(value || 0);
  return `Rs. ${amount}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateWithDay(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  const formatted = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
  const day = new Intl.DateTimeFormat("en-IN", {
    weekday: "long"
  }).format(date);

  return `${formatted} (${day})`;
}

function setTodayMoneyDate() {
  const moneyDate = document.querySelector("#moneyDate");
  if (moneyDate && !moneyDate.value) {
    moneyDate.value = new Date().toISOString().slice(0, 10);
  }
}

function renderStats() {
  const pending = entries.filter((entry) => !entry.returned);
  const customers = new Set(entries.map((entry) => entry.customerName.trim().toLowerCase()));
  const total = pending.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  borrowedCount.textContent = pending.length;
  pendingAmount.textContent = formatMoney(total);
  customerCount.textContent = customers.size;
}

function renderMoneyStats() {
  const credit = moneyEntries
    .filter((entry) => entry.type === "credit")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const debit = moneyEntries
    .filter((entry) => entry.type === "debit")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  creditTotal.textContent = formatMoney(credit);
  debitTotal.textContent = formatMoney(debit);
  cashBalance.textContent = formatMoney(credit - debit);
}

function renderMoneyLedger() {
  const query = moneySearchInput.value.trim().toLowerCase();
  const visibleEntries = moneyEntries
    .filter((entry) => {
      const text = `${entry.type} ${entry.reason} ${entry.notes} ${entry.entryDate}`.toLowerCase();
      return text.includes(query);
    })
    .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate) || b.createdAt - a.createdAt);

  moneyLedgerBody.innerHTML = "";
  moneyEmptyState.classList.toggle("show", visibleEntries.length === 0);

  visibleEntries.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatDateWithDay(entry.entryDate)}</td>
      <td><span class="money-type ${entry.type}">${escapeHtml(entry.type)}</span></td>
      <td>
        <strong>${escapeHtml(entry.reason)}</strong>
        ${entry.notes ? `<span class="note">${escapeHtml(entry.notes)}</span>` : ""}
      </td>
      <td class="money-amount ${entry.type}">${formatMoney(Number(entry.amount))}</td>
      <td>
        <button class="delete-btn" type="button" data-action="delete-money" data-id="${entry.id}">
          Delete
        </button>
      </td>
    `;
    moneyLedgerBody.appendChild(row);
  });

  renderMoneyStats();
}

function renderLedger() {
  const query = searchInput.value.trim().toLowerCase();
  const visibleEntries = entries
    .filter((entry) => {
      const text = `${entry.customerName} ${entry.phoneNumber} ${entry.itemName}`.toLowerCase();
      return text.includes(query);
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  ledgerBody.innerHTML = "";
  emptyState.classList.toggle("show", visibleEntries.length === 0);

  visibleEntries.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <strong>${escapeHtml(entry.customerName)}</strong>
        <span class="customer-meta">${escapeHtml(entry.phoneNumber || "No phone")}</span>
      </td>
      <td>
        ${escapeHtml(entry.itemName)}
        ${entry.notes ? `<span class="note">${escapeHtml(entry.notes)}</span>` : ""}
      </td>
      <td>${entry.quantity}</td>
      <td>${formatMoney(Number(entry.amount))}</td>
      <td>${formatDate(entry.dueDate)}</td>
      <td>
        <span class="status ${entry.returned ? "returned" : "pending"}">
          ${entry.returned ? "Returned" : "Pending"}
        </span>
      </td>
      <td>
        <div class="actions">
          <button class="return-btn" type="button" data-action="toggle" data-id="${entry.id}">
            ${entry.returned ? "Undo" : "Return"}
          </button>
          <button class="delete-btn" type="button" data-action="delete" data-id="${entry.id}">
            Delete
          </button>
        </div>
      </td>
    `;
    ledgerBody.appendChild(row);
  });

  renderStats();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadState() {
  const state = await api("/state");
  profile = state.profile;
  entries = state.borrowings || [];
  moneyEntries = state.moneyEntries || [];

  if (profile) {
    showApp();
  } else {
    showSignup();
  }
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  profile = await api("/profile", {
    method: "POST",
    body: JSON.stringify({
      shopName: document.querySelector("#shopName").value.trim(),
      ownerName: document.querySelector("#ownerName").value.trim(),
      phoneNumber: document.querySelector("#signupPhone").value.trim(),
      email: document.querySelector("#signupEmail").value.trim()
    })
  });

  signupForm.reset();
  showApp();
});

moneyForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const moneyEntry = await api("/money", {
    method: "POST",
    body: JSON.stringify({
      type: document.querySelector("#moneyType").value,
      amount: Number(document.querySelector("#moneyAmount").value),
      entryDate: document.querySelector("#moneyDate").value,
      reason: document.querySelector("#moneyReason").value.trim(),
      notes: document.querySelector("#moneyNotes").value.trim()
    })
  });

  moneyEntries.push(moneyEntry);
  moneyForm.reset();
  setTodayMoneyDate();
  renderMoneyLedger();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const entry = await api("/borrowings", {
    method: "POST",
    body: JSON.stringify({
      customerName: document.querySelector("#customerName").value.trim(),
      phoneNumber: document.querySelector("#phoneNumber").value.trim(),
      itemName: document.querySelector("#itemName").value.trim(),
      quantity: Number(document.querySelector("#quantity").value),
      amount: Number(document.querySelector("#amount").value),
      dueDate: document.querySelector("#dueDate").value,
      notes: document.querySelector("#notes").value.trim()
    })
  });

  entries.push(entry);
  form.reset();
  document.querySelector("#quantity").value = 1;
  renderLedger();
});

ledgerBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const id = button.dataset.id;

  if (button.dataset.action === "toggle") {
    const updated = await api(`/borrowings/${id}/toggle`, { method: "PATCH" });
    entries = entries.map((entry) => (entry.id === id ? updated : entry));
  }

  if (button.dataset.action === "delete") {
    await api(`/borrowings/${id}`, { method: "DELETE" });
    entries = entries.filter((entry) => entry.id !== id);
  }

  renderLedger();
});

moneyLedgerBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.action === "delete-money") {
    await api(`/money/${button.dataset.id}`, { method: "DELETE" });
    moneyEntries = moneyEntries.filter((entry) => entry.id !== button.dataset.id);
    renderMoneyLedger();
  }
});

searchInput.addEventListener("input", renderLedger);
moneySearchInput.addEventListener("input", renderMoneyLedger);

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showTab(button.dataset.tab);
  });
});

clearDataBtn.addEventListener("click", async () => {
  if (!confirm("Clear all borrowing and money entries?")) return;

  await api("/all", { method: "DELETE" });
  entries = [];
  moneyEntries = [];
  renderMoneyLedger();
  renderLedger();
});

signOutBtn.addEventListener("click", async () => {
  await api("/profile", { method: "DELETE" });
  profile = null;
  showSignup();
});

setAppAddress();

loadState().catch((error) => {
  console.error(error);
  alert("Backend is not running. Start server.js and refresh the page.");
});

