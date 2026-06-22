/* FinanceOS — utilities: formatting, dates, interest math */
"use strict";

/* ---------- icon system ----------
   Inline monoline SVGs (currentColor, 1.6px stroke) — one consistent,
   professional icon language across nav, categories and empty states.
   No emoji, no dependencies. */
const ICON_PATHS = {
  // nav
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
  bank: '<path d="M3 21h18"/><path d="M5 21V10M9.5 21V10M14.5 21V10M19 21V10"/><path d="M3.5 10 12 4l8.5 6z"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="M3 10h18"/><path d="M6.5 14.5h4"/>',
  growth: '<path d="M3 16.5l5.5-5.5 4 4 8-8"/><path d="M15.5 6.5H21V12"/>',
  wallet: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H17v3"/><rect x="3" y="7.5" width="18" height="12" rx="2.4"/><circle cx="17" cy="13.5" r="1.3"/>',
  pie: '<path d="M21 12.5A8.5 8.5 0 1 1 11.5 3v9.5z"/><path d="M13.5 3.2A8.5 8.5 0 0 1 20.8 10.5H13.5z"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M9 14.2 7.5 21l4.5-2.7L16.5 21 15 14.2"/>',
  cap: '<path d="M2.5 9 12 5l9.5 4-9.5 4z"/><path d="M6.5 11v4.6c0 1.2 2.5 2.4 5.5 2.4s5.5-1.2 5.5-2.4V11"/><path d="M21.5 9v5"/>',
  book: '<path d="M12 6.5S9.5 4.5 4.5 4.5V18c5 0 7.5 1.8 7.5 1.8S14.5 18 19.5 18V4.5C14.5 4.5 12 6.5 12 6.5z"/><path d="M12 6.5v13.3"/>',
  // categories
  bolt: '<path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z"/>',
  cart: '<circle cx="9.5" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/><path d="M2.5 3.5H5l2.3 11.4a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.3L20.5 7H6"/>',
  food: '<path d="M5 3v6a2 2 0 0 0 2 2v10"/><path d="M9 3v6"/><path d="M7 3v6"/><path d="M17 3c-1.7 0-3 2.2-3 5.2 0 2.4 1.2 3.4 3 3.6V21"/>',
  car: '<path d="M5 13l1.6-4.6A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.4L19 13"/><path d="M4 13h16v4.5H4z"/><circle cx="7.5" cy="17.5" r="1.3"/><circle cx="16.5" cy="17.5" r="1.3"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  shield: '<path d="M12 3l7 3v5c0 4.6-3 8.1-7 10-4-1.9-7-5.4-7-10V6z"/>',
  blocks: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/><path d="M13.5 4.5h7v6M10.5 17h-6v-6"/>',
  bag: '<path d="M6 7.5h12l1 12.5H5z"/><path d="M9 7.5a3 3 0 0 1 6 0"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2.2"/><path d="M3 9h18M3 15h18M8 4v16M16 4v16"/>',
  plane: '<path d="M21 4 3.5 11l6 2.2L11.5 20 14 13z"/><path d="M21 4 11 13"/>',
  repeat: '<path d="M17 3.5l3 3-3 3"/><path d="M4 12V10a3.5 3.5 0 0 1 3.5-3.5H20"/><path d="M7 20.5l-3-3 3-3"/><path d="M20 12v2a3.5 3.5 0 0 1-3.5 3.5H4"/>',
  sparkle: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.4L12 17l-1.9-5.6L4.5 10l5.6-1.4z"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v9h14v-9"/><path d="M12 8v13"/><path d="M12 8C9.5 8 8 7 8 5.5S9.5 3.5 10.5 4.5 12 8 12 8zM12 8c2.5 0 4-1 4-2.5S14.5 3.5 13.5 4.5 12 8 12 8z"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.4 2 3.5 2 3.5-2 3.5-2"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  dots: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  // chrome / controls
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"/>',
  moon: '<path d="M21 12.8A8.6 8.6 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  star: '<path d="M12 3.5l2.55 5.2 5.7.85-4.13 4 .98 5.7L12 16.6l-5.08 2.65.98-5.7L3.75 9.55l5.7-.85z"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2 2 0 0 0-2.83-2.83L5 17.2z"/><path d="M13.5 6.7l3.8 3.8"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 1.8"/>',
};

function icon(name, cls) {
  const p = ICON_PATHS[name] || ICON_PATHS.dots;
  return '<svg class="ic' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>";
}

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const CURRENCY_LOCALE = { USD: "en-US", MXN: "es-MX", EUR: "de-DE", GBP: "en-GB" };
const CURRENCY_CODES = ["USD", "MXN", "EUR", "GBP"];

function displayCurrency() {
  return (typeof Store !== "undefined" && Store.state) ? Store.state.settings.currency : "USD";
}

/* Format an amount that is already in the display currency */
function fmtMoney(n, opts) {
  return fmtMoneyIn(n, displayCurrency(), opts);
}

/* Format an amount in an explicit currency.
   Foreign currencies render with their code ("USD 6.97") rather than an
   ambiguous "$", since USD and MXN share the same symbol. */
function fmtMoneyIn(n, cur, opts) {
  opts = opts || {};
  const v = Number(n) || 0;
  const out = new Intl.NumberFormat(CURRENCY_LOCALE[cur] || "en-US", {
    style: "currency", currency: cur,
    currencyDisplay: cur !== displayCurrency() ? "code" : "symbol",
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

/* Deposits per month for a frequency */
function freqFactor(income) {
  switch (income.frequency) {
    case "monthly": return 1;
    case "quincena": return 2;
    case "biweekly": return 26 / 12;
    case "weekly": return 52 / 12;
    default: return 1;
  }
}

/* What actually lands in the account per deposit (after tax). */
function netPerDeposit(income) {
  const a = Number(income.amount) || 0;
  const r = Number(income.taxRate) || 0;
  if (income.amountType === "gross" && r > 0) return a * (1 - r / 100);
  return a;
}

/* Pre-tax amount per deposit. */
function grossPerDeposit(income) {
  const a = Number(income.amount) || 0;
  const r = Number(income.taxRate) || 0;
  if (income.amountType === "net" && r > 0 && r < 100) return a / (1 - r / 100);
  return a;
}

/* Monthly-equivalent gross amount of an income stream (native currency) */
function monthlyEquivalent(income) {
  return grossPerDeposit(income) * freqFactor(income);
}

/* Monthly-equivalent net amount (native currency) */
function monthlyEquivalentNet(income) {
  return netPerDeposit(income) * freqFactor(income);
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
  // compound monthly to match dailyInterest/accruedInterest/settleInterest
  return (Number(account.balance) || 0) * (Math.pow(1 + apy / 100, 1 / 12) - 1);
}

function yearlyInterestEst(account) {
  const apy = Number(account.apy) || 0;
  return (Number(account.balance) || 0) * (apy / 100);
}

/* Taxable "interés real" — the only interest the ISR actually hits in Mexico:
   nominal interest less the inflationary adjustment on capital. Inflation is the
   configurable assumption in settings.tax.inflation (a rational long-run MX rate
   is ≈4–4.5%). Never negative — a real loss isn't taxed. */
function realInterestEst(account) {
  const apy = Number(account.apy) || 0;
  if (apy <= 0) return 0;
  const infl = (typeof Store !== "undefined" && Store.state && Store.state.settings &&
    Store.state.settings.tax && Number(Store.state.settings.tax.inflation)) || 0;
  return (Number(account.balance) || 0) * Math.max(0, apy - infl) / 100;
}

/* ---------- expected investment return ----------
   A holding's expReturn is its long-run (10y / max history) average annual
   return, populated from live data on "Update prices". Falls back to 9% — the
   rough long-run equity average — when no history is available. Clamped to a
   sane band so a data glitch can't blow up projections. */
const DEFAULT_INVEST_RETURN = 0.09;
function holdingReturnRate(h) {
  const r = h ? Number(h.expReturn) : NaN;
  if (isFinite(r) && r > -0.95 && r <= 1.0) return r;
  return DEFAULT_INVEST_RETURN;
}

/* ---------- interest pay schedule ----------
   Accounts choose how often interest is credited. APY is the true annual
   yield, so each payout is derived from it — paying more often never changes
   the yearly total, only when (and in what size chunks) it lands. */
const INTEREST_FREQ = {
  daily:     { label: "Daily",       perYear: 365 },
  monthly:   { label: "Monthly",     perYear: 12 },
  quarterly: { label: "Quarterly",   perYear: 4 },
  annually:  { label: "Annually",    perYear: 1 },
  everyN:    { label: "Every N days", perYear: null },  // cadence from interestEveryDays
  term:      { label: "Fixed term",   perYear: null },  // pays at maturity (start + term)
};
const INTEREST_FREQ_DEFAULT = "monthly";

// frequencies whose schedule is anchored to a start date and a day-count
function isDayCountFreq(f) { return f === "everyN" || f === "term"; }

function interestFreqKey(account) {
  return account && INTEREST_FREQ[account.interestFreq] ? account.interestFreq : INTEREST_FREQ_DEFAULT;
}

/* Length in days of one interest period for everyN / fixed-term accounts. */
function interestPeriodDays(account) {
  const n = Math.round(Number(account && account.interestEveryDays));
  return n >= 1 ? n : 365;
}

/* Anchor date a custom / fixed-term schedule counts from. */
function interestStartDate(account) {
  return parseISO(account && account.interestStart) ||
    parseISO(account && account.balanceAsOf) || todayMid();
}

/* Day-of-month interest is credited (31 = last day of the month). */
function interestPayDay(account) {
  const d = account ? Number(account.interestDay) : NaN;
  return d >= 1 && d <= 31 ? d : 31;
}

/* Interest credited per scheduled payment, derived from APY.
   Paying more often never changes the yearly total, only the chunk size. */
function interestPerPeriod(account) {
  const apy = Number(account.apy) || 0;
  if (apy <= 0) return 0;
  const f = interestFreqKey(account);
  const exp = isDayCountFreq(f) ? interestPeriodDays(account) / 365 : 1 / INTEREST_FREQ[f].perYear;
  return (Number(account.balance) || 0) * (Math.pow(1 + apy / 100, exp) - 1);
}

/* Next date interest is scheduled to be credited, on or after `from`.
   quarterly anchors to Jan/Apr/Jul/Oct, annually to December, everyN/term to
   their start date stepped by the period length (fixed terms roll to the next
   maturity once the prior one passes). */
function nextInterestDate(account, from) {
  from = from || todayMid();
  const f = interestFreqKey(account);
  if (f === "daily") { const d = new Date(from); d.setDate(d.getDate() + 1); return d; }
  if (isDayCountFreq(f)) {
    const start = interestStartDate(account);
    const N = interestPeriodDays(account);
    const d = new Date(start);
    if (start > from) { d.setDate(d.getDate() + N); return d; }   // first maturity ahead
    const k = Math.floor(daysBetween(start, from) / N) + 1;
    d.setDate(d.getDate() + k * N);
    return d;
  }
  const day = interestPayDay(account);
  if (f === "monthly") return nextMonthlyOccurrence(day, from);
  const anchors = f === "quarterly" ? [0, 3, 6, 9] : [11];
  for (let i = 0; i < 48; i++) {
    const base = new Date(from.getFullYear(), from.getMonth() + i, 1);
    if (anchors.indexOf(base.getMonth()) !== -1) {
      const d = clampedDate(base.getFullYear(), base.getMonth(), day);
      if (d >= from) return d;
    }
  }
  return nextMonthlyOccurrence(day, from);
}

/* "Daily" / "Monthly · last day" / "Every 547 days" / "Fixed term · 364 days" */
function interestScheduleLabel(account) {
  const f = interestFreqKey(account);
  if (f === "daily") return "Daily";
  if (f === "everyN") return "Every " + interestPeriodDays(account) + " days";
  if (f === "term") return "Fixed term · " + interestPeriodDays(account) + " days";
  const day = interestPayDay(account);
  return INTEREST_FREQ[f].label + " · " + (day >= 29 ? "last day" : ordinal(day));
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

/* ---------- number-input grouping (live thousands separators) ----------
   <input type="number"> can't show commas, so money fields are text inputs with
   class "fmt-num"; these helpers format the display and parse it back. */
function parseNum(s) {
  const n = parseFloat(String(s == null ? "" : s).replace(/,/g, ""));
  return isFinite(n) ? n : 0;
}
function fmtNumInput(raw) {
  if (raw == null || raw === "") return "";
  let s = String(raw).replace(/[^\d.\-]/g, "");
  if (s === "" || s === "-") return s;
  const neg = s[0] === "-";
  s = s.replace(/-/g, "");
  const dot = s.indexOf(".");
  let intPart = dot === -1 ? s : s.slice(0, dot);
  const decPart = dot === -1 ? null : s.slice(dot + 1).replace(/\./g, "");
  intPart = intPart.replace(/^0+(?=\d)/, "");
  if (intPart === "") intPart = "0";
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + grouped + (decPart !== null ? "." + decPart : "");
}
/* reformat an input in place, keeping the caret after the same digit */
function reformatNumInput(el) {
  const old = el.value, caret = el.selectionStart == null ? old.length : el.selectionStart;
  const sig = old.slice(0, caret).replace(/[^\d.\-]/g, "").length;
  const next = fmtNumInput(old);
  if (next === old) return;
  el.value = next;
  let seen = 0, pos = 0;
  while (pos < next.length && seen < sig) { if (/[\d.\-]/.test(next[pos])) seen++; pos++; }
  try { el.setSelectionRange(pos, pos); } catch (e) { /* not focusable */ }
}

/* tiny inline sparkline SVG from a list of numbers (green if up, rose if down) */
function sparkline(values, opts) {
  opts = opts || {};
  const W = opts.w || 96, H = opts.h || 22, PAD = 2;
  const vals = (values || []).filter(v => isFinite(v));
  if (vals.length < 2) return "";
  const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), span = (max - min) || 1, n = vals.length;
  const pts = vals.map((v, i) =>
    (PAD + i * (W - 2 * PAD) / (n - 1)).toFixed(1) + "," + (H - PAD - (v - min) / span * (H - 2 * PAD)).toFixed(1)).join(" ");
  const col = vals[n - 1] >= vals[0] ? "#8fe3a6" : "#e8836f";
  return '<svg class="spark" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true">' +
    '<polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>';
}

function ordinal(n) {
  n = Number(n);
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ---------- foreign exchange ----------
   Rates are stored as units-per-USD (Frankfurter/ECB, refreshed daily).
   FALLBACK_FX keeps the app working offline. */

const FALLBACK_FX = { USD: 1, MXN: 18.2, EUR: 0.92, GBP: 0.79 };

function fxRates() {
  const s = (typeof Store !== "undefined" && Store.state) ? Store.state.settings : null;
  return (s && s.fx && s.fx.rates) ? s.fx.rates : FALLBACK_FX;
}

function convBetween(amount, from, to) {
  if (from === to) return Number(amount) || 0;
  const r = fxRates();
  // never silently treat a missing rate as 1 (that would read the amount as USD);
  // fall back to the built-in offline rate for that currency instead.
  const rf = r[from] || FALLBACK_FX[from] || 1;
  const rt = r[to] || FALLBACK_FX[to] || 1;
  return (Number(amount) || 0) * (rt / rf);
}

/* entity currency -> display currency */
function conv(amount, fromCur) {
  return convBetween(amount, fromCur || displayCurrency(), displayCurrency());
}

function toUSD(amount, fromCur) {
  return convBetween(amount, fromCur || displayCurrency(), "USD");
}

function fromUSD(amount, toCur) {
  return convBetween(amount, "USD", toCur || displayCurrency());
}

/* ---------- global percentile estimation (gamification) ----------
   Approximate distributions for the global adult population, in USD,
   interpolated from public global wealth & income reports (UBS/Credit
   Suisse Global Wealth Report, World Inequality Database, ~2024).
   Estimates only — shown with a disclaimer in the app. */

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
