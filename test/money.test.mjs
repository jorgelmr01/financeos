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
const bundle = [read("js/utils.js"), read("js/instruments.js"), read("js/budget.js"), read("js/statements.js"), read("js/store.js")].join("\n;\n") +
  "\n;globalThis.__api = { interestPerPeriod, nextInterestDate, interestScheduleLabel, interestPeriodDays," +
  " accruedInterest, holdingReturnRate, parseAmount, parseExpenseDate, expenseSig, canonicalCategory," +
  " earningsBreakdown, retirementProjection, retirementMonteCarlo, retirementBuckets, retirementBucketsMC, makeEquityMarket, mulberry32, MARKET, realInterestEst, monthlyInterestEst," +
  " convBetween, sparkline, categorySeries, debtPayoff, detectRecurring, cashflowForecast, buroScore, investReadiness, irregularIncomePlan," +
  " classifyHolding, portfolioExposure, seriesReturns, annualizedVol, alignReturns, betaOf, correlationOf, periodsPerYear, weightedValueSeries, seriesReturnOver, finnhubSectorToGICS, countryToRegion, fmtNumInput, parseNum, budgetSpendEstimate," +
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

group("withdrawal-rate explorer — same nest, different draw", () => {
  // the explorer holds the nest egg fixed (set by saving) and varies only the
  // withdrawal. accumulation params are identical, so the nest must not move.
  const base = { start: 2000000, contrib: 5000, years: 20, inflation: 4.5, eqRet: 10, bondRet: 7, cashRet: 4.5, cashYears: 1, bondYears: 2, accEquity: 100, maxDraw: 30 };
  const nestOf = spend => A.retirementBuckets(Object.assign({}, base, { annualSpend: spend })).nest;
  approx(nestOf(100000), nestOf(900000), 1, "the nest egg is the same regardless of how fast you spend it");

  // a withdrawal rate of X% means a first-year draw of X% of the (real) nest
  const sim = A.retirementBuckets(Object.assign({}, base, { annualSpend: 1 }));
  const nestReal = sim.nestReal;
  const drawAt = pct => A.retirementBuckets(Object.assign({}, base, { annualSpend: pct / 100 * nestReal }));
  const low = drawAt(3), mid = drawAt(5), high = drawAt(8);
  ok(low.endBalance >= mid.endBalance && mid.endBalance >= high.endBalance, "a higher rate always leaves less (or empties sooner)");
  ok(low.sustainable, "a 3% draw on this nest lasts the full retirement");

  // success rate is monotone non-increasing in the withdrawal rate
  const sOf = pct => A.retirementBucketsMC(Object.assign({}, base, { annualSpend: pct / 100 * nestReal, runs: 200 })).successRate;
  ok(sOf(3) >= sOf(6) - 1e-9 && sOf(6) >= sOf(9) - 1e-9, "spending more never raises the success rate");
});

group("bucket strategy — the buffer earns its keep (sweet spot)", () => {
  // fix the nest egg (years:0 → nest = start) so the withdrawal rate is exactly
  // annualSpend / nest, then stress it where sequence risk actually bites.
  const NEST = 10000000;
  const base = { start: NEST, contrib: 0, years: 0, inflation: 4.5, eqRet: 10, bondRet: 7, cashRet: 4.5, accEquity: 100, maxDraw: 30 };
  const succ = (rate, cy, by) => A.retirementBucketsMC(Object.assign({}, base, { annualSpend: rate / 100 * NEST, cashYears: cy, bondYears: by, runs: 3000 })).successRate;

  // at a stressed 5% draw, a modest 1y-cash / 3y-bond buffer must beat going
  // all-equity — that's the whole sequence-of-returns case the buffer defends.
  const none = succ(5, 0, 0), modest = succ(5, 1, 3);
  ok(modest > none + 0.03, "a modest buffer clearly beats no buffer at a stressed 5% draw (" +
    (modest * 100).toFixed(1) + "% vs " + (none * 100).toFixed(1) + "%)");

  // but an over-large 2y/6y (=8 years parked in low-return assets) drags so much
  // it gives back the edge — the sweet spot is a few years, not a fortress.
  const tooMuch = succ(5, 2, 6);
  ok(modest > tooMuch, "an over-large buffer underperforms the modest one (drag wins)");

  // and the all-equity baseline is unchanged by the new logic (no buffer = no
  // defend/harvest distinction), so its success only depends on the draw
  ok(succ(3.5, 0, 0) > succ(5.5, 0, 0), "all-equity still just tracks the withdrawal rate");
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

group("recurring detection — steady monthly charges", () => {
  const mk = (mm, dd) => "2026-" + String(mm).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
  resetStore({
    settings: { currency: "MXN", fx: null, tax: {} }, incomes: [], holdings: [], cards: [],
    expenses: [
      // Netflix: 4 months, steady amount → recurring
      { id: "n1", date: mk(3, 17), amount: 219, description: "Netflix", category: "Subscriptions", currency: "MXN" },
      { id: "n2", date: mk(4, 17), amount: 219, description: "Netflix", category: "Subscriptions", currency: "MXN" },
      { id: "n3", date: mk(5, 17), amount: 219, description: "Netflix", category: "Subscriptions", currency: "MXN" },
      { id: "n4", date: mk(6, 17), amount: 219, description: "Netflix", category: "Subscriptions", currency: "MXN" },
      // Rent: 3 months, steady → recurring (fixed cost, not a "subscription")
      { id: "r1", date: mk(4, 1), amount: 12000, description: "Renta depa", category: "Rent", currency: "MXN" },
      { id: "r2", date: mk(5, 1), amount: 12000, description: "Renta depa", category: "Rent", currency: "MXN" },
      { id: "r3", date: mk(6, 1), amount: 12000, description: "Renta depa", category: "Rent", currency: "MXN" },
      // Groceries: every month but wildly varying amount → NOT recurring (high CV)
      { id: "g1", date: mk(4, 8), amount: 800, description: "Super", category: "Groceries", currency: "MXN" },
      { id: "g2", date: mk(5, 12), amount: 2400, description: "Super", category: "Groceries", currency: "MXN" },
      { id: "g3", date: mk(6, 3), amount: 1500, description: "Super", category: "Groceries", currency: "MXN" },
      // one-off → never recurring (single occurrence)
      { id: "o1", date: mk(5, 9), amount: 5000, description: "Vuelo Cancun", category: "Travel", currency: "MXN" },
    ],
  });
  const rec = A.detectRecurring(6);
  const names = rec.map(r => r.name);
  ok(names.includes("Netflix"), "catches a steady monthly subscription");
  ok(names.includes("Renta depa"), "catches rent as a recurring fixed cost");
  ok(!names.includes("Super"), "ignores groceries — same label but volatile amount");
  ok(!names.includes("Vuelo Cancun"), "ignores a one-off charge");
  ok(rec[0].monthly >= rec[rec.length - 1].monthly, "sorted by monthly cost, biggest first");
  const nf = rec.find(r => r.name === "Netflix");
  eq(nf.dayOfMonth, 17, "remembers the day of month it lands on");
  approx(nf.monthly, 219, 0.01, "monthly = the steady amount");
});

group("cashflow forecast — will I make it to payday?", () => {
  const mk = (mm, dd) => "2026-" + String(mm).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
  resetStore({
    settings: { currency: "MXN", fx: null, tax: {} },
    accounts: [{ id: "c", type: "checking", balance: 15000, currency: "MXN" }],
    cards: [], holdings: [],
    incomes: [{ id: "i", name: "Salario", amount: 20000, currency: "MXN", frequency: "monthly", payDay: 30 }],
    expenses: [
      { id: "r1", date: mk(4, 5), amount: 9000, description: "Renta", category: "Rent", currency: "MXN" },
      { id: "r2", date: mk(5, 5), amount: 9000, description: "Renta", category: "Rent", currency: "MXN" },
      { id: "r3", date: mk(6, 5), amount: 9000, description: "Renta", category: "Rent", currency: "MXN" },
    ],
  });
  const f = A.cashflowForecast(60);
  ok(f.hasData, "produces a forecast when there's a balance and events");
  approx(f.start, 15000, 1, "starts from the liquid balance");
  ok(f.points.length >= 2, "walks at least start → end");
  ok(f.min <= f.start + 1e-6, "the low point is never above where we started");
  ok(f.minDate instanceof Date || typeof f.minDate === "object", "reports when the trough lands");
  // every projected balance point is a finite number (no NaN leaking into the chart)
  ok(f.points.every(p => isFinite(p.bal)), "no NaN balances in the projection");
});

group("credit-score simulator — Buró proxy", () => {
  // a model citizen: clean record, low utilization, long history
  const great = A.buroScore({ util: 0.05, onTimeMonths: 36, lates: 0, ageYears: 8, products: 3, inquiries: 0 });
  ok(great.score >= 700 && great.score <= 850, "excellent profile lands high (" + great.score + ")");
  eq(great.band, "Excellent", "labels it excellent");

  // a beginner: maxed card, one late mark, thin history
  const rough = A.buroScore({ util: 0.95, onTimeMonths: 3, lates: 1, ageYears: 1, products: 1, inquiries: 3 });
  ok(rough.score < great.score, "a worse profile always scores lower");
  ok(rough.score >= 400, "never drops below the floor");

  // score stays inside the band for extreme inputs
  const floor = A.buroScore({ util: 1, onTimeMonths: 0, lates: 9, ageYears: 0, products: 0, inquiries: 20 });
  ok(floor.score >= 400 && floor.score <= 850, "clamps to the 400–850 range");

  // utilization is monotonic: paying down a card never lowers the score
  const hi = A.buroScore({ util: 0.9, onTimeMonths: 24, lates: 0, ageYears: 5, products: 2, inquiries: 0 });
  const lo = A.buroScore({ util: 0.1, onTimeMonths: 24, lates: 0, ageYears: 5, products: 2, inquiries: 0 });
  ok(lo.score > hi.score, "lower utilization scores higher, all else equal");

  // the weights sum to 1 and each factor carries an improvement headroom
  const sumW = great.factors.reduce((a, f) => a + f.weight, 0);
  approx(sumW, 1, 1e-9, "factor weights sum to 100%");
  rough.factors.forEach(f => ok(f.impact >= 0, "no factor reports a negative possible gain"));
  ok(rough.topAction && rough.topAction.impact > 0, "flags a biggest-win action when there's room");

  // a missed payment is heavily penalised vs an otherwise identical record
  const clean = A.buroScore({ util: 0.2, onTimeMonths: 24, lates: 0, ageYears: 4, products: 2, inquiries: 0 });
  const late = A.buroScore({ util: 0.2, onTimeMonths: 24, lates: 1, ageYears: 4, products: 2, inquiries: 0 });
  ok(clean.score - late.score >= 25, "one late payment costs real points");
});

group("invest readiness — the beginner order of operations", () => {
  const mk = (mm) => "2026-" + String(mm).padStart(2, "0") + "-05";
  const months = [1, 2, 3, 4].map((m, i) => ({ id: "e" + i, date: mk(m), amount: 15000, category: "Rent", currency: "MXN" }));
  // not ready: thin cushion + costly card debt
  resetStore({
    settings: { currency: "MXN", fx: null, tax: {} },
    accounts: [{ id: "s", type: "savings", balance: 5000, currency: "MXN" }],
    cards: [{ id: "k", name: "Card", balance: 18000, apr: 42, limit: 30000, currency: "MXN" }],
    holdings: [], incomes: [], budgets: {}, snapshots: [], expenses: months,
  });
  const a = A.investReadiness();
  approx(a.monthlySpend, 15000, 1, "monthly spend comes from the budget");
  ok(!a.fundOk, "0.3 months of savings fails the 3-month cushion");
  ok(!a.debtOk && a.highDebt === 18000, "flags the 42% card as high-interest debt");
  ok(!a.ready, "not ready while either gate is open");
  ok(a.suggest >= 500, "still suggests a sensible first contribution");

  // ready: a real cushion and no costly debt
  resetStore({
    settings: { currency: "MXN", fx: null, tax: {} },
    accounts: [{ id: "s", type: "savings", balance: 60000, currency: "MXN" }],
    cards: [{ id: "k", name: "Card", balance: 0, apr: 42, limit: 30000, currency: "MXN" }],
    holdings: [], incomes: [], budgets: {}, snapshots: [], expenses: months,
  });
  const b = A.investReadiness();
  ok(b.fundOk && b.debtOk && b.ready, "4 months saved + no costly debt → ready");
  approx(b.monthsCovered, 4, 0.01, "reports months of cushion");

  // a low-APR card is not a blocker
  resetStore({
    settings: { currency: "MXN", fx: null, tax: {} },
    accounts: [{ id: "s", type: "savings", balance: 60000, currency: "MXN" }],
    cards: [{ id: "k", name: "Card", balance: 9000, apr: 9, limit: 30000, currency: "MXN" }],
    holdings: [], incomes: [], budgets: {}, snapshots: [], expenses: months,
  });
  ok(A.investReadiness().debtOk, "sub-15% APR debt doesn't block investing");

  // no data → graceful, never ready
  resetStore();
  const c = A.investReadiness();
  ok(!c.ready && c.monthsCovered == null && c.suggest > 0, "no data degrades gracefully");
});

group("irregular-income planner — budget the lean month", () => {
  const p = A.irregularIncomePlan({ low: 12000, high: 30000, essentials: 14000 });
  eq(p.baseline, 12000, "you budget to the lean month, not the average");
  approx(p.volatility, 0.6, 1e-9, "income swing = (high − low) / high");
  eq(p.goodMonthSave, 16000, "a good month can stash high − essentials");
  eq(p.bufferTarget, 42000, "smoothing fund = max(3× essentials, 6× lean gap)");
  eq(p.monthsToBuffer, 3, "good-month savings build the fund in ceil(target / save)");
  ok(!p.coversEssentials, "a lean month below essentials is flagged");
  eq(p.leanGap, 2000, "reports the lean-month shortfall");

  // a steady income → low volatility, lean month covers the basics
  const steady = A.irregularIncomePlan({ low: 20000, high: 22000, essentials: 15000 });
  ok(steady.volatility < 0.15 && steady.coversEssentials, "near-steady income is recognised");

  // a good month that can't beat essentials can't build the fund
  const stuck = A.irregularIncomePlan({ low: 5000, high: 12000, essentials: 14000 });
  eq(stuck.goodMonthSave, 0, "no surplus when even a good month is below essentials");
  eq(stuck.monthsToBuffer, null, "can't build a buffer with nothing to stash");

  // garbage in → safe zeros, no NaN
  const z = A.irregularIncomePlan({});
  ok(z.baseline === 0 && z.bufferTarget === 0 && isFinite(z.volatility), "empty input degrades to zeros");
});

group("instrument classification + ETF look-through", () => {
  // a single stock resolves to one sector / region at 100%
  const aapl = A.classifyHolding({ symbol: "AAPL", kind: "stock" });
  eq(aapl.assetClass, "Equity", "AAPL is equity");
  approx(aapl.sectors["Technology"], 1, 1e-9, "AAPL is 100% Technology");
  approx(aapl.regions["United States"], 1, 1e-9, "AAPL is 100% US");

  // an S&P 500 ETF spreads across many sectors, all in the US, summing to 1
  const voo = A.classifyHolding({ symbol: "VOO", kind: "etf" });
  const sSum = Object.values(voo.sectors).reduce((a, b) => a + b, 0);
  approx(sSum, 1, 1e-9, "VOO sector weights sum to 1");
  ok(Object.keys(voo.sectors).length > 5, "VOO looks through to many sectors");
  ok(voo.sectors["Technology"] > voo.sectors["Utilities"], "tech outweighs utilities in the S&P");

  // an international ETF splits across regions
  const vxus = A.classifyHolding({ symbol: "VXUS", kind: "etf" });
  ok(vxus.regions["Developed ex-US"] > 0 && vxus.regions["Emerging Markets"] > 0, "VXUS spans developed + emerging");

  // a bond fund buckets into Bonds, not an equity sector
  eq(A.classifyHolding({ symbol: "BND" }).assetClass, "Bonds", "BND is a bond fund");
  ok(A.classifyHolding({ symbol: "BND" }).sectors["Bonds"] === 1, "non-equity buckets into its own class");

  // unknown ticker is honestly flagged, never crashes
  const wat = A.classifyHolding({ symbol: "ZZZZ", kind: "stock" });
  ok(!wat.known && wat.sectors["Unclassified"] === 1, "an unknown ticker is Unclassified, not guessed");

  // a user override wins over the dataset
  const ov = A.classifyHolding({ symbol: "AAPL", cls: { sector: "Health Care", region: "Mexico" } });
  ok(ov.sectors["Health Care"] === 1 && ov.regions["Mexico"] === 1, "per-holding override beats the dataset");
});

group("Finnhub free-key enrichment — auto-classify stocks", () => {
  // map Finnhub's industry labels → our GICS-style sectors by keyword
  eq(A.finnhubSectorToGICS("Semiconductors"), "Technology", "semis → Technology");
  eq(A.finnhubSectorToGICS("Banking"), "Financials", "banking → Financials");
  eq(A.finnhubSectorToGICS("Pharmaceuticals"), "Health Care", "pharma → Health Care");
  eq(A.finnhubSectorToGICS("Oil & Gas"), "Energy", "oil & gas → Energy");
  eq(A.finnhubSectorToGICS("Aerospace & Defense"), "Industrials", "aero/defense → Industrials");
  ok(A.finnhubSectorToGICS("") == null && A.finnhubSectorToGICS("Blockchain Unicorns") == null, "unknown/empty → null, never a wrong guess");

  // ISO country → region buckets
  eq(A.countryToRegion("US"), "United States", "US");
  eq(A.countryToRegion("MX"), "Mexico", "MX");
  eq(A.countryToRegion("DE"), "Developed ex-US", "Germany is developed");
  eq(A.countryToRegion("BR"), "Emerging Markets", "Brazil is emerging");
  ok(A.countryToRegion("") == null, "no country → null");

  // autoCls feeds classifyHolding when the dataset doesn't know the ticker, but
  // a user override still wins and the curated dataset still wins for ETFs
  const auto = A.classifyHolding({ symbol: "ZZZZ", kind: "stock", autoCls: { sector: "Energy", region: "Mexico", source: "finnhub" } });
  ok(auto.sectors["Energy"] === 1 && auto.regions["Mexico"] === 1 && auto.source === "finnhub", "unknown stock uses Finnhub auto-classification");
  const overridden = A.classifyHolding({ symbol: "ZZZZ", cls: { sector: "Technology" }, autoCls: { sector: "Energy" } });
  eq(overridden.source, "you", "a manual override beats Finnhub");
  const etf = A.classifyHolding({ symbol: "VOO", kind: "etf", autoCls: { sector: "Financials" } });
  ok(etf.source === "dataset" && Object.keys(etf.sectors).length > 5, "curated ETF look-through beats a single-sector auto guess");
});

group("portfolio exposure — weighted, with look-through", () => {
  resetStore({
    settings: { currency: "USD", fx: null, tax: {} }, incomes: [], cards: [], accounts: [], expenses: [], budgets: {}, snapshots: [],
    holdings: [
      { id: "a", symbol: "VOO", kind: "etf", shares: 10, currentPrice: 500, currency: "USD" },   // 5,000 US blend
      { id: "b", symbol: "AAPL", kind: "stock", shares: 10, currentPrice: 200, currency: "USD" }, // 2,000 US tech
      { id: "c", symbol: "BND", kind: "etf", shares: 30, currentPrice: 100, currency: "USD" },    // 3,000 bonds
    ],
  });
  const e = A.portfolioExposure();
  approx(e.total, 10000, 1, "totals the market value in the display currency");
  // asset classes: 7,000 equity + 3,000 bonds
  const eqAC = e.byAssetClass.find(x => x.name === "Equity"), bd = e.byAssetClass.find(x => x.name === "Bonds");
  approx(eqAC.pct, 70, 0.5, "equity is 70% of the book");
  approx(bd.pct, 30, 0.5, "bonds are 30%");
  // sectors must sum to ~100% across the whole book (incl. the Bonds bucket)
  const secSum = e.bySector.reduce((a, s) => a + s.pct, 0);
  approx(secSum, 100, 0.5, "every peso lands in some sector bucket");
  // tech = AAPL (2,000) + VOO's tech slice (~31% of 5,000 ≈ 1,550) → biggest equity sector
  const tech = e.bySector.find(s => s.name === "Technology");
  ok(tech && tech.value > 3000 && tech.value < 4000, "look-through aggregates ETF + single-stock tech");
  ok(e.hhi > 0 && e.hhi <= 1, "concentration index is a valid Herfindahl");
  eq(e.unclassifiedPct, 0, "a fully-known book has nothing unclassified");
});

group("weighted value series — current shares × historical price", () => {
  const pts = (arr) => arr.map((c, i) => ({ t: i * 86400000, c: c }));
  // two holdings, same calendar: portfolio value = Σ shares×price×fx
  const s = A.weightedValueSeries([
    { shares: 2, fx: 1, points: pts([100, 110, 120]) },   // 200 → 220 → 240
    { shares: 1, fx: 1, points: pts([50, 50, 60]) },      //  50 →  50 →  60
  ]);
  eq(s.length, 3, "one value point per shared date");
  approx(s[0].v, 250, 1e-9, "start = 2×100 + 1×50");
  approx(s[2].v, 300, 1e-9, "end = 2×120 + 1×60");

  // mismatched calendars: the missing holding is forward-filled, not dropped
  const m = A.weightedValueSeries([
    { shares: 1, fx: 1, points: [{ t: 0, c: 100 }, { t: 2 * 86400000, c: 130 }] },
    { shares: 1, fx: 1, points: [{ t: 1 * 86400000, c: 40 }, { t: 2 * 86400000, c: 50 }] },
  ]);
  eq(m.length, 3, "union timeline covers every date");
  approx(m[2].v, 180, 1e-9, "last point sums both holdings (130 + 50)");

  // fx factor scales a foreign listing into the display currency
  const fx = A.weightedValueSeries([{ shares: 10, fx: 20, points: pts([5, 6]) }]);
  approx(fx[1].v, 1200, 1e-9, "10 sh × 6 × 20 fx = 1,200");

  eq(A.weightedValueSeries([]).length, 0, "no holdings → empty series");
});

group("series return over a window", () => {
  const days = 86400000;
  const s = [{ t: 0, v: 100 }, { t: 30 * days, v: 110 }, { t: 60 * days, v: 132 }];
  approx(A.seriesReturnOver(s, 60), 0.32, 1e-9, "60-day return spans the whole series");
  approx(A.seriesReturnOver(s, 30), 0.20, 1e-9, "30-day window starts at the 30-day point");
  ok(A.seriesReturnOver(s, 365) == null, "a window longer than the history → null");
  ok(A.seriesReturnOver([{ t: 0, v: 1 }], 30) == null, "a single point → null");
});

group("risk math — returns, volatility, beta", () => {
  const pts = (arr) => arr.map((c, i) => ({ t: i * 86400000, c: c }));
  eq(A.seriesReturns(pts([100, 110, 99])).length, 2, "n closes → n−1 returns");
  approx(A.seriesReturns(pts([100, 110]))[0], 0.1, 1e-9, "a 10% step is a 0.10 return");

  // a series that swings more has higher annualized vol
  const calm = A.annualizedVol(A.seriesReturns(pts([100, 101, 100, 101, 100, 101])), 252);
  const wild = A.annualizedVol(A.seriesReturns(pts([100, 130, 90, 140, 80, 150])), 252);
  ok(wild > calm, "a choppier series is more volatile");

  // beta: an asset that is exactly 2× the market each step has beta ≈ 2
  const mkt = pts([100, 110, 99, 108.9, 98.01]);                 // ±10% steps
  const lev = pts([100, 120, 96, 115.2, 92.16]);                // ±20% steps (2×)
  const beta = A.betaOf(
    [...Array(20)].flatMap((_, k) => lev.map((p, i) => ({ t: (k * 5 + i) * 86400000, c: p.c }))),
    [...Array(20)].flatMap((_, k) => mkt.map((p, i) => ({ t: (k * 5 + i) * 86400000, c: p.c }))));
  ok(beta != null && Math.abs(beta - 2) < 0.4, "a 2× leveraged proxy has beta near 2 (got " + (beta && beta.toFixed(2)) + ")");

  // correlation of a market with itself is 1
  const same = A.correlationOf(mkt.map((p, i) => ({ t: i * 86400000, c: p.c })).concat(pts([90, 95, 100, 92, 88]).map((p, i) => ({ t: (5 + i) * 86400000, c: p.c }))),
                               mkt.map((p, i) => ({ t: i * 86400000, c: p.c })).concat(pts([90, 95, 100, 92, 88]).map((p, i) => ({ t: (5 + i) * 86400000, c: p.c }))));
  ok(same == null || Math.abs(same - 1) < 1e-6, "a series is perfectly correlated with itself");

  // too little overlap → null, never a bogus number
  ok(A.betaOf(pts([100, 101]), pts([100, 101])) == null, "not enough data → null beta");

  // periods/year inferred from spacing
  eq(A.periodsPerYear(pts([1, 2, 3, 4])), 252, "daily spacing → 252");
  eq(A.periodsPerYear([{ t: 0, c: 1 }, { t: 7 * 86400000, c: 1 }, { t: 14 * 86400000, c: 1 }, { t: 21 * 86400000, c: 1 }]), 52, "weekly spacing → 52");
});

/* ---- report ---- */
console.log(`\n${pass} passed, ${fail} failed  (${pass + fail} assertions)`);
if (fail) {
  console.log("\nFailures:");
  fails.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
console.log("✓ all money-math checks green");
