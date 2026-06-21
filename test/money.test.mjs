/* FinanceOS — money-math test suite.
   In a finance app the one bug you cannot ship is a wrong number, so the
   money-critical logic gets covered here: interest schedules, amount/date
   parsing, dedup signatures, statement classification + reconciliation.

   No dependencies, no framework. Run it with:  node test/money.test.mjs
   It loads the real source files (utils / budget / statements) into a sandbox
   and asserts on their actual output, then exits non-zero if anything fails. */
import fs from "fs";
import vm from "vm";
import { fileURLToPath } from "url";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

/* ---- sandbox: load the real source, sharing one lexical scope ---- */
const ctx = {
  console, Date, Math, Intl, JSON, RegExp,
  isFinite, isNaN, parseFloat, parseInt,
  String, Number, Object, Array, Boolean, Map, Set,
  WebAssembly: undefined, document: undefined,
};
vm.createContext(ctx);
const bundle = [read("js/utils.js"), read("js/budget.js"), read("js/statements.js"), read("js/store.js")].join("\n;\n") +
  "\n;globalThis.__api = { interestPerPeriod, nextInterestDate, interestScheduleLabel, interestPeriodDays," +
  " accruedInterest, holdingReturnRate, parseAmount, parseExpenseDate, expenseSig, canonicalCategory," +
  " toISO, parseISO, daysBetween, todayMid, Statements, INTEREST_FREQ, Store };";
vm.runInContext(bundle, ctx, { filename: "bundle.js" });
const A = ctx.__api;
// fresh in-memory store, no persistence
const resetStore = (over) => {
  A.Store.state = Object.assign({
    settings: { currency: "MXN", tax: { interest: 0 }, autoInterest: true, fx: null },
    accounts: [], cards: [], holdings: [], incomes: [], expenses: [], budgets: {}, snapshots: [], learn: {},
  }, over || {});
  A.Store.save = () => {};
};
resetStore();

/* ---- tiny assertion harness ---- */
let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; fails.push(msg); } }
function eq(actual, expected, msg) { ok(actual === expected, `${msg}  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`); }
function approx(actual, expected, tol, msg) { ok(Math.abs(actual - expected) <= tol, `${msg}  (got ${actual}, want ${expected}±${tol})`); }
function group(name, fn) { fn(); }

const acct = (o) => Object.assign({ balance: 100000, apy: 10.2, currency: "MXN", balanceAsOf: "2026-01-01" }, o);
const annualFromPeriod = (perPeriod, periodsPerYear, bal) => (Math.pow(1 + perPeriod / bal, periodsPerYear) - 1) * 100;

/* ================= interest math ================= */
group("interest: APY invariance across cadences", () => {
  const cases = [
    ["daily", {}, 365],
    ["monthly", {}, 12],
    ["quarterly", {}, 4],
    ["annually", {}, 1],
    ["everyN", { interestEveryDays: 182, interestStart: "2026-01-01" }, 365 / 182],
    ["term", { interestEveryDays: 91, interestStart: "2026-01-01" }, 365 / 91],
  ];
  for (const [freq, extra, perYr] of cases) {
    const a = acct(Object.assign({ interestFreq: freq }, extra));
    const per = A.interestPerPeriod(a);
    approx(annualFromPeriod(per, perYr, 100000), 10.2, 0.001, `${freq}: per-period compounds back to APY`);
    ok(per > 0, `${freq}: positive payout`);
  }
});

group("interest: zero / negative APY pays nothing", () => {
  eq(A.interestPerPeriod(acct({ apy: 0, interestFreq: "monthly" })), 0, "0% APY → 0 payout");
  eq(A.interestPerPeriod(acct({ apy: -3, interestFreq: "daily" })), 0, "negative APY → 0 payout");
});

group("interest: custom N-day cadence", () => {
  const a = acct({ interestFreq: "everyN", interestEveryDays: 547, interestStart: "2026-01-01" });
  eq(A.interestPeriodDays(a), 547, "period length = 547");
  eq(A.interestScheduleLabel(a), "Every 547 days", "everyN label");
  const next = A.toISO(A.nextInterestDate(a, new Date("2026-06-01")));
  eq(next, "2027-07-02", "next pay = start + 547 days");
});

group("interest: fixed-term maturity + rollover", () => {
  const a = acct({ interestFreq: "term", interestEveryDays: 91, interestStart: "2026-01-01" });
  eq(A.interestScheduleLabel(a), "Fixed term · 91 days", "term label");
  eq(A.toISO(A.nextInterestDate(a, new Date("2026-02-01"))), "2026-04-02", "first maturity = +91d");
  eq(A.toISO(A.nextInterestDate(a, new Date("2026-05-01"))), "2026-07-02", "rolls to +182d after first matures");
  approx(A.interestPerPeriod(a), 100000 * (Math.pow(1.102, 91 / 365) - 1), 0.01, "maturity payout matches term");
  // the annual rate must be PRO-RATED to the term, not paid in full
  const t = acct({ apy: 11.5, interestFreq: "term", interestEveryDays: 91, interestStart: "2026-01-01" });
  approx(A.interestPerPeriod(t), 2751.07, 1, "11.5%/yr over 91 days ≈ 2.75%, not the full 11.5%");
  ok(A.interestPerPeriod(t) < 0.04 * 100000, "91-day payout is a small fraction of the balance");
});

group("interest: accrual since balance date", () => {
  const a = acct({ apy: 10, interestFreq: "daily", balanceAsOf: "2026-01-01" });
  approx(A.accruedInterest(a, new Date("2027-01-01")), 10000, 1, "≈1y accrual ≈ APY×balance");
  eq(A.accruedInterest(acct({ apy: 0 })), 0, "no APY → no accrual");
});

group("interest: monthly pay-day & quarterly anchors", () => {
  const m = acct({ interestFreq: "monthly", interestDay: 15 });
  eq(A.interestScheduleLabel(m), "Monthly · 15th", "monthly label with day");
  const q = acct({ interestFreq: "quarterly", interestDay: 31 });
  const qd = A.nextInterestDate(q, new Date("2026-02-10"));
  eq(qd.getMonth(), 3, "quarterly from Feb 10 → next anchor is April (Jan/Apr/Jul/Oct)");
});

/* ================= investment return guard ================= */
group("holdingReturnRate clamps to a sane band", () => {
  eq(A.holdingReturnRate({ expReturn: 0.12 }), 0.12, "passes through valid rate");
  eq(A.holdingReturnRate({ expReturn: 5 }), 0.09, "absurd 500% → default 9%");
  eq(A.holdingReturnRate({ expReturn: -2 }), 0.09, "<-95% → default 9%");
  eq(A.holdingReturnRate({}), 0.09, "missing → default 9%");
});

/* ================= amount & date parsing ================= */
group("parseAmount", () => {
  eq(A.parseAmount("$1,234.56"), 1234.56, "currency + thousands");
  eq(A.parseAmount("(50.00)"), -50, "parens = negative");
  eq(A.parseAmount("-5"), -5, "leading minus");
  eq(A.parseAmount(""), null, "empty → null");
});

group("parseExpenseDate", () => {
  eq(A.parseExpenseDate("2026-06-15"), "2026-06-15", "ISO passthrough");
  eq(A.parseExpenseDate("6/15/2026"), "2026-06-15", "M/D/Y");
  eq(A.parseExpenseDate("2026-02-30"), null, "impossible day → null");
  eq(A.parseExpenseDate(""), null, "empty → null");
});

/* ================= dedup signature ================= */
group("expenseSig is stable & discriminating", () => {
  const base = { date: "2026-06-01", description: "Trader Joe's", category: "Groceries", amount: 82.4, currency: "USD" };
  eq(A.expenseSig(base), A.expenseSig(Object.assign({}, base)), "same fields → same sig");
  eq(A.expenseSig(base), A.expenseSig(Object.assign({}, base, { description: "  trader joe's " })), "case/space-insensitive desc");
  ok(A.expenseSig(base) !== A.expenseSig(Object.assign({}, base, { amount: 82.41 })), "amount change → new sig");
  ok(A.expenseSig(base) !== A.expenseSig(Object.assign({}, base, { date: "2026-06-02" })), "date change → new sig");
});

group("canonicalCategory aliases", () => {
  eq(A.canonicalCategory("coffee"), "Dining", "coffee → Dining");
  eq(A.canonicalCategory("rent"), "Housing", "rent → Housing");
  eq(A.canonicalCategory("Netflix"), "Subscriptions", "netflix → Subscriptions");
  eq(A.canonicalCategory("Groceries"), "Groceries", "known passes through");
});

/* ================= statement classification ================= */
group("Statements.classify", () => {
  const S = A.Statements;
  eq(S.classify("GRACIAS POR SU PAGO EN LINEA", 8313.4, false), "payment", "thank-you-for-payment → payment");
  eq(S.classify("MERCADOPAGO*PERIFERICO", 230, false), "charge", "MercadoPago is a merchant, not a payment");
  eq(S.classify("Reembolso · Uber", -10, false), "refund", "reembolso → refund");
  eq(S.classify("AMAZON MX", 277, true), "payment", "CR flag → payment/credit");
  eq(S.classify("Saldo al corte del periodo anterior", 2508.3, false), "balance", "prior balance → balance");
});

group("Statements.guessCategory", () => {
  const S = A.Statements;
  eq(S.guessCategory("UBER EATS HELP.UBER.C"), "Dining", "uber eats → Dining");
  eq(S.guessCategory("Uber XXXX"), "Transport", "uber rides → Transport");
  eq(S.guessCategory("MERCADOPAGO*HARVARDGALA"), "Shopping", "mercadopago → Shopping");
  eq(S.guessCategory("COSTCO SANTA FE"), "Groceries", "costco → Groceries");
  eq(S.guessCategory("TOTAL PLAY CR"), "Utilities", "total play → Utilities");
});

group("Statements._tidyDesc strips masked card numbers", () => {
  const S = A.Statements;
  eq(S._tidyDesc("Uber XXXXXXXXXXXX9906"), "Uber", "strips masked PAN");
  eq(S._tidyDesc("UBER EATS, CDMX, "), "UBER EATS, CDMX", "strips trailing separators");
});

group("Statements.parseKlar", () => {
  const S = A.Statements;
  const text = ["Transacciones",
    "4 enero 2026 Costco $1,578.26",
    "6 enero 2026 Pago de Línea de crédito $-580.00",
    "22 enero 2026 Reembolso | 20 enero 2026 | Uber $-10.00",
    "Total de transacciones, cargos y pagos $0.00"].join("\n");
  const rows = S.parseKlar(text);
  eq(rows.length, 3, "three rows before the Total stop-line");
  eq(rows[0].date, "2026-01-04", "date built from day/month/year");
  eq(rows[0].amount, 1578.26, "amount parsed");
  eq(rows[0].type, "charge", "Costco is a charge");
  eq(rows[1].type, "payment", "Pago de Línea → payment");
  eq(rows[2].type, "refund", "Reembolso → refund");
});

group("Statements.parseSantander (OCR layout)", () => {
  const S = A.Statements;
  const text = ["14-Ene-2026 | 15-Ene-2026 | MERPAGO PERIFERICO MAG 2105031V3 $ 135.00",
    "21-Ene-2026 | 21-Ene-2026 | PAGO POR TRANSFERENCIA [-] $ 6,084.14"].join("\n");
  const rows = S.parseSantander(text);
  eq(rows.length, 2, "two rows");
  eq(rows[0].date, "2026-01-14", "uses operation date, Spanish month abbrev");
  eq(rows[0].amount, 135, "amount");
  eq(rows[0].description, "MERPAGO PERIFERICO", "reference code stripped");
  eq(rows[1].type, "payment", "PAGO POR TRANSFERENCIA → payment");
});

group("Statements._reconcile flags gross gaps, tolerates small ones", () => {
  const S = A.Statements;
  const rows = [{ type: "charge", amount: 100 }, { type: "charge", amount: 50 }, { type: "payment", amount: 999 }];
  const matchText = "Total cargos + $ 150.00";
  let r = S._reconcile(matchText, "santander", rows);
  eq(r.printed, 150, "reads printed total");
  eq(r.parsed, 150, "sums charge rows only (excludes payment)");
  ok(r.ok === true, "matching totals → ok");
  r = S._reconcile("Total cargos + $ 600.00", "santander", rows);
  ok(r.ok === false, "gross gap → flagged");
  r = S._reconcile("Total cargos + $ 150.40", "santander", rows);
  ok(r.ok === true, "40c rounding gap within tolerance");
});

group("Statements.commit is dedup-aware", () => {
  const S = A.Statements;
  resetStore();
  const row = { date: "2026-06-01", description: "Costco", category: "Groceries", amount: 1578.26, currency: "MXN" };
  const r1 = S.commit([Object.assign({}, row)]);
  eq(r1.added, 1, "first import adds the row");
  const r2 = S.commit([Object.assign({}, row)]);
  eq(r2.added, 0, "re-import adds nothing");
  eq(r2.skipped, 1, "re-import skips the duplicate");
  eq(A.Store.state.expenses.length, 1, "store holds a single copy");
});

/* ================= auto interest settlement ================= */
group("Store.settleInterest credits scheduled interest, idempotently", () => {
  const today = A.todayMid();
  const back = (days) => { const d = new Date(today); d.setDate(d.getDate() - days); return A.toISO(d); };

  // monthly, ~3 paydays elapsed: balance grows, balanceAsOf advances, re-run is a no-op
  resetStore({ accounts: [{ id: "m", balance: 100000, apy: 10, currency: "MXN", interestFreq: "monthly", interestDay: 31, balanceAsOf: back(95) }] });
  const r = A.Store.settleInterest();
  eq(r.count, 1, "one account credited");
  ok(A.Store.state.accounts[0].balance > 100000, "balance increased");
  ok(A.Store.state.accounts[0].balanceAsOf > back(95), "balanceAsOf advanced");
  const r2 = A.Store.settleInterest();
  eq(r2.count, 0, "idempotent — second run credits nothing");

  // daily over 30 days, 5% tax → net of tax, settled to today
  resetStore({ settings: { currency: "MXN", tax: { interest: 5 }, autoInterest: true, fx: null }, accounts: [{ id: "d", balance: 50000, apy: 9, currency: "MXN", interestFreq: "daily", balanceAsOf: back(30) }] });
  A.Store.settleInterest();
  approx(A.Store.state.accounts[0].balance - 50000, 50000 * (Math.pow(1.09, 30 / 365) - 1) * 0.95, 0.5, "daily credit is net of 5% tax");
  eq(A.Store.state.accounts[0].balanceAsOf, A.toISO(today), "daily settles to today");

  // fixed term not yet matured → nothing credited
  resetStore({ accounts: [{ id: "t", balance: 50000, apy: 10.2, currency: "MXN", interestFreq: "term", interestEveryDays: 91, interestStart: back(30), balanceAsOf: back(30) }] });
  eq(A.Store.settleInterest().count, 0, "term before maturity → no credit");

  // a matured term pays its FULL period interest (locked principal), even when
  // the balance was entered mid-term — matching the form's preview, not a slice
  resetStore({ accounts: [{ id: "tf", balance: 50000, apy: 10, currency: "MXN", interestFreq: "term", interestEveryDays: 91, interestStart: back(200), balanceAsOf: back(100) }] });
  A.Store.settleInterest();
  approx(A.Store.state.accounts[0].balance - 50000, 50000 * (Math.pow(1.10, 91 / 365) - 1), 1, "matured term credits the full 91-day interest, not the partial since balanceAsOf");

  // off switch leaves balances untouched
  resetStore({ settings: { currency: "MXN", tax: { interest: 0 }, autoInterest: false, fx: null }, accounts: [{ id: "x", balance: 100000, apy: 10, currency: "MXN", interestFreq: "monthly", interestDay: 31, balanceAsOf: back(95) }] });
  eq(A.Store.settleInterest().count, 0, "autoInterest off → no settlement");
  eq(A.Store.state.accounts[0].balance, 100000, "balance untouched when off");
});

/* ---- report ---- */
console.log(`\n${pass} passed, ${fail} failed  (${pass + fail} assertions)`);
if (fail) {
  console.log("\nFailures:");
  fails.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
console.log("✓ all money-math checks green");
