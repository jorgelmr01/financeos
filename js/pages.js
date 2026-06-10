/* FinanceOS — page renderers */
"use strict";

const Pages = {

  /* ================= OVERVIEW ================= */
  overview() {
    const t = computeTotals();
    const alerts = collectAlerts();
    const s = Store.state;
    const hasAnything = s.accounts.length || s.cards.length || s.holdings.length || s.incomes.length;

    if (!hasAnything) {
      return '<div class="section"><div class="empty">' +
        '<div class="empty-glyph">§</div>' +
        "<h3>Welcome to your command center</h3>" +
        "<p>Add your first account, credit card, or position — or load sample data to explore what FinanceOS can do.</p>" +
        '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
          '<button class="btn primary" data-action="sample">Load sample data</button>' +
          '<button class="btn" data-action="add-account">Add an account</button>' +
        "</div></div></div>";
    }

    // composition segments (assets only)
    const segs = [
      { label: "Cash", val: t.cash, color: "#8fc9e3" },
      { label: "Savings", val: t.savings, color: "#8fe3a6" },
      { label: "Brokerage cash", val: t.investCash, color: "#9be3d2" },
      { label: "Investments", val: t.marketValue, color: "#c5b3e6" },
    ].filter(x => x.val > 0);
    const segTotal = segs.reduce((a, x) => a + x.val, 0) || 1;
    const compBar = '<div class="comp-bar">' +
      segs.map(x => '<span style="width:' + (x.val / segTotal * 100).toFixed(2) + '%;background:' + x.color + '" title="' + x.label + '"></span>').join("") +
      "</div>" +
      '<div class="comp-legend">' +
      segs.map(x => '<span class="lg"><span class="dot" style="background:' + x.color + '"></span>' + x.label + " · " + fmtMoney(x.val, { compact: true }) + "</span>").join("") +
      "</div>";

    // monthly income estimate
    const interestMo = s.accounts.reduce((a, x) => a + monthlyInterestEst(x), 0);
    const incomeMo = s.incomes.reduce((a, x) => a + monthlyEquivalent(x), 0);

    const alertsHtml = alerts.length
      ? alerts.slice(0, 6).map(a =>
          '<div class="alert-row"><span class="alert-dot ' + a.level + '"></span>' +
          '<div class="alert-body">' + a.text + '<div class="alert-meta">' + a.meta + "</div></div></div>"
        ).join("")
      : '<div class="all-clear"><span class="pulse"></span>All clear — no payments due soon, utilization healthy.</div>';

    // upcoming income next 14 days
    const upcoming = [];
    const to = new Date(todayMid()); to.setDate(to.getDate() + 14);
    s.incomes.forEach(inc => {
      incomeOccurrences(inc, todayMid(), to).forEach(d => upcoming.push({ d, inc }));
    });
    upcoming.sort((a, b) => a.d - b.d);
    const upcomingHtml = upcoming.length
      ? upcoming.slice(0, 5).map(u =>
          '<div class="alert-row"><span class="alert-dot info" style="background:var(--mint);color:var(--mint)"></span>' +
          '<div class="alert-body"><strong>' + esc(u.inc.name) + "</strong> → " + esc(Store.accountName(u.inc.accountId)) +
          '<div class="alert-meta">' + fmtDate(u.d) + "</div></div>" +
          '<div class="tl-amount" style="margin-left:auto">' + fmtMoney(u.inc.amount, { sign: true }) + "</div></div>"
        ).join("")
      : '<div class="all-clear" style="color:var(--text-mute)">No deposits scheduled in the next 14 days.</div>';

    return (
      '<div class="hero section">' +
        '<div class="hero-networth">' +
          '<span class="micro-label">Total Net Worth</span>' +
          '<div class="hero-amount ' + (t.netWorth < 0 ? "neg" : "") + '">' + fmtMoney(t.netWorth) + "</div>" +
          '<div class="hero-breakdown">' +
            '<div class="b-item"><span class="micro-label">Assets</span><span class="b-val pos">' + fmtMoney(t.assets) + "</span></div>" +
            '<div class="b-item"><span class="micro-label">Card debt</span><span class="b-val ' + (t.debt > 0 ? "neg" : "") + '">−' + fmtMoney(t.debt) + "</span></div>" +
            '<div class="b-item"><span class="micro-label">Unrealized P/L</span><span class="b-val ' + (t.pnl >= 0 ? "pos" : "neg") + '">' + fmtMoney(t.pnl, { sign: true }) + "</span></div>" +
          "</div>" +
          compBar +
          '<button class="pct-chip" data-action="nav" data-page="milestones">✶ ' +
            topShareLabel(percentileFromTable(toUSD(t.netWorth), NETWORTH_PCT_TABLE)) +
            " worldwide by net worth — see your milestones →</button>" +
        "</div>" +
        '<div class="panel alerts-panel">' +
          '<div class="panel-head"><div class="panel-title">Attention</div>' +
          '<span class="panel-sub">' + alerts.length + " alert" + (alerts.length === 1 ? "" : "s") + "</span></div>" +
          alertsHtml +
        "</div>" +
      "</div>" +

      '<div class="grid cols-4 section">' +
        '<div class="stat"><span class="micro-label">Liquid cash</span><div class="stat-value">' + fmtMoney(t.cash + t.savings + t.investCash) + '</div><div class="stat-note">' + s.accounts.length + " account" + (s.accounts.length === 1 ? "" : "s") + "</div></div>" +
        '<div class="stat"><span class="micro-label">Portfolio value</span><div class="stat-value">' + fmtMoney(t.marketValue) + '</div><div class="stat-note ' + (t.pnl >= 0 ? "pos" : "neg") + '">' + fmtMoney(t.pnl, { sign: true }) + " (" + fmtPct(t.invested ? t.pnl / t.invested * 100 : 0, 1) + ")</div></div>" +
        '<div class="stat"><span class="micro-label">Credit available</span><div class="stat-value">' + fmtMoney(Math.max(0, t.creditLimit - t.debt)) + '</div><div class="stat-note">of ' + fmtMoney(t.creditLimit, { compact: true }) + " total limit</div></div>" +
        '<div class="stat"><span class="micro-label">Est. monthly income</span><div class="stat-value gold">' + fmtMoney(incomeMo + interestMo) + '</div><div class="stat-note">incl. ' + fmtMoney(interestMo) + " interest</div></div>" +
      "</div>" +

      '<div class="grid cols-2 section">' +
        '<div class="panel"><div class="panel-head"><div class="panel-title">Incoming — next 14 days</div>' +
        '<button class="btn small ghost" data-action="nav" data-page="earnings">View all →</button></div>' + upcomingHtml + "</div>" +
        this._topHoldingsPanel() +
      "</div>"
    );
  },

  _topHoldingsPanel() {
    const hs = Store.state.holdings.slice().sort((a, b) =>
      b.shares * b.currentPrice - a.shares * a.currentPrice).slice(0, 5);
    if (!hs.length) {
      return '<div class="panel"><div class="panel-head"><div class="panel-title">Portfolio snapshot</div></div>' +
        '<div class="all-clear" style="color:var(--text-mute)">No positions yet — add stocks or ETFs in Portfolio.</div></div>';
    }
    const rows = hs.map(h => {
      const mv = h.shares * h.currentPrice, cost = h.shares * h.costBasis;
      const pct = cost ? (mv - cost) / cost * 100 : 0;
      return '<div class="alert-row"><span class="sym-badge">' + esc(h.symbol.slice(0, 5)) + "</span>" +
        '<div class="alert-body"><strong>' + esc(h.name || h.symbol) + '</strong><div class="alert-meta">' + fmtNum(h.shares) + " shares</div></div>" +
        '<div style="margin-left:auto;text-align:right"><div class="tl-amount" style="color:var(--text)">' + fmtMoney(mv) + "</div>" +
        '<div class="alert-meta ' + (pct >= 0 ? "pos" : "neg") + '">' + fmtPct(pct, 1) + "</div></div></div>";
    }).join("");
    return '<div class="panel"><div class="panel-head"><div class="panel-title">Portfolio snapshot</div>' +
      '<button class="btn small ghost" data-action="nav" data-page="portfolio">Manage →</button></div>' + rows + "</div>";
  },

  /* ================= ACCOUNTS ================= */
  accounts() {
    const s = Store.state;
    const t = computeTotals();
    if (!s.accounts.length) {
      return '<div class="section"><div class="empty"><div class="empty-glyph">▤</div>' +
        "<h3>No accounts yet</h3><p>Add your checking, savings, and investment accounts. FinanceOS will track interest automatically for any account with an APY.</p>" +
        '<button class="btn primary" data-action="add-account">+ Add your first account</button></div></div>';
    }

    const interestMo = s.accounts.reduce((a, x) => a + monthlyInterestEst(x), 0);
    const accruedTotal = s.accounts.reduce((a, x) => a + accruedInterest(x), 0);

    const stats =
      '<div class="grid cols-4 section">' +
        '<div class="stat"><span class="micro-label">Total across accounts</span><div class="stat-value">' + fmtMoney(t.accountsTotal) + "</div></div>" +
        '<div class="stat"><span class="micro-label">Earning interest</span><div class="stat-value">' + fmtMoney(s.accounts.filter(a => a.apy > 0).reduce((a, x) => a + Number(x.balance), 0)) + '</div><div class="stat-note">' + s.accounts.filter(a => a.apy > 0).length + " interest-bearing</div></div>" +
        '<div class="stat"><span class="micro-label">Est. interest / month</span><div class="stat-value pos">' + fmtMoney(interestMo, { sign: true }) + "</div></div>" +
        '<div class="stat"><span class="micro-label">Accrued since update</span><div class="stat-value gold">' + fmtMoney(accruedTotal, { sign: true }) + '</div><div class="stat-note">capitalize from each card below</div></div>' +
      "</div>";

    const cards = s.accounts.map(a => {
      const meta = ACCOUNT_TYPE_META[a.type] || ACCOUNT_TYPE_META.checking;
      const hasApy = Number(a.apy) > 0;
      const accrued = accruedInterest(a);
      const interest = hasApy
        ? '<div class="acct-interest">' +
            '<div class="ai-item"><span class="micro-label">Daily</span><span class="ai-val">' + fmtMoney(dailyInterest(a), { sign: true }) + "</span></div>" +
            '<div class="ai-item"><span class="micro-label">Monthly</span><span class="ai-val">' + fmtMoney(monthlyInterestEst(a), { sign: true }) + "</span></div>" +
            '<div class="ai-item"><span class="micro-label">Yearly</span><span class="ai-val">' + fmtMoney(yearlyInterestEst(a), { sign: true }) + "</span></div>" +
          "</div>" +
          '<div class="acct-foot">' +
            '<span class="accrued-note">accrued ' + fmtMoney(accrued, { sign: true }) + " since " + fmtDateShort(parseISO(a.balanceAsOf) || todayMid()) + "</span>" +
            (accrued >= 0.01 ? '<button class="btn small ghost" data-action="capitalize" data-id="' + a.id + '" title="Add accrued interest to the balance">Capitalize</button>' : "") +
          "</div>"
        : "";
      return '<div class="acct-card">' +
        '<div class="acct-head"><div><div class="acct-name">' + esc(a.name) + '</div><div class="acct-inst">' + esc(a.institution || "—") + "</div></div>" +
        '<div style="display:flex;gap:2px;align-items:center">' +
          '<span class="tag ' + meta.tag + '">' + meta.label + (hasApy ? " · " + a.apy + "%" : "") + "</span>" +
          '<button class="icon-btn" data-action="edit-account" data-id="' + a.id + '" title="Edit">✎</button>' +
          '<button class="icon-btn danger" data-action="del-account" data-id="' + a.id + '" title="Delete">✕</button>' +
        "</div></div>" +
        '<div class="acct-balance">' + fmtMoney(a.balance) + "</div>" +
        interest +
      "</div>";
    }).join("");

    return stats + '<div class="grid cols-2 section">' + cards + "</div>";
  },

  /* ================= CREDIT CARDS ================= */
  cards() {
    const s = Store.state;
    if (!s.cards.length) {
      return '<div class="section"><div class="empty"><div class="empty-glyph">▭</div>' +
        "<h3>No credit cards yet</h3><p>Track limits, balances, statement cut dates and payment due dates — with alerts before anything is due.</p>" +
        '<button class="btn primary" data-action="add-card">+ Add your first card</button></div></div>';
    }
    const t = computeTotals();
    const totalUtil = t.creditLimit ? t.debt / t.creditLimit : 0;

    const stats =
      '<div class="grid cols-4 section">' +
        '<div class="stat"><span class="micro-label">Total owed</span><div class="stat-value ' + (t.debt > 0 ? "neg" : "") + '">' + fmtMoney(t.debt) + "</div></div>" +
        '<div class="stat"><span class="micro-label">Total limit</span><div class="stat-value">' + fmtMoney(t.creditLimit) + "</div></div>" +
        '<div class="stat"><span class="micro-label">Available credit</span><div class="stat-value pos">' + fmtMoney(Math.max(0, t.creditLimit - t.debt)) + "</div></div>" +
        '<div class="stat"><span class="micro-label">Overall utilization</span><div class="stat-value ' + (totalUtil >= 0.7 ? "neg" : totalUtil >= 0.3 ? "gold" : "") + '">' + Math.round(totalUtil * 100) + "%</div><div class=\"stat-note\">aim for under 30%</div></div>" +
      "</div>";

    const cardsHtml = s.cards.map(c => {
      const util = cardUtilization(c);
      const cut = nextCardDate(c.cutDay), pay = nextCardDate(c.payDay);
      const dCut = daysUntil(cut), dPay = daysUntil(pay);
      const utilClass = util >= 0.7 ? "danger" : util >= 0.3 ? "warn" : "";
      const pillClass = dd => dd <= 2 ? " due-now" : dd <= 7 ? " due-soon" : "";
      return '<div class="ccard ' + esc(c.color || "c-forest") + '">' +
        '<div class="ccard-actions">' +
          '<button class="icon-btn" data-action="edit-card" data-id="' + c.id + '" title="Edit">✎</button>' +
          '<button class="icon-btn danger" data-action="del-card" data-id="' + c.id + '" title="Delete">✕</button>' +
        "</div>" +
        '<div class="ccard-top"><div>' +
          '<div class="ccard-issuer">' + esc(c.issuer || "Credit Card") + "</div>" +
          '<div class="ccard-name">' + esc(c.name) + "</div>" +
        "</div></div>" +
        '<div class="ccard-balance-row">' +
          '<div><span class="micro-label">Balance</span><div class="ccard-balance">' + fmtMoney(c.balance) + "</div></div>" +
          '<div class="ccard-limit">limit ' + fmtMoney(c.limit, { compact: true }) +
            (c.apr ? " · APR " + c.apr + "%" : "") + "</div>" +
        "</div>" +
        '<div class="util-track"><div class="util-fill ' + utilClass + '" style="width:' + Math.min(100, util * 100).toFixed(1) + '%"></div></div>' +
        '<div class="accrued-note" style="margin-top:6px">' + Math.round(util * 100) + "% used · " + fmtMoney(Math.max(0, c.limit - c.balance), { compact: true }) + " available</div>" +
        '<div class="ccard-dates">' +
          '<div class="date-pill' + pillClass(dCut) + '"><span class="micro-label">Statement cut</span>' +
            '<span class="dp-val">' + fmtDateShort(cut) + '</span> <span class="dp-in">' + (dCut === 0 ? "today" : "in " + dCut + "d") + "</span></div>" +
          '<div class="date-pill' + pillClass(dPay) + '"><span class="micro-label">Payment due</span>' +
            '<span class="dp-val">' + fmtDateShort(pay) + '</span> <span class="dp-in">' + (dPay === 0 ? "today" : "in " + dPay + "d") + "</span></div>" +
        "</div>" +
      "</div>";
    }).join("");

    return stats + '<div class="grid cols-2 section">' + cardsHtml + "</div>";
  },

  /* ================= PORTFOLIO ================= */
  portfolio() {
    const s = Store.state;
    if (!s.holdings.length) {
      return '<div class="section"><div class="empty"><div class="empty-glyph">◮</div>' +
        "<h3>No positions yet</h3><p>Add the stocks and ETFs you own with the price you paid. FinanceOS computes your returns as you update prices.</p>" +
        '<button class="btn primary" data-action="add-holding">+ Add your first position</button></div></div>';
    }
    const t = computeTotals();
    const retPct = t.invested ? t.pnl / t.invested * 100 : 0;

    let best = null, worst = null;
    s.holdings.forEach(h => {
      const cost = h.shares * h.costBasis;
      if (!cost) return;
      const p = (h.shares * h.currentPrice - cost) / cost * 100;
      if (!best || p > best.p) best = { h, p };
      if (!worst || p < worst.p) worst = { h, p };
    });

    const stats =
      '<div class="grid cols-4 section">' +
        '<div class="stat"><span class="micro-label">Market value</span><div class="stat-value">' + fmtMoney(t.marketValue) + "</div></div>" +
        '<div class="stat"><span class="micro-label">Total invested</span><div class="stat-value">' + fmtMoney(t.invested) + "</div></div>" +
        '<div class="stat"><span class="micro-label">Total return</span><div class="stat-value ' + (t.pnl >= 0 ? "pos" : "neg") + '">' + fmtMoney(t.pnl, { sign: true }) + '</div><div class="stat-note ' + (t.pnl >= 0 ? "pos" : "neg") + '">' + fmtPct(retPct) + "</div></div>" +
        '<div class="stat"><span class="micro-label">Best / Worst</span><div class="stat-value" style="font-size:17px;line-height:1.5">' +
          (best ? '<span class="pos">' + esc(best.h.symbol) + " " + fmtPct(best.p, 1) + "</span><br>" : "") +
          (worst && worst.h !== (best && best.h) ? '<span class="neg">' + esc(worst.h.symbol) + " " + fmtPct(worst.p, 1) + "</span>" : "") +
        "</div></div>" +
      "</div>";

    // allocation bar
    const sorted = s.holdings.slice().sort((a, b) => b.shares * b.currentPrice - a.shares * a.currentPrice);
    const mvTotal = t.marketValue || 1;
    const alloc =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Allocation</div>' +
      '<span class="panel-sub">' + s.holdings.length + " positions</span></div>" +
      '<div class="alloc-bar">' +
      sorted.map((h, i) =>
        '<span style="width:' + (h.shares * h.currentPrice / mvTotal * 100).toFixed(2) + '%;background:' + CHART_COLORS[i % CHART_COLORS.length] + '" title="' + esc(h.symbol) + " " + (h.shares * h.currentPrice / mvTotal * 100).toFixed(1) + '%"></span>').join("") +
      "</div>" +
      '<div class="comp-legend" style="margin-top:14px">' +
      sorted.map((h, i) =>
        '<span class="lg"><span class="dot" style="background:' + CHART_COLORS[i % CHART_COLORS.length] + '"></span>' + esc(h.symbol) + " " + (h.shares * h.currentPrice / mvTotal * 100).toFixed(1) + "%</span>").join("") +
      "</div></div>";

    const rows = sorted.map(h => {
      const cost = h.shares * h.costBasis, mv = h.shares * h.currentPrice;
      const pnl = mv - cost, pct = cost ? pnl / cost * 100 : 0;
      return "<tr>" +
        '<td><div style="display:flex;align-items:center;gap:11px"><span class="sym-badge">' + esc(h.symbol.slice(0, 5)) + "</span>" +
          '<div><div class="cell-main">' + esc(h.name || h.symbol) + '</div><div class="cell-sub">' +
          (h.kind === "etf" ? "ETF" : "Stock") +
          (h.accountId ? " · " + esc(Store.accountName(h.accountId)) : "") +
          (h.purchaseDate ? " · since " + fmtDateShort(parseISO(h.purchaseDate)) : "") +
          "</div></div></div></td>" +
        '<td class="num">' + fmtNum(h.shares) + "</td>" +
        '<td class="num">' + fmtMoney(h.costBasis) + "</td>" +
        '<td class="num"><input class="price-input" type="number" step="any" min="0" value="' + h.currentPrice + '" data-price-id="' + h.id + '" title="Edit current price"></td>' +
        '<td class="num">' + fmtMoney(mv) + "</td>" +
        '<td class="num ' + (pnl >= 0 ? "pos" : "neg") + '">' + fmtMoney(pnl, { sign: true }) + '<div class="cell-sub ' + (pnl >= 0 ? "pos" : "neg") + '">' + fmtPct(pct) + "</div></td>" +
        '<td class="actions-cell">' +
          '<button class="icon-btn" data-action="edit-holding" data-id="' + h.id + '" title="Edit">✎</button>' +
          '<button class="icon-btn danger" data-action="del-holding" data-id="' + h.id + '" title="Delete">✕</button>' +
        "</td></tr>";
    }).join("");

    const table =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Positions</div>' +
      '<span class="panel-sub">edit the price column to refresh returns</span></div>' +
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr>' +
        "<th>Position</th><th class=\"num\">Shares</th><th class=\"num\">Paid</th><th class=\"num\">Price now</th><th class=\"num\">Value</th><th class=\"num\">Return</th><th></th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table></div></div>";

    return stats + alloc + table;
  },

  /* ================= EARNINGS ================= */
  earnings() {
    const s = Store.state;
    const t = computeTotals();
    const now = todayMid();

    const interestMo = s.accounts.reduce((a, x) => a + monthlyInterestEst(x), 0);
    const incomeMo = s.incomes.reduce((a, x) => a + monthlyEquivalent(x), 0);

    const stats =
      '<div class="grid cols-4 section">' +
        '<div class="stat"><span class="micro-label">Projected / month</span><div class="stat-value gold">' + fmtMoney(incomeMo + interestMo) + '</div><div class="stat-note">all streams + interest</div></div>' +
        '<div class="stat"><span class="micro-label">Scheduled income</span><div class="stat-value">' + fmtMoney(incomeMo) + '</div><div class="stat-note">' + s.incomes.length + " stream" + (s.incomes.length === 1 ? "" : "s") + "</div></div>" +
        '<div class="stat"><span class="micro-label">Interest / month</span><div class="stat-value pos">' + fmtMoney(interestMo, { sign: true }) + '</div><div class="stat-note">from ' + s.accounts.filter(a => a.apy > 0).length + " accounts</div></div>" +
        '<div class="stat"><span class="micro-label">Investment returns</span><div class="stat-value ' + (t.pnl >= 0 ? "pos" : "neg") + '">' + fmtMoney(t.pnl, { sign: true }) + '</div><div class="stat-note">unrealized, all time</div></div>' +
      "</div>";

    /* ---- 12-month projection chart ---- */
    const months = [];
    for (let i = 0; i < 12; i++) {
      const mStart = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
      let inc = 0;
      s.incomes.forEach(stream => {
        inc += incomeOccurrences(stream, mStart < now ? now : mStart, mEnd).length * Number(stream.amount);
      });
      months.push({ label: MONTHS_SHORT[mStart.getMonth()], income: inc, interest: interestMo });
    }
    const maxMonth = Math.max(...months.map(m => m.income + m.interest), 1);
    const chart =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">12-month income projection</div>' +
      '<div class="comp-legend" style="margin:0"><span class="lg"><span class="dot" style="background:var(--mint)"></span>Scheduled</span>' +
      '<span class="lg"><span class="dot" style="background:var(--gold)"></span>Interest</span></div></div>' +
      '<div class="chart-bars">' +
      months.map(m => {
        const hI = (m.income / maxMonth * 100).toFixed(1);
        const hT = (m.interest / maxMonth * 100).toFixed(1);
        return '<div class="cbar"><div class="bar-total">' + fmtMoney(m.income + m.interest, { compact: true }) + "</div>" +
          '<div class="bar-stack" style="height:' + Math.max(2, Number(hI) + Number(hT)).toFixed(1) + '%">' +
            '<div class="seg-income" style="flex:' + (m.income || 0.001) + '"></div>' +
            '<div class="seg-interest" style="flex:' + (m.interest || 0.001) + '"></div>' +
          "</div>" +
          '<div class="bar-label">' + m.label + "</div></div>";
      }).join("") +
      "</div></div>";

    /* ---- income streams management ---- */
    const streamsRows = s.incomes.length ? s.incomes.map(inc => {
      const next = incomeOccurrences(inc, now, new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()))[0];
      return "<tr>" +
        '<td><div class="cell-main">' + esc(inc.name) + '</div><div class="cell-sub">' + esc(inc.category || "Other") + " · " + freqLabel(inc) + "</div></td>" +
        "<td>" + esc(Store.accountName(inc.accountId)) + "</td>" +
        '<td class="num">' + fmtMoney(inc.amount) + "</td>" +
        '<td class="num">' + fmtMoney(monthlyEquivalent(inc)) + "</td>" +
        "<td>" + (next ? fmtDate(next) : "—") + "</td>" +
        '<td class="actions-cell">' +
          '<button class="icon-btn" data-action="edit-income" data-id="' + inc.id + '" title="Edit">✎</button>' +
          '<button class="icon-btn danger" data-action="del-income" data-id="' + inc.id + '" title="Delete">✕</button>' +
        "</td></tr>";
    }).join("") : '<tr><td colspan="6" style="color:var(--text-mute);text-align:center;padding:26px">No income streams yet — add your salary or other recurring income.</td></tr>';

    const streams =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Income streams</div>' +
      '<button class="btn small primary" data-action="add-income">+ Add stream</button></div>' +
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr>' +
        "<th>Stream</th><th>Deposits into</th><th class=\"num\">Per deposit</th><th class=\"num\">≈ Monthly</th><th>Next payment</th><th></th>" +
      "</tr></thead><tbody>" + streamsRows + "</tbody></table></div></div>";

    /* ---- interest by account ---- */
    const intAccounts = s.accounts.filter(a => Number(a.apy) > 0);
    const interestRows = intAccounts.length ? intAccounts.map(a =>
      "<tr>" +
        '<td><div class="cell-main">' + esc(a.name) + '</div><div class="cell-sub">' + esc(a.institution || "") + "</div></td>" +
        '<td class="num">' + fmtMoney(a.balance) + "</td>" +
        '<td class="num"><span class="tag mint">' + a.apy + "% APY</span></td>" +
        '<td class="num pos">' + fmtMoney(dailyInterest(a), { sign: true }) + "</td>" +
        '<td class="num pos">' + fmtMoney(monthlyInterestEst(a), { sign: true }) + "</td>" +
        '<td class="num pos">' + fmtMoney(yearlyInterestEst(a), { sign: true }) + "</td>" +
      "</tr>").join("") :
      '<tr><td colspan="6" style="color:var(--text-mute);text-align:center;padding:26px">No interest-bearing accounts. Set an APY on a savings account to see projections here.</td></tr>';

    const interestPanel =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Interest engine</div>' +
      '<span class="panel-sub">compounding estimates per account</span></div>' +
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr>' +
        "<th>Account</th><th class=\"num\">Balance</th><th class=\"num\">Rate</th><th class=\"num\">Daily</th><th class=\"num\">Monthly</th><th class=\"num\">Yearly</th>" +
      "</tr></thead><tbody>" + interestRows + "</tbody></table></div></div>";

    /* ---- 30-day timeline ---- */
    const to = new Date(now); to.setDate(to.getDate() + 30);
    const events = [];
    s.incomes.forEach(inc => {
      incomeOccurrences(inc, now, to).forEach(d => events.push({
        d, name: inc.name, sub: esc(inc.category || "Income") + " → " + esc(Store.accountName(inc.accountId)),
        amount: Number(inc.amount),
      }));
    });
    // interest credited at month-end for each interest-bearing account
    intAccounts.forEach(a => {
      for (let i = 0; i <= 1; i++) {
        const eom = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
        if (eom >= now && eom <= to) events.push({
          d: eom, name: "Interest — " + a.name, sub: a.apy + "% APY → " + esc(a.name),
          amount: monthlyInterestEst(a), interest: true,
        });
      }
    });
    events.sort((a, b) => a.d - b.d);
    const timelineRows = events.length ? events.map(ev =>
      '<div class="tl-row">' +
        '<div class="tl-date"><strong>' + fmtDateShort(ev.d) + "</strong>" + (daysUntil(ev.d) === 0 ? "today" : "in " + daysUntil(ev.d) + "d") + "</div>" +
        '<div class="tl-desc"><div class="cell-main">' + esc(ev.name) + '</div><div class="cell-sub">' + ev.sub + "</div></div>" +
        '<div class="tl-amount">' + fmtMoney(ev.amount, { sign: true }) + "</div>" +
      "</div>").join("") :
      '<div class="all-clear" style="color:var(--text-mute)">Nothing scheduled in the next 30 days.</div>';

    const total30 = events.reduce((a, e) => a + e.amount, 0);
    const timeline =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Next 30 days</div>' +
      '<span class="panel-sub">' + fmtMoney(total30, { sign: true }) + " expected</span></div>" +
      '<div class="timeline">' + timelineRows + "</div></div>";

    return stats + chart + '<div class="grid cols-2 section" style="align-items:start">' + streams + timeline + "</div>" + interestPanel;
  },

  /* ================= MILESTONES ================= */
  milestones() {
    const s = Store.state;
    const hasAnything = s.accounts.length || s.cards.length || s.holdings.length || s.incomes.length;
    if (!hasAnything) {
      return '<div class="section"><div class="empty"><div class="empty-glyph">✶</div>' +
        "<h3>Nothing to measure yet</h3><p>Add your accounts, portfolio and income streams first — then come back to see where you stand globally and which achievements you've unlocked.</p>" +
        '<button class="btn primary" data-action="nav" data-page="accounts">Start with an account</button></div></div>';
    }

    const ctx = achievementContext();
    const earned = ACHIEVEMENTS.filter(a => { try { return a.test(ctx); } catch (e) { return false; } });
    const earnedIds = new Set(earned.map(a => a.id));

    const pctCard = (label, pct, valueDisplay, table, currentUSD, breakdownHtml) => {
      const next = nextMilestone(pct, table);
      const nextLine = next
        ? "≈ " + fmtMoney(Math.max(0, fromUSD(next.usd - currentUSD)), { compact: true }) + " more to reach <strong>" + next.label + "</strong>"
        : "You're at the summit — top 0.1% worldwide";
      return '<div class="pct-card">' +
        '<span class="micro-label">' + label + "</span>" +
        '<div class="pct-big">' + topShareLabel(pct) + "</div>" +
        '<div class="pct-sub">higher than <strong>' + Math.min(99.99, pct).toFixed(pct >= 99 ? 2 : 0) + "%</strong> of adults worldwide · " + valueDisplay + "</div>" +
        '<div class="pct-track"><div class="pct-fill" style="width:' + Math.min(100, pct).toFixed(1) + '%"></div>' +
          '<span class="pct-mark" style="left:50%" title="Global median"></span>' +
          '<span class="pct-mark" style="left:90%" title="Top 10%"></span>' +
          '<span class="pct-mark" style="left:99%" title="Top 1%"></span></div>' +
        '<div class="pct-scale"><span>median</span><span>top 10%</span><span>top 1%</span></div>' +
        '<div class="pct-next">' + nextLine + "</div>" +
        (breakdownHtml || "") +
      "</div>";
    };

    const eb = ctx.eb;
    const ebRows =
      '<div class="pct-breakdown">' +
        '<span>Scheduled income <em>' + fmtMoney(eb.scheduled, { compact: true }) + "/yr</em></span>" +
        '<span>Interest <em>' + fmtMoney(eb.interest, { compact: true }) + "/yr</em></span>" +
        '<span>Investments <em class="' + (eb.invest >= 0 ? "pos" : "neg") + '">' + fmtMoney(eb.invest, { sign: true, compact: true }) + "/yr</em></span>" +
      "</div>";

    const standing =
      '<div class="grid cols-2 section">' +
        pctCard("Global standing — net worth", ctx.nwPct, fmtMoney(ctx.t.netWorth, { compact: true }), NETWORTH_PCT_TABLE, toUSD(ctx.t.netWorth), "") +
        pctCard("Global standing — annual earnings", ctx.incPct, fmtMoney(eb.total, { compact: true }) + "/yr", INCOME_PCT_TABLE, toUSD(eb.total), ebRows) +
      "</div>";

    const badges =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Achievements</div>' +
      '<span class="panel-sub">' + earned.length + " of " + ACHIEVEMENTS.length + " unlocked</span></div>" +
      '<div class="badge-grid">' +
      ACHIEVEMENTS.map(a => {
        const got = earnedIds.has(a.id);
        return '<div class="badge' + (got ? " earned" : "") + '">' +
          '<div class="badge-icon">' + a.icon + "</div>" +
          '<div><div class="badge-title">' + a.title + (got ? "" : ' <span class="badge-lock">locked</span>') + "</div>" +
          '<div class="badge-desc">' + a.desc + "</div></div></div>";
      }).join("") +
      "</div></div>";

    const method =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">How this is estimated</div></div>' +
      '<p class="method-note">Percentiles compare you against the <strong>global adult population</strong>, interpolated from public datasets (UBS/Credit Suisse Global Wealth Report and the World Inequality Database, ~2024). Your figures are converted to USD at approximate fixed rates. Annual earnings = scheduled income + projected interest + investment returns annualized over each position\'s holding period. These are rough, directional estimates for motivation — not financial statistics about you.</p></div>';

    return standing + badges + method;
  },

  /* ================= GUIDE ================= */
  guide() {
    const card = (glyph, title, items) =>
      '<div class="guide-card"><div class="guide-glyph">' + glyph + '</div><h3>' + title + "</h3><ul>" +
      items.map(i => "<li>" + i + "</li>").join("") + "</ul></div>";

    const steps =
      '<div class="panel section guide-intro">' +
        '<div class="panel-head"><div class="panel-title">Three steps to total clarity</div></div>' +
        '<div class="guide-steps">' +
          '<div class="g-step"><span class="step-num">1</span><strong>Add what you have.</strong> Your bank accounts (with their interest rate), credit cards, and the stocks or ETFs you own with the price you paid.</div>' +
          '<div class="g-step"><span class="step-num">2</span><strong>Add what comes in.</strong> Salaries and any recurring income, each mapped to the account that receives it and the dates it arrives.</div>' +
          '<div class="g-step"><span class="step-num">3</span><strong>Check in weekly.</strong> Update portfolio prices and card balances. FinanceOS recalculates everything else — interest, returns, alerts and your global standing.</div>' +
        "</div></div>";

    const cards =
      '<div class="guide-grid section">' +
      card("▤", "Accounts & interest", [
        "Set the <strong>APY %</strong> on savings accounts and FinanceOS projects daily, monthly and yearly interest automatically.",
        "The <em>accrued</em> line shows interest earned since you last updated the balance (daily compounding).",
        "Press <strong>Capitalize</strong> when your bank actually credits the interest — it folds the accrual into the balance.",
        "Updating a balance resets the accrual clock to today.",
      ]) +
      card("▭", "Credit cards", [
        "<strong>Statement cut</strong> is when the bank closes your bill; <strong>payment due</strong> is the deadline to pay it. FinanceOS counts down to both.",
        "Alerts fire 5 days before the cut and 7 days before payment is due.",
        "The colored bar is your <strong>utilization</strong> (balance ÷ limit). Keep it under 30% — it goes gold above 30% and red above 70%.",
        "Tip: big purchases made right <em>after</em> the cut date give you the longest interest-free period.",
      ]) +
      card("◮", "Portfolio", [
        "Add each stock or ETF with the <strong>shares and average price you paid</strong>.",
        "Edit the <strong>Price now</strong> column anytime — returns, allocation and net worth update instantly.",
        "Positions can be linked to an investment account to keep everything organized.",
        "The Overview flags any position down more than 10%.",
      ]) +
      card("✦", "Earnings", [
        "Income streams support <strong>monthly</strong> (any day), <strong>every 15 days</strong> (15th & month-end), <strong>every 14 days</strong> and <strong>weekly</strong> schedules.",
        "Each stream is mapped to the account that receives it — the 30-day timeline shows exactly what lands where, and when.",
        "Interest from your accounts appears in the timeline as a month-end credit.",
        "The 12-month chart projects scheduled income + interest, prorating the current month.",
      ]) +
      card("✶", "Milestones", [
        "See your estimated <strong>global percentile</strong> for net worth and total annual earnings (all sources combined).",
        "Unlock achievements for healthy habits — low utilization, an emergency fund, a diversified portfolio.",
        "Percentiles are rough estimates from public global wealth data, for motivation only.",
      ]) +
      card("⛨", "Keep your data safe", [
        "Everything lives <strong>only in this browser</strong> — nothing is ever sent anywhere.",
        "Turn on the <strong>PIN lock</strong> (⋯ menu) to encrypt your data with AES-256. No PIN, no data — so don't forget it.",
        "Use the <strong>eye button</strong> to blur all amounts when someone's looking over your shoulder.",
        "Export a <strong>.json backup</strong> regularly (⋯ menu) — backups are unencrypted, store them somewhere safe. Clearing browser data erases the app's storage.",
      ]) +
      "</div>";

    const faq =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Good to know</div></div>' +
      '<p class="method-note"><strong>Where is my data?</strong> In your browser\'s local storage on this device, under the key <code>financeos_v1</code>. ' +
      "<strong>Can I move it?</strong> Yes — export on one device, import on another. " +
      "<strong>What does the currency switch do?</strong> It changes display formatting and the USD conversion used for milestones; it doesn't convert your numbers. " +
      "<strong>Forgot your PIN?</strong> Encrypted data can't be recovered — use the erase option on the lock screen and import your latest backup.</p></div>";

    return steps + cards + faq;
  },
};
