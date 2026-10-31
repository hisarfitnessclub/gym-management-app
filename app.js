import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDyfJDLrZ2bFAdLQhJ72jof8-_1sRxFQPY",
  authDomain: "gym-backend-719eb.firebaseapp.com",
  projectId: "gym-backend-719eb",
  storageBucket: "gym-backend-719eb.firebasestorage.app",
  messagingSenderId: "610292511359",
  appId: "1:610292511359:web:bca0f9dbe3857707f7054a"
};

const GYM_BRAND = {
  name: "Hisar Fitness Club",
  tagline: "FITNESS • STRENGTH • COMMUNITY",
  logoUrl: "assets/hisarfitnessclublogo.jpg"
};

const $ = id => document.getElementById(id);

let auth, db;
let members = [];
let payments = [];
let expenses = [];
let attendance = [];
let toastTimer;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const monthNow = () => today().slice(0, 7);

const money = value =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);

const statusOf = m => m.expiryDate >= today() ? "Active" : "Expired";

function notify(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2800);
}

function showError(id, message) {
  $(id).textContent = message;
}

function friendlyError(err) {
  const code = err?.code || "";

  if (
    code.includes("invalid-credential") ||
    code.includes("wrong-password") ||
    code.includes("user-not-found")
  ) {
    return "Incorrect email or password.";
  }

  if (code.includes("permission-denied")) {
    return "Access denied. Check Firestore security rules.";
  }

  if (code.includes("unavailable")) {
    return "Network issue. Please try again.";
  }

  return err?.message || "Something went wrong.";
}

function applyBrand() {
  $("brandName").textContent = GYM_BRAND.name;
  $("loginBrandName").textContent = GYM_BRAND.name;
  $("brandTagline").textContent = GYM_BRAND.tagline;
  $("loginTagline").textContent = GYM_BRAND.tagline;
  document.title = `${GYM_BRAND.name} — Gym Management`;

  if (GYM_BRAND.logoUrl) {
    $("brandLogo").src = GYM_BRAND.logoUrl;
    $("brandLogo").classList.remove("hidden");
    $("brandInitials").classList.add("hidden");

    $("loginLogo").src = GYM_BRAND.logoUrl;
    $("loginLogo").classList.remove("hidden");
    $("loginInitials").classList.add("hidden");
  } else {
    const initials = GYM_BRAND.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(x => x[0])
      .join("")
      .toUpperCase() || "GY";

    $("brandInitials").textContent = initials;
    $("loginInitials").textContent = initials;
  }
}

function initFirebase() {
  applyBrand();

  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  onAuthStateChanged(auth, async user => {
    if (user) {
      $("loginScreen").classList.add("hidden");
      $("app").classList.remove("hidden");
      $("userEmail").textContent = user.email || "Admin";
      await refreshAll();
    } else {
      $("app").classList.add("hidden");
      $("loginScreen").classList.remove("hidden");
    }
  });
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  showError("loginError", "");

  if (!auth) {
    showError("loginError", "Firebase is not initialized.");
    return;
  }

  try {
    await signInWithEmailAndPassword(
      auth,
      $("loginEmail").value.trim(),
      $("loginPassword").value
    );
  } catch (err) {
    showError("loginError", friendlyError(err));
  }
});

$("logoutBtn").addEventListener("click", () => signOut(auth));

// FIXED refreshAll FUNCTION
async function refreshAll() {
  try {
    const results = await Promise.all([
      getDocs(query(collection(db, "members"), orderBy("createdAt", "desc"))),
      getDocs(query(collection(db, "payments"), orderBy("createdAt", "desc"))),
      getDocs(query(collection(db, "expenses"), orderBy("createdAt", "desc"))),
      getDocs(query(collection(db, "attendance"), orderBy("checkedInAt", "desc")))
    ]);

    const [m, p, x, a] = results;

    members = m.docs.map(d => ({ id: d.id, ...d.data() }));
    payments = p.docs.map(d => ({ id: d.id, ...d.data() }));
    expenses = x.docs.map(d => ({ id: d.id, ...d.data() }));
    attendance = a.docs.map(d => ({ id: d.id, ...d.data() }));

    renderAll();
  } catch (err) {
    notify("Could not load data: " + friendlyError(err));
  }
}

function renderAll() {
  renderDashboard();
  renderMembers();
  renderPayments();
  renderAttendance();
  renderReports();
  populatePaymentMembers();
  populateAttendanceMembers();
  renderReminders();
}

function memberCell(m) {
  return `<div class="member-cell">
    <span class="member-avatar">${esc((m.name || "?").trim().charAt(0).toUpperCase())}</span>
    ${esc(m.name)}
  </div>`;
}

function daysUntil(date) {
  return Math.ceil(
    (new Date(date + "T00:00:00") - new Date(today() + "T00:00:00")) / 86400000
  );
}

function renderDashboard() {
  const active = members.filter(m => statusOf(m) === "Active");
  const soon = active.filter(m => daysUntil(m.expiryDate) >= 0 && daysUntil(m.expiryDate) <= 7);

  $("totalMembers").textContent = members.length;
  $("activeMembers").textContent = active.length;
  $("expiringMembers").textContent = soon.length;

  $("totalRevenue").textContent = money(
    payments
      .filter(p => (p.paymentDate || "").startsWith(monthNow()))
      .reduce((s, p) => s + Number(p.amount || 0), 0)
  );

  $("todayAttendance").textContent = attendance.filter(a => a.date === today()).length;

  $("recentMembers").innerHTML = members.slice(0, 5).map(m => `
    <tr>
      <td>${memberCell(m)}</td>
      <td>${esc(m.phone)}</td>
      <td>${esc(m.plan)}</td>
      <td>${esc(m.expiryDate)}</td>
      <td><span class="badge ${statusOf(m).toLowerCase()}">${statusOf(m)}</span></td>
    </tr>
  `).join("") || '<tr><td colspan="5">No members added yet.</td></tr>';
}

function renderMembers() {
  const term = $("memberSearch").value.toLowerCase();
  const filter = $("statusFilter").value;

  const list = members.filter(m =>
    (`${m.name} ${m.phone}`.toLowerCase().includes(term)) &&
    (filter === "all" || statusOf(m) === filter)
  );

  $("membersTable").innerHTML = list.map(m => `
    <tr>
      <td>${memberCell(m)}</td>
      <td>${esc(m.phone)}</td>
      <td>${esc(m.plan)}</td>
      <td>${esc(m.startDate)}</td>
      <td>${esc(m.expiryDate)}</td>
      <td><span class="badge ${statusOf(m).toLowerCase()}">${statusOf(m)}</span></td>
      <td>
        <button class="action-btn" data-edit="${m.id}">Edit</button>
        <button class="action-btn renew" data-renew="${m.id}">Renew</button>
        <button class="action-btn delete" data-delete="${m.id}">Delete</button>
      </td>
    </tr>
  `).join("");

  $("emptyMembers").classList.toggle("hidden", list.length > 0);
}

function renderPayments() {
  $("paymentsTable").innerHTML = payments.map(p => `
    <tr>
      <td>${esc(p.memberName)}</td>
      <td><strong>${money(p.amount)}</strong></td>
      <td>${esc(p.paymentDate)}</td>
      <td>${esc(p.method)}</td>
      <td>${esc(p.note || "—")}</td>
    </tr>
  `).join("");

  $("emptyPayments").classList.toggle("hidden", payments.length > 0);
  $("paymentsTotal").textContent = money(payments.reduce((s, p) => s + Number(p.amount || 0), 0));
  $("paymentCount").textContent = payments.length;
}

function renderAttendance() {
  const list = attendance.filter(a => a.date === today());

  $("attendanceTodayCount").textContent = list.length;

  $("attendanceTable").innerHTML = list.map(a => `
    <tr>
      <td>${esc(a.memberName)}</td>
      <td>${esc(a.date)}</td>
      <td>${esc(a.time || "—")}</td>
      <td>${esc(a.note || "—")}</td>
      <td><button class="action-btn delete" data-att-delete="${a.id}">Remove</button></td>
    </tr>
  `).join("");

  $("emptyAttendance").classList.toggle("hidden", list.length > 0);
}

function renderReports() {
  const month = $("reportMonth").value || monthNow();

  const income = payments
    .filter(p => (p.paymentDate || "").startsWith(month))
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const out = expenses
    .filter(x => (x.expenseDate || "").startsWith(month))
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  $("reportIncome").textContent = money(income);
  $("reportExpenses").textContent = money(out);
  $("reportNet").textContent = money(income - out);

  $("reportPayments").innerHTML = payments
    .filter(p => (p.paymentDate || "").startsWith(month))
    .map(p => `
      <tr>
        <td>${esc(p.paymentDate)}</td>
        <td>${esc(p.memberName)}</td>
        <td>${esc(p.method)}</td>
        <td>${money(p.amount)}</td>
      </tr>
    `).join("") || '<tr><td colspan="4">No income for this month.</td></tr>';

  $("reportExpenseRows").innerHTML = expenses
    .filter(x => (x.expenseDate || "").startsWith(month))
    .map(x => `
      <tr>
        <td>${esc(x.expenseDate)}</td>
        <td>${esc(x.category)}</td>
        <td>${esc(x.description)}</td>
        <td>${money(x.amount)}</td>
        <td><button class="action-btn delete" data-exp-delete="${x.id}">Remove</button></td>
      </tr>
    `).join("") || '<tr><td colspan="5">No expenses for this month.</td></tr>';
}

function renderReminders() {
  const list = members
    .filter(m => statusOf(m) === "Expired" ||
      (daysUntil(m.expiryDate) >= 0 && daysUntil(m.expiryDate) <= 7))
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  $("reminderList").innerHTML = list.map(m => {
    const expired = statusOf(m) === "Expired";

    const msg = expired
      ? `Hi ${m.name}, your gym membership expired on ${m.expiryDate}. Please contact us to renew.`
      : `Hi ${m.name}, your gym membership expires on ${m.expiryDate}. Please renew to keep training.`;

    const url = `https://wa.me/${String(m.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;

    return `<div class="reminder-item">
      <div>
        <strong>${esc(m.name)}</strong>
        <small>${expired ? "Expired" : "Expires in " + daysUntil(m.expiryDate) + " day(s)"} · ${esc(m.expiryDate)}</small>
      </div>
      <a class="action-btn" href="${url}" target="_blank" rel="noopener">WhatsApp reminder ↗</a>
    </div>`;
  }).join("") || '<p class="empty">No upcoming expiries or expired memberships.</p>';
}

function populatePaymentMembers() {
  const cur = $("paymentMember").value;
  $("paymentMember").innerHTML = members.map(m =>
    `<option value="${m.id}">${esc(m.name)} — ${esc(m.phone)}</option>`
  ).join("");

  if (members.some(m => m.id === cur)) $("paymentMember").value = cur;
}

function populateAttendanceMembers() {
  const cur = $("attendanceMember").value;

  $("attendanceMember").innerHTML = members
    .filter(m => statusOf(m) === "Active")
    .map(m => `<option value="${m.id}">${esc(m.name)} — ${esc(m.phone)}</option>`)
    .join("");

  if (members.some(m => m.id === cur)) $("attendanceMember").value = cur;
}

function navigate(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  $(page + "Page").classList.remove("hidden");

  document.querySelectorAll(".nav").forEach(n =>
    n.classList.toggle("active", n.dataset.page === page)
  );

  $("pageTitle").textContent = ({
    dashboard: "Dashboard",
    members: "Members",
    payments: "Payments",
    attendance: "Attendance",
    reports: "Reports"
  })[page] || page;
}

document.querySelectorAll(".nav").forEach(n =>
  n.addEventListener("click", () => navigate(n.dataset.page))
);

document.querySelectorAll("[data-goto]").forEach(b =>
  b.addEventListener("click", () => navigate(b.dataset.goto))
);

$("memberSearch").addEventListener("input", renderMembers);
$("statusFilter").addEventListener("change", renderMembers);

function addMonths(dateString, months) {
  const [y, mo, d] = dateString.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  date.setMonth(date.getMonth() + months);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function openMember(m = null) {
  $("memberForm").reset();
  $("memberError").textContent = "";
  $("memberId").value = m?.id || "";
  $("memberDialogTitle").textContent = m ? "Edit member" : "Add member";
  $("memberName").value = m?.name || "";
  $("memberPhone").value = m?.phone || "";
  $("memberEmail").value = m?.email || "";
  $("memberPlan").value = m?.plan || "Monthly";
  $("memberStart").value = m?.startDate || today();
  $("memberExpiry").value = m?.expiryDate || addMonths(today(), 1);
  $("memberFee").value = m?.fee ?? 1000;
  $("memberNotes").value = m?.notes || "";
  $("memberDialog").showModal();
}

$("memberPlan").addEventListener("change", () => {
  const months = { Monthly: 1, Quarterly: 3, "Half-yearly": 6, Yearly: 12 };
  $("memberExpiry").value = addMonths(
    $("memberStart").value || today(),
    months[$("memberPlan").value] || 1
  );
});

$("memberStart").addEventListener("change", () =>
  $("memberPlan").dispatchEvent(new Event("change"))
);

$("addMemberBtn").addEventListener("click", () => openMember());

$("membersTable").addEventListener("click", async e => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-delete]");
  const renew = e.target.closest("[data-renew]");

  if (edit) {
    const m = members.find(x => x.id === edit.dataset.edit);
    if (m) openMember(m);
  }

  if (renew) {
    const m = members.find(x => x.id === renew.dataset.renew);

    if (m) {
      const months = { Monthly: 1, Quarterly: 3, "Half-yearly": 6, Yearly: 12 };
      const start = m.expiryDate >= today() ? m.expiryDate : today();

      try {
        await updateDoc(doc(db, "members", m.id), {
          startDate: start,
          expiryDate: addMonths(start, months[m.plan] || 1),
          updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, "payments"), {
          memberId: m.id,
          memberName: m.name,
          amount: Number(m.fee || 0),
          paymentDate: today(),
          method: "Pending confirmation",
          note: "Membership renewal — confirm payment received",
          createdAt: serverTimestamp()
        });

        await refreshAll();
        notify("Membership dates renewed. Please verify the fee record.");
      } catch (err) {
        notify(friendlyError(err));
      }
    }
  }

  if (del) {
    const m = members.find(x => x.id === del.dataset.delete);

    if (m && confirm(`Delete ${m.name}? This cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, "members", m.id));
        await refreshAll();
        notify("Member deleted");
      } catch (err) {
        notify(friendlyError(err));
      }
    }
  }
});

$("memberForm").addEventListener("submit", async e => {
  e.preventDefault();

  if ($("memberExpiry").value < $("memberStart").value) {
    showError("memberError", "Expiry date must be on or after start date.");
    return;
  }

  const id = $("memberId").value;

  const data = {
    name: $("memberName").value.trim(),
    phone: $("memberPhone").value.trim(),
    email: $("memberEmail").value.trim(),
    plan: $("memberPlan").value,
    startDate: $("memberStart").value,
    expiryDate: $("memberExpiry").value,
    fee: Number($("memberFee").value),
    notes: $("memberNotes").value.trim(),
    updatedAt: serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(doc(db, "members", id), data);
    } else {
      await addDoc(collection(db, "members"), {
        ...data,
        createdAt: serverTimestamp()
      });
    }

    $("memberDialog").close();
    await refreshAll();
    notify(id ? "Member updated" : "Member added");
  } catch (err) {
    showError("memberError", friendlyError(err));
  }
});

$("addPaymentBtn").addEventListener("click", () => {
  if (!members.length) {
    notify("Add a member before recording payment.");
    return;
  }

  $("paymentForm").reset();
  $("paymentDate").value = today();
  $("paymentAmount").value =
    members.find(m => m.id === $("paymentMember").value)?.fee || 1000;
  $("paymentError").textContent = "";
  $("paymentDialog").showModal();
});

$("paymentMember").addEventListener("change", () => {
  $("paymentAmount").value =
    members.find(m => m.id === $("paymentMember").value)?.fee || 0;
});

$("paymentForm").addEventListener("submit", async e => {
  e.preventDefault();

  const m = members.find(x => x.id === $("paymentMember").value);

  if (!m) {
    showError("paymentError", "Select a member.");
    return;
  }

  const data = {
    memberId: m.id,
    memberName: m.name,
    amount: Number($("paymentAmount").value),
    paymentDate: $("paymentDate").value,
    method: $("paymentMethod").value,
    note: $("paymentNote").value.trim(),
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "payments"), data);
    $("paymentDialog").close();
    await refreshAll();
    notify("Payment recorded");
  } catch (err) {
    showError("paymentError", friendlyError(err));
  }
});

$("checkInBtn").addEventListener("click", async () => {
  const id = $("attendanceMember").value;
  const m = members.find(x => x.id === id);

  if (!m) {
    notify("No active members available.");
    return;
  }

  if (attendance.some(a => a.memberId === id && a.date === today())) {
    notify("This member is already checked in today.");
    return;
  }

  const now = new Date();

  try {
    await addDoc(collection(db, "attendance"), {
      memberId: m.id,
      memberName: m.name,
      date: today(),
      time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      note: $("attendanceNote").value.trim(),
      checkedInAt: serverTimestamp()
    });

    $("attendanceNote").value = "";
    await refreshAll();
    notify(`${m.name} checked in`);
  } catch (err) {
    notify(friendlyError(err));
  }
});

$("attendanceTable").addEventListener("click", async e => {
  const b = e.target.closest("[data-att-delete]");

  if (b && confirm("Remove this check-in record?")) {
    try {
      await deleteDoc(doc(db, "attendance", b.dataset.attDelete));
      await refreshAll();
      notify("Check-in removed");
    } catch (err) {
      notify(friendlyError(err));
    }
  }
});

$("reportMonth").value = monthNow();
$("reportMonth").addEventListener("change", renderReports);

$("addExpenseBtn").addEventListener("click", () => {
  $("expenseForm").reset();
  $("expenseDate").value = today();
  $("expenseError").textContent = "";
  $("expenseDialog").showModal();
});

$("expenseForm").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    await addDoc(collection(db, "expenses"), {
      category: $("expenseCategory").value,
      description: $("expenseDescription").value.trim(),
      amount: Number($("expenseAmount").value),
      expenseDate: $("expenseDate").value,
      createdAt: serverTimestamp()
    });

    $("expenseDialog").close();
    await refreshAll();
    notify("Expense recorded");
  } catch (err) {
    showError("expenseError", friendlyError(err));
  }
});

$("reportExpenseRows").addEventListener("click", async e => {
  const b = e.target.closest("[data-exp-delete]");

  if (b && confirm("Delete this expense record?")) {
    try {
      await deleteDoc(doc(db, "expenses", b.dataset.expDelete));
      await refreshAll();
      notify("Expense removed");
    } catch (err) {
      notify(friendlyError(err));
    }
  }
});

$("exportReportBtn").addEventListener("click", () => {
  const month = $("reportMonth").value || monthNow();

  const rows = [
    ["Type", "Date", "Name / Category", "Method / Description", "Amount"],
    ...payments
      .filter(p => (p.paymentDate || "").startsWith(month))
      .map(p => ["Income", p.paymentDate, p.memberName, p.method, p.amount]),
    ...expenses
      .filter(x => (x.expenseDate || "").startsWith(month))
      .map(x => ["Expense", x.expenseDate, x.category, x.description, x.amount])
  ];

  const csv = rows
    .map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" })
  );

  const a = document.createElement("a");
  a.href = url;
  a.download = `gym-report-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

document.querySelectorAll("[data-close]").forEach(b =>
  b.addEventListener("click", () => $(b.dataset.close).close())
);

initFirebase();
