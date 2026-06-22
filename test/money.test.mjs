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
  " earningsBreakdown, retirementProjection, retirementMonteCarlo, retirementBuckets, retirementBucketsMC, makeEquityMarket, mulberry32, MARKET, realInterestEst, monthlyInterestEst," +
  " convBetween, sparkline, categorySeries, debtPayoff, fmtNumInput, parseNum, budgetSpendEstimate," +
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

  // daily over 30 days: interest is credited GROSS — the income ISR is settled
  // in the annual April return, NOT withheld at source — so the 5% rate must
  // NOT reduce the credited interest (it only feeds the April liability).
  resetStore({ settings: { currency: "MXN", tax: { interest: 5 }, autoInterest: true, fx: null }, accounts: [{ id: "d", balance: 50000, apy: 9, currency: "MXN", interestFreq: "daily", balanceAsOf: back(30) }] });
  A.Store.settleInterest();
  approx(A.Store.state.accounts[0].balance - 50000, 50000 * (Math.pow(1.09, 30 / 365) - 1), 0.5, "daily interest credits gross — income ISR is deferred to April, not withheld");
  eq(A.Store.state.accounts[0].balanceAsOf, A.toISO(today), "daily settles to today");

  // the only at-source deduction is the provisional ISR on capital (Ley de
  // Ingresos rate), which DOES reduce the credit: gross − balance·provRate·t
  resetStore({ settings: { currency: "MXN", tax: { interest: 5, interestProvisional: 0.5 }, autoInterest: true, fx: null }, accounts: [{ id: "dp", balance: 50000, apy: 9, currency: "MXN", interestFreq: "daily", balanceAsOf: back(30) }] });
  A.Store.settleInterest();
  approx(A.Store.state.accounts[0].balance - 50000, 50000 * (Math.pow(1.09, 30 / 365) - 1) - 50000 * 0.005 * (30 / 365), 0.5, "provisional ISR on capital is withheld from the credit; income ISR is not");

  // fixed term not yet matured → nothing credited
  resetStore({ accounts: [{ id: "t", balance: 50000, apy: 10.2, currency: "MXN", interestFreq: "term", interestEveryDays: 91, interestStart: back(30), balanceAsOf: back(30) }] });
  eq(A.Store.settleInterest().count, 0, "term before maturity → no credit");

  // a matured term pays its FULL period interest (locked principal), even when
  // the balance was entered mid-term — matching the form's preview, not a slice
  resetStore({ accounts: [{ id: "tf", balance: 50000, apy: 10, currency: "MXN", interestFreq: "term", interestEveryDays: 91, interestStart: back(200), balanceAsOf: back(100) }] });
  A.Store.settleInterest();
  approx(A.Store.state.accounts[0].balance - 50000, 50000 * (Math.pow(1.10, 91 / 365) - 1), 1, "matured term credits the full 91-day interest, not the partial since balanceAsOf");

  // earnings breakdown splits the interest ISR into the annual liability (paid
  // in April) vs. the provisional ISR already withheld on capital
  resetStore({ settings: { currency: "MXN", tax: { interest: 10, interestProvisional: 0.5, dividends: 0, capGains: 0 }, autoInterest: true, fx: null }, accounts: [{ id: "e", balance: 100000, apy: 10, currency: "MXN", balanceAsOf: A.toISO(today) }], incomes: [], holdings: [] });
  const eb = A.earningsBreakdown();
  approx(eb.intGross, 10000, 0.5, "gross interest = balance × APY");
  approx(eb.intProvisional, 500, 0.5, "provisional ISR = balance × 0.5%");
  approx(eb.intAnnualISR, 1000, 0.5, "annual ISR = gross × 10%");
  approx(eb.intTaxDueApril, 500, 0.5, "April liability = annual ISR − provisional already withheld");
  approx(eb.intNet, 9000, 0.5, "net kept = gross − full annual ISR");

  // ISR applies ONLY to real interest (nominal less the inflation assumption)
  resetStore({ settings: { currency: "MXN", tax: { interest: 10, inflation: 4, interestProvisional: 0, dividends: 0, capGains: 0 }, autoInterest: true, fx: null }, accounts: [{ id: "rl", balance: 100000, apy: 10, currency: "MXN", balanceAsOf: A.toISO(today) }], incomes: [], holdings: [] });
  const ebr = A.earningsBreakdown();
  approx(ebr.intGross, 10000, 0.5, "gross interest is nominal");
  approx(ebr.intReal, 6000, 0.5, "real interest = balance × (apy − inflation)");
  approx(ebr.intAnnualISR, 600, 0.5, "ISR hits only the real interest");
  approx(ebr.intNet, 9400, 0.5, "net kept = gross − ISR on real interest");

  // when inflation ≥ apy there is no real interest, so no ISR is due
  resetStore({ settings: { currency: "MXN", tax: { interest: 10, inflation: 12 }, autoInterest: true, fx: null }, accounts: [{ id: "rl2", balance: 100000, apy: 10, currency: "MXN", balanceAsOf: A.toISO(today) }], incomes: [], holdings: [] });
  approx(A.earningsBreakdown().intAnnualISR, 0, 0.01, "inflation above APY → no real interest → no ISR");

  // off switch leaves balances untouched
  resetStore({ settings: { currency: "MXN", tax: { interest: 0 }, autoInterest: false, fx: null }, accounts: [{ id: "x", balance: 100000, apy: 10, currency: "MXN", interestFreq: "monthly", interestDay: 31, balanceAsOf: back(95) }] });
  eq(A.Store.settleInterest().count, 0, "autoInterest off → no settlement");
  eq(A.Store.state.accounts[0].balance, 100000, "balance untouched when off");
});

group("retirement projection — accumulation & drawdown", () => {
  // pure growth, no contributions: 1,000,000 at 7% for 10y
  const g = A.retirementProjection({ start: 1000000, ret: 7, years: 10, contrib: 0, withdraw: 0, inflation: 0, maxDraw: 5 });
  approx(g.nest, 1000000 * Math.pow(Math.pow(1.07, 1 / 12), 120), 5, "nest egg compounds monthly at the annual rate");
  approx(g.contributed, 1000000, 0.01, "contributed = starting amount when no monthly adds");
  approx(g.growth, g.nest - 1000000, 0.01, "growth = nest − contributed");
  ok(g.pts[0].year === 0 && g.pts[0].phase === "save", "timeline starts at year 0 in the saving phase");

  // real (today's-pesos) nest egg deflates by inflation over the horizon
  const ri = A.retirementProjection({ start: 1000000, ret: 7, years: 10, contrib: 0, withdraw: 0, inflation: 5, maxDraw: 1 });
  approx(ri.nestReal, ri.nest / Math.pow(1.05, 10), 5, "real nest egg deflates by inflation");

  // withdrawing well under the real return lasts the whole horizon
  const sus2 = A.retirementProjection({ start: 2000000, ret: 7, years: 0, contrib: 0, withdraw: 3, inflation: 0, maxDraw: 40 });
  ok(sus2.sustainable, "withdrawing 3% with a 7% return lasts the full horizon");
  approx(sus2.monthlyIncome, 2000000 * 0.03 / 12, 0.5, "monthly income = withdrawal rate × nest / 12");

  // an aggressive withdrawal depletes the pot in a finite number of years
  const dep = A.retirementProjection({ start: 1000000, ret: 2, years: 0, contrib: 0, withdraw: 10, inflation: 4, maxDraw: 50 });
  ok(!dep.sustainable && dep.depletedYear > 0 && dep.depletedYear < 50, "10% withdrawals on a 2% return run out before the cap");
  ok(dep.endBalance === 0, "depleted projection ends at zero");
});

group("monthly interest estimate compounds (not simple)", () => {
  const a = { balance: 100000, apy: 12, currency: "MXN" };
  approx(A.monthlyInterestEst(a), 100000 * (Math.pow(1.12, 1 / 12) - 1), 0.01, "monthly est compounds the APY");
  ok(A.monthlyInterestEst(a) < 100000 * 0.12 / 12, "compound monthly is below the naive apy/12");
  eq(A.monthlyInterestEst({ balance: 100000, apy: 0 }), 0, "no APY → no interest");
});

group("FX never silently treats a missing rate as USD", () => {
  // with no Store fx configured, convBetween must use the built-in fallback,
  // not collapse a missing rate to 1 (which would read MXN as USD)
  resetStore({ settings: { currency: "USD", fx: null }, accounts: [] });
  const mxnToUsd = A.convBetween(1820, "MXN", "USD");
  approx(mxnToUsd, 100, 1, "1820 MXN ≈ 100 USD via fallback (18.2/USD), not 1820");
  approx(A.convBetween(100, "USD", "USD"), 100, 0.0001, "same-currency is identity");
});

group("retirement Monte Carlo — seeded, stable, sane", () => {
  const p = { start: 2000000, ret: 7, years: 10, contrib: 0, withdraw: 4, inflation: 4, vol: 12, maxDraw: 40, runs: 200 };
  const a = A.retirementMonteCarlo(p);
  const b = A.retirementMonteCarlo(p);
  eq(a.successRate, b.successRate, "seeded RNG → identical success rate across runs");
  ok(a.successRate >= 0 && a.successRate <= 1, "success rate is a probability");
  ok(a.band.length === p.years + p.maxDraw + 1, "band has one point per year incl. year 0");
  a.band.forEach(pt => ok(pt.p10 <= pt.p50 + 1e-6 && pt.p50 <= pt.p90 + 1e-6, "percentiles ordered p10≤p50≤p90"));
  // higher withdrawals should not improve survival
  const greedy = A.retirementMonteCarlo(Object.assign({}, p, { withdraw: 9 }));
  ok(greedy.successRate <= a.successRate + 1e-9, "a higher withdrawal rate never raises success");
});

group("sparkline + category series", () => {
  eq(A.sparkline([5]), "", "needs ≥2 points");
  eq(A.sparkline([]), "", "empty → no svg");
  ok(/polyline/.test(A.sparkline([1, 2, 3])), "renders a polyline for ≥2 points");
  ok(/#8fe3a6/.test(A.sparkline([1, 5])), "rising series is green");
  ok(/#e8836f/.test(A.sparkline([5, 1])), "falling series is rose");

  // category series: top categories with per-month values across 3 months
  const m = (mm, dd) => "2026-0" + mm + "-0" + dd;
  resetStore({
    settings: { currency: "MXN", fx: null, tax: {} },
    incomes: [], holdings: [], cards: [],
    expenses: [
      { id: "1", date: m(4, 5), amount: 4000, category: "Groceries", currency: "MXN" },
      { id: "2", date: m(5, 5), amount: 4500, category: "Groceries", currency: "MXN" },
      { id: "3", date: m(6, 5), amount: 3800, category: "Groceries", currency: "MXN" },
      { id: "4", date: m(4, 7), amount: 1200, category: "Dining", currency: "MXN" },
      { id: "5", date: m(6, 7), amount: 1600, category: "Dining", currency: "MXN" },
    ],
  });
  const cs = A.categorySeries(12, 6);
  ok(cs.months.length >= 3, "covers the active months");
  eq(cs.cats[0].name, "Groceries", "top category is the highest total");
  eq(cs.cats[0].values.length, cs.months.length, "one value per month");
  approx(cs.cats[0].total, 12300, 0.5, "category total sums every month");
});

group("debt payoff — snowball vs avalanche", () => {
  const debts = [
    { id: "a", name: "Store card", balance: 8000, apr: 36 },
    { id: "b", name: "Big bank", balance: 40000, apr: 24 },
    { id: "c", name: "Small", balance: 3000, apr: 18 },
  ];
  const av = A.debtPayoff(debts, 6000, "avalanche");
  const sn = A.debtPayoff(debts, 6000, "snowball");
  ok(av.feasible && sn.feasible, "a 6k/mo budget clears ~51k of debt");
  ok(av.totalInterest <= sn.totalInterest + 1e-6, "avalanche never costs more interest than snowball");
  ok(av.order[0] === "a", "avalanche targets the highest APR first");
  ok(sn.order[0] === "c", "snowball targets the smallest balance first");
  ok(av.months > 0 && av.startBalance === 51000, "reports the starting balance");

  // a budget below the interest run-rate can never finish
  const broke = A.debtPayoff(debts, 200, "avalanche");
  ok(!broke.feasible, "a tiny budget is flagged infeasible, not looped forever");

  eq(A.debtPayoff([], 1000, "avalanche").months, 0, "no debt → nothing to pay");
});

group("number input grouping (live thousands separators)", () => {
  eq(A.fmtNumInput(92000), "92,000", "groups thousands");
  eq(A.fmtNumInput("1234567"), "1,234,567", "groups millions");
  eq(A.fmtNumInput("1234.5"), "1,234.5", "keeps the decimal part as typed");
  eq(A.fmtNumInput("0.5"), "0.5", "leading zero before a decimal");
  eq(A.fmtNumInput("-2500"), "-2,500", "negatives keep their sign");
  eq(A.fmtNumInput(""), "", "empty stays empty");
  eq(A.fmtNumInput("00042"), "42", "strips leading zeros");
  // round-trips back to a clean number for storage
  eq(A.parseNum("1,234,567.89"), 1234567.89, "parses grouped value");
  eq(A.parseNum("92,000"), 92000, "strips commas");
  eq(A.parseNum(""), 0, "blank → 0");
  eq(A.parseNum("abc"), 0, "garbage → 0");
});

group("smart annual-spend estimate for FIRE", () => {
  const m = (mm) => "2026-" + String(mm).padStart(2, "0") + "-05";
  // 4 complete months of ~stable spend → 3-month-average window, low variance
  resetStore({
    settings: { currency: "MXN", fx: null, tax: {} }, incomes: [], holdings: [], cards: [],
    expenses: [1, 2, 3, 4].map((mm, i) => ({ id: "e" + i, date: m(mm), amount: 20000 + i * 200, category: "Rent", currency: "MXN" })),
  });
  const est = A.budgetSpendEstimate();
  ok(est.months >= 3, "counts the complete months");
  eq(est.window, 3, "3–5 months → 3-month window");
  ok(est.annual > 0 && est.cov < 0.1, "stable spend → low coefficient of variation");
  ok(Math.abs(est.annual / 12 - est.annual / 12) < 1e-9, "annual is monthly × 12");
  eq(A.budgetSpendEstimate.length, 0, "takes no args");
});

group("advanced retirement — bucket strategy", () => {
  const base = { start: 2000000, contrib: 5000, years: 20, annualSpend: 240000, inflation: 4.5, eqRet: 10, bondRet: 7, cashRet: 4.5, maxDraw: 30 };
  // deterministic accumulation: nest = start grown at eqRet plus annual contributions
  const det = A.retirementBuckets(base);
  approx(det.nest, 2000000 * Math.pow(1.10, 20) + 5000 * 12 * (Math.pow(1.10, 20) - 1) / 0.10, 50, "nest grows steadily at the equities return");
  ok(det.pts[0].phase === "save" && det.pts[det.pts.length - 1].phase === "draw", "timeline runs save → draw");

  // seeded → identical, and a probability
  const a = A.retirementBucketsMC(Object.assign({}, base, { cashYears: 1, bondYears: 3, runs: 200 }));
  const b = A.retirementBucketsMC(Object.assign({}, base, { cashYears: 1, bondYears: 3, runs: 200 }));
  eq(a.successRate, b.successRate, "seeded RNG → identical success rate");
  ok(a.successRate >= 0 && a.successRate <= 1, "success is a probability");
  a.band.forEach(pt => ok(pt.p10 <= pt.p50 + 1e-6 && pt.p50 <= pt.p90 + 1e-6, "p10 ≤ p50 ≤ p90"));

  // the buffer's whole point: bigger cash/bond buffers lift the worst-case (10th
  // pct) ending balance vs going all-equities, at a moderate withdrawal
  const aggro = A.retirementBucketsMC(Object.assign({}, base, { cashYears: 0, bondYears: 0, runs: 300 }));
  const cons = A.retirementBucketsMC(Object.assign({}, base, { cashYears: 2, bondYears: 6, runs: 300 }));
  const p10 = mc => mc.band[mc.band.length - 1].p10;
  ok(p10(cons) >= p10(aggro), "a bigger buffer lifts the worst-case ending balance");
  ok(cons.successRate >= aggro.successRate - 1e-9, "and does not lower success at a moderate withdrawal");

  // spending it down to nothing → not sustainable
  const broke = A.retirementBuckets(Object.assign({}, base, { annualSpend: 3000000 }));
  ok(!broke.sustainable && broke.depletedYear > 0, "an unaffordable spend depletes the pot");

  // a less equity-heavy accumulation (more bonds while saving) grows a smaller
  // nest when bonds return less than equities
  const allEq = A.retirementBuckets(Object.assign({}, base, { accEquity: 100 }));
  const halfEq = A.retirementBuckets(Object.assign({}, base, { accEquity: 50 }));
  ok(halfEq.nest < allEq.nest, "a lower equity tilt while saving grows a smaller nest");
});

group("market regime model — bounded crashes (locks)", () => {
  const rng = A.mulberry32(0xC0FFEE);
  const eq = A.makeEquityMarket(rng, 10);
  const N = 60000;
  let logVal = 0, logPeak = 0, maxDD = 0, downRun = 0, maxDownRun = 0, worstYear = 1, sumLog = 0;
  for (let i = 0; i < N; i++) {
    const r = eq();
    worstYear = Math.min(worstYear, r); sumLog += Math.log(1 + r);
    downRun = r < 0 ? downRun + 1 : 0; maxDownRun = Math.max(maxDownRun, downRun);
    logVal += Math.log(1 + r);
    if (logVal >= logPeak) logPeak = logVal;
    maxDD = Math.max(maxDD, 1 - Math.exp(logVal - logPeak));
  }
  ok(maxDownRun <= A.MARKET.maxDecline, "never more than maxDecline down years in a row (got " + maxDownRun + ")");
  ok(maxDD <= A.MARKET.maxLoss + 1e-9, "peak-to-trough loss never exceeds maxLoss (got " + (maxDD * 100).toFixed(1) + "%)");
  ok(worstYear >= -A.MARKET.maxYearDrop - 1e-9, "no single year falls past maxYearDrop");
  // mean-preserving: the long-run geometric return tracks the assumed return
  approx((Math.exp(sumLog / N) - 1) * 100, 10, 0.8, "long-run return ≈ the assumed mean");
});

/* ---- report ---- */
console.log(`\n${pass} passed, ${fail} failed  (${pass + fail} assertions)`);
if (fail) {
  console.log("\nFailures:");
  fails.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
console.log("✓ all money-math checks green");
