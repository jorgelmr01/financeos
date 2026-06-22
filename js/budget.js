/* FinanceOS — budgeting & expenses: categories, scoring, insights,
   and a spreadsheet template that round-trips without ever duplicating rows. */
"use strict";

/* ---------- categories ----------
   bucket drives the 50/30/20 needs-vs-wants math and the score. */
const EXPENSE_CATEGORIES = [
  { name: "Housing",          icon: "home",    bucket: "needs" },
  { name: "Utilities",        icon: "bolt",    bucket: "needs" },
  { name: "Groceries",        icon: "cart",    bucket: "needs" },
  { name: "Transport",        icon: "car",     bucket: "needs" },
  { name: "Health",           icon: "heart",   bucket: "needs" },
  { name: "Insurance",        icon: "shield",  bucket: "needs" },
  { name: "Debt",             icon: "card",    bucket: "needs" },
  { name: "Education",        icon: "book",    bucket: "needs" },
  { name: "Kids",             icon: "blocks",  bucket: "needs" },
  { name: "Fees",             icon: "bank",    bucket: "needs" },
  { name: "Dining",           icon: "food",    bucket: "wants" },
  { name: "Shopping",         icon: "bag",     bucket: "wants" },
  { name: "Entertainment",    icon: "film",    bucket: "wants" },
  { name: "Travel",           icon: "plane",   bucket: "wants" },
  { name: "Subscriptions",    icon: "repeat",  bucket: "wants" },
  { name: "Personal Care",    icon: "sparkle", bucket: "wants" },
  { name: "Gifts & Donations", icon: "gift",   bucket: "wants" },
  { name: "Other",            icon: "dots",    bucket: "wants" },
];

/* common words people (and statements) use → canonical category */
const CATEGORY_ALIASES = {
  rent: "Housing", mortgage: "Housing", home: "Housing",
  electricity: "Utilities", water: "Utilities", gas: "Utilities", internet: "Utilities", phone: "Utilities",
  grocery: "Groceries", supermarket: "Groceries", food: "Groceries",
  restaurant: "Dining", restaurants: "Dining", coffee: "Dining", takeout: "Dining", "eating out": "Dining", bar: "Dining",
  fuel: "Transport", gasoline: "Transport", uber: "Transport", taxi: "Transport", transit: "Transport", parking: "Transport", car: "Transport",
  doctor: "Health", pharmacy: "Health", medical: "Health", dentist: "Health", gym: "Health",
  loan: "Debt", "credit card": "Debt", interest: "Debt",
  school: "Education", tuition: "Education", course: "Education", books: "Education",
  clothes: "Shopping", clothing: "Shopping", amazon: "Shopping", electronics: "Shopping",
  movies: "Entertainment", games: "Entertainment", concert: "Entertainment", hobby: "Entertainment",
  flight: "Travel", hotel: "Travel", vacation: "Travel", airbnb: "Travel",
  subscription: "Subscriptions", netflix: "Subscriptions", spotify: "Subscriptions", streaming: "Subscriptions",
  haircut: "Personal Care", salon: "Personal Care", beauty: "Personal Care",
  gift: "Gifts & Donations", gifts: "Gifts & Donations", donation: "Gifts & Donations", charity: "Gifts & Donations",
  fee: "Fees", fees: "Fees", bank: "Fees", commission: "Fees",
  baby: "Kids", childcare: "Kids", daycare: "Kids", kid: "Kids",
};

const CATEGORY_BY_LOWER = (() => {
  const m = {};
  EXPENSE_CATEGORIES.forEach(c => { m[c.name.toLowerCase()] = c; });
  return m;
})();

function categoryMeta(name) {
  const c = CATEGORY_BY_LOWER[String(name || "").toLowerCase()];
  return c || { name: name || "Other", icon: "dots", bucket: "wants" };
}

/* Map a free-text category to a known one where possible, else keep it. */
function canonicalCategory(raw) {
  const s = String(raw || "").trim();
  if (!s) return "Other";
  const lc = s.toLowerCase();
  if (CATEGORY_BY_LOWER[lc]) return CATEGORY_BY_LOWER[lc].name;
  if (CATEGORY_ALIASES[lc]) return CATEGORY_ALIASES[lc];
  // partial alias match (e.g. "uber eats" -> contains "uber")
  for (const k in CATEGORY_ALIASES) {
    if (lc.indexOf(k) !== -1) return CATEGORY_ALIASES[k];
  }
  // unknown — keep a tidy version of what they typed
  return s.length > 24 ? s.slice(0, 24) : s;
}

/* ---------- normalization & dedup signature ---------- */

function parseExpenseDate(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (!s) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const build = (y, mo, da) => {
    y = +y; mo = +mo; da = +da;
    if (y < 100) y += 2000;
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    // reject impossible calendar days (e.g. Jun 31, Feb 30) — Date would roll
    // them into the next month, mis-dating the expense
    const dt = new Date(y, mo - 1, da);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== da) return null;
    return y + "-" + pad(mo) + "-" + pad(da);
  };
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return build(m[1], m[2], m[3]);
  if ((m = s.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/))) return build(m[1], m[2], m[3]);
  if ((m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})$/))) {
    let a = +m[1], b = +m[2];
    // assume M/D/Y unless the first field can't be a month
    return a > 12 ? build(m[3], b, a) : build(m[3], a, b);
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return toISO(d);
  return null;
}

function parseAmount(raw) {
  const orig = String(raw == null ? "" : raw).trim();
  if (!orig) return null;
  const neg = /^\(.*\)$/.test(orig) || /-/.test(orig);
  const cleaned = orig.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  let n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  if (neg) n = -n;
  return Math.round(n * 100) / 100;
}

/* cyrb53 — compact, stable string hash for dedup keys */
function hashStr(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/* Identity of an expense — same fields => same signature => deduped on import. */
function expenseSig(e) {
  const desc = String(e.description || "").trim().toLowerCase().replace(/\s+/g, " ");
  const amt = (Math.round((Number(e.amount) || 0) * 100) / 100).toFixed(2);
  return hashStr([e.date, amt, String(e.category || "").toLowerCase(), desc, e.currency].join("|"));
}

/* ---------- month helpers ---------- */

function monthKeyOf(dateISO) { return String(dateISO || "").slice(0, 7); }

function monthLabel(mk) {
  const p = String(mk).split("-");
  if (p.length < 2) return mk;
  return MONTHS_SHORT[(+p[1]) - 1] + " " + p[0];
}

function expenseMonths() {
  const set = {};
  (Store.state.expenses || []).forEach(e => { set[monthKeyOf(e.date)] = true; });
  return Object.keys(set).sort().reverse();
}

function expensesForMonth(mk) {
  return (Store.state.expenses || []).filter(e => monthKeyOf(e.date) === mk);
}

/* ---------- month completeness ----------
   The current calendar month is "in progress": comparing its partial spend
   against a full month of income makes savings look artificially high. We
   prorate by how much of the month has elapsed and default insights to the
   most recent *complete* month. */
function currentMonthKey() { return monthKeyOf(toISO(todayMid())); }
function isMonthComplete(mk) { return mk < currentMonthKey(); }
function monthFraction(mk) {
  if (mk !== currentMonthKey()) return 1;
  const t = todayMid();
  const dim = lastDayOfMonth(t.getFullYear(), t.getMonth());
  return Math.max(0.01, Math.min(1, t.getDate() / dim));
}
function monthDaysElapsed(mk) {
  if (mk !== currentMonthKey()) {
    const p = String(mk).split("-");
    return lastDayOfMonth(+p[0], +p[1] - 1);
  }
  return todayMid().getDate();
}
function monthDaysTotal(mk) {
  const p = String(mk).split("-");
  return lastDayOfMonth(+p[0], +p[1] - 1);
}
/* Most recent month that has expenses AND is fully elapsed (or null). */
function latestCompleteMonth() {
  const m = expenseMonths().filter(isMonthComplete);  // expenseMonths() is newest-first
  return m.length ? m[0] : null;
}

/* ---------- aggregation (everything converted to display currency) ---------- */

function categoryTotalsSorted(exps) {
  const by = {};
  exps.forEach(e => {
    const cat = e.category || "Other";
    by[cat] = (by[cat] || 0) + conv(Number(e.amount) || 0, e.currency);
  });
  return Object.keys(by).map(name => ({ name, amount: by[name], meta: categoryMeta(name) }))
    .sort((a, b) => b.amount - a.amount);
}

function bucketTotals(exps) {
  let needs = 0, wants = 0;
  exps.forEach(e => {
    const amt = conv(Number(e.amount) || 0, e.currency);
    if (categoryMeta(e.category).bucket === "needs") needs += amt; else wants += amt;
  });
  return { needs, wants };
}

/* Monthly budget limit for a category, in display currency (or null if unset). */
function budgetForCategory(name) {
  const b = (Store.state.budgets || {})[name];
  if (!b || !(Number(b.amount) > 0)) return null;
  return convBetween(Number(b.amount), b.currency || displayCurrency(), displayCurrency());
}

function totalBudget() {
  const b = Store.state.budgets || {};
  return Object.keys(b).reduce((a, k) => a + (budgetForCategory(k) || 0), 0);
}

/* ---------- historic series (WHOOP-style trends) ---------- */

function monthAdd(mk, delta) {
  const p = String(mk).split("-");
  let y = +p[0], m = (+p[1] - 1) + delta;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return y + "-" + String(m + 1).padStart(2, "0");
}

function monthShort(mk) {
  const p = String(mk).split("-");
  return MONTHS_SHORT[(+p[1]) - 1] + (p[1] === "01" || +p[1] === 1 ? " ’" + String(p[0]).slice(2) : "");
}

/* One row per month from first activity to the current month (gaps filled with 0). */
function budgetSeries(maxMonths) {
  const all = expenseMonths();
  if (!all.length) return [];
  const sorted = all.slice().sort();
  const end = monthKeyOf(toISO(todayMid()));
  let start = sorted[0];
  if (start > end) start = end;
  const months = [];
  for (let mk = start, i = 0; mk <= end && i < 240; mk = monthAdd(mk, 1), i++) months.push(mk);
  const tail = (maxMonths && months.length > maxMonths) ? months.slice(-maxMonths) : months;
  return tail.map(mk => {
    const sc = budgetScore(mk);
    const spread = sc.needs + sc.wants;
    return {
      mk: mk, label: monthLabel(mk), short: monthShort(mk),
      spend: sc.monthlyExpenses, score: sc.score, savingsRate: sc.savingsRate,
      needs: sc.needs, wants: sc.wants, income: sc.monthlyIncomeNet, runway: sc.runwayMonths,
      wantsShare: spread > 0 ? sc.wants / spread : 0,
      complete: sc.complete,
      hasData: sc.monthlyExpenses !== 0 || expensesForMonth(mk).length > 0,
    };
  });
}

function avgOf(rows, key) {
  const vals = rows.map(r => r[key]).filter(v => v != null && isFinite(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/* Latest COMPLETE month vs the trailing average of the prior complete months —
   excludes the in-progress month so partial data doesn't skew the comparison. */
function budgetComparison(n) {
  const s = budgetSeries(null).filter(m => m.hasData && m.complete);
  if (s.length < 2) return null;
  const cur = s[s.length - 1];
  const prior = s.slice(0, s.length - 1).slice(-(n || 3));
  if (!prior.length) return null;
  return {
    cur: cur, months: prior.length,
    spendAvg: avgOf(prior, "spend"),
    saveAvg: avgOf(prior, "savingsRate"),
    scoreAvg: avgOf(prior.filter(m => m.score != null), "score"),
    wantsAvg: avgOf(prior, "wantsShare"),
  };
}

/* Per-category change: latest complete month vs trailing average of prior complete months. */
function categoryMovers(n) {
  const s = budgetSeries(null).filter(m => m.hasData && m.complete);
  if (s.length < 2) return [];
  const curMk = s[s.length - 1].mk;
  const priorMks = s.slice(0, s.length - 1).slice(-(n || 3)).map(m => m.mk);
  if (!priorMks.length) return [];
  const cur = {}, prior = {};
  categoryTotalsSorted(expensesForMonth(curMk)).forEach(c => { cur[c.name] = c.amount; });
  priorMks.forEach(mk => categoryTotalsSorted(expensesForMonth(mk)).forEach(c => {
    prior[c.name] = (prior[c.name] || 0) + c.amount;
  }));
  const names = {};
  Object.keys(cur).forEach(k => names[k] = 1);
  Object.keys(prior).forEach(k => names[k] = 1);
  return Object.keys(names).map(name => {
    const c = cur[name] || 0, avg = (prior[name] || 0) / priorMks.length;
    return { name: name, meta: categoryMeta(name), cur: c, avg: avg, delta: c - avg };
  }).filter(x => Math.abs(x.delta) >= 1).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/* Per-category monthly spend for the highest-spend categories — feeds the
   small-multiple "spending by category" trend. Returns the month labels plus,
   for each top category, its monthly values and total. */
function categorySeries(maxMonths, topN) {
  const rows = budgetSeries(maxMonths || 12).filter(m => m.hasData);
  if (rows.length < 2) return { months: [], cats: [] };
  const totals = {};
  const perMonth = rows.map(r => {
    const m = {};
    categoryTotalsSorted(expensesForMonth(r.mk)).forEach(c => {
      m[c.name] = c.amount; totals[c.name] = (totals[c.name] || 0) + c.amount;
    });
    return m;
  });
  const top = Object.keys(totals).sort((a, b) => totals[b] - totals[a]).slice(0, topN || 6);
  return {
    months: rows.map(r => r.short),
    cats: top.map(name => ({
      name: name, meta: categoryMeta(name), total: totals[name],
      values: perMonth.map(m => m[name] || 0),
    })),
  };
}

/* Smart annual-spending estimate for the FIRE calculator. Picks the averaging
   window from how much COMPLETE history exists and how noisy it is, and reports
   the coefficient of variation so the UI can warn when spending is erratic:
     1–2 months  → use what's there, extended to a year
     3–5 months  → 3-month average
     6–11 months → 6-month average
     12+ months  → 12-month average
   Returns { annual, window, months, cov, basis }. */
function budgetSpendEstimate() {
  const months = (typeof budgetSeries === "function") ? budgetSeries(null).filter(m => m.hasData && m.complete) : [];
  if (!months.length) return { annual: 0, window: 0, months: 0, cov: 0, basis: "no complete months yet" };
  const spends = months.map(m => Number(m.spend) || 0);
  const mean = spends.reduce((a, b) => a + b, 0) / spends.length;
  const variance = spends.reduce((a, b) => a + (b - mean) * (b - mean), 0) / spends.length;
  const cov = mean > 0 ? Math.sqrt(variance) / mean : 0;
  let win;
  if (spends.length >= 12) win = 12;
  else if (spends.length >= 6) win = 6;
  else if (spends.length >= 3) win = 3;
  else win = spends.length;
  const used = spends.slice(-win);
  const avg = used.reduce((a, b) => a + b, 0) / used.length;
  const basis = spends.length === 1 ? "last month × 12"
    : spends.length === 2 ? "2-month average × 12"
    : win + "-month average × 12";
  return { annual: avg * 12, window: win, months: spends.length, cov: cov, basis: basis };
}

/* Consistency streaks, counting back from the most recent month with data. */
function budgetStreaks() {
  const s = budgetSeries(null).filter(m => m.hasData && m.complete);
  let save = 0, under = 0;
  for (let i = s.length - 1; i >= 0; i--) { if (s[i].savingsRate != null && s[i].savingsRate > 0) save++; else break; }
  // "all budgets met" = every category you set a limit on stayed within it that month
  const budgeted = Object.keys(Store.state.budgets || {}).filter(k => budgetForCategory(k) != null);
  if (budgeted.length) {
    for (let i = s.length - 1; i >= 0; i--) {
      const totals = {};
      categoryTotalsSorted(expensesForMonth(s[i].mk)).forEach(c => { totals[c.name] = c.amount; });
      const ok = budgeted.every(cat => (totals[cat] || 0) <= budgetForCategory(cat));
      if (ok) under++; else break;
    }
  }
  let best = null;
  s.forEach(m => { if (m.savingsRate != null && (!best || m.savingsRate > best.savingsRate)) best = m; });
  return { saveStreak: save, underStreak: under, hasBudget: budgeted.length > 0, best: best, count: s.length };
}

/* ---------- score ---------- */

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function budgetScore(mk) {
  const t = computeTotals();
  const eb = earningsBreakdown();
  const exps = expensesForMonth(mk);
  const monthlyExpenses = exps.reduce((a, e) => a + conv(Number(e.amount) || 0, e.currency), 0);
  const monthlyIncomeNet = eb.monthlyNet;              // steady net cash flow, display currency
  const liquid = t.accountsTotal + t.marketValue;      // assets you could actually draw on
  const buckets = bucketTotals(exps);
  const spend = buckets.needs + buckets.wants;
  const wantsShare = spend > 0 ? buckets.wants / spend : 0;
  // for an in-progress month, compare partial spend against the elapsed
  // portion of income, and project spend to a full month for runway —
  // so a half-finished month isn't read as a huge savings rate
  const frac = monthFraction(mk);
  const incomeBasis = monthlyIncomeNet * frac;
  const fullSpend = frac > 0 ? monthlyExpenses / frac : monthlyExpenses;
  const savingsRate = incomeBasis > 0 ? (incomeBasis - monthlyExpenses) / incomeBasis : null;
  const runwayMonths = fullSpend > 0 ? liquid / fullSpend : Infinity;

  const runwayComp = clamp01(runwayMonths / 12);       // 12 months liquid = full marks
  const wantsComp = clamp01((0.6 - wantsShare) / 0.6); // 60%+ on wants = 0
  let score = null, basis = "full";
  if (monthlyExpenses > 0) {
    if (savingsRate == null) {
      score = Math.round(runwayComp * 70 + wantsComp * 30);
      basis = "no-income";
    } else {
      const saveComp = clamp01(savingsRate / 0.4);     // 40% savings rate = full
      score = Math.round(saveComp * 60 + runwayComp * 25 + wantsComp * 15);
    }
  }
  return {
    score, basis,
    monthlyExpenses, monthlyIncomeNet, liquid,
    savingsRate, runwayMonths, wantsShare,
    needs: buckets.needs, wants: buckets.wants, spend,
    complete: frac >= 1, frac: frac,
    daysElapsed: monthDaysElapsed(mk), daysTotal: monthDaysTotal(mk),
  };
}

function scoreGrade(score) {
  if (score == null) return { grade: "—", label: "No spending logged", tone: "mute" };
  if (score >= 90) return { grade: "A", label: "Excellent", tone: "pos" };
  if (score >= 78) return { grade: "B", label: "Strong", tone: "pos" };
  if (score >= 64) return { grade: "C", label: "Okay", tone: "gold" };
  if (score >= 50) return { grade: "D", label: "Tight", tone: "gold" };
  return { grade: "E", label: "Over-spending", tone: "neg" };
}

function healthGrade(score) {
  if (score == null) return { grade: "—", label: "Getting started", tone: "mute" };
  if (score >= 85) return { grade: "A", label: "Thriving", tone: "pos" };
  if (score >= 70) return { grade: "B", label: "Healthy", tone: "pos" };
  if (score >= 55) return { grade: "C", label: "Steady", tone: "gold" };
  if (score >= 40) return { grade: "D", label: "Stretched", tone: "gold" };
  return { grade: "E", label: "Needs attention", tone: "neg" };
}

/* ---------- ONE unified Financial Health score ----------
   Rolls the app's separate signals (cash flow, debt, safety net, growth)
   into a single 0–100 number so there's one honest "how am I doing?". Each
   factor is skipped when there's no data for it, and the rest are reweighted,
   so the score is fair whether you track everything or just a couple things. */
function financialHealth() {
  const t = computeTotals();
  const eb = earningsBreakdown();
  // base cash-flow & safety on the latest COMPLETE month (fall back to a
  // prorated current month) so a half-finished month doesn't inflate the score
  const mk = latestCompleteMonth() || currentMonthKey();
  const frac = monthFraction(mk);
  const monthExp = (typeof expensesForMonth === "function")
    ? expensesForMonth(mk).reduce((a, e) => a + conv(Number(e.amount) || 0, e.currency), 0) : 0;
  const incomeMo = eb.monthlyNet;
  const factors = [];

  if (incomeMo > 0 && monthExp > 0) {
    const sr = (incomeMo * frac - monthExp) / (incomeMo * frac);
    factors.push({ key: "cashflow", label: "Cash flow", weight: 30, score: clamp01(sr / 0.2),
      detail: Math.round(sr * 100) + "% of income saved" });
  }
  if (t.creditLimit > 0) {
    const util = t.debt / t.creditLimit;
    factors.push({ key: "debt", label: "Debt load", weight: 25, score: clamp01(1 - util / 0.5),
      detail: Math.round(util * 100) + "% of credit used" });
  }
  const fullSpend = monthExp > 0 ? monthExp / frac : 0;
  const outflow = fullSpend > 0 ? fullSpend : (incomeMo > 0 ? incomeMo * 0.8 : 0);
  if (outflow > 0) {
    const months = (t.cash + t.savings) / outflow;
    factors.push({ key: "safety", label: "Safety net", weight: 25, score: clamp01(months / 6),
      detail: months.toFixed(1) + " mo runway" });
  }
  // Growth = net-worth TREND from daily snapshots (not income/expenses, which
  // don't auto-move balances). Needs ~10 days of history before it means
  // anything, and a flat trend reads as neutral — not a failure.
  const snaps = Store.state.snapshots || [];
  if (snaps.length >= 2) {
    const last = snaps[snaps.length - 1];
    const ago = snaps[Math.max(0, snaps.length - 31)];
    const days = Math.max(1, daysBetween(parseISO(ago.d), parseISO(last.d)));
    if (days >= 10 && ago.usd) {
      const chg = (last.usd - ago.usd) / Math.abs(ago.usd);
      factors.push({ key: "growth", label: "Growth", weight: 20,
        score: clamp01(0.5 + chg / 0.04),
        detail: (chg >= 0 ? "+" : "") + (Math.abs(chg) < 0.1 ? (chg * 100).toFixed(1) : Math.round(chg * 100)) + "% / " + days + "d" });
    }
  }

  if (!factors.length) return { score: null, factors: [] };
  const w = factors.reduce((a, f) => a + f.weight, 0);
  const score = Math.round(factors.reduce((a, f) => a + f.score * f.weight, 0) / w * 100);
  return { score: score, factors: factors };
}

/* ---------- insights ---------- */

function budgetInsights(mk) {
  const exps = expensesForMonth(mk);
  if (!exps.length) return [];
  const sc = budgetScore(mk);
  const cats = categoryTotalsSorted(exps);
  const spend = sc.spend || 1;
  const out = [];
  const pct = (x) => Math.round(x * 100) + "%";

  if (sc.savingsRate != null) {
    if (sc.savingsRate >= 0.2) {
      out.push({ level: "good", title: "Healthy savings rate", text: "You kept <strong>" + pct(sc.savingsRate) + "</strong> of your net income this month — at or above the 20% guideline. Keep it up." });
    } else if (sc.savingsRate >= 0) {
      const gap = Math.max(0, sc.monthlyIncomeNet * 0.2 - (sc.monthlyIncomeNet - sc.monthlyExpenses));
      out.push({ level: "warn", title: "Thin savings rate", text: "You saved <strong>" + pct(sc.savingsRate) + "</strong> of income. Trimming about <strong>" + fmtMoney(gap, { compact: true }) + "</strong>/mo would reach a healthy 20%." });
    } else {
      out.push({ level: "danger", title: "Spending exceeds income", text: "You spent <strong>" + fmtMoney(sc.monthlyExpenses, { compact: true }) + "</strong> against <strong>" + fmtMoney(sc.monthlyIncomeNet, { compact: true }) + "</strong> of net income — you're drawing down savings." });
    }
  }

  if (cats[0]) {
    const share = cats[0].amount / spend;
    out.push({
      level: share > 0.4 ? "warn" : "info",
      title: "Biggest category: " + cats[0].name,
      text: icon(cats[0].meta.icon) + " <strong>" + esc(cats[0].name) + "</strong> is " + pct(share) + " of spending (" + fmtMoney(cats[0].amount, { compact: true }) + ")" + (share > 0.4 ? " — a big concentration worth reviewing." : "."),
    });
  }

  out.push({
    level: sc.wantsShare <= 0.3 ? "good" : sc.wantsShare <= 0.5 ? "info" : "warn",
    title: "Needs vs wants",
    text: "<strong>" + pct(sc.wantsShare) + "</strong> of spending went to wants. The 50/30/20 guide suggests keeping wants near 30% of income.",
  });

  if (isFinite(sc.runwayMonths)) {
    out.push({
      level: sc.runwayMonths >= 6 ? "good" : sc.runwayMonths >= 3 ? "info" : "warn",
      title: "Runway",
      text: "Your liquid assets could cover <strong>" + sc.runwayMonths.toFixed(1) + " months</strong> at this spending rate" + (sc.runwayMonths < 3 ? " — an emergency fund of 3–6 months is a great target." : ".") ,
    });
  }

  // over-budget categories
  const over = cats.filter(c => { const b = budgetForCategory(c.name); return b && c.amount > b; });
  if (over.length) {
    out.push({
      level: "danger",
      title: "Over budget: " + over.slice(0, 3).map(c => c.name).join(", "),
      text: over.slice(0, 3).map(c => esc(c.name) + " " + fmtMoney(c.amount, { compact: true }) + " / " + fmtMoney(budgetForCategory(c.name), { compact: true })).join(" · "),
    });
  }

  // month-over-month trend
  const months = expenseMonths().slice().sort();
  const idx = months.indexOf(mk);
  if (idx > 0) {
    const prev = months[idx - 1];
    const prevTotal = expensesForMonth(prev).reduce((a, e) => a + conv(Number(e.amount) || 0, e.currency), 0);
    if (prevTotal > 0) {
      const chg = (sc.monthlyExpenses - prevTotal) / prevTotal;
      if (Math.abs(chg) >= 0.05) {
        out.push({
          level: chg < 0 ? "good" : "info",
          title: chg < 0 ? "Spending down vs " + monthLabel(prev) : "Spending up vs " + monthLabel(prev),
          text: "You spent <strong>" + Math.round(Math.abs(chg) * 100) + "%</strong> " + (chg < 0 ? "less" : "more") + " than in " + monthLabel(prev) + " (" + fmtMoney(prevTotal, { compact: true }) + ").",
        });
      }
    }
  }

  const order = { danger: 0, warn: 1, good: 2, info: 3 };
  out.sort((a, b) => order[a.level] - order[b.level]);
  return out.slice(0, 6);
}

/* ====================================================================
   Spreadsheet template — download, AI prompt, and dedup-aware import
   ==================================================================== */

const BudgetIO = {
  CATEGORY_LIST: EXPENSE_CATEGORIES.map(c => c.name).join(", "),

  aiPrompt() {
    return "I'm attaching my credit-card / bank statement(s). Fill a CSV with exactly these columns: " +
      "Date,Description,Category,Amount,Currency — one row per transaction.\n" +
      "Rules:\n" +
      "• Date format YYYY-MM-DD.\n" +
      "• Amount = a positive number for money spent (use a minus sign only for refunds).\n" +
      "• Category MUST be one of: " + this.CATEGORY_LIST + ".\n" +
      "• Currency is USD, MXN, EUR or GBP.\n" +
      "• Skip card payments and transfers (they aren't expenses).\n" +
      "Return ONLY the CSV rows (no header, no commentary) so I can paste them into my template.";
  },

  buildTemplateCSV() {
    const cur = displayCurrency();
    const L = [
      "# FinanceOS — Expense Import Template",
      "# -----------------------------------------------------------------",
      "# HOW TO USE",
      "# 1. Add ONE row per expense under the 'Date,Description,...' header line.",
      "# 2. Date format: YYYY-MM-DD  (e.g. 2026-06-15).",
      "# 3. Amount: a positive number for money spent (minus sign only for refunds).",
      "# 4. Category: pick ONE from the list below.",
      "# 5. Currency: USD, MXN, EUR or GBP. Leave blank to use " + cur + ".",
      "# 6. Save as CSV, then in FinanceOS open Budget and Upload it.",
      "# 7. Re-uploading is safe — duplicate rows are detected and never added twice.",
      "#",
      "# LET YOUR AI FILL IT FOR YOU:",
      "#   Paste this template + your statement into ChatGPT or Claude and ask it to",
      "#   return CSV rows (Date,Description,Category,Amount,Currency). Drop them under",
      "#   the header below and upload. Lines starting with # are ignored on import.",
      "#",
      "# CATEGORIES: " + this.CATEGORY_LIST,
      "#",
      "# EXAMPLES (these are comments — they will NOT be imported):",
      "#   2026-06-01,Trader Joe's,Groceries,82.40,USD",
      "#   2026-06-02,Spotify,Subscriptions,11.99,USD",
      "#   2026-06-03,Metro card,Transport,40.00,USD",
      "# -----------------------------------------------------------------",
      "Date,Description,Category,Amount,Currency",
      "",
    ];
    return "﻿" + L.join("\r\n"); // BOM so Excel reads accents correctly
  },

  downloadTemplate() {
    const blob = new Blob([this.buildTemplateCSV()], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "financeos-expense-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  },

  /* minimal but correct CSV parser (quoted fields, embedded commas/newlines) */
  parseCSV(text) {
    const rows = [];
    let row = [], field = "", i = 0, inQ = false;
    text = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    while (i < text.length) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += c; i++;
    }
    row.push(field); rows.push(row);
    return rows;
  },

  /* Parse + dedup-aware import. Never adds a row that already exists, and never
     double-counts across re-uploads or overlapping files. */
  importText(text) {
    // an .xlsx is a binary zip ("PK") — guide the user to CSV instead
    if (/^PK\x03\x04/.test(text)) {
      return { added: 0, skipped: 0, errors: ["This looks like an .xlsx file. In Excel use File → Save As → CSV, then upload the .csv."], rows: 0 };
    }
    const rows = this.parseCSV(text);
    const errors = [];
    let added = 0, skipped = 0, dataRows = 0;

    // locate the header row (first non-comment row containing Date & Amount)
    let headerIdx = -1, cols = null;
    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r].map(x => String(x).trim());
      if (!cells.length || cells[0].charAt(0) === "#") continue;
      const lower = cells.map(x => x.toLowerCase());
      if (lower.indexOf("date") !== -1 && lower.indexOf("amount") !== -1) { headerIdx = r; cols = lower; break; }
    }
    const idx = (names) => {
      if (!cols) return -1;
      for (const n of names) { const k = cols.indexOf(n); if (k !== -1) return k; }
      return -1;
    };
    const di = headerIdx === -1 ? 0 : idx(["date"]);
    const ai = headerIdx === -1 ? 3 : idx(["amount", "amount spent", "value"]);
    const ci = headerIdx === -1 ? 2 : idx(["category", "cat"]);
    const ni = headerIdx === -1 ? 1 : idx(["description", "merchant", "name", "memo", "details"]);
    const ui = headerIdx === -1 ? 4 : idx(["currency", "cur", "ccy"]);

    // existing signatures → counts, so legitimate repeats survive but dupes don't
    const have = {};
    (Store.state.expenses || []).forEach(e => { have[e.sig] = (have[e.sig] || 0) + 1; });
    const seen = {};
    const toAdd = [];

    const start = headerIdx === -1 ? 0 : headerIdx + 1;
    for (let r = start; r < rows.length; r++) {
      const cells = rows[r];
      const first = String(cells[0] || "").trim();
      if (first.charAt(0) === "#") continue;                       // comment line
      if (cells.every(x => String(x).trim() === "")) continue;     // blank line
      dataRows++;

      const date = parseExpenseDate(cells[di]);
      const amount = parseAmount(cells[ai]);
      if (!date || amount == null || amount === 0) {
        if (errors.length < 6) errors.push("Skipped row " + (r + 1) + " — needs a valid date and amount.");
        continue;
      }
      const e = {
        date,
        description: String(cells[ni] != null ? cells[ni] : "").trim().slice(0, 80),
        category: canonicalCategory(cells[ci]),
        amount,
        currency: (function (c) { c = String(c || "").trim().toUpperCase(); return CURRENCY_CODES.indexOf(c) !== -1 ? c : displayCurrency(); })(cells[ui]),
        source: "import",
      };
      e.sig = expenseSig(e);
      seen[e.sig] = (seen[e.sig] || 0) + 1;
      if (seen[e.sig] <= (have[e.sig] || 0)) { skipped++; continue; }  // already have this many
      toAdd.push(e);
    }

    toAdd.forEach(e => { Store.add("expenses", e); added++; });
    return { added, skipped, errors, rows: dataRows };
  },
};
