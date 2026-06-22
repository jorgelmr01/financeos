/* FinanceOS — state & persistence (localStorage) */
"use strict";

const STORAGE_KEY = "financeos_v1";

const Store = {
  state: null,
  key: null,        // cached AES key while unlocked
  saltB64: null,
  pinEnabled: false,
  _saveChain: Promise.resolve(),

  defaults() {
    return {
      accounts: [],   // {id, name, institution, type, balance, apy, balanceAsOf, currency, interestFreq, interestDay, interestEveryDays, interestStart}
      cards: [],      // {id, name, issuer, limit, balance, cutDay, payDay, apr, color, currency}
      holdings: [],   // {id, symbol, name, kind, shares, costBasis, currentPrice, divPerShare, accountId, purchaseDate, currency}
      incomes: [],    // {id, name, category, amount, amountType, taxRate, accountId, frequency, payDay, startDate, currency}
      expenses: [],   // {id, date, description, category, amount, currency, sig, source}
      budgets: {},    // { [category]: { amount, currency } }  — monthly limit per category
      goals: [],      // {id, name, target, saved, targetDate, currency} — savings goals / sinking funds
      snapshots: [],  // [{d: ISO date, usd, liq, inv, debt} — net worth + composition in USD]
      learn: { scenarios: {}, sandbox: { best: 0, runs: 0 } },
      settings: {
        currency: "USD", privacy: false, pinEnabled: false, lastExport: null, theme: "dark",
        fx: null,                 // {base:'USD', rates:{...units per USD}, asOf}
        tax: { interest: 0, dividends: 0, capGains: 0, interestProvisional: 0, inflation: 4.5 },
        autoInterest: true,       // credit interest to balances on its schedule
        finnhubKey: "", lastQuoteSync: null,
      },
    };
  },

  _hydrate(parsed) {
    const d = this.defaults();
    this.state = Object.assign(d, parsed);
    this.state.settings = Object.assign(d.settings, parsed.settings || {});
    this.state.settings.tax = Object.assign({ interest: 0, dividends: 0, capGains: 0, interestProvisional: 0, inflation: 4.5 }, (parsed.settings || {}).tax || {});
    if (!Array.isArray(this.state.snapshots)) this.state.snapshots = [];
    if (!Array.isArray(this.state.goals)) this.state.goals = [];
    if (!Array.isArray(this.state.expenses)) this.state.expenses = [];
    if (!this.state.budgets || typeof this.state.budgets !== "object") this.state.budgets = {};
    this.state.learn = Object.assign({ scenarios: {}, sandbox: {} }, this.state.learn || {});
    this.state.learn.sandbox = Object.assign({ best: 0, runs: 0 }, this.state.learn.sandbox || {});
    // migrate pre-multicurrency data: tag entities with the display currency
    const cur = this.state.settings.currency || "USD";
    ["accounts", "cards", "holdings", "incomes", "expenses"].forEach(coll =>
      this.state[coll].forEach(x => { if (!x.currency) x.currency = cur; }));
    this.state.incomes.forEach(x => { if (!x.amountType) x.amountType = "net"; if (x.taxRate == null) x.taxRate = 0; });
    // backfill dedup signatures on any expense missing one
    this.state.expenses.forEach(e => { if (!e.sig && typeof expenseSig === "function") e.sig = expenseSig(e); });
    // interest pay schedule: default to monthly-on-the-last-day, matching the
    // month-end crediting the app used before this setting existed
    this.state.accounts.forEach(a => {
      if (!a.interestFreq) a.interestFreq = "monthly";
      if (a.interestDay == null) a.interestDay = 31;
    });
    if (this.state.settings.autoInterest == null) this.state.settings.autoInterest = true;
  },

  /* returns { locked: boolean } — when locked, call unlock(pin) before using state */
  async load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { this.state = this.defaults(); return { locked: false }; }
      const parsed = JSON.parse(raw);
      if (parsed && parsed.__enc) {
        this.pinEnabled = true;
        this.saltB64 = parsed.salt;
        return { locked: true };
      }
      this._hydrate(parsed);
      return { locked: false };
    } catch (e) {
      console.error("FinanceOS: failed to load saved data", e);
      this.state = this.defaults();
      this.loadFailed = true;   // app.init() surfaces this to the user
      return { locked: false };
    }
  },

  async unlock(pin) {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const key = await deriveKeyFromPin(pin, b64ToBuf(parsed.salt));
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: b64ToBuf(parsed.iv) }, key, b64ToBuf(parsed.ct));
      this._hydrate(JSON.parse(new TextDecoder().decode(plain)));
      this.key = key;
      this.saltB64 = parsed.salt;
      this.pinEnabled = true;
      this.state.settings.pinEnabled = true;
      return true;
    } catch (e) {
      return false; // wrong PIN (GCM auth failure) or corrupt data
    }
  },

  async verifyPin(pin) {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed || !parsed.__enc) return false;
      const key = await deriveKeyFromPin(pin, b64ToBuf(parsed.salt));
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: b64ToBuf(parsed.iv) }, key, b64ToBuf(parsed.ct));
      return true;
    } catch (e) {
      return false;
    }
  },

  async enablePin(pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    this.key = await deriveKeyFromPin(pin, salt);
    this.saltB64 = bufToB64(salt);
    this.pinEnabled = true;
    this.state.settings.pinEnabled = true;
    this.save();
  },

  async disablePin() {
    this.key = null;
    this.saltB64 = null;
    this.pinEnabled = false;
    this.state.settings.pinEnabled = false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  },

  async _encryptAndStore(json) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, this.key, new TextEncoder().encode(json));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      __enc: 1, v: 1, salt: this.saltB64, iv: bufToB64(iv), ct: bufToB64(ct),
    }));
  },

  save() {
    try {
      const json = JSON.stringify(this.state);
      if (this.pinEnabled && this.key) {
        // serialize writes so the last state always wins
        this._saveChain = this._saveChain
          .then(() => this._encryptAndStore(json))
          .then(() => this._saveOk())
          .catch(e => { console.error("FinanceOS: encrypted save failed", e); this._saveFailed(e); });
      } else {
        localStorage.setItem(STORAGE_KEY, json);
        this._saveOk();
      }
      return true;
    } catch (e) {
      console.error("FinanceOS: failed to save", e);
      this._saveFailed(e);
      return false;
    }
  },

  _saveOk() { this._saveErrShown = false; },

  /* A failed save means changes live only in memory and will vanish on reload —
     a real data-loss risk, so tell the user (once, until the next good save). */
  _saveFailed(e) {
    if (this._saveErrShown) return;
    this._saveErrShown = true;
    const quota = e && (e.name === "QuotaExceededError" || e.code === 22 || /quota|exceeded/i.test(String((e && e.message) || "")));
    if (typeof UI !== "undefined" && UI.toast) {
      UI.toast(quota
        ? "Storage is full — your latest changes may NOT be saved. Export a backup (⋯ menu) and delete old expenses/snapshots."
        : "Couldn't save your changes on this device — export a backup (⋯ menu) so you don't lose them.",
        { type: "error", duration: 12000 });
    }
  },

  add(coll, item) {
    item.id = item.id || uid();
    this.state[coll].push(item);
    this.save();
    return item;
  },

  update(coll, id, patch) {
    const it = this.state[coll].find(x => x.id === id);
    if (it) { Object.assign(it, patch); this.save(); }
    return it;
  },

  remove(coll, id) {
    this.state[coll] = this.state[coll].filter(x => x.id !== id);
    this.save();
  },

  find(coll, id) {
    return this.state[coll].find(x => x.id === id) || null;
  },

  accountName(id) {
    const a = this.find("accounts", id);
    return a ? a.name : "Unassigned";
  },

  replaceAll(data) {
    const d = this.defaults();
    this.state = {
      accounts: Array.isArray(data.accounts) ? data.accounts : d.accounts,
      cards: Array.isArray(data.cards) ? data.cards : d.cards,
      holdings: Array.isArray(data.holdings) ? data.holdings : d.holdings,
      incomes: Array.isArray(data.incomes) ? data.incomes : d.incomes,
      expenses: Array.isArray(data.expenses) ? data.expenses : d.expenses,
      budgets: (data.budgets && typeof data.budgets === "object") ? data.budgets : d.budgets,
      snapshots: Array.isArray(data.snapshots) ? data.snapshots : d.snapshots,
      learn: (data.learn && typeof data.learn === "object") ? data.learn : d.learn,
      settings: Object.assign(d.settings, data.settings || {}),
    };
    // ensure every imported expense has a dedup signature
    this.state.expenses.forEach(e => { if (!e.sig && typeof expenseSig === "function") e.sig = expenseSig(e); });
    // imported flags don't change this browser's actual lock state
    this.state.settings.pinEnabled = this.pinEnabled;
    this.save();
  },

  reset() {
    this.key = null;
    this.saltB64 = null;
    this.pinEnabled = false;
    this.state = this.defaults();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  },

  /* ---------- live data ---------- */

  /* ECB daily rates via Frankfurter (no key, CORS-friendly). Returns true if updated. */
  async refreshFx(force) {
    const fx = this.state && this.state.settings.fx;
    if (!force && fx && fx.asOf && daysBetween(parseISO(fx.asOf), todayMid()) < 1) return false;
    try {
      const r = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=MXN,EUR,GBP");
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      if (j && j.rates) {
        this.state.settings.fx = {
          base: "USD",
          rates: Object.assign({ USD: 1 }, j.rates),
          asOf: toISO(todayMid()),
        };
        this.save();
        return true;
      }
    } catch (e) {
      console.warn("FinanceOS: FX refresh failed (offline?)", e);
    }
    return false;
  },

  /* Yahoo Finance chart endpoint (via CORS proxy): live price, trailing-12mo
     dividends, and the long-run (≤10y) average annual return (CAGR). One call,
     no key needed; covers ETFs. */
  async _yahooData(symbol) {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(symbol) + "?range=10y&interval=1mo&events=div";
    const proxies = [
      u => "https://corsproxy.io/?url=" + encodeURIComponent(u),
      u => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
    ];
    const nowSec = Date.now() / 1000;
    for (const mk of proxies) {
      try {
        const r = await fetch(mk(url));
        if (!r.ok) continue;
        const j = await r.json();
        const res = j && j.chart && j.chart.result && j.chart.result[0];
        if (!res) continue;
        const price = (res.meta && Number(res.meta.regularMarketPrice)) || 0;
        // trailing-12-month dividends only
        const evs = res.events && res.events.dividends;
        const div = evs
          ? Object.keys(evs).reduce((a, k) => a + (Number(evs[k].date) >= nowSec - 365 * 86400 ? (Number(evs[k].amount) || 0) : 0), 0)
          : 0;
        // long-run average annual return from first→last close
        let cagr = null;
        const ts = res.timestamp;
        const closes = res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close;
        if (ts && closes && closes.length > 1) {
          let fi = 0; while (fi < closes.length && !(closes[fi] > 0)) fi++;
          let li = closes.length - 1; while (li > fi && !(closes[li] > 0)) li--;
          if (li > fi) {
            const years = (ts[li] - ts[fi]) / (365.25 * 86400);
            if (years >= 1 && closes[fi] > 0) cagr = Math.pow(closes[li] / closes[fi], 1 / years) - 1;
          }
        }
        return { price, div: Math.round(div * 10000) / 10000, cagr: cagr };
      } catch (e) { /* proxy down — try the next one */ }
    }
    return null;
  },

  /* Historical close prices for a symbol (Yahoo chart via CORS proxy). Returns
     { symbol, range, currency, points:[{t,c}] } or null. Cached per symbol+range. */
  _histCache: {},
  async fetchHistory(symbol, range) {
    range = range || "6mo";
    const key = String(symbol).toUpperCase() + "|" + range;
    if (this._histCache[key]) return this._histCache[key];
    const interval = range === "1mo" ? "1d" : range === "6mo" ? "1d" : range === "1y" ? "1wk" : "1mo";
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(symbol) + "?range=" + range + "&interval=" + interval;
    const proxies = [
      u => "https://corsproxy.io/?url=" + encodeURIComponent(u),
      u => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
    ];
    for (const mk of proxies) {
      try {
        const r = await fetch(mk(url));
        if (!r.ok) continue;
        const j = await r.json();
        const res = j && j.chart && j.chart.result && j.chart.result[0];
        const ts = res && res.timestamp;
        const closes = res && res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close;
        if (!ts || !closes) continue;
        const points = [];
        for (let i = 0; i < ts.length; i++) {
          if (closes[i] != null) points.push({ t: ts[i] * 1000, c: closes[i] });
        }
        if (points.length < 2) continue;
        const out = { symbol: String(symbol).toUpperCase(), range: range, currency: (res.meta && res.meta.currency) || "", points: points };
        this._histCache[key] = out;
        return out;
      } catch (e) { /* proxy down — try the next one */ }
    }
    return null;
  },

  /* Quotes + annual dividends. Finnhub first when a key is set; Yahoo (proxied)
     fills anything missing — including ETF dividends and the keyless case. */
  async fetchQuotes() {
    const key = (this.state.settings.finnhubKey || "").trim();
    let prices = 0, divs = 0, keyBad = false;
    const failed = [], noDiv = [];
    for (const h of this.state.holdings) {
      const sym = encodeURIComponent(h.symbol);
      let gotPrice = false, gotDiv = false;
      if (key && !keyBad) {
        try {
          const r = await fetch("https://finnhub.io/api/v1/quote?symbol=" + sym + "&token=" + key);
          if (r.status === 401 || r.status === 403) keyBad = true;
          else {
            const j = await r.json();
            if (j && Number(j.c) > 0) { h.currentPrice = Number(j.c); gotPrice = true; }
          }
        } catch (e) { /* fall through to Yahoo */ }
        if (!keyBad) {
          try {
            const r2 = await fetch("https://finnhub.io/api/v1/stock/metric?symbol=" + sym + "&metric=all&token=" + key);
            const m = r2.ok ? await r2.json() : null;
            const met = (m && m.metric) || {};
            let dps = Number(met.dividendPerShareAnnual) || Number(met.dividendPerShareTTM) || 0;
            if (!(dps > 0)) {
              const yld = Number(met.dividendYieldIndicatedAnnual) || Number(met.currentDividendYieldTTM) || 0;
              if (yld > 0 && Number(h.currentPrice) > 0) dps = Number(h.currentPrice) * yld / 100;
            }
            if (dps > 0) { h.divPerShare = Math.round(dps * 10000) / 10000; gotDiv = true; }
          } catch (e) { /* fall through to Yahoo */ }
        }
      }
      // also call Yahoo when we still need the long-run return for this holding
      if (!gotPrice || !gotDiv || h.expReturn == null) {
        const y = await this._yahooData(h.symbol);
        if (y) {
          if (!gotPrice && y.price > 0) { h.currentPrice = y.price; gotPrice = true; }
          if (!gotDiv && y.div > 0) { h.divPerShare = y.div; gotDiv = true; }
          if (y.cagr != null && isFinite(y.cagr)) h.expReturn = Math.round(y.cagr * 10000) / 10000;
        }
      }
      if (gotPrice) prices++; else failed.push(h.symbol);
      if (gotDiv) divs++;
      // a manually-entered dividend counts — only flag holdings with nothing at all
      else if (!(Number(h.divPerShare) > 0)) noDiv.push(h.symbol);
    }
    this.state.settings.lastQuoteSync = toISO(todayMid());
    this.save();
    return { prices, divs, failed, noDiv, keyBad };
  },

  /* One net-worth snapshot per day, stored in USD so currency switches don't distort history. */
  recordSnapshot() {
    if (!this.state) return;
    const s = this.state;
    if (!(s.accounts.length || s.cards.length || s.holdings.length || s.incomes.length)) return;
    const t = computeTotals();
    const usd = toUSD(t.netWorth);
    // also store the composition (in USD) so the net-worth chart can show HOW
    // wealth is built — liquid accounts, investments and debt — over time.
    const liq = toUSD(t.accountsTotal), inv = toUSD(t.marketValue), debt = toUSD(t.debt);
    const iso = toISO(todayMid());
    const snaps = s.snapshots;
    const last = snaps[snaps.length - 1];
    if (last && last.d === iso) {
      if (Math.abs(last.usd - usd) > 0.005 || last.liq == null) {
        last.usd = usd; last.liq = liq; last.inv = inv; last.debt = debt; this.save();
      }
    } else {
      snaps.push({ d: iso, usd: usd, liq: liq, inv: inv, debt: debt });
      if (snaps.length > 730) snaps.splice(0, snaps.length - 730);
      this.save();
    }
  },

  /* Bring balances up to date by crediting interest the schedule says has
     already been paid. For each interest-bearing account it pays out every
     scheduled date in (balanceAsOf, today], compounding, then advances
     balanceAsOf — so it's idempotent (re-running credits nothing new) and the
     net-worth history + earnings projection both reflect the higher balances.
     Interest is credited GROSS (it compounds in full); the only at-source
     deduction is the small provisional ISR the bank withholds on *capital*
     (Ley de Ingresos rate). The income ISR on the interest itself is deferred
     to the annual April return, not withheld here — matching how MX banks,
     brokerages and CETES actually pay. Mirrors the manual "Capitalize". */
  settleInterest() {
    if (!this.state || this.state.settings.autoInterest === false) return { credited: 0, count: 0 };
    const today = todayMid();
    const provRate = ((this.state.settings.tax && Number(this.state.settings.tax.interestProvisional)) || 0) / 100;
    const dayAfter = (d) => { const x = new Date(d); x.setDate(x.getDate() + 1); return x; };
    let creditedDisp = 0, count = 0, changed = false;
    this.state.accounts.forEach(a => {
      const apy = Number(a.apy) || 0;
      if (apy <= 0) return;
      const start = parseISO(a.balanceAsOf);
      if (!start || start >= today) return;
      let bal = Number(a.balance) || 0, last = start, creditedNative = 0;
      const creditTo = (to) => {
        const days = daysBetween(last, to);
        if (days <= 0) return;
        // full interest compounds; the bank only withholds provisional ISR on capital
        const net = bal * (Math.pow(1 + apy / 100, days / 365) - 1) - bal * provRate * (days / 365);
        bal += net; creditedNative += net; last = to;
      };
      const f = interestFreqKey(a);
      if (f === "daily") {
        creditTo(today);                                   // formula already compounds daily
      } else if (f === "everyN" || f === "term") {
        // the principal is committed for the whole period, so each matured
        // period pays its full N-day interest (matching the form's preview),
        // not just the slice since the balance was last entered.
        const periodDays = interestPeriodDays(a);
        const factor = Math.pow(1 + apy / 100, periodDays / 365) - 1;
        let next = nextInterestDate(a, dayAfter(start)), guard = 0;
        while (next && next <= today && guard < 4000) {
          const net = bal * factor - bal * provRate * (periodDays / 365);
          bal += net; creditedNative += net; last = next;
          next = nextInterestDate(a, dayAfter(next)); guard++;
        }
      } else {
        let next = nextInterestDate(a, dayAfter(start)), guard = 0;
        while (next && next <= today && guard < 4000) { creditTo(next); next = nextInterestDate(a, dayAfter(next)); guard++; }
      }
      if (creditedNative > 0.005) {
        a.balance = Math.round(bal * 100) / 100;
        a.balanceAsOf = toISO(last);
        creditedDisp += (typeof conv === "function" ? conv(creditedNative, a.currency) : creditedNative);
        count++; changed = true;
      }
    });
    if (changed) this.save();
    return { credited: creditedDisp, count: count };
  },

  loadSample() {
    const t = todayMid();
    const iso = toISO(t);
    const monthAgo = toISO(new Date(t.getFullYear(), t.getMonth() - 1, t.getDate()));
    const acc1 = uid(), acc2 = uid(), acc3 = uid(), acc4 = uid(), acc5 = uid();
    const termStart = toISO(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 30));
    const settings = Object.assign(this.defaults().settings, this.state ? this.state.settings : {});
    settings.tax = { interest: 5, dividends: 10, capGains: 10, interestProvisional: 0.5, inflation: 4.5 };
    this.state = {
      settings: settings,
      learn: this.state && this.state.learn ? this.state.learn : { scenarios: {}, sandbox: { best: 0, runs: 0 } },
      accounts: [
        { id: acc1, name: "Everyday Checking", institution: "BBVA", type: "checking", balance: 18450.22, apy: 0, balanceAsOf: iso, currency: "MXN" },
        { id: acc2, name: "High-Yield Savings", institution: "Nu", type: "savings", balance: 92000, apy: 9.25, balanceAsOf: monthAgo, currency: "MXN", interestFreq: "daily", interestDay: 31 },
        { id: acc3, name: "Emergency Fund", institution: "Openbank", type: "savings", balance: 45000, apy: 7.5, balanceAsOf: monthAgo, currency: "MXN", interestFreq: "quarterly", interestDay: 15 },
        { id: acc4, name: "Brokerage Cash", institution: "GBM+", type: "investment", balance: 1200, apy: 0, balanceAsOf: iso, currency: "USD" },
        { id: acc5, name: "CETES 91 días", institution: "Cetesdirecto", type: "investment", balance: 50000, apy: 10.2, balanceAsOf: termStart, currency: "MXN", interestFreq: "term", interestEveryDays: 91, interestStart: termStart },
      ],
      cards: [
        { id: uid(), name: "Platinum Rewards", issuer: "American Express", limit: 85000, balance: 21340.5, cutDay: 14, payDay: 4, apr: 39.9, color: "c-forest", currency: "MXN" },
        { id: uid(), name: "Cashback Visa", issuer: "Santander", limit: 40000, balance: 31200, cutDay: 25, payDay: 15, apr: 45.2, color: "c-ocean", currency: "MXN" },
      ],
      holdings: [
        { id: uid(), symbol: "VOO", name: "Vanguard S&P 500 ETF", kind: "etf", shares: 14, costBasis: 412.3, currentPrice: 472.1, divPerShare: 6.97, accountId: acc4, purchaseDate: "2025-03-10", currency: "USD" },
        { id: uid(), symbol: "AAPL", name: "Apple Inc.", kind: "stock", shares: 25, costBasis: 178.5, currentPrice: 224.4, divPerShare: 1.04, accountId: acc4, purchaseDate: "2025-01-22", currency: "USD" },
        { id: uid(), symbol: "QQQM", name: "Invesco Nasdaq 100 ETF", kind: "etf", shares: 30, costBasis: 168.2, currentPrice: 195.6, divPerShare: 1.18, accountId: acc4, purchaseDate: "2025-06-02", currency: "USD" },
        { id: uid(), symbol: "NVDA", name: "NVIDIA Corp.", kind: "stock", shares: 10, costBasis: 118.9, currentPrice: 104.3, divPerShare: 0.04, accountId: acc4, purchaseDate: "2025-11-14", currency: "USD" },
      ],
      incomes: [
        { id: uid(), name: "Salary — Acme Corp", category: "Salary", amount: 36000, amountType: "gross", taxRate: 21, accountId: acc1, frequency: "quincena", payDay: 15, startDate: "2025-01-15", currency: "MXN" },
        { id: uid(), name: "Freelance retainer", category: "Freelance", amount: 9500, amountType: "net", taxRate: 0, accountId: acc1, frequency: "monthly", payDay: 1, startDate: "2025-04-01", currency: "MXN" },
        { id: uid(), name: "Apartment rent (tenant)", category: "Rent", amount: 7800, amountType: "gross", taxRate: 10, accountId: acc2, frequency: "monthly", payDay: 5, startDate: "2025-02-05", currency: "MXN" },
      ],
      snapshots: (() => {
        // synthetic 90-day history ending near today's value, so the chart has something to show
        const out = [];
        let v = 21500;
        for (let i = 90; i >= 1; i--) {
          const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i);
          v *= 1 + 0.0012 + Math.sin(i / 7) * 0.004;
          out.push({ d: toISO(d), usd: Math.round(v * 100) / 100 });
        }
        return out;
      })(),
      expenses: (() => {
        // 5 months of demo spending (current month is partial) so the Budget
        // score, complete-month default, trends, movers and streaks all light up
        const out = [];
        const day = (mOff, dom) => toISO(new Date(t.getFullYear(), t.getMonth() - mOff, dom));
        const add = (mOff, dom, desc, cat, amt) => out.push({ id: uid(), date: day(mOff, dom), description: desc, category: cat, amount: amt, currency: "MXN", source: "sample" });
        // m=0 current (partial), 1=last, 2,3,4 = older complete months
        for (let m = 0; m <= 4; m++) {
          add(m, 2, "Apartment rent", "Housing", 11500);
          add(m, 3, "CFE electricity", "Utilities", 640 + m * 20);
          add(m, 4, "Internet — Totalplay", "Utilities", 599);
          add(m, 13, "Netflix", "Subscriptions", 219);
          add(m, 13, "Spotify", "Subscriptions", 129);
          add(m, 16, "Gym", "Health", 650);
        }
        // variable categories with month-to-month movement (index = months ago)
        const groceries = [2980, 3120, 3380, 3650, 3050];
        const dining = [1190, 1480, 1400, 1240, 980];
        const transport = [1190, 1050, 1320, 980, 1110];
        const shopping = [0, 1800, 0, 1450, 3200];
        const travel = [0, 3850, 0, 0, 5200];               // occasional spikes
        const health = [430, 380, 1240, 290, 360];
        const entertainment = [320, 540, 280, 760, 410];
        for (let m = 0; m <= 4; m++) {
          add(m, 6, "Walmart", "Groceries", Math.round(groceries[m] * 0.55));
          add(m, 19, "Soriana", "Groceries", Math.round(groceries[m] * 0.45));
          if (dining[m]) { add(m, 11, "Restaurante", "Dining", Math.round(dining[m] * 0.7)); add(m, 18, "Café & pan", "Dining", Math.round(dining[m] * 0.3)); }
          if (transport[m]) { add(m, 9, "Gasolina", "Transport", Math.round(transport[m] * 0.7)); add(m, 8, "Uber", "Transport", Math.round(transport[m] * 0.3)); }
          if (shopping[m]) add(m, 14, "Amazon MX / Liverpool", "Shopping", shopping[m]);
          if (travel[m]) add(m, 16, "Vuelo — Volaris", "Travel", travel[m]);
          if (health[m]) add(m, 20, "Farmacia", "Health", health[m]);
          if (entertainment[m]) add(m, 10, "Cinépolis", "Entertainment", entertainment[m]);
        }
        // keep the partial current month light (only a few days elapsed feel)
        return out.filter(e => !(monthKeyOf(e.date) === monthKeyOf(toISO(t)) && parseISO(e.date) > t)).map(e => {
          if (typeof expenseSig === "function") e.sig = expenseSig(e);
          return e;
        });
      })(),
      budgets: {
        Groceries: { amount: 4500, currency: "MXN" },
        Dining: { amount: 1500, currency: "MXN" },
        Transport: { amount: 1500, currency: "MXN" },
        Shopping: { amount: 2000, currency: "MXN" },
        Entertainment: { amount: 800, currency: "MXN" },
      },
    };
    this.save();
  },
};

/* ---------- derived totals (all converted to the display currency) ---------- */

function computeTotals() {
  const s = Store.state;
  let cash = 0, savings = 0, investCash = 0;
  s.accounts.forEach(a => {
    const b = conv(Number(a.balance) || 0, a.currency);
    if (a.type === "checking") cash += b;
    else if (a.type === "savings") savings += b;
    else investCash += b;
  });
  let invested = 0, marketValue = 0;
  s.holdings.forEach(h => {
    invested += conv((Number(h.shares) || 0) * (Number(h.costBasis) || 0), h.currency);
    marketValue += conv((Number(h.shares) || 0) * (Number(h.currentPrice) || 0), h.currency);
  });
  let debt = 0, creditLimit = 0;
  s.cards.forEach(c => {
    debt += conv(Number(c.balance) || 0, c.currency);
    creditLimit += conv(Number(c.limit) || 0, c.currency);
  });

  const accountsTotal = cash + savings + investCash;
  const assets = accountsTotal + marketValue;
  return {
    cash, savings, investCash, accountsTotal,
    invested, marketValue, pnl: marketValue - invested,
    debt, creditLimit,
    assets, netWorth: assets - debt,
  };
}

function collectAlerts() {
  const s = Store.state;
  const alerts = [];
  s.cards.forEach(c => {
    const cut = nextCardDate(c.cutDay);
    const pay = nextCardDate(c.payDay);
    const dCut = daysUntil(cut), dPay = daysUntil(pay);
    if (dPay <= 7) {
      alerts.push({
        level: dPay <= 2 ? "danger" : "warn",
        text: "<strong>" + esc(c.name) + "</strong> payment due " + (dPay === 0 ? "today" : "in " + dPay + " day" + (dPay === 1 ? "" : "s")),
        meta: fmtDate(pay) + " · " + esc(c.issuer),
        when: dPay,
      });
    }
    if (dCut <= 5) {
      alerts.push({
        level: "info",
        text: "<strong>" + esc(c.name) + "</strong> statement cut " + (dCut === 0 ? "today" : "in " + dCut + " day" + (dCut === 1 ? "" : "s")),
        meta: fmtDate(cut) + " — purchases after this date land on next statement",
        when: dCut,
      });
    }
    const util = cardUtilization(c);
    if (util >= 0.7) {
      alerts.push({
        level: "danger",
        text: "<strong>" + esc(c.name) + "</strong> utilization at " + Math.round(util * 100) + "%",
        meta: "High utilization can hurt your credit score — consider paying down",
        when: 99,
      });
    } else if (util >= 0.5) {
      alerts.push({
        level: "warn",
        text: "<strong>" + esc(c.name) + "</strong> utilization at " + Math.round(util * 100) + "%",
        meta: "Above the recommended 30–50% range",
        when: 100,
      });
    }
  });
  s.holdings.forEach(h => {
    const cost = (Number(h.shares) || 0) * (Number(h.costBasis) || 0);
    const mv = (Number(h.shares) || 0) * (Number(h.currentPrice) || 0);
    if (cost > 0 && (mv - cost) / cost <= -0.1) {
      alerts.push({
        level: "warn",
        text: "<strong>" + esc(h.symbol) + "</strong> is down " + fmtPct(((mv - cost) / cost) * 100, 1).replace("+", ""),
        meta: "Position value " + fmtMoneyIn(mv, h.currency) + " vs cost " + fmtMoneyIn(cost, h.currency),
        when: 101,
      });
    }
  });
  // budget overspending this month (Budget feature; functions live in budget.js)
  if (typeof categoryTotalsSorted === "function" && (s.expenses || []).length) {
    const cm = toISO(todayMid()).slice(0, 7);
    const monthExps = s.expenses.filter(e => monthKeyOf(e.date) === cm);
    if (monthExps.length) {
      const over = categoryTotalsSorted(monthExps).filter(c => {
        const b = budgetForCategory(c.name);
        return b && c.amount > b;
      });
      if (over.length) {
        const names = over.slice(0, 3).map(c => c.name).join(", ") + (over.length > 3 ? " +" + (over.length - 3) + " more" : "");
        alerts.push({
          level: "warn",
          text: "<strong>Over budget</strong> in " + esc(names),
          meta: "This month's spending tops your limit in " + over.length + " categor" + (over.length === 1 ? "y" : "ies") + " — review on the Budget page",
          when: 60,
        });
      }
    }
  }

  // backup hygiene
  const hasData = s.accounts.length || s.cards.length || s.holdings.length || s.incomes.length || (s.expenses || []).length;
  if (hasData) {
    const last = parseISO(s.settings.lastExport);
    const stale = !last || daysBetween(last, todayMid()) > 30;
    if (stale) {
      alerts.push({
        level: "info",
        text: "<strong>No recent backup</strong> — your data lives only in this browser",
        meta: "Export a .json backup from the ⋯ menu in the sidebar" + (last ? " (last: " + fmtDate(last) + ")" : ""),
        when: 102,
      });
    }
  }
  alerts.sort((a, b) => a.when - b.when);
  return alerts;
}

/* ---------- annual earnings, all sources ----------
   Everything converted to the display currency. Gross = pre-tax,
   Net = what actually lands after the configured tax rates. */

function earningsBreakdown() {
  const s = Store.state;
  const tax = s.settings.tax || { interest: 0, dividends: 0, capGains: 0 };

  let schedGross = 0, schedNet = 0;
  s.incomes.forEach(i => {
    schedGross += conv(monthlyEquivalent(i) * 12, i.currency);
    schedNet += conv(monthlyEquivalentNet(i) * 12, i.currency);
  });

  // Interest is paid GROSS; the income ISR is settled in the April return, not
  // withheld at source (unlike dividends). Crucially, the ISR only hits the
  // *real* interest (nominal less inflation) — not the inflationary portion.
  // During the year the bank withholds a small provisional ISR on capital, a
  // credit toward that annual bill. intNet = what you keep after the full ISR.
  let intGross = 0, intReal = 0, intProvisional = 0;
  const provR = Math.max(0, Number(tax.interestProvisional) || 0) / 100;
  s.accounts.forEach(a => {
    intGross += conv(yearlyInterestEst(a), a.currency);
    intReal += conv(realInterestEst(a), a.currency);
    intProvisional += conv((Number(a.balance) || 0) * provR, a.currency);
  });
  const intAnnualISR = intReal * Math.max(0, Number(tax.interest) || 0) / 100;
  const intTaxDueApril = Math.max(0, intAnnualISR - intProvisional);
  const intNet = intGross - intAnnualISR;

  let divGross = 0;
  s.holdings.forEach(h => {
    divGross += conv((Number(h.shares) || 0) * (Number(h.divPerShare) || 0), h.currency);
  });
  const divNet = divGross * (1 - (Number(tax.dividends) || 0) / 100);

  // Expected annual investment return = market value × the security's long-run
  // (10y / max history) average annual return, defaulting to 9% when there's no
  // data. Far steadier than annualizing a short holding period's unrealized P/L.
  let investGross = 0;
  s.holdings.forEach(h => {
    const mv = conv((Number(h.shares) || 0) * (Number(h.currentPrice) || 0), h.currency);
    investGross += mv * holdingReturnRate(h);
  });
  const investNet = investGross > 0 ? investGross * (1 - (Number(tax.capGains) || 0) / 100) : investGross;

  return {
    schedGross, schedNet, intGross, intNet, divGross, divNet, investGross, investNet,
    intReal, intProvisional, intAnnualISR, intTaxDueApril,
    totalGross: schedGross + intGross + divGross + investGross,
    totalNet: schedNet + intNet + divNet + investNet,
    /* steady monthly cash-flow estimate (excludes market swings) */
    monthlyNet: (schedNet + intNet + divNet) / 12,
  };
}

/* ---------- retirement projection ----------
   Two phases on one timeline. ACCUMULATION: grow `start` for `years` at `ret`%
   (nominal), adding `contrib` every month. DRAWDOWN: from the nest egg, pull
   `withdraw`% in year one and raise that withdrawal each year by `inflation`%
   so its buying power holds (the inflation-adjusted "4% rule"), while the pot
   keeps earning `ret`%. We simulate monthly for smooth curves and stop when the
   money runs out or after `maxDraw` years. Real (today's-pesos) figures deflate
   by inflation over the accumulation horizon. Pure function — easy to test. */
function retirementProjection(p) {
  p = p || {};
  const start = Math.max(0, Number(p.start) || 0);
  const ret = Number(p.ret) || 0;                                   // annual nominal return %
  const years = Math.max(0, Math.round(Number(p.years) || 0));      // accumulation years
  const contrib = Math.max(0, Number(p.contrib) || 0);             // monthly contribution
  const wd = Math.max(0, Number(p.withdraw) || 0);                 // withdrawal rate %
  const infl = Number(p.inflation) || 0;                          // inflation assumption %
  const maxDraw = Math.max(1, Math.round(Number(p.maxDraw) || 50)); // cap drawdown sim (yrs)
  const mRet = Math.pow(1 + ret / 100, 1 / 12) - 1;

  const pts = [{ year: 0, bal: start, phase: "save" }];
  let bal = start, contributed = start;
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) { bal = bal * (1 + mRet) + contrib; contributed += contrib; }
    pts.push({ year: y, bal: bal, phase: "save" });
  }
  const nest = bal;
  const annualWithdraw0 = nest * wd / 100;

  let draw = annualWithdraw0, depletedYear = null;
  for (let y = 1; y <= maxDraw; y++) {
    for (let m = 0; m < 12; m++) {
      bal = bal * (1 + mRet) - draw / 12;
      if (bal <= 0) { bal = 0; break; }
    }
    pts.push({ year: years + y, bal: Math.max(0, bal), phase: "draw" });
    if (bal <= 0) { depletedYear = y; break; }
    draw = draw * (1 + infl / 100);
  }
  const realFactor = Math.pow(1 + infl / 100, years);

  return {
    pts, nest, contributed, growth: nest - contributed,
    nestReal: nest / realFactor,
    annualWithdraw0,
    monthlyIncome: annualWithdraw0 / 12,
    monthlyIncomeReal: (annualWithdraw0 / 12) / realFactor,
    depletedYear,                      // years into retirement, or null if it lasted the cap
    sustainable: depletedYear == null,
    maxDraw,
    endBalance: pts.length ? pts[pts.length - 1].bal : 0,
    realReturn: ret - infl,
  };
}

/* Seeded RNG (mulberry32) + standard normal, so the Monte-Carlo cone is stable
   across re-renders instead of flickering on every slider tick. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randNormal(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* Monte-Carlo retirement: same two phases as retirementProjection but with
   random annual returns ~ N(ret, vol). Returns a per-year p10/p50/p90 balance
   band (the cone of outcomes) and the share of runs whose money outlives the
   horizon (success rate). Seeded → deterministic and testable. */
function retirementMonteCarlo(p) {
  p = p || {};
  const start = Math.max(0, Number(p.start) || 0);
  const ret = (Number(p.ret) || 0) / 100;
  const vol = Math.max(0.0001, (p.vol != null ? Number(p.vol) : 12) / 100);
  const years = Math.max(0, Math.round(Number(p.years) || 0));
  const contrib = Math.max(0, Number(p.contrib) || 0) * 12;
  const wd = Math.max(0, Number(p.withdraw) || 0) / 100;
  const infl = (Number(p.inflation) || 0) / 100;
  const maxDraw = Math.max(1, Math.round(Number(p.maxDraw) || 50));
  const runs = Math.max(50, Math.round(Number(p.runs) || 300));
  const totalYears = years + maxDraw;
  const rng = mulberry32(0x9E3779B9);
  const cols = [];
  for (let y = 0; y <= totalYears; y++) cols.push([]);
  let survived = 0;
  for (let run = 0; run < runs; run++) {
    let bal = start; cols[0].push(bal);
    for (let y = 1; y <= years; y++) {
      bal = bal * (1 + ret + vol * randNormal(rng)) + contrib;
      cols[y].push(Math.max(0, bal));
    }
    let draw = bal * wd, alive = true;
    for (let y = 1; y <= maxDraw; y++) {
      bal = bal * (1 + ret + vol * randNormal(rng)) - draw;
      if (bal <= 0) { bal = 0; alive = false; }
      cols[years + y].push(Math.max(0, bal));
      draw = draw * (1 + infl);
    }
    if (alive) survived++;
  }
  const quant = (arr, q) => {
    if (!arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
  };
  return {
    band: cols.map((arr, y) => ({ year: y, p10: quant(arr, 0.1), p50: quant(arr, 0.5), p90: quant(arr, 0.9) })),
    successRate: runs ? survived / runs : 0,
    runs, vol: vol * 100,
  };
}

/* Debt payoff simulator (the classic spreadsheet/undebt.it model). Each month:
   accrue interest, pay each card its minimum, then roll every spare peso of the
   monthly budget onto ONE target card — the smallest balance (snowball) or the
   highest APR (avalanche). As cards clear, their freed minimums snowball into
   the budget. Returns months to debt-free, total interest, payoff order, and
   whether the budget is even enough to make progress. Pure & testable.
   debts: [{id, name, balance, apr}] (balance & apr already in display ccy/%). */
function debtPayoff(debts, monthlyBudget, method, opts) {
  opts = opts || {};
  const minPct = opts.minPct != null ? opts.minPct : 0.02;     // 2% of balance
  const minFloor = opts.minFloor != null ? opts.minFloor : 200; // small absolute floor
  const maxMonths = opts.maxMonths || 600;
  const budget = Math.max(0, Number(monthlyBudget) || 0);
  let cards = (debts || [])
    .map(d => ({ id: d.id, name: d.name, bal: Math.max(0, Number(d.balance) || 0), apr: Math.max(0, Number(d.apr) || 0) }))
    .filter(c => c.bal > 0.005);
  const startBalance = cards.reduce((s, c) => s + c.bal, 0);
  if (!cards.length) return { months: 0, totalInterest: 0, totalPaid: 0, startBalance: 0, order: [], feasible: true };
  const order = cards.slice().sort((a, b) =>
    method === "avalanche" ? (b.apr - a.apr) || (a.bal - b.bal) : (a.bal - b.bal) || (b.apr - a.apr)).map(c => c.id);
  const orderIdx = id => order.indexOf(id);

  let months = 0, totalInterest = 0;
  while (cards.some(c => c.bal > 0.005) && months < maxMonths) {
    months++;
    cards.forEach(c => { if (c.bal > 0) { const it = c.bal * c.apr / 1200; c.bal += it; totalInterest += it; } });
    let left = budget;
    const active = cards.filter(c => c.bal > 0.005);
    active.forEach(c => {
      const min = Math.min(c.bal, Math.max(minFloor, c.bal * minPct));
      const pay = Math.min(c.bal, min, left);
      c.bal -= pay; left -= pay;
    });
    if (left > 0) {
      active.slice().sort((a, b) => orderIdx(a.id) - orderIdx(b.id)).forEach(c => {
        if (left <= 0 || c.bal <= 0.005) return;
        const pay = Math.min(c.bal, left);
        c.bal -= pay; left -= pay;
      });
    }
  }
  const feasible = !cards.some(c => c.bal > 0.005);
  return {
    months: feasible ? months : maxMonths,
    totalInterest, totalPaid: startBalance + totalInterest,
    startBalance, order, feasible,
  };
}

/* ---------- achievements ---------- */

const ACHIEVEMENTS = [
  { id: "first-steps", icon: "▤", title: "First Steps",
    desc: "Add your first account",
    test: c => c.s.accounts.length >= 1 },
  { id: "full-stack", icon: "◉", title: "Full Picture",
    desc: "Track all four: accounts, a card, a position and an income stream",
    test: c => c.s.accounts.length && c.s.cards.length && c.s.holdings.length && c.s.incomes.length },
  { id: "interest-earner", icon: "✦", title: "Interest Earner",
    desc: "Hold an account that pays interest",
    test: c => c.s.accounts.some(a => Number(a.apy) > 0) },
  { id: "compounding", icon: "❋", title: "Compounding Machine",
    desc: "Earn $100+ (USD) of interest per month",
    test: c => toUSD(c.interestMo) >= 100 },
  { id: "dividend-collector", icon: "✿", title: "Dividend Collector",
    desc: "Hold a position that pays dividends",
    test: c => c.s.holdings.some(h => Number(h.divPerShare) > 0) },
  { id: "globalist", icon: "◍", title: "Globalist",
    desc: "Hold assets in two or more currencies",
    test: c => new Set([].concat(c.s.accounts, c.s.holdings).map(x => x.currency)).size >= 2 },
  { id: "budgeter", icon: "◓", title: "Budgeter",
    desc: "Log or import your first expenses",
    test: c => (c.s.expenses || []).length >= 1 },
  { id: "frugal", icon: "☘", title: "Frugal",
    desc: "Reach a 20%+ savings rate in a month",
    test: c => typeof expenseMonths === "function" &&
      expenseMonths().some(m => { const sb = budgetScore(m); return sb.monthlyExpenses > 0 && sb.savingsRate != null && sb.savingsRate >= 0.2; }) },
  { id: "diversified", icon: "◮", title: "Diversified",
    desc: "Hold 5 or more positions",
    test: c => c.s.holdings.length >= 5 },
  { id: "in-the-green", icon: "↗", title: "In the Green",
    desc: "Keep your portfolio in positive territory",
    test: c => c.s.holdings.length > 0 && c.t.pnl > 0 },
  { id: "disciplined", icon: "▭", title: "Disciplined Borrower",
    desc: "Keep every card under 30% utilization",
    test: c => c.s.cards.length > 0 && c.s.cards.every(x => cardUtilization(x) < 0.3) },
  { id: "clean-slate", icon: "◌", title: "Clean Slate",
    desc: "Owe $0 across all your credit cards",
    test: c => c.s.cards.length > 0 && c.t.debt === 0 },
  { id: "safety-net", icon: "☂", title: "Safety Net",
    desc: "Save 3+ months of income in savings accounts",
    test: c => c.incomeMo > 0 && c.t.savings >= 3 * c.incomeMo },
  { id: "six-figures", icon: "Ⅵ", title: "Six Figures",
    desc: "Reach $100,000 (USD) net worth",
    test: c => toUSD(c.t.netWorth) >= 100000 },
  { id: "top-half", icon: "◐", title: "Top Half",
    desc: "Net worth above the global median",
    test: c => c.nwPct >= 50 },
  { id: "one-percent", icon: "♛", title: "The 1% Club",
    desc: "Net worth or earnings in the global top 1%",
    test: c => c.nwPct >= 99 || c.incPct >= 99 },
  { id: "student", icon: "✐", title: "Student of Money",
    desc: "Complete your first Learn scenario",
    test: c => c.s.learn && Object.keys(c.s.learn.scenarios).length >= 1 },
  { id: "scholar", icon: "❈", title: "Scholar",
    desc: "Complete every Learn scenario",
    test: c => c.s.learn && typeof SCENARIOS !== "undefined" && SCENARIOS.every(sc => c.s.learn.scenarios[sc.id]) },
  { id: "tycoon", icon: "♚", title: "Sandbox Tycoon",
    desc: "Reach $400k in a Wealth Builder run",
    test: c => c.s.learn && c.s.learn.sandbox.best >= 400000 },
  { id: "guardian", icon: "⛨", title: "Guardian",
    desc: "Protect your data with a PIN lock",
    test: c => !!c.s.settings.pinEnabled },
  { id: "archivist", icon: "⎘", title: "Archivist",
    desc: "Export a backup of your data",
    test: c => !!c.s.settings.lastExport },
];

function achievementContext() {
  const s = Store.state;
  const t = computeTotals();
  const eb = earningsBreakdown();
  return {
    s, t, eb,
    interestMo: eb.intGross / 12,                                         // display currency
    incomeMo: s.incomes.reduce((a, x) => a + conv(monthlyEquivalentNet(x), x.currency), 0),
    nwPct: percentileFromTable(toUSD(t.netWorth), NETWORTH_PCT_TABLE),
    incPct: percentileFromTable(toUSD(eb.totalGross), INCOME_PCT_TABLE),  // income stats are pre-tax
  };
}
