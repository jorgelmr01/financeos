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
      accounts: [],   // {id, name, institution, type, balance, apy, balanceAsOf}
      cards: [],      // {id, name, issuer, limit, balance, cutDay, payDay, apr, color}
      holdings: [],   // {id, symbol, name, kind, shares, costBasis, currentPrice, accountId, purchaseDate}
      incomes: [],    // {id, name, category, amount, accountId, frequency, payDay, startDate}
      settings: { currency: "USD", privacy: false, pinEnabled: false, lastExport: null },
    };
  },

  _hydrate(parsed) {
    this.state = Object.assign(this.defaults(), parsed);
    this.state.settings = Object.assign(this.defaults().settings, parsed.settings || {});
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
          .catch(e => console.error("FinanceOS: encrypted save failed", e));
      } else {
        localStorage.setItem(STORAGE_KEY, json);
      }
    } catch (e) {
      console.error("FinanceOS: failed to save", e);
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
      settings: Object.assign(d.settings, data.settings || {}),
    };
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

  loadSample() {
    const t = todayMid();
    const iso = toISO(t);
    const monthAgo = toISO(new Date(t.getFullYear(), t.getMonth() - 1, t.getDate()));
    const acc1 = uid(), acc2 = uid(), acc3 = uid(), acc4 = uid();
    this.state = {
      settings: Object.assign(this.defaults().settings,
        this.state ? this.state.settings : {}),
      accounts: [
        { id: acc1, name: "Everyday Checking", institution: "BBVA", type: "checking", balance: 18450.22, apy: 0, balanceAsOf: iso },
        { id: acc2, name: "High-Yield Savings", institution: "Nu", type: "savings", balance: 92000, apy: 9.25, balanceAsOf: monthAgo },
        { id: acc3, name: "Emergency Fund", institution: "Openbank", type: "savings", balance: 45000, apy: 7.5, balanceAsOf: monthAgo },
        { id: acc4, name: "Brokerage Cash", institution: "GBM+", type: "investment", balance: 6200, apy: 0, balanceAsOf: iso },
      ],
      cards: [
        { id: uid(), name: "Platinum Rewards", issuer: "American Express", limit: 85000, balance: 21340.5, cutDay: 14, payDay: 4, apr: 39.9, color: "c-forest" },
        { id: uid(), name: "Cashback Visa", issuer: "Santander", limit: 40000, balance: 31200, cutDay: 25, payDay: 15, apr: 45.2, color: "c-ocean" },
      ],
      holdings: [
        { id: uid(), symbol: "VOO", name: "Vanguard S&P 500 ETF", kind: "etf", shares: 14, costBasis: 412.3, currentPrice: 472.1, accountId: acc4, purchaseDate: "2025-03-10" },
        { id: uid(), symbol: "AAPL", name: "Apple Inc.", kind: "stock", shares: 25, costBasis: 178.5, currentPrice: 224.4, accountId: acc4, purchaseDate: "2025-01-22" },
        { id: uid(), symbol: "QQQM", name: "Invesco Nasdaq 100 ETF", kind: "etf", shares: 30, costBasis: 168.2, currentPrice: 195.6, accountId: acc4, purchaseDate: "2025-06-02" },
        { id: uid(), symbol: "NVDA", name: "NVIDIA Corp.", kind: "stock", shares: 10, costBasis: 118.9, currentPrice: 104.3, accountId: acc4, purchaseDate: "2025-11-14" },
      ],
      incomes: [
        { id: uid(), name: "Salary — Acme Corp", category: "Salary", amount: 28500, accountId: acc1, frequency: "quincena", payDay: 15, startDate: "2025-01-15" },
        { id: uid(), name: "Freelance retainer", category: "Freelance", amount: 9500, accountId: acc1, frequency: "monthly", payDay: 1, startDate: "2025-04-01" },
        { id: uid(), name: "Apartment rent (tenant)", category: "Rent", amount: 7800, accountId: acc2, frequency: "monthly", payDay: 5, startDate: "2025-02-05" },
      ],
    };
    this.save();
  },
};

/* ---------- derived totals ---------- */

function computeTotals() {
  const s = Store.state;
  let cash = 0, savings = 0, investCash = 0;
  s.accounts.forEach(a => {
    const b = Number(a.balance) || 0;
    if (a.type === "checking") cash += b;
    else if (a.type === "savings") savings += b;
    else investCash += b;
  });
  let invested = 0, marketValue = 0;
  s.holdings.forEach(h => {
    invested += (Number(h.shares) || 0) * (Number(h.costBasis) || 0);
    marketValue += (Number(h.shares) || 0) * (Number(h.currentPrice) || 0);
  });
  let debt = 0, creditLimit = 0;
  s.cards.forEach(c => { debt += Number(c.balance) || 0; creditLimit += Number(c.limit) || 0; });

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
        meta: "Position value " + fmtMoney(mv) + " vs cost " + fmtMoney(cost),
        when: 101,
      });
    }
  });
  // backup hygiene
  const hasData = s.accounts.length || s.cards.length || s.holdings.length || s.incomes.length;
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

/* ---------- annual earnings, all sources (for Milestones) ---------- */

function earningsBreakdown() {
  const s = Store.state;
  const scheduled = s.incomes.reduce((a, x) => a + monthlyEquivalent(x), 0) * 12;
  const interest = s.accounts.reduce((a, x) => a + monthlyInterestEst(x), 0) * 12;
  let invest = 0;
  s.holdings.forEach(h => {
    const pnl = (Number(h.shares) || 0) * ((Number(h.currentPrice) || 0) - (Number(h.costBasis) || 0));
    const bought = parseISO(h.purchaseDate);
    // annualize each position's return over its holding period (≥30d to avoid spikes)
    const days = bought ? Math.max(30, daysBetween(bought, todayMid())) : 365;
    invest += pnl * 365 / days;
  });
  return { scheduled, interest, invest, total: scheduled + interest + invest };
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
    interestMo: s.accounts.reduce((a, x) => a + monthlyInterestEst(x), 0),
    incomeMo: s.incomes.reduce((a, x) => a + monthlyEquivalent(x), 0),
    nwPct: percentileFromTable(toUSD(t.netWorth), NETWORTH_PCT_TABLE),
    incPct: percentileFromTable(toUSD(eb.total), INCOME_PCT_TABLE),
  };
}
