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

    // monthly cash-flow estimate (net of taxes)
    const eb = earningsBreakdown();

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
          '<div class="alert-meta">' + fmtDate(u.d) + (u.inc.amountType === "gross" && u.inc.taxRate > 0 ? " · net of " + u.inc.taxRate + "% tax" : "") + "</div></div>" +
          '<div class="tl-amount" style="margin-left:auto">' + fmtMoney(conv(netPerDeposit(u.inc), u.inc.currency), { sign: true }) + "</div></div>"
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
        '<div class="stat"><span class="micro-label">Monthly income (net)</span><div class="stat-value gold">' + fmtMoney(eb.monthlyNet) + '</div><div class="stat-note">after tax · incl. interest & dividends</div></div>' +
      "</div>" +

      this._nwChartPanel() +

      '<div class="grid cols-2 section">' +
        '<div class="panel"><div class="panel-head"><div class="panel-title">Incoming — next 14 days</div>' +
        '<button class="btn small ghost" data-action="nav" data-page="earnings">View all →</button></div>' + upcomingHtml + "</div>" +
        this._topHoldingsPanel() +
      "</div>"
    );
  },

  /* SVG net-worth history line (snapshots stored in USD, drawn in display currency) */
  _nwChartPanel() {
    const snaps = Store.state.snapshots || [];
    if (snaps.length < 2) {
      return '<div class="panel section"><div class="panel-head"><div class="panel-title">Net worth over time</div></div>' +
        '<div class="all-clear" style="color:var(--text-mute)">Your history starts today — FinanceOS saves one snapshot per day. Come back tomorrow to see the line take shape.</div></div>';
    }
    const pts = snaps.map(x => fromUSD(x.usd));
    const min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
    const span = (max - min) || 1;
    const W = 1000, H = 220, PAD = 8;
    const xy = pts.map((v, i) => [
      PAD + i * (W - 2 * PAD) / (pts.length - 1),
      H - PAD - (v - min) / span * (H - 2 * PAD),
    ]);
    const line = xy.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    const area = line + " " + (W - PAD) + "," + (H - PAD) + " " + PAD + "," + (H - PAD);
    const first = pts[0], lastV = pts[pts.length - 1];
    const change = lastV - first;
    const changePct = first ? change / Math.abs(first) * 100 : 0;
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Net worth over time</div>' +
      '<span class="panel-sub ' + (change >= 0 ? "pos" : "neg") + '">' + fmtMoney(change, { sign: true, compact: true }) + " (" + fmtPct(changePct, 1) + ") · " + snaps.length + " days</span></div>" +
      '<svg class="nw-chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' +
        '<defs><linearGradient id="nwfill" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="rgba(143,227,166,0.28)"/><stop offset="100%" stop-color="rgba(143,227,166,0)"/>' +
        "</linearGradient></defs>" +
        '<polygon points="' + area + '" fill="url(#nwfill)"/>' +
        '<polyline points="' + line + '" fill="none" stroke="#8fe3a6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      "</svg>" +
      '<div class="nw-chart-scale"><span>' + fmtDateShort(parseISO(snaps[0].d)) + " · " + fmtMoney(first, { compact: true }) + "</span>" +
      "<span>today · " + fmtMoney(lastV, { compact: true }) + "</span></div></div>";
  },

  _topHoldingsPanel() {
    const hs = Store.state.holdings.slice().sort((a, b) =>
      conv(b.shares * b.currentPrice, b.currency) - conv(a.shares * a.currentPrice, a.currency)).slice(0, 5);
    if (!hs.length) {
      return '<div class="panel"><div class="panel-head"><div class="panel-title">Portfolio snapshot</div></div>' +
        '<div class="all-clear" style="color:var(--text-mute)">No positions yet — add stocks or ETFs in Portfolio.</div></div>';
    }
    const rows = hs.map(h => {
      const mv = conv(h.shares * h.currentPrice, h.currency), cost = conv(h.shares * h.costBasis, h.currency);
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

    const taxI = (s.settings.tax && Number(s.settings.tax.interest)) || 0;
    const netF = 1 - taxI / 100;
    const interestMo = s.accounts.reduce((a, x) => a + conv(monthlyInterestEst(x), x.currency), 0);
    const accruedTotal = s.accounts.reduce((a, x) => a + conv(accruedInterest(x), x.currency), 0);

    const stats =
      '<div class="grid cols-4 section">' +
        '<div class="stat"><span class="micro-label">Total across accounts</span><div class="stat-value">' + fmtMoney(t.accountsTotal) + "</div></div>" +
        '<div class="stat"><span class="micro-label">Earning interest</span><div class="stat-value">' + fmtMoney(s.accounts.filter(a => a.apy > 0).reduce((a, x) => a + conv(Number(x.balance), x.currency), 0)) + '</div><div class="stat-note">' + s.accounts.filter(a => a.apy > 0).length + " interest-bearing</div></div>" +
        '<div class="stat"><span class="micro-label">Est. interest / month</span><div class="stat-value pos">' + fmtMoney(interestMo * netF, { sign: true }) + '</div><div class="stat-note">' + (taxI > 0 ? "net of " + taxI + "% tax · gross " + fmtMoney(interestMo, { compact: true }) : "set a tax rate in Settings if withheld") + "</div></div>" +
        '<div class="stat"><span class="micro-label">Accrued since update</span><div class="stat-value gold">' + fmtMoney(accruedTotal, { sign: true }) + '</div><div class="stat-note">capitalize from each card below</div></div>' +
      "</div>";

    const cards = s.accounts.map(a => {
      const meta = ACCOUNT_TYPE_META[a.type] || ACCOUNT_TYPE_META.checking;
      const hasApy = Number(a.apy) > 0;
      const accrued = accruedInterest(a);
      const foreign = a.currency !== s.settings.currency;
      const interest = hasApy
        ? '<div class="acct-interest">' +
            '<div class="ai-item"><span class="micro-label">Daily' + (taxI > 0 ? " net" : "") + '</span><span class="ai-val">' + fmtMoneyIn(dailyInterest(a) * netF, a.currency, { sign: true }) + "</span></div>" +
            '<div class="ai-item"><span class="micro-label">Monthly' + (taxI > 0 ? " net" : "") + '</span><span class="ai-val">' + fmtMoneyIn(monthlyInterestEst(a) * netF, a.currency, { sign: true }) + "</span></div>" +
            '<div class="ai-item"><span class="micro-label">Yearly' + (taxI > 0 ? " net" : "") + '</span><span class="ai-val">' + fmtMoneyIn(yearlyInterestEst(a) * netF, a.currency, { sign: true }) + "</span></div>" +
          "</div>" +
          '<div class="acct-sched">' +
            '<span class="micro-label">Paid ' + esc(interestScheduleLabel(a)) + "</span>" +
            '<span class="sched-next">next ' + fmtDateShort(nextInterestDate(a)) +
              ' · <span class="pos">' + fmtMoneyIn(interestPerPeriod(a) * netF, a.currency, { sign: true }) + "</span></span>" +
          "</div>" +
          '<div class="acct-foot">' +
            '<span class="accrued-note">accrued ' + fmtMoneyIn(accrued * netF, a.currency, { sign: true }) + (taxI > 0 ? " (after " + taxI + "% tax)" : "") + " since " + fmtDateShort(parseISO(a.balanceAsOf) || todayMid()) + "</span>" +
            (accrued * netF >= 0.01 ? '<button class="btn small ghost" data-action="capitalize" data-id="' + a.id + '" title="Add accrued net interest to the balance">Capitalize</button>' : "") +
          "</div>"
        : "";
      return '<div class="acct-card">' +
        '<div class="acct-head"><div><div class="acct-name">' + esc(a.name) + '</div><div class="acct-inst">' + esc(a.institution || "—") + "</div></div>" +
        '<div style="display:flex;gap:2px;align-items:center">' +
          '<span class="tag ' + meta.tag + '">' + meta.label + " · " + a.currency + (hasApy ? " · " + a.apy + "%" : "") + "</span>" +
          '<button class="icon-btn" data-action="edit-account" data-id="' + a.id + '" title="Edit">✎</button>' +
          '<button class="icon-btn danger" data-action="del-account" data-id="' + a.id + '" title="Delete">✕</button>' +
        "</div></div>" +
        '<div class="acct-balance">' + fmtMoneyIn(a.balance, a.currency) +
          (foreign ? '<span class="fx-sub">≈ ' + fmtMoney(conv(a.balance, a.currency)) + "</span>" : "") + "</div>" +
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
          '<div><span class="micro-label">Balance</span><div class="ccard-balance">' + fmtMoneyIn(c.balance, c.currency) +
            (c.currency !== Store.state.settings.currency ? '<span class="fx-sub">≈ ' + fmtMoney(conv(c.balance, c.currency)) + "</span>" : "") + "</div></div>" +
          '<div class="ccard-limit">limit ' + fmtMoneyIn(c.limit, c.currency, { compact: true }) +
            (c.apr ? " · APR " + c.apr + "%" : "") + "</div>" +
        "</div>" +
        '<div class="util-track"><div class="util-fill ' + utilClass + '" style="width:' + Math.min(100, util * 100).toFixed(1) + '%"></div></div>' +
        '<div class="accrued-note" style="margin-top:6px">' + Math.round(util * 100) + "% used · " + fmtMoneyIn(Math.max(0, c.limit - c.balance), c.currency, { compact: true }) + " available</div>" +
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
    const taxCG = (s.settings.tax && Number(s.settings.tax.capGains)) || 0;
    const pnlAfterTax = t.pnl > 0 ? t.pnl * (1 - taxCG / 100) : t.pnl;

    let best = null, worst = null;
    s.holdings.forEach(h => {
      const cost = h.shares * h.costBasis;
      if (!cost) return;
      const p = (h.shares * h.currentPrice - cost) / cost * 100;
      if (!best || p > best.p) best = { h, p };
      if (!worst || p < worst.p) worst = { h, p };
    });

    const syncNote = s.settings.lastQuoteSync
      ? "prices synced " + fmtDateShort(parseISO(s.settings.lastQuoteSync))
      : "press ↻ Update prices for live quotes & dividends — no key needed";

    const stats =
      '<div class="grid cols-4 section">' +
        '<div class="stat"><span class="micro-label">Market value</span><div class="stat-value">' + fmtMoney(t.marketValue) + '</div><div class="stat-note">' + syncNote + "</div></div>" +
        '<div class="stat"><span class="micro-label">Total invested</span><div class="stat-value">' + fmtMoney(t.invested) + "</div></div>" +
        '<div class="stat"><span class="micro-label">Total return</span><div class="stat-value ' + (t.pnl >= 0 ? "pos" : "neg") + '">' + fmtMoney(t.pnl, { sign: true }) + '</div><div class="stat-note ' + (t.pnl >= 0 ? "pos" : "neg") + '">' + fmtPct(retPct) +
          (taxCG > 0 && t.pnl > 0 ? ' · <span style="color:var(--text-mute)">' + fmtMoney(pnlAfterTax, { sign: true }) + " after " + taxCG + "% tax</span>" : "") + "</div></div>" +
        '<div class="stat"><span class="micro-label">Best / Worst</span><div class="stat-value" style="font-size:17px;line-height:1.5">' +
          (best ? '<span class="pos">' + esc(best.h.symbol) + " " + fmtPct(best.p, 1) + "</span><br>" : "") +
          (worst && worst.h !== (best && best.h) ? '<span class="neg">' + esc(worst.h.symbol) + " " + fmtPct(worst.p, 1) + "</span>" : "") +
        "</div></div>" +
      "</div>";

    // allocation bar (weights in display currency)
    const sorted = s.holdings.slice().sort((a, b) =>
      conv(b.shares * b.currentPrice, b.currency) - conv(a.shares * a.currentPrice, a.currency));
    const mvTotal = t.marketValue || 1;
    const weight = h => conv(h.shares * h.currentPrice, h.currency) / mvTotal * 100;
    const alloc =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Allocation</div>' +
      '<span class="panel-sub">' + s.holdings.length + " positions</span></div>" +
      '<div class="alloc-bar">' +
      sorted.map((h, i) =>
        '<span style="width:' + weight(h).toFixed(2) + '%;background:' + CHART_COLORS[i % CHART_COLORS.length] + '" title="' + esc(h.symbol) + " " + weight(h).toFixed(1) + '%"></span>').join("") +
      "</div>" +
      '<div class="comp-legend" style="margin-top:14px">' +
      sorted.map((h, i) =>
        '<span class="lg"><span class="dot" style="background:' + CHART_COLORS[i % CHART_COLORS.length] + '"></span>' + esc(h.symbol) + " " + weight(h).toFixed(1) + "%</span>").join("") +
      "</div></div>";

    const rows = sorted.map(h => {
      const cost = conv(h.shares * h.costBasis, h.currency), mv = conv(h.shares * h.currentPrice, h.currency);
      const pnl = mv - cost, pct = cost ? pnl / cost * 100 : 0;
      return "<tr>" +
        '<td><div style="display:flex;align-items:center;gap:11px"><span class="sym-badge">' + esc(h.symbol.slice(0, 5)) + "</span>" +
          '<div><div class="cell-main">' + esc(h.name || h.symbol) + '</div><div class="cell-sub">' +
          (h.kind === "etf" ? "ETF" : "Stock") + " · " + esc(h.currency) +
          (Number(h.divPerShare) > 0 ? " · div " + fmtMoneyIn(h.divPerShare, h.currency) + "/sh" : "") +
          (h.accountId ? " · " + esc(Store.accountName(h.accountId)) : "") +
          (h.purchaseDate ? " · since " + fmtDateShort(parseISO(h.purchaseDate)) : "") +
          "</div></div></div></td>" +
        '<td class="num">' + fmtNum(h.shares) + "</td>" +
        '<td class="num">' + fmtMoneyIn(h.costBasis, h.currency) + "</td>" +
        '<td class="num"><input class="price-input" type="number" step="any" min="0" value="' + h.currentPrice + '" data-price-id="' + h.id + '" title="Edit current price (' + esc(h.currency) + ')"></td>' +
        '<td class="num">' + fmtMoney(mv) + "</td>" +
        '<td class="num ' + (pnl >= 0 ? "pos" : "neg") + '">' + fmtMoney(pnl, { sign: true }) + '<div class="cell-sub ' + (pnl >= 0 ? "pos" : "neg") + '">' + fmtPct(pct) + "</div></td>" +
        '<td class="actions-cell">' +
          '<button class="icon-btn" data-action="edit-holding" data-id="' + h.id + '" title="Edit">✎</button>' +
          '<button class="icon-btn danger" data-action="del-holding" data-id="' + h.id + '" title="Delete">✕</button>' +
        "</td></tr>";
    }).join("");

    const table =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Positions</div>' +
      '<span class="panel-sub">Paid &amp; Price in each listing\'s currency · Value &amp; Return in ' + esc(s.settings.currency) + "</span></div>" +
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

    const eb = earningsBreakdown();
    const tax = s.settings.tax || { interest: 0, dividends: 0, capGains: 0 };
    const passiveMo = (eb.intNet + eb.divNet) / 12;

    const stats =
      '<div class="grid cols-4 section">' +
        '<div class="stat"><span class="micro-label">Projected / month (net)</span><div class="stat-value gold">' + fmtMoney(eb.monthlyNet) + '</div><div class="stat-note">after tax · gross ' + fmtMoney((eb.schedGross + eb.intGross + eb.divGross) / 12, { compact: true }) + "</div></div>" +
        '<div class="stat"><span class="micro-label">Scheduled income (net)</span><div class="stat-value">' + fmtMoney(eb.schedNet / 12) + '</div><div class="stat-note">' + s.incomes.length + " stream" + (s.incomes.length === 1 ? "" : "s") + " · gross " + fmtMoney(eb.schedGross / 12, { compact: true }) + "</div></div>" +
        '<div class="stat"><span class="micro-label">Passive / month (net)</span><div class="stat-value pos">' + fmtMoney(passiveMo, { sign: true }) + '</div><div class="stat-note">interest ' + fmtMoney(eb.intNet / 12, { compact: true }) + " + dividends " + fmtMoney(eb.divNet / 12, { compact: true }) + "</div></div>" +
        '<div class="stat"><span class="micro-label">Investment returns</span><div class="stat-value ' + (t.pnl >= 0 ? "pos" : "neg") + '">' + fmtMoney(t.pnl, { sign: true }) + '</div><div class="stat-note">unrealized' + (tax.capGains > 0 && t.pnl > 0 ? " · " + fmtMoney(t.pnl * (1 - tax.capGains / 100), { sign: true, compact: true }) + " after tax" : ", all time") + "</div></div>" +
      "</div>";

    /* ---- 12-month projection chart (net of taxes) ---- */
    const months = [];
    for (let i = 0; i < 12; i++) {
      const mStart = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
      let inc = 0;
      s.incomes.forEach(stream => {
        inc += incomeOccurrences(stream, mStart < now ? now : mStart, mEnd).length * conv(netPerDeposit(stream), stream.currency);
      });
      months.push({ label: MONTHS_SHORT[mStart.getMonth()], income: inc, passive: passiveMo });
    }
    const maxMonth = Math.max(...months.map(m => m.income + m.passive), 1);
    const chart =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">12-month income projection <span class="panel-sub">net of taxes</span></div>' +
      '<div class="comp-legend" style="margin:0"><span class="lg"><span class="dot" style="background:var(--mint)"></span>Scheduled</span>' +
      '<span class="lg"><span class="dot" style="background:var(--gold)"></span>Interest + dividends</span></div></div>' +
      '<div class="chart-bars">' +
      months.map(m => {
        const hI = (m.income / maxMonth * 100).toFixed(1);
        const hT = (m.passive / maxMonth * 100).toFixed(1);
        return '<div class="cbar"><div class="bar-total">' + fmtMoney(m.income + m.passive, { compact: true }) + "</div>" +
          '<div class="bar-stack" style="height:' + Math.max(2, Number(hI) + Number(hT)).toFixed(1) + '%">' +
            '<div class="seg-income" style="flex:' + (m.income || 0.001) + '"></div>' +
            '<div class="seg-interest" style="flex:' + (m.passive || 0.001) + '"></div>' +
          "</div>" +
          '<div class="bar-label">' + m.label + "</div></div>";
      }).join("") +
      "</div></div>";

    /* ---- income streams management ---- */
    const streamsRows = s.incomes.length ? s.incomes.map(inc => {
      const next = incomeOccurrences(inc, now, new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()))[0];
      const isGross = inc.amountType === "gross" && Number(inc.taxRate) > 0;
      return "<tr>" +
        '<td><div class="cell-main">' + esc(inc.name) + '</div><div class="cell-sub">' + esc(inc.category || "Other") + " · " + freqLabel(inc) + " · " + esc(inc.currency) +
          (isGross ? " · gross −" + inc.taxRate + "% tax" : "") + "</div></td>" +
        "<td>" + esc(Store.accountName(inc.accountId)) + "</td>" +
        '<td class="num">' + fmtMoney(conv(netPerDeposit(inc), inc.currency)) +
          (isGross ? '<div class="cell-sub">gross ' + fmtMoneyIn(inc.amount, inc.currency, { compact: true }) + "</div>"
            : (inc.currency !== s.settings.currency ? '<div class="cell-sub">' + fmtMoneyIn(netPerDeposit(inc), inc.currency, { compact: true }) + "</div>" : "")) + "</td>" +
        '<td class="num">' + fmtMoney(conv(monthlyEquivalentNet(inc), inc.currency)) + "</td>" +
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
        "<th>Stream</th><th>Deposits into</th><th class=\"num\">Net / deposit</th><th class=\"num\">≈ Monthly net</th><th>Next payment</th><th></th>" +
      "</tr></thead><tbody>" + streamsRows + "</tbody></table></div></div>";

    /* ---- interest by account ---- */
    const taxIF = 1 - (Number(tax.interest) || 0) / 100;
    const intAccounts = s.accounts.filter(a => Number(a.apy) > 0);
    const interestRows = intAccounts.length ? intAccounts.map(a =>
      "<tr>" +
        '<td><div class="cell-main">' + esc(a.name) + '</div><div class="cell-sub">' + esc(a.institution || "") + " · " + esc(a.currency) + "</div></td>" +
        '<td class="num">' + fmtMoney(conv(a.balance, a.currency)) + "</td>" +
        '<td class="num"><span class="tag mint">' + a.apy + "% APY</span></td>" +
        '<td class="num pos">' + fmtMoney(conv(dailyInterest(a) * taxIF, a.currency), { sign: true }) + "</td>" +
        '<td class="num pos">' + fmtMoney(conv(monthlyInterestEst(a) * taxIF, a.currency), { sign: true }) + "</td>" +
        '<td class="num pos">' + fmtMoney(conv(yearlyInterestEst(a) * taxIF, a.currency), { sign: true }) + "</td>" +
        '<td><div class="cell-main">' + esc(interestScheduleLabel(a)) + '</div><div class="cell-sub">next ' + fmtDateShort(nextInterestDate(a)) + "</div></td>" +
      "</tr>").join("") :
      '<tr><td colspan="7" style="color:var(--text-mute);text-align:center;padding:26px">No interest-bearing accounts. Set an APY on a savings account to see projections here.</td></tr>';

    const interestPanel =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Interest engine</div>' +
      '<span class="panel-sub">' + (tax.interest > 0 ? "net of " + tax.interest + "% tax · " : "") + "compounding estimates per account</span></div>" +
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr>' +
        "<th>Account</th><th class=\"num\">Balance</th><th class=\"num\">Rate</th><th class=\"num\">Daily</th><th class=\"num\">Monthly</th><th class=\"num\">Yearly</th><th>Paid</th>" +
      "</tr></thead><tbody>" + interestRows + "</tbody></table></div></div>";

    /* ---- dividends by holding ---- */
    const taxDF = 1 - (Number(tax.dividends) || 0) / 100;
    const divHoldings = s.holdings.filter(h => Number(h.divPerShare) > 0);
    const divPanel = divHoldings.length
      ? '<div class="panel section"><div class="panel-head"><div class="panel-title">Dividend engine</div>' +
        '<span class="panel-sub">' + (tax.dividends > 0 ? "net of " + tax.dividends + "% withholding · " : "") + fmtMoney(eb.divNet) + "/yr total</span></div>" +
        '<div style="overflow-x:auto"><table class="tbl"><thead><tr>' +
          "<th>Position</th><th class=\"num\">Shares</th><th class=\"num\">Div / share / yr</th><th class=\"num\">Yield</th><th class=\"num\">Annual (net)</th><th class=\"num\">Monthly avg</th>" +
        "</tr></thead><tbody>" +
        divHoldings.map(h => {
          const annualDisp = conv(h.shares * h.divPerShare * taxDF, h.currency);
          const yieldPct = h.currentPrice > 0 ? h.divPerShare / h.currentPrice * 100 : 0;
          return "<tr>" +
            '<td><div class="cell-main">' + esc(h.symbol) + '</div><div class="cell-sub">' + esc(h.name || "") + " · " + esc(h.currency) + "</div></td>" +
            '<td class="num">' + fmtNum(h.shares) + "</td>" +
            '<td class="num">' + fmtMoneyIn(h.divPerShare, h.currency) + "</td>" +
            '<td class="num">' + yieldPct.toFixed(2) + "%</td>" +
            '<td class="num pos">' + fmtMoney(annualDisp, { sign: true }) + "</td>" +
            '<td class="num pos">' + fmtMoney(annualDisp / 12, { sign: true }) + "</td>" +
          "</tr>";
        }).join("") +
        "</tbody></table></div></div>"
      : "";

    /* ---- 30-day timeline ---- */
    const to = new Date(now); to.setDate(to.getDate() + 30);
    const events = [];
    s.incomes.forEach(inc => {
      incomeOccurrences(inc, now, to).forEach(d => events.push({
        d, name: inc.name,
        sub: esc(inc.category || "Income") + " → " + esc(Store.accountName(inc.accountId)) +
          (inc.amountType === "gross" && inc.taxRate > 0 ? " · net of " + inc.taxRate + "% tax" : ""),
        amount: conv(netPerDeposit(inc), inc.currency),
      }));
    });
    // interest credited on each account's own pay schedule
    intAccounts.forEach(a => {
      if (interestFreqKey(a) === "daily") {
        // continuous — show one summarized line for the whole window
        const days = daysBetween(now, to);
        events.push({
          d: to, name: "Interest — " + a.name,
          sub: "Daily · " + a.apy + "% APY" + (tax.interest > 0 ? " · net of " + tax.interest + "% tax" : "") + " → " + esc(a.name),
          amount: conv(interestPerPeriod(a) * taxIF * days, a.currency), interest: true,
        });
        return;
      }
      let d = nextInterestDate(a, now), guard = 0;
      while (d <= to && guard++ < 12) {
        events.push({
          d, name: "Interest — " + a.name,
          sub: interestScheduleLabel(a) + " · " + a.apy + "% APY" + (tax.interest > 0 ? " · net of " + tax.interest + "% tax" : "") + " → " + esc(a.name),
          amount: conv(interestPerPeriod(a) * taxIF, a.currency), interest: true,
        });
        d = nextInterestDate(a, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
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

    return stats + chart + '<div class="grid cols-2 stack-wide section" style="align-items:start">' + streams + timeline + "</div>" + interestPanel + divPanel;
  },

  /* ================= BUDGET & EXPENSES ================= */
  budget() {
    const s = Store.state;
    const months = expenseMonths();

    if (!months.length) {
      return '<div class="section"><div class="empty"><div class="empty-glyph">◓</div>' +
        "<h3>Track where your money goes</h3>" +
        "<p>Most people hate logging expenses by hand — so don't. Download the ready-made spreadsheet template, fill it in Excel or Google Sheets (or have your favourite AI fill it from your credit-card statements), and upload it. FinanceOS scores your spending, spots your biggest categories, and never double-counts a row.</p>" +
        '<div class="empty-actions">' +
          '<button class="btn primary" data-action="expense-template">↓ Download template</button>' +
          '<button class="btn" data-action="expense-import">↑ Upload filled sheet</button>' +
          '<button class="btn ghost" data-action="add-expense">+ Add one manually</button>' +
        "</div>" +
        '<p class="empty-tip">Tip: paste the template and your statement into ChatGPT or Claude and ask it to return the rows for you. ' +
          '<a href="#" data-action="expense-import">See how →</a></p>' +
      "</div></div>";
    }

    // selected month — default to the most recent with data
    let mk = App.budgetMonth;
    if (!mk || months.indexOf(mk) === -1) mk = months[0];
    const exps = expensesForMonth(mk).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const sc = budgetScore(mk);
    const g = scoreGrade(sc.score);
    const cats = categoryTotalsSorted(exps);
    const spend = sc.spend || 0;
    const isCurrent = mk === toISO(todayMid()).slice(0, 7);

    const monthOpts = months.map(m =>
      '<option value="' + m + '"' + (m === mk ? " selected" : "") + ">" + monthLabel(m) + "</option>").join("");
    const controls =
      '<div class="budget-controls section">' +
        '<select id="budget-month" class="budget-month">' + monthOpts + "</select>" +
        '<span class="budget-count">' + exps.length + " expense" + (exps.length === 1 ? "" : "s") +
          (isCurrent ? " · month in progress" : "") + "</span>" +
        '<div class="budget-controls-right">' +
          '<button class="btn small ghost" data-action="set-budgets">Set budgets</button>' +
          '<button class="btn small ghost" data-action="expense-template">↓ Template</button>' +
          '<button class="btn small" data-action="expense-import">↑ Upload</button>' +
        "</div>" +
      "</div>";

    // ---- score hero ----
    const pct = (x) => Math.round(x * 100) + "%";
    const scoreNum = sc.score == null ? "—" : sc.score;
    const ringDeg = sc.score == null ? 0 : Math.round(sc.score * 3.6);
    const ringColor = g.tone === "pos" ? "var(--mint)" : g.tone === "gold" ? "var(--gold)" : g.tone === "neg" ? "var(--rose)" : "var(--text-mute)";
    const hero =
      '<div class="score-hero section">' +
        '<div class="score-ring" style="background:conic-gradient(' + ringColor + ' ' + ringDeg + 'deg, var(--surface-3) 0)">' +
          '<div class="score-ring-in"><div class="score-num ' + g.tone + '">' + scoreNum + '</div><div class="score-grade">' + g.grade + "</div></div>" +
        "</div>" +
        '<div class="score-meat">' +
          '<div class="micro-label">Spending health · ' + monthLabel(mk) + "</div>" +
          '<div class="score-label ' + g.tone + '">' + g.label + "</div>" +
          '<div class="score-sub">' +
            (sc.savingsRate != null
              ? "You saved <strong>" + pct(sc.savingsRate) + "</strong> of net income and spent <strong>" + fmtMoney(sc.monthlyExpenses, { compact: true }) + "</strong> of <strong>" + fmtMoney(sc.monthlyIncomeNet, { compact: true }) + "</strong>."
              : "Spent <strong>" + fmtMoney(sc.monthlyExpenses, { compact: true }) + "</strong> this month. Add income streams in Earnings for a savings-rate score.") +
          "</div>" +
          '<div class="score-bars">' +
            this._scoreBar("Savings rate", sc.savingsRate == null ? null : sc.savingsRate, 0.2, sc.savingsRate == null ? null : pct(sc.savingsRate)) +
            this._scoreBar("Runway", isFinite(sc.runwayMonths) ? Math.min(1, sc.runwayMonths / 6) : 1, null, isFinite(sc.runwayMonths) ? sc.runwayMonths.toFixed(1) + " mo" : "∞") +
            this._scoreBar("Wants share", spend > 0 ? sc.wantsShare : 0, 0.3, pct(sc.wantsShare), true) +
          "</div>" +
        "</div>" +
      "</div>";

    // ---- stat tiles ----
    const topCat = cats[0];
    const stats =
      '<div class="grid cols-4 section">' +
        '<div class="stat"><span class="micro-label">Spent · ' + monthLabel(mk) + '</span><div class="stat-value">' + fmtMoney(sc.monthlyExpenses) + '</div><div class="stat-note">' + exps.length + " expenses</div></div>" +
        '<div class="stat"><span class="micro-label">Savings rate</span><div class="stat-value ' + (sc.savingsRate == null ? "" : sc.savingsRate >= 0.2 ? "pos" : sc.savingsRate < 0 ? "neg" : "gold") + '">' + (sc.savingsRate == null ? "—" : pct(sc.savingsRate)) + '</div><div class="stat-note">' + (sc.savingsRate == null ? "add income to compute" : "of net income") + "</div></div>" +
        '<div class="stat"><span class="micro-label">Biggest category</span><div class="stat-value">' + (topCat ? esc(topCat.meta.icon + " " + topCat.name) : "—") + '</div><div class="stat-note">' + (topCat ? fmtMoney(topCat.amount, { compact: true }) + (spend > 0 ? " · " + pct(topCat.amount / spend) : "") : "") + "</div></div>" +
        '<div class="stat"><span class="micro-label">Runway</span><div class="stat-value ' + (sc.runwayMonths >= 6 ? "pos" : sc.runwayMonths < 3 ? "neg" : "gold") + '">' + (isFinite(sc.runwayMonths) ? sc.runwayMonths.toFixed(1) + " mo" : "∞") + '</div><div class="stat-note">liquid assets at this rate</div></div>' +
      "</div>";

    // ---- 50/30/20 needs vs wants ----
    const needsPct = spend > 0 ? sc.needs / spend : 0;
    const wantsPct = spend > 0 ? sc.wants / spend : 0;
    const bucketPanel =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Needs vs wants</div>' +
        '<span class="panel-sub">50/30/20 guide · wants near 30% of income</span></div>' +
        '<div class="comp-bar">' +
          '<span style="width:' + (needsPct * 100) + '%;background:var(--sky)"></span>' +
          '<span style="width:' + (wantsPct * 100) + '%;background:var(--gold)"></span>' +
        "</div>" +
        '<div class="comp-legend">' +
          '<span class="lg"><span class="dot" style="background:var(--sky)"></span>Needs ' + fmtMoney(sc.needs, { compact: true }) + " · " + pct(needsPct) + "</span>" +
          '<span class="lg"><span class="dot" style="background:var(--gold)"></span>Wants ' + fmtMoney(sc.wants, { compact: true }) + " · " + pct(wantsPct) + "</span>" +
        "</div>" +
      "</div>";

    // ---- category breakdown (actual vs budget) ----
    const maxCat = cats.reduce((m, c) => Math.max(m, c.amount), 0) || 1;
    const catRows = cats.map(c => {
      const budget = budgetForCategory(c.name);
      const over = budget != null && c.amount > budget;
      const ratio = budget != null ? Math.min(1, c.amount / budget) : c.amount / maxCat;
      const barColor = budget != null ? (over ? "var(--rose)" : "var(--mint)") : "var(--sky)";
      return '<div class="bcat">' +
        '<div class="bcat-head"><span class="bcat-name">' + esc(c.meta.icon) + " " + esc(c.name) + "</span>" +
          '<span class="bcat-amt' + (over ? " neg" : "") + '">' + fmtMoney(c.amount, { compact: true }) +
            (budget != null ? ' <span class="bcat-budget">/ ' + fmtMoney(budget, { compact: true }) + "</span>" : "") + "</span></div>" +
        '<div class="bcat-track"><span style="width:' + (ratio * 100) + '%;background:' + barColor + '"></span></div>' +
      "</div>";
    }).join("");
    const catPanel =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">By category</div>' +
        '<span class="panel-sub">' + (totalBudget() > 0 ? "vs your budgets" : "share of spending") + "</span></div>" +
        (catRows || '<div class="all-clear" style="color:var(--text-mute)">No expenses this month.</div>') +
      "</div>";

    // ---- insights ----
    const insights = budgetInsights(mk);
    const insightRows = insights.length ? insights.map(i =>
      '<div class="alert-row"><span class="alert-dot ' + i.level + '"></span>' +
        '<div class="alert-body"><strong>' + esc(i.title) + "</strong><div class=\"alert-meta\" style=\"font-family:var(--font-body);font-size:13px;color:var(--text-dim);letter-spacing:0\">" + i.text + "</div></div></div>").join("") :
      '<div class="all-clear"><span class="pulse"></span>Looking good — nothing to flag.</div>';
    const insightPanel =
      '<div class="panel section alerts-panel"><div class="panel-head"><div class="panel-title">Insights & advice</div></div>' + insightRows + "</div>";

    // ---- expense list ----
    const rows = exps.map(e =>
      "<tr>" +
        '<td class="num" style="white-space:nowrap">' + fmtDateShort(e.date) + "</td>" +
        '<td><div class="cell-main">' + esc(e.description || "—") + "</div></td>" +
        '<td><span class="bcat-tag">' + esc(categoryMeta(e.category).icon + " " + e.category) + "</span></td>" +
        '<td class="num">' + fmtMoneyIn(e.amount, e.currency) + "</td>" +
        '<td class="actions-cell"><button class="icon-btn" data-action="edit-expense" data-id="' + e.id + '" title="Edit">✎</button>' +
          '<button class="icon-btn danger" data-action="del-expense" data-id="' + e.id + '" title="Remove">✕</button></td>' +
      "</tr>").join("");
    const listPanel =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">' + monthLabel(mk) + ' expenses</div>' +
        '<span class="panel-sub">' + fmtMoney(sc.monthlyExpenses) + " · " + exps.length + " items</span></div>" +
        '<div style="overflow-x:auto"><table class="tbl"><thead><tr>' +
          '<th class="num">Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th class="actions-cell"></th>' +
        "</tr></thead><tbody>" + rows + "</tbody></table></div>" +
        '<div class="budget-foot"><button class="btn small ghost danger-ghost" data-action="clear-expenses">Clear all expenses</button></div>' +
      "</div>";

    return controls + hero + stats +
      '<div class="grid cols-2 stack-wide section" style="align-items:start">' + catPanel + insightPanel + "</div>" +
      bucketPanel + listPanel;
  },

  // a labelled mini progress bar for the score hero
  _scoreBar(label, ratio, target, valueText, invert) {
    if (ratio == null) {
      return '<div class="sbar"><div class="sbar-top"><span>' + label + "</span><span>—</span></div>" +
        '<div class="sbar-track"><span style="width:0%"></span></div></div>';
    }
    const r = Math.max(0, Math.min(1, ratio));
    // invert=true means lower is better (e.g. wants share)
    let color;
    if (invert) color = r <= target ? "var(--mint)" : r <= target * 1.6 ? "var(--gold)" : "var(--rose)";
    else if (target != null) color = r >= target ? "var(--mint)" : r >= target * 0.5 ? "var(--gold)" : "var(--rose)";
    else color = r >= 0.66 ? "var(--mint)" : r >= 0.33 ? "var(--gold)" : "var(--rose)";
    const val = valueText != null ? valueText : Math.round(r * 100) + "%";
    return '<div class="sbar"><div class="sbar-top"><span>' + label + '</span><span class="sbar-val">' + val + "</span></div>" +
      '<div class="sbar-track"><span style="width:' + (r * 100) + "%;background:" + color + '"></span></div></div>';
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
        '<span>Scheduled <em>' + fmtMoney(eb.schedGross, { compact: true }) + "/yr</em></span>" +
        '<span>Interest <em>' + fmtMoney(eb.intGross, { compact: true }) + "/yr</em></span>" +
        '<span>Dividends <em>' + fmtMoney(eb.divGross, { compact: true }) + "/yr</em></span>" +
        '<span>Investments <em class="' + (eb.investGross >= 0 ? "pos" : "neg") + '">' + fmtMoney(eb.investGross, { sign: true, compact: true }) + "/yr</em></span>" +
      "</div>";

    const standing =
      '<div class="grid cols-2 section">' +
        pctCard("Global standing — net worth", ctx.nwPct, fmtMoney(ctx.t.netWorth, { compact: true }), NETWORTH_PCT_TABLE, toUSD(ctx.t.netWorth), "") +
        pctCard("Global standing — annual earnings (gross)", ctx.incPct, fmtMoney(eb.totalGross, { compact: true }) + "/yr", INCOME_PCT_TABLE, toUSD(eb.totalGross), ebRows) +
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
      '<p class="method-note">Percentiles compare you against the <strong>global adult population</strong>, interpolated from public datasets (UBS/Credit Suisse Global Wealth Report and the World Inequality Database, ~2024). Your figures are converted to USD using daily ECB exchange rates (with an offline fallback). Annual earnings are <strong>gross</strong> — global income statistics are pre-tax — and equal scheduled income + projected interest + dividends + investment returns annualized over each position\'s holding period. These are rough, directional estimates for motivation — not financial statistics about you.</p></div>';

    return standing + badges + method;
  },

  /* ================= LEARN ================= */
  learn() {
    return Learn.render();
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
        "Choose how often interest is paid — <strong>daily, monthly, quarterly or annually</strong> — and the exact day it lands. The card shows your next payment and the date it's due.",
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
      card("◮", "Portfolio & live prices", [
        "Add each stock or ETF with the <strong>shares and average price you paid</strong>, in the listing's own currency (US tickers are USD).",
        "Press <strong>↻ Update prices</strong> to pull live quotes and annual dividends — <strong>no API key needed</strong>. Stocks and ETFs both work: dividends come from the actual payments of the last 12 months (Yahoo data via a public proxy that sees only ticker symbols). An optional free <strong>finnhub.io</strong> key in Settings adds a direct quote source.",
        "Values and returns are converted to your display currency with daily ECB exchange rates.",
        "Dividends feed the Earnings page and your annual-earnings milestone automatically. If a ticker still reports no dividend, set <strong>Dividend / share / year</strong> yourself in the position editor (✎) — manual values are never overwritten.",
      ]) +
      card("✦", "Earnings & taxes", [
        "Income streams support <strong>monthly</strong> (any day), <strong>every 15 days</strong> (15th & month-end), <strong>every 14 days</strong> and <strong>weekly</strong> schedules.",
        "When adding income, say whether the amount is <strong>gross</strong> (before tax, with your effective rate) or <strong>net</strong> (take-home). Projections and the timeline always show what actually lands.",
        "Set tax rates for <strong>interest, dividends and capital gains</strong> in Settings — every projection becomes after-tax.",
        "The 12-month chart projects net scheduled income + net interest + net dividends, prorating the current month.",
      ]) +
      card("◓", "Budget & expenses", [
        "Hate logging expenses? <strong>Download the spreadsheet template</strong> (Budget → Template), fill it in Excel / Sheets / Numbers, and upload it. Columns are Date, Description, Category, Amount, Currency.",
        "Even easier: paste the template and your <strong>credit-card statement</strong> into ChatGPT or Claude and ask it to return the rows — the exact prompt is in the Upload dialog. Drop the result under the header and upload.",
        "<strong>Re-uploading is safe.</strong> FinanceOS fingerprints every row, so importing the same file twice — or overlapping months — never creates duplicates, while genuine same-day repeats are kept.",
        "You get a <strong>spending-health score</strong> from your savings rate, runway and needs-vs-wants split, plus insights, a 50/30/20 breakdown, and per-category budgets. Set monthly limits with <strong>Set budgets</strong>.",
      ]) +
      card("◍", "Currencies", [
        "Every account, card, position and income stream has its <strong>own currency</strong> — mix MXN accounts with USD stocks freely.",
        "Totals, net worth and charts convert everything to your <strong>display currency</strong> (sidebar selector) using daily ECB rates, refreshed automatically when online.",
        "Entity cards show the native amount with the converted value underneath.",
        "Net worth history is stored in USD, so switching display currency never distorts the chart.",
      ]) +
      card("✺", "Learn", [
        "Four <strong>interactive modules</strong> mix live calculators (drag a slider, watch compounding, minimum-payment traps or the Rule of 72 react), real decisions with a <strong>10-year impact</strong> meter, and quick knowledge checks.",
        "The <strong>Wealth Builder sandbox</strong> plays 20 years where crashes, scams, emergencies and job offers interrupt you — each demands a decision with real consequences.",
        "Balance wealth against the <strong>life-satisfaction meter</strong>: finish burned out and the grade drops. Results show your fortune in today's purchasing power, too.",
        "Scores earn XP and levels, and three achievements are tied to learning.",
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
