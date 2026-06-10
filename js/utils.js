/* FinanceOS — utilities: formatting, dates, interest math */
"use strict";

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const CURRENCY_LOCALE = { USD: "en-US", MXN: "es-MX", EUR: "de-DE", GBP: "en-GB" };

function fmtMoney(n, opts) {
  opts = opts || {};
  const cur = (typeof Store !== "undefined" && Store.state) ? Store.state.settings.currency : "USD";
  const v = Number(n) || 0;
  const out = new Intl.NumberFormat(CURRENCY_LOCALE[cur] || "en-US", {
    style: "currency", currency: cur,
    minimumFractionDigits: opts.compact ? 0 : 2,
    maximumFractionDigits: opts.compact ? 0 : 2,
  }).format(v);
  return (opts.sign && v > 0 ? "+" : "") + out;
}

function fmtPct(n, digits) {
  const v = Number(n) || 0;
  return (v > 0 ? "+" : "") + v.toFixed(digits == null ? 2 : digits) + "%";
}

function fmtNum(n, digits) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits == null ? 4 : digits,
  }).format(Number(n) || 0);
}

/* ---------- dates ---------- */

function todayMid() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseISO(s) {
  // 'YYYY-MM-DD' -> local Date at midnight
  if (!s) return null;
  const p = String(s).split("-").map(Number);
  if (p.length < 3) return null;
  return new Date(p[0], p[1] - 1, p[2]);
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + dd;
}

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(d) {
  if (!(d instanceof Date)) d = parseISO(d);
  if (!d) return "—";
  return MONTHS_SHORT[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
}

function fmtDateShort(d) {
  if (!(d instanceof Date)) d = parseISO(d);
  if (!d) return "—";
  return MONTHS_SHORT[d.getMonth()] + " " + d.getDate();
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

function daysUntil(d) {
  return daysBetween(todayMid(), d);
}

function lastDayOfMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

function clampedDate(y, m, day) {
  return new Date(y, m, Math.min(day, lastDayOfMonth(y, m)));
}

/* Next occurrence of a day-of-month, on or after `from` (clamped to month length). */
function nextMonthlyOccurrence(day, from) {
  from = from || todayMid();
  let d = clampedDate(from.getFullYear(), from.getMonth(), day);
  if (d < from) d = clampedDate(from.getFullYear(), from.getMonth() + 1, day);
  return d;
}

/* ---------- income schedules ----------
   frequency: 'monthly' (payDay), 'quincena' (15th & last day),
   'biweekly' (every 14 days from startDate), 'weekly' (every 7 days from startDate)
*/
function incomeOccurrences(income, from, to) {
  const out = [];
  const start = parseISO(income.startDate) || todayMid();
  const lo = from > start ? from : start;

  if (income.frequency === "monthly") {
    let d = nextMonthlyOccurrence(Number(income.payDay) || 1, lo);
    while (d <= to) {
      out.push(d);
      d = clampedDate(d.getFullYear(), d.getMonth() + 1, Number(income.payDay) || 1);
    }
  } else if (income.frequency === "quincena") {
    let y = lo.getFullYear(), m = lo.getMonth();
    for (let i = 0; i < 30; i++) {
      const mid = new Date(y, m, 15);
      const end = new Date(y, m, lastDayOfMonth(y, m));
      if (mid >= lo && mid <= to) out.push(mid);
      if (end >= lo && end <= to) out.push(end);
      if (end > to) break;
      m++; if (m > 11) { m = 0; y++; }
    }
  } else {
    const step = income.frequency === "weekly" ? 7 : 14;
    let d = new Date(start);
    if (d < lo) {
      const k = Math.ceil(daysBetween(d, lo) / step);
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + k * step);
    }
    while (d <= to) {
      out.push(new Date(d));
      d.setDate(d.getDate() + step);
    }
  }
  out.sort((a, b) => a - b);
  return out;
}

function freqLabel(income) {
  switch (income.frequency) {
    case "monthly": return "Monthly · day " + income.payDay;
    case "quincena": return "Every 15th & month-end";
    case "biweekly": return "Every 14 days";
    case "weekly": return "Weekly";
    default: return income.frequency;
  }
}

/* Monthly-equivalent amount of an income stream */
function monthlyEquivalent(income) {
  const a = Number(income.amount) || 0;
  switch (income.frequency) {
    case "monthly": return a;
    case "quincena": return a * 2;
    case "biweekly": return a * 26 / 12;
    case "weekly": return a * 52 / 12;
    default: return a;
  }
}

/* ---------- interest math ---------- */

/* Interest accrued on an account since its balance was last set (daily compounding). */
function accruedInterest(account, asOf) {
  const apy = Number(account.apy) || 0;
  if (apy <= 0) return 0;
  const since = parseISO(account.balanceAsOf);
  if (!since) return 0;
  const days = Math.max(0, daysBetween(since, asOf || todayMid()));
  return (Number(account.balance) || 0) * (Math.pow(1 + apy / 100, days / 365) - 1);
}

function dailyInterest(account) {
  const apy = Number(account.apy) || 0;
  if (apy <= 0) return 0;
  return (Number(account.balance) || 0) * (Math.pow(1 + apy / 100, 1 / 365) - 1);
}

function monthlyInterestEst(account) {
  const apy = Number(account.apy) || 0;
  if (apy <= 0) return 0;
  return (Number(account.balance) || 0) * (apy / 100) / 12;
}

function yearlyInterestEst(account) {
  const apy = Number(account.apy) || 0;
  return (Number(account.balance) || 0) * (apy / 100);
}

/* ---------- credit cards ---------- */

function nextCardDate(dayOfMonth, from) {
  return nextMonthlyOccurrence(Number(dayOfMonth) || 1, from || todayMid());
}

function cardUtilization(card) {
  const lim = Number(card.limit) || 0;
  if (lim <= 0) return 0;
  return (Number(card.balance) || 0) / lim;
}

/* ---------- misc ---------- */

const ACCOUNT_TYPE_META = {
  checking:   { label: "Checking",   tag: "sky" },
  savings:    { label: "Savings",    tag: "mint" },
  investment: { label: "Investment", tag: "lilac" },
};

const CHART_COLORS = ["#8fe3a6", "#e5c97b", "#8fc9e3", "#c5b3e6", "#e8a26f", "#9be3d2", "#e3b8cf", "#b8c8e3"];

function ordinal(n) {
  n = Number(n);
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ---------- global percentile estimation (gamification) ----------
   Approximate distributions for the global adult population, in USD,
   interpolated from public global wealth & income reports (UBS/Credit
   Suisse Global Wealth Report, World Inequality Database, ~2024).
   Estimates only — shown with a disclaimer in the app. */

const FX_TO_USD = { USD: 1, MXN: 0.055, EUR: 1.09, GBP: 1.27 };

function toUSD(amount) {
  const cur = (typeof Store !== "undefined" && Store.state) ? Store.state.settings.currency : "USD";
  return (Number(amount) || 0) * (FX_TO_USD[cur] || 1);
}

function fromUSD(amount) {
  const cur = (typeof Store !== "undefined" && Store.state) ? Store.state.settings.currency : "USD";
  return (Number(amount) || 0) / (FX_TO_USD[cur] || 1);
}

/* [net worth in USD, % of global adults at or below that level] */
const NETWORTH_PCT_TABLE = [
  [-10000, 5], [0, 12], [1000, 27], [5000, 42], [8700, 50], [25000, 62],
  [50000, 70], [100000, 77], [140000, 82], [250000, 88], [500000, 93.5],
  [1000000, 98], [1200000, 99], [5000000, 99.8], [10000000, 99.9], [50000000, 99.99],
];

/* [annual gross income in USD, % of global adults at or below] */
const INCOME_PCT_TABLE = [
  [0, 0], [500, 10], [1200, 22], [2500, 35], [4800, 50], [10000, 65],
  [20000, 78], [35000, 87], [50000, 92], [75000, 95.5], [100000, 97.5],
  [130000, 99], [250000, 99.5], [500000, 99.9], [1000000, 99.99],
];

function percentileFromTable(usd, table) {
  if (usd <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (usd <= table[i][0]) {
      const [v0, p0] = table[i - 1], [v1, p1] = table[i];
      return p0 + (p1 - p0) * (usd - v0) / (v1 - v0);
    }
  }
  return table[table.length - 1][1];
}

function valueAtPercentile(pct, table) {
  if (pct <= table[0][1]) return table[0][0];
  for (let i = 1; i < table.length; i++) {
    if (pct <= table[i][1]) {
      const [v0, p0] = table[i - 1], [v1, p1] = table[i];
      if (p1 === p0) return v1;
      return v0 + (v1 - v0) * (pct - p0) / (p1 - p0);
    }
  }
  return table[table.length - 1][0];
}

/* "Top 12%" / "Top 1.3%" / "Top 0.05%" */
function topShareLabel(pct) {
  const top = Math.max(0.01, 100 - pct);
  if (top >= 10) return "Top " + Math.round(top) + "%";
  if (top >= 1) return "Top " + top.toFixed(1) + "%";
  return "Top " + top.toFixed(2) + "%";
}

/* Next "top X%" bracket above the current percentile, or null at the summit. */
function nextMilestone(pct, table) {
  const brackets = [
    { pct: 50, label: "the top 50%" }, { pct: 75, label: "the top 25%" },
    { pct: 90, label: "the top 10%" }, { pct: 95, label: "the top 5%" },
    { pct: 99, label: "the top 1%" }, { pct: 99.9, label: "the top 0.1%" },
  ];
  for (const b of brackets) {
    if (pct < b.pct) return { label: b.label, usd: valueAtPercentile(b.pct, table) };
  }
  return null;
}

/* ---------- crypto helpers (PIN lock, AES-GCM via Web Crypto) ---------- */

function bufToB64(buf) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
}

function b64ToBuf(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function cryptoAvailable() {
  return typeof crypto !== "undefined" && !!crypto.subtle;
}

async function deriveKeyFromPin(pin, saltBuf) {
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBuf, iterations: 150000, hash: "SHA-256" },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
