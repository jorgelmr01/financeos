/* FinanceOS — page renderers */
"use strict";

const Pages = {

  /* ================= OVERVIEW ================= */
  /* first-week checklist: walks a new user from empty app to full picture.
     Shows until every core step is done (or they dismiss it). */
  _onboardPanel() {
    const s = Store.state;
    if (s.settings.onboardDone) return "";
    const steps = [
      { done: s.accounts.length > 0, label: "Add an account", sub: "checking, savings or CETES — your money's home base", action: "add-account" },
      { done: s.incomes.length > 0, label: "Add your income", sub: "salary or any recurring deposit — powers the forecasts", action: "add-income" },
      { done: (s.expenses || []).length > 0, label: "Log or import expenses", sub: "import a statement PDF or add one by hand — unlocks the Budget", action: "statement-import" },
      { done: s.cards.length > 0, label: "Add a credit card", sub: "get due-date alerts and your utilization at a glance", action: "add-card" },
    ];
    const nDone = steps.filter(x => x.done).length;
    if (nDone === steps.length) return "";
    const rows = steps.map(st =>
      '<div class="ob-step' + (st.done ? " done" : "") + '">' +
        '<span class="ob-check">' + (st.done ? "✓" : "") + "</span>" +
        '<div class="ob-tx"><strong>' + st.label + "</strong><span>" + st.sub + "</span></div>" +
        (st.done ? "" : '<button class="btn small ghost" data-action="' + st.action + '">Do it →</button>') +
      "</div>").join("");
    return '<div class="panel section ob-panel"><div class="panel-head"><div class="panel-title">Set up your command center</div>' +
      '<span class="panel-sub">' + nDone + " of " + steps.length + ' done · <a href="#" class="ob-dismiss" data-action="onboard-dismiss">dismiss</a></span></div>' +
      '<div class="ob-bar"><span style="width:' + (nDone / steps.length * 100) + '%"></span></div>' +
      '<div class="ob-steps">' + rows + "</div></div>";
  },

  overview() {
    const t = computeTotals();
    const alerts = collectAlerts();
    const s = Store.state;
    const hasAnything = s.accounts.length || s.cards.length || s.holdings.length || s.incomes.length;

    if (!hasAnything) {
      return '<div class="section"><div class="empty">' +
        '<div class="empty-glyph">' + icon("home") + '</div>' +
        "<h3>Welcome to your command center</h3>" +
        "<p>Add your first account, credit card, or position — or load sample data to explore what FinanceOS can do.</p>" +
        '<div class="empty-actions">' +
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
      { label: "Property & other", val: t.otherAssets, color: "#e3c98f" },
    ].filter(x => x.val > 0);
    const segTotal = segs.reduce((a, x) => a + x.val, 0) || 1;
    const compBar = '<div class="comp-bar">' +
      segs.map(x => '<span style="width:' + (x.val / segTotal * 100).toFixed(2) + '%;background:' + x.color + '" data-tip="' + esc(x.label) + " · <strong>" + fmtMoney(x.val, { compact: true }) + "</strong> · " + (x.val / segTotal * 100).toFixed(1) + '%"></span>').join("") +
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

    // ---- unified Financial Health score ----
    const fh = financialHealth();
    const fg = healthGrade(fh.score);
    const healthBars = fh.factors.length
      ? '<div class="score-bars health-bars">' + fh.factors.map(f => this._scoreBar(f.label, f.score, null, f.detail)).join("") + "</div>"
      : "";
    // biggest lever = the weakest factor, with a concrete next step
    const leverTip = { cashflow: "spend a bit less or earn more to lift your savings rate", debt: "pay down a card balance to cut utilization", safety: "grow savings toward 6 months of expenses", growth: "keep net worth trending up" };
    let lever = null;
    fh.factors.forEach(f => { if (f.score < 0.95 && (!lever || f.score < lever.score)) lever = f; });
    const leverHtml = lever ? '<div class="health-lever"><span class="micro-label">Biggest lever</span> <strong>' + esc(lever.label) + "</strong> — " + esc(leverTip[lever.key] || "small steps add up") + "</div>" : "";

    // ---- net worth since the last snapshot ----
    const snaps = s.snapshots || [];
    const nwDelta = snaps.length >= 2 ? fromUSD(snaps[snaps.length - 1].usd - snaps[snaps.length - 2].usd) : null;

    // ---- "today" lead: greeting + what needs attention now ----
    const hr = new Date().getHours();
    const greet = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
    const dangers = alerts.filter(a => a.level === "danger").length;
    const warns = alerts.filter(a => a.level === "warn").length;
    const status = dangers ? (dangers + " thing" + (dangers > 1 ? "s need" : " needs") + " your attention today")
      : warns ? "A couple of things to keep an eye on"
      : "You're on track — nothing urgent today";
    const todayFeed = alerts.length ? alertsHtml
      : '<div class="all-clear"><span class="pulse"></span>All clear — no payments due, utilization healthy.' +
        (upcoming.length ? " Next money in on " + fmtDateShort(upcoming[0].d) + "." : "") + "</div>";

    const todayStrip =
      '<div class="today section">' +
        '<div class="today-head">' +
          '<div class="today-intro"><div class="today-greet">' + greet + '</div><div class="today-status">' + status + '.</div></div>' +
          '<div class="today-actions">' +
            '<button class="btn small primary" data-action="add-expense">+ Log expense</button>' +
            '<button class="btn small ghost" data-action="nav" data-page="budget">Budget →</button>' +
          "</div>" +
        "</div>" +
        '<div class="today-feed">' + todayFeed + "</div>" +
      "</div>";

    return (
      todayStrip +
      this._onboardPanel() +
      '<div class="hero section">' +
        '<div class="hero-health">' +
          '<div class="health-top">' + this._scoreRing(fh.score, fg.tone, fg.grade) +
            '<div class="health-meat"><span class="micro-label">Financial health</span>' +
              '<div class="score-label ' + fg.tone + '">' + fg.label + "</div>" +
              '<div class="health-sub">' + (fh.score == null
                ? "Add accounts, income and a few expenses to unlock your score."
                : "One number across cash flow, debt, safety net &amp; growth." + this._hint("Your Financial Health blends four signals: cash flow (savings rate), debt load (card utilization), safety net (months of runway) and growth (net-worth trend). Each is skipped until it has data.")) + "</div>" +
            "</div>" +
          "</div>" + healthBars + leverHtml +
        "</div>" +
        '<div class="hero-networth">' +
          '<span class="micro-label">Net worth</span>' +
          '<div class="hero-amount ' + (t.netWorth < 0 ? "neg" : "") + '">' + fmtMoney(t.netWorth) +
            (nwDelta != null ? '<span class="nw-delta ' + (nwDelta >= 0 ? "pos" : "neg") + '">' + fmtMoney(nwDelta, { sign: true, compact: true }) + " today</span>" : "") + "</div>" +
          '<div class="hero-breakdown">' +
            '<div class="b-item"><span class="micro-label">Assets</span><span class="b-val pos">' + fmtMoney(t.assets) + "</span></div>" +
            '<div class="b-item"><span class="micro-label">Card debt</span><span class="b-val ' + (t.debt > 0 ? "neg" : "") + '">−' + fmtMoney(t.debt) + "</span></div>" +
            '<div class="b-item"><span class="micro-label">Unrealized P/L</span><span class="b-val ' + (t.pnl >= 0 ? "pos" : "neg") + '">' + fmtMoney(t.pnl, { sign: true }) + "</span></div>" +
          "</div>" +
          compBar +
          '<button class="pct-chip" data-action="nav" data-page="milestones">' + icon("star") + " " +
            topShareLabel(percentileFromTable(toUSD(t.netWorth), NETWORTH_PCT_TABLE)) + " worldwide — see milestones →</button>" +
        "</div>" +
      "</div>" +

      '<div class="grid cols-4 section">' +
        '<div class="stat"><span class="micro-label">Liquid cash</span><div class="stat-value">' + fmtMoney(t.cash + t.savings + t.investCash) + '</div><div class="stat-note">' + s.accounts.length + " account" + (s.accounts.length === 1 ? "" : "s") + (t.investCash > 0 ? " · incl. brokerage cash" : "") + "</div></div>" +
        '<div class="stat"><span class="micro-label">Portfolio value</span><div class="stat-value">' + fmtMoney(t.marketValue) + '</div><div class="stat-note ' + (t.pnl >= 0 ? "pos" : "neg") + '">' + fmtMoney(t.pnl, { sign: true }) + " (" + fmtPct(t.invested ? t.pnl / t.invested * 100 : 0, 1) + ")</div></div>" +
        '<div class="stat"><span class="micro-label">Credit available</span><div class="stat-value">' + fmtMoney(Math.max(0, t.creditLimit - t.debt)) + '</div><div class="stat-note">of ' + fmtMoney(t.creditLimit, { compact: true }) + " total limit</div></div>" +
        '<div class="stat"><span class="micro-label">Monthly income (net)</span><div class="stat-value gold">' + fmtMoney(eb.monthlyNet) + '</div><div class="stat-note">after tax · incl. interest &amp; dividends</div></div>' +
      "</div>" +

      this._cashflowPanel() +
      this._savingsRatePanel() +
      this._nwChartPanel() +
      this._nwCompositionPanel() +

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
      '<div class="chart-wrap"><svg class="nw-chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' +
        '<defs><linearGradient id="nwfill" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="rgba(143,227,166,0.28)"/><stop offset="100%" stop-color="rgba(143,227,166,0)"/>' +
        "</linearGradient></defs>" +
        '<polygon points="' + area + '" fill="url(#nwfill)"/>' +
        '<polyline points="' + line + '" fill="none" stroke="#8fe3a6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      "</svg>" +
      this._chartHits(pts.map((v, i) => ({ tip: fmtDateShort(parseISO(snaps[i].d)) + " · <strong>" + fmtMoney(v, { compact: true }) + "</strong>" }))) +
      "</div>" +
      '<div class="nw-chart-scale"><span>' + fmtDateShort(parseISO(snaps[0].d)) + " · " + fmtMoney(first, { compact: true }) + "</span>" +
      "<span>today · " + fmtMoney(lastV, { compact: true }) + "</span></div></div>";
  },

  /* savings rate (latest month) + 50/30/20 needs/wants/savings split */
  _savingsRatePanel() {
    const all = (typeof budgetSeries === "function") ? budgetSeries(null).filter(m => m.hasData) : [];
    if (!all.length) return "";
    const complete = all.filter(m => m.complete);
    const m = (complete.length ? complete : all)[(complete.length ? complete : all).length - 1];
    const income = Number(m.income) || 0;
    if (income <= 0) return "";
    const needs = Math.max(0, Number(m.needs) || 0);
    const wants = Math.max(0, Number(m.wants) || 0);
    const savings = Math.max(0, income - needs - wants);
    const sr = m.savingsRate != null ? m.savingsRate : savings / income;
    const pct = v => v / income * 100;
    const tone = sr >= 0.2 ? "pos" : sr >= 0.05 ? "gold" : "neg";
    const seg = (v, bg, label) => '<span style="width:' + Math.max(0, pct(v)).toFixed(2) + "%;background:" + bg + '" data-tip="' + esc(label + " · " + fmtMoney(v, { compact: true }) + " · " + Math.round(pct(v)) + "%") + '"></span>';
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Savings rate</div>' +
      '<span class="panel-sub">' + esc(m.short) + " · target 20%+</span></div>" +
      '<div class="sr-row"><div class="sr-big ' + tone + '">' + Math.round(sr * 100) + "%</div>" +
        '<div class="sr-detail"><div class="comp-bar">' +
          seg(needs, "var(--sky)", "Needs") + seg(wants, "var(--gold)", "Wants") + seg(savings, "var(--mint)", "Savings") +
        "</div>" +
        '<div class="comp-legend" style="margin-top:10px">' +
          '<span class="lg"><span class="dot" style="background:var(--sky)"></span>Needs ' + Math.round(pct(needs)) + "%</span>" +
          '<span class="lg"><span class="dot" style="background:var(--gold)"></span>Wants ' + Math.round(pct(wants)) + "%</span>" +
          '<span class="lg"><span class="dot" style="background:var(--mint)"></span>Savings ' + Math.round(pct(savings)) + "%</span>" +
          '<span class="lg" style="margin-left:auto">50 / 30 / 20 rule</span>' +
        "</div></div></div></div>";
  },

  /* stacked-area: HOW net worth is built over time — liquid + investments
     (assets) with debt drawn as an overlaid line. Uses the composition stored
     on each daily snapshot; needs ≥2 days of composition history. */
  _nwCompositionPanel() {
    const snaps = (Store.state.snapshots || []).filter(x => x.liq != null);
    if (snaps.length < 2) return "";
    const liq = snaps.map(x => fromUSD(x.liq || 0));
    const inv = snaps.map(x => fromUSD(x.inv || 0));
    const debt = snaps.map(x => fromUSD(x.debt || 0));
    const assets = liq.map((v, i) => v + inv[i]);
    const max = Math.max.apply(null, assets.concat(debt).concat([1]));
    const W = 1000, H = 200, PAD = 8, n = snaps.length;
    const X = (i) => PAD + i * (W - 2 * PAD) / (n - 1);
    const Y = (v) => H - PAD - v / max * (H - 2 * PAD);
    const base = (H - PAD).toFixed(1);
    const liqTop = liq.map((v, i) => X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" ");
    const liqArea = liqTop + " " + X(n - 1).toFixed(1) + "," + base + " " + X(0).toFixed(1) + "," + base;
    const invTop = assets.map((v, i) => X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" ");
    const invBotRev = liq.map((v, i) => X(i).toFixed(1) + "," + Y(v).toFixed(1)).reverse().join(" ");
    const invArea = invTop + " " + invBotRev;
    const debtLine = debt.map((v, i) => X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" ");
    const hasDebt = debt.some(v => v > 0.005);
    const grid = [1, 2 / 3, 1 / 3].map(f =>
      '<div class="proj-grid" style="top:' + ((1 - f) * 100).toFixed(1) + '%"><span>' + fmtMoney(max * f, { compact: true }) + "</span></div>").join("");
    const hits = this._chartHits(snaps.map((x, i) =>
      ({ tip: fmtDateShort(parseISO(x.d)) + " · liquid <strong>" + fmtMoney(liq[i], { compact: true }) + "</strong> · invest <strong>" + fmtMoney(inv[i], { compact: true }) + "</strong>" + (hasDebt ? " · debt " + fmtMoney(debt[i], { compact: true }) : "") })));
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">How your wealth is built</div>' +
      '<span class="panel-sub">liquid + investments over time' + (hasDebt ? ", debt overlaid" : "") + "</span></div>" +
      '<div class="chart-wrap"><div class="comp-plot">' + grid +
        '<svg class="comp-area-chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' +
          '<defs><linearGradient id="liqfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(143,227,166,0.45)"/><stop offset="100%" stop-color="rgba(143,227,166,0.05)"/></linearGradient>' +
          '<linearGradient id="invfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(143,201,227,0.5)"/><stop offset="100%" stop-color="rgba(143,201,227,0.08)"/></linearGradient></defs>' +
          '<polygon points="' + invArea + '" fill="url(#invfill)"/>' +
          '<polygon points="' + liqArea + '" fill="url(#liqfill)"/>' +
          '<polyline points="' + invTop + '" fill="none" stroke="#8fc9e3" stroke-width="2" stroke-linejoin="round"/>' +
          (hasDebt ? '<polyline points="' + debtLine + '" fill="none" stroke="#ea8770" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>' : "") +
        "</svg>" + hits + "</div></div>" +
      '<div class="comp-legend" style="margin-top:12px">' +
        '<span class="lg"><span class="dot" style="background:#8fe3a6"></span>Liquid</span>' +
        '<span class="lg"><span class="dot" style="background:#8fc9e3"></span>Investments</span>' +
        (hasDebt ? '<span class="lg"><span class="dot" style="background:#ea8770"></span>Debt</span>' : "") +
      "</div></div>";
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
      return '<div class="section"><div class="empty"><div class="empty-glyph">' + icon("bank") + '</div>' +
        "<h3>No accounts yet</h3><p>Add your checking, savings, and investment accounts. FinanceOS will track interest automatically for any account with an APY.</p>" +
        '<button class="btn primary" data-action="add-account">+ Add your first account</button></div></div>';
    }

    const taxI = (s.settings.tax && Number(s.settings.tax.interest)) || 0;
    const provI = (s.settings.tax && Number(s.settings.tax.interestProvisional)) || 0;
    const inflI = (s.settings.tax && Number(s.settings.tax.inflation)) || 0;
    const interestMo = s.accounts.reduce((a, x) => a + conv(monthlyInterestEst(x), x.currency), 0);
    const accruedTotal = s.accounts.reduce((a, x) => a + conv(accruedInterest(x), x.currency), 0);

    const stats =
      '<div class="grid cols-4 section">' +
        '<div class="stat"><span class="micro-label">Total across accounts</span><div class="stat-value">' + fmtMoney(t.accountsTotal) + "</div></div>" +
        '<div class="stat"><span class="micro-label">Earning interest</span><div class="stat-value">' + fmtMoney(s.accounts.filter(a => a.apy > 0).reduce((a, x) => a + conv(Number(x.balance), x.currency), 0)) + '</div><div class="stat-note">' + s.accounts.filter(a => a.apy > 0).length + " interest-bearing</div></div>" +
        '<div class="stat"><span class="micro-label">Est. interest / month</span><div class="stat-value pos">' + fmtMoney(interestMo, { sign: true }) + '</div><div class="stat-note">' + (taxI > 0 ? "paid gross · " + taxI + "% ISR settled in April" + (provI > 0 ? " · " + provI + "% withheld on capital" : "") : "set your ISR rate in Settings") + "</div></div>" +
        '<div class="stat"><span class="micro-label">Accrued since update</span><div class="stat-value gold">' + fmtMoney(accruedTotal, { sign: true }) + '</div><div class="stat-note">capitalize from each card below</div></div>' +
      "</div>";

    const cards = s.accounts.map(a => {
      const meta = ACCOUNT_TYPE_META[a.type] || ACCOUNT_TYPE_META.checking;
      const hasApy = Number(a.apy) > 0;
      const accrued = accruedInterest(a);
      const foreign = a.currency !== s.settings.currency;
      const isTerm = interestFreqKey(a) === "term";

      // fixed terms are locked: show progress toward the lump-sum payout, not a
      // day-by-day "accrued since" (which reads $0 right after you enter it).
      let footHtml;
      if (isTerm) {
        const N = interestPeriodDays(a);
        const matur = nextInterestDate(a);
        const periodStart = new Date(matur); periodStart.setDate(periodStart.getDate() - N);
        const elapsed = Math.max(0, Math.min(N, daysBetween(periodStart, todayMid())));
        const built = (Number(a.balance) || 0) * (Math.pow(1 + Number(a.apy) / 100, elapsed / 365) - 1);
        footHtml = '<span class="accrued-note">≈ ' + fmtMoneyIn(built, a.currency, { sign: true }) +
          " earned so far" + (taxI > 0 ? " (gross)" : "") + " · " + elapsed + " of " + N + " days · paid at maturity</span>";
      } else {
        footHtml = '<span class="accrued-note">accrued ' + fmtMoneyIn(accrued, a.currency, { sign: true }) +
          (taxI > 0 ? " (gross — ISR settled in April)" : "") + " since " + fmtDateShort(parseISO(a.balanceAsOf) || todayMid()) + "</span>" +
          (accrued >= 0.01 ? '<button class="btn small ghost" data-action="capitalize" data-id="' + a.id + '" title="Add accrued interest to the balance">Capitalize</button>' + this._hint("Capitalize means add the interest you've earned so far onto your balance, so it starts earning interest too — do this when your bank actually credits it. It's added gross; the income ISR is paid in your April return.") : "");
      }

      const interest = hasApy
        ? '<div class="acct-interest">' +
            '<div class="ai-item"><span class="micro-label">Daily</span><span class="ai-val">' + fmtMoneyIn(dailyInterest(a), a.currency, { sign: true }) + "</span></div>" +
            '<div class="ai-item"><span class="micro-label">Monthly</span><span class="ai-val">' + fmtMoneyIn(monthlyInterestEst(a), a.currency, { sign: true }) + "</span></div>" +
            '<div class="ai-item"><span class="micro-label">Yearly</span><span class="ai-val">' + fmtMoneyIn(yearlyInterestEst(a), a.currency, { sign: true }) + "</span></div>" +
          "</div>" +
          (taxI > 0 ? '<div class="ai-note">Paid gross — ' + taxI + "% ISR hits only real interest (nominal − " + inflI + "% inflation); set aside ≈" + fmtMoneyIn(realInterestEst(a) * taxI / 100, a.currency) + "/yr for the April return" + (provI > 0 ? ", " + provI + "% withheld on capital meanwhile" : "") + "</div>" : "") +
          '<div class="acct-sched">' +
            '<span class="micro-label">' + (isTerm ? "Pays " : "Paid ") + esc(interestScheduleLabel(a)) + "</span>" +
            '<span class="sched-next">' + (isTerm ? "matures " : "next ") + fmtDateShort(nextInterestDate(a)) +
              ' · <span class="pos">' + fmtMoneyIn(interestPerPeriod(a), a.currency, { sign: true }) + "</span></span>" +
          "</div>" +
          '<div class="acct-foot">' + footHtml + "</div>"
        : "";
      return '<div class="acct-card">' +
        '<div class="acct-head"><div><div class="acct-name">' + esc(a.name) + '</div><div class="acct-inst">' + esc(a.institution || "—") + "</div></div>" +
        '<div style="display:flex;gap:2px;align-items:center">' +
          '<span class="tag ' + meta.tag + '">' + meta.label + " · " + a.currency + (hasApy ? " · " + a.apy + "%" : "") + "</span>" +
          '<button class="icon-btn" data-action="edit-account" data-id="' + a.id + '" title="Edit">' + icon("edit") + '</button>' +
          '<button class="icon-btn danger" data-action="del-account" data-id="' + a.id + '" title="Delete">' + icon("x") + '</button>' +
        "</div></div>" +
        '<div class="acct-balance">' + fmtMoneyIn(a.balance, a.currency) +
          (foreign ? '<span class="fx-sub">≈ ' + fmtMoney(conv(a.balance, a.currency)) + "</span>" : "") + "</div>" +
        interest +
      "</div>";
    }).join("");

    return stats + '<div class="grid cols-2 section">' + cards + "</div>" + this._balanceSheet();
  },

  /* ---------- personal balance sheet ----------
     The full picture: on-platform money (accounts, portfolio, cards) plus the
     off-platform wealth every real balance sheet needs — property, vehicles,
     business stakes — and the loans behind them, with amortization. */
  _balanceSheet() {
    const s = Store.state, t = computeTotals();
    const KIND_META = { property: ["home", "Property"], vehicle: ["car", "Vehicle"], business: ["bank", "Business / private equity"], crypto: ["growth", "Crypto (off-platform)"], other: ["dots", "Other"] };
    const LKIND = { mortgage: "Mortgage", auto: "Auto loan", personal: "Personal loan", student: "Student loan", other: "Other debt" };
    const assetRows = (s.assets || []).map(a =>
      '<div class="bs-row"><span class="bs-name">' + icon((KIND_META[a.kind] || KIND_META.other)[0], "ic-cat") + esc(a.name) +
        '<span class="bs-kind">' + (KIND_META[a.kind] || KIND_META.other)[1] + "</span></span>" +
      '<span class="bs-amt">' + fmtMoneyIn(a.value, a.currency, { compact: true }) + "</span>" +
      '<span class="bs-actions"><button class="icon-btn" data-action="edit-asset" data-id="' + a.id + '" title="Edit">' + icon("edit") + "</button>" +
        '<button class="icon-btn danger" data-action="del-asset" data-id="' + a.id + '" title="Delete">' + icon("x") + "</button></span></div>").join("");
    const liabRows = (s.liabilities || []).map(l => {
      const am = amortizeLoan(l.balance, l.apr, l.payment);
      const note = !(Number(l.payment) > 0) ? ""
        : am.feasible
          ? Math.floor(am.months / 12) + "y " + (am.months % 12) + "mo left · " + fmtMoneyIn(am.totalInterest, l.currency, { compact: true }) + " interest to go"
          : "payment doesn't cover interest — balance grows";
      return '<div class="bs-row"><span class="bs-name">' + icon("card", "ic-cat") + esc(l.name) +
          '<span class="bs-kind">' + (LKIND[l.kind] || LKIND.other) + (Number(l.apr) > 0 ? " · " + l.apr + "%" : "") + "</span>" +
          (note ? '<span class="bs-note' + (am.feasible ? "" : " neg") + '">' + note + "</span>" : "") + "</span>" +
        '<span class="bs-amt neg">' + fmtMoneyIn(l.balance, l.currency, { compact: true }) + "</span>" +
        '<span class="bs-actions"><button class="icon-btn" data-action="edit-liability" data-id="' + l.id + '" title="Edit">' + icon("edit") + "</button>" +
          '<button class="icon-btn danger" data-action="del-liability" data-id="' + l.id + '" title="Delete">' + icon("x") + "</button></span></div>";
    }).join("");
    const line = (l, v, cls, strong) =>
      '<div class="bs-line' + (strong ? " strong" : "") + '"><span>' + l + '</span><span class="' + (cls || "") + '">' + fmtMoney(v) + "</span></div>";
    const statement =
      '<div class="panel"><div class="panel-head"><div class="panel-title">Net worth statement</div>' +
        '<span class="panel-sub">the full balance sheet · ' + displayCurrency() + "</span></div>" +
      line("Cash & savings", t.cash + t.savings + t.investCash) +
      line("Investments (market value)", t.marketValue) +
      line("Property & other assets", t.otherAssets) +
      line("Total assets", t.assets, "pos", true) +
      line("Credit cards", -t.debt, t.debt > 0 ? "neg" : "") +
      line("Loans & mortgages", -t.otherDebt, t.otherDebt > 0 ? "neg" : "") +
      line("Total liabilities", -(t.totalDebt), t.totalDebt > 0 ? "neg" : "", true) +
      line("Net worth", t.netWorth, t.netWorth >= 0 ? "pos" : "neg", true) +
      '<p class="method-note" style="margin-top:12px">Liquid net worth (cash + investments − cards): <strong>' + fmtMoney(t.liquidAssets - t.debt) + "</strong> · " +
        (t.assets > 0 ? Math.round(t.otherAssets / t.assets * 100) : 0) + "% of assets are illiquid · debt-to-assets " +
        (t.assets > 0 ? Math.round(t.totalDebt / t.assets * 100) : 0) + "%</p></div>";
    return '<div class="section bs-head-row"><h2 class="bs-title">Balance sheet</h2>' +
      '<div class="bs-head-actions"><button class="btn small ghost" data-action="add-asset">+ Asset</button>' +
      '<button class="btn small ghost" data-action="add-liability">+ Liability</button></div></div>' +
      '<div class="grid cols-2 stack-wide section" style="align-items:start">' +
        '<div>' +
          '<div class="panel"><div class="panel-head"><div class="panel-title">Other assets</div>' +
            '<span class="panel-sub">' + fmtMoney(t.otherAssets, { compact: true }) + "</span></div>" +
            (assetRows || '<p class="method-note">Property, vehicles, business stakes, crypto held elsewhere — add them for a true net worth.</p>') + "</div>" +
          '<div class="panel" style="margin-top:18px"><div class="panel-head"><div class="panel-title">Loans & mortgages</div>' +
            '<span class="panel-sub">' + fmtMoney(t.otherDebt, { compact: true }) + "</span></div>" +
            (liabRows || '<p class="method-note">Mortgage, auto or personal loans — with APR and payment, FinanceOS shows the payoff horizon and remaining interest.</p>') + "</div>" +
        "</div>" +
        statement +
      "</div>" +
      this._stressPanel();
  },

  /* ================= PROJECTION — a dedicated page for the lifetime
     wealth model: assumptions, life events, chart and year-by-year detail */
  projection() {
    if (typeof wealthProjection !== "function") return "";
    const t = computeTotals();
    if (!(Math.abs(t.netWorth) > 0) && !(Store.state.plan || []).length) {
      return '<div class="section"><div class="empty"><div class="empty-glyph">' + icon("growth") + "</div>" +
        "<h3>Nothing to project yet</h3><p>Add your accounts, income and recent spending first — the projection builds a year-by-year model of your whole financial life: salary changes, purchases, loans, taxes, retirement and estate.</p>" +
        '<button class="btn primary" data-action="nav" data-page="accounts">Go to accounts</button></div></div>';
    }
    return this._wplanAssumptions() + this._wplanEvents() +
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Your life, year by year' +
      this._hint("Deterministic on purpose — the Retirement page handles market randomness; this shows the shape of a life under your assumptions. Every slider and event updates it live.") + "</div></div>" +
      '<div id="wplan-out">' + this._wealthPlanOut() + "</div></div>";
  },

  _wplanInit() {
    if (App.wplan) return;
    const infl = (Store.state.settings.tax && Number(Store.state.settings.tax.inflation)) || 4.5;
    const by = Number(Store.state.settings.birthYear) || 0;
    const age = by > 1900 ? todayMid().getFullYear() - by : 30;
    App.wplan = { age: age, toAge: Math.max(age + 10, 90), retireAge: 65, pensionPct: 0,
      ret: 8, propG: infl, incomeG: 2, eqShare: 70, propCarry: 1, estateCost: 3, inflation: infl };
  },

  _wplanAssumptions() {
    this._wplanInit();
    const w = App.wplan;
    const slider = (key, label, val, min, max, step, suffix) =>
      '<div class="r-row"><label>' + label +
        '<span class="r-val-wrap"><input class="wp-num" data-wk="' + key + '" type="text" inputmode="decimal" value="' + val + '" aria-label="' + label + '"><span class="r-suffix">' + suffix + "</span></span></label>" +
        '<input class="wp-input" data-wk="' + key + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"></div>';
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Model assumptions' +
      this._hint("Your whole balance sheet, year by year, for an entire life: financial assets compound with the Mexican tax drag on REAL returns (interest ISR on the non-equity share, 10% bursátil on the equity share, both only above inflation), property appreciates net of its carry cost (predial + upkeep), loans amortize away (a payoff frees its payment into savings), salary grows and STOPS at your retirement age (optionally replaced by a pension), and your planned life events land in their year — including purchases financed with a new loan. It ends with the estate: in Mexico, inheritances to direct heirs are ISR-exempt via testamento; what drags is settlement costs (notary, probate), which you can set below.") + "</div></div>" +
      '<div class="sb-alloc-head"><span class="micro-label">Your life</span></div>' +
      '<div class="r-grid">' +
        slider("age", "Your age today", w.age, 15, 90, 1, " yr") +
        slider("toAge", "Model to age", w.toAge, Math.min(110, w.age + 5), 110, 1, " yr") +
        slider("retireAge", "Retire at", w.retireAge, Math.min(90, w.age + 1), 90, 1, " yr") +
        slider("pensionPct", "Pension replaces", w.pensionPct, 0, 100, 5, "%") +
      "</div>" +
      '<div class="sb-alloc-head" style="margin-top:14px"><span class="micro-label">Assumptions</span></div>' +
      '<div class="r-grid">' +
        slider("ret", "Return on investments", w.ret, 0, 15, 0.5, "%") +
        slider("eqShare", "Equity share of investments", w.eqShare, 0, 100, 5, "%") +
        slider("propG", "Property appreciation", w.propG, 0, 12, 0.5, "%") +
        slider("propCarry", "Property carry cost", w.propCarry, 0, 4, 0.25, "%") +
        slider("incomeG", "Baseline salary growth", w.incomeG, 0, 10, 0.5, "%") +
        slider("estateCost", "Estate settlement costs", w.estateCost, 0, 15, 0.5, "%") +
      "</div></div>";
  },

  _wplanEvents() {
    const events = (Store.state.plan || []).slice().sort((a, b) => a.year - b.year);
    const KIND = { purchase: ["bag", "Purchase"], salary: ["wallet", "New salary"], raise: ["growth", "Raise"], spending: ["bag", "New spending"], windfall: ["gift", "Windfall"] };
    const evRows = events.map(e => {
      const meta = KIND[e.kind] || KIND.purchase;
      const detail = e.kind === "raise" ? (Number(e.pct) > 0 ? "+" : "") + e.pct + "% salary"
        : e.kind === "salary" ? fmtMoneyIn(e.amount, e.currency, { compact: true }) + "/mo net" + (e.pct != null && e.pct !== "" ? " · then " + (Number(e.pct) >= 0 ? "+" : "") + e.pct + "%/yr" : "")
        : e.kind === "spending" ? fmtMoneyIn(e.amount, e.currency, { compact: true }) + "/mo total spending"
        : fmtMoneyIn(e.amount, e.currency, { compact: true }) +
          (e.kind === "purchase" ? (e.financed ? " · financed " + (e.downPct || 20) + "% down @ " + (e.loanRate || 0) + "% · " + (e.termYears || 20) + "y" : "") + (e.asset ? " · becomes an asset" : " · consumption") : "");
      return '<div class="bs-row"><span class="bs-name">' + icon(meta[0], "ic-cat") + esc(e.name || meta[1]) +
        '<span class="bs-kind">' + e.year + " · " + meta[1] + " · " + detail + "</span></span>" +
        '<span class="bs-actions"><button class="icon-btn" data-action="edit-plan" data-id="' + e.id + '" title="Edit">' + icon("edit") + "</button>" +
        '<button class="icon-btn danger" data-action="del-plan" data-id="' + e.id + '" title="Delete">' + icon("x") + "</button></span></div>";
    }).join("");
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Life events' +
      this._hint("The script of your life, one event per line: pin your salary to an exact amount from a given year (with its own growth from then on), plan a % raise, set a whole new spending level, schedule a purchase — cash or financed with a down payment and an auto-modeled loan — or drop in a windfall. Each event lands in its year and reshapes everything after it.") + "</div>" +
      '<span class="panel-sub"><button class="btn small ghost" data-action="add-plan">+ Life event</button></span></div>' +
      (evRows ? "<div>" + evRows + "</div>"
        : '<p class="method-note">No life events yet — pin your salary to an exact amount from 2028, add the house you plan to buy in 2030 (financed, with its down payment and mortgage), the car in 2031, and see what they do to a lifetime.</p>') +
      "</div>";
  },

  _wealthPlanOut() {
    const w = App.wplan;
    // remember the age so it survives reloads
    const by = todayMid().getFullYear() - Math.round(w.age);
    if (Store.state.settings.birthYear !== by) { Store.state.settings.birthYear = by; Store.save(); }
    const sim = wealthProjection({
      ageNow: w.age, toAge: w.toAge, retPct: w.ret, propPct: w.propG,
      inflationPct: w.inflation, incomeGrowthPct: w.incomeG,
      retireAge: w.retireAge, pensionPct: w.pensionPct, eqSharePct: w.eqShare,
      interestTaxPct: (Store.state.settings.tax && Number(Store.state.settings.tax.interest)) || 0,
      capGainsPct: (Store.state.settings.tax && Number(Store.state.settings.tax.capGains)) || 0,
      propCarryPct: w.propCarry, estateCostPct: w.estateCost,
    });
    const rows = sim.rows;
    if (!rows.length) return "";
    const doubled = rows.find(r => r.netWorth >= sim.start * 2);
    const shortYear = rows.find(r => r.shortfall);
    const peak = rows.reduce((m, r) => r.netWorth > m.netWorth ? r : m, rows[0]);
    const stat = (l, v, n, tone) => '<div class="stat"><span class="micro-label">' + l + '</span><div class="stat-value ' + (tone || "") + '" style="font-size:21px">' + v + "</div>" + (n ? '<div class="stat-note">' + n + "</div>" : "") + "</div>";
    const last = rows[rows.length - 1];
    const stats = '<div class="grid cols-4 section" style="margin-top:14px">' +
      stat("Net worth at " + (last.age != null ? "age " + last.age : last.year), fmtMoney(sim.end, { compact: true }),
        fmtMoney(sim.endReal, { compact: true }) + " in today’s money", sim.end >= 0 ? "pos" : "neg") +
      stat("Peak wealth", fmtMoney(peak.netWorth, { compact: true }),
        (peak.age != null ? "age " + peak.age + " · " : "") + peak.year, "gold") +
      stat("Retirement" + (sim.retireYear ? " · " + sim.retireYear : ""),
        shortYear && sim.retireYear && shortYear.year > sim.retireYear ? "runs dry " + shortYear.year
          : sim.retireYear ? (shortYear && shortYear.year <= sim.retireYear ? "shortfall " + shortYear.year : "funded to " + (last.age != null ? "age " + last.age : last.year)) : "beyond horizon",
        sim.retireYear ? "salary ends at " + w.retireAge + (w.pensionPct > 0 ? " · pension " + w.pensionPct + "%" : "") : "",
        shortYear ? "neg" : "pos") +
      stat("Estate to heirs" + this._hint("What your heirs receive at the end of the model. In Mexico, inheritances to legitimate heirs (spouse, children) are ISR-EXEMPT when settled properly through a will (testamento) — the real drag is settlement: notary, probate and appraisal costs, set above. Without a will, an intestate succession (juicio sucesorio) costs meaningfully more and takes years — the cheapest estate planning in Mexico is a testamento (≈$2–3k MXN in September campaigns)."),
        fmtMoney(sim.estate.net, { compact: true }),
        fmtMoney(sim.estate.netReal, { compact: true }) + " today’s money · " + fmtMoney(sim.estate.costs, { compact: true }) + " settlement",
        sim.estate.net > 0 ? "pos" : "neg") +
      "</div>";
    // chart: net worth line with event-year markers
    const vals = rows.map(r => r.netWorth);
    const lo = Math.min.apply(null, vals.concat([0])), hi = Math.max.apply(null, vals) || 1;
    const span = (hi - lo) || 1;
    const W = 1000, H = 200, PAD = 10;
    const X = i => PAD + (rows.length <= 1 ? 0 : i * (W - 2 * PAD) / (rows.length - 1));
    const Y = v => H - PAD - (v - lo) / span * (H - 2 * PAD);
    const line = rows.map((r, i) => X(i).toFixed(1) + "," + Y(r.netWorth).toFixed(1)).join(" ");
    const area = line + " " + X(rows.length - 1).toFixed(1) + "," + (H - PAD) + " " + X(0).toFixed(1) + "," + (H - PAD);
    const markers = rows.map((r, i) => r.events.length
      ? '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(r.netWorth).toFixed(1) + '" r="5" fill="#e6cb80" stroke="#0d1512" stroke-width="1.5"/>' : "").join("");
    const retIdx = rows.findIndex(r => r.retired);
    const retLine = retIdx >= 0
      ? '<line x1="' + X(retIdx).toFixed(1) + '" y1="0" x2="' + X(retIdx).toFixed(1) + '" y2="' + H + '" stroke="#8fc9e3" stroke-width="1.2" stroke-dasharray="5 4" opacity="0.8"/>' : "";
    const zero = lo < 0 ? '<line x1="0" y1="' + Y(0).toFixed(1) + '" x2="' + W + '" y2="' + Y(0).toFixed(1) + '" stroke="var(--rose)" stroke-width="1" stroke-dasharray="4 4" opacity="0.7"/>' : "";
    const hits = this._chartHits(rows.map(r => ({
      tip: r.year + (r.age != null ? " · age " + r.age : "") + " · <strong>" + fmtMoney(r.netWorth, { compact: true }) + "</strong>" +
        "<br>income " + fmtMoney(r.salary, { compact: true }) + " · spend " + fmtMoney(r.spend, { compact: true }) +
        "<br>fin " + fmtMoney(r.fin, { compact: true }) + " · prop " + fmtMoney(r.prop, { compact: true }) + (r.loans > 0 ? " · debt " + fmtMoney(-r.loans, { compact: true }) : "") +
        (r.tax > 0 ? " · tax " + fmtMoney(r.tax, { compact: true }) : "") +
        (r.events.length ? "<br>" + r.events.map(e => esc(e.name) + " (" + esc(e.detail) + ")").join(", ") : ""),
    })));
    const chart = '<div class="chart-wrap"><div class="cf-fc-plot">' +
      '<svg class="cf-fc-chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' +
        '<defs><linearGradient id="wpfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8fe3a6" stop-opacity="0.20"/><stop offset="100%" stop-color="#8fe3a6" stop-opacity="0"/></linearGradient></defs>' +
        zero + retLine +
        '<polygon points="' + area + '" fill="url(#wpfill)"/>' +
        '<polyline points="' + line + '" fill="none" stroke="#8fe3a6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
        markers +
      "</svg>" + hits + "</div></div>" +
      '<div class="cf-fc-scale"><span>' + rows[0].year + (rows[0].age != null ? " · " + rows[0].age : "") + "</span><span>" +
        (shortYear ? '<span class="neg">cash runs negative in ' + shortYear.year + (shortYear.age != null ? " (age " + shortYear.age + ")" : "") + "</span>"
          : "gold dots = life events" + (retIdx >= 0 ? " · blue line = retirement" : "")) +
      "</span><span>" + last.year + (last.age != null ? " · " + last.age : "") + "</span></div>";
    // the ledger of a life: every year self-contained — what you start with,
    // what comes in, what goes out, what's left
    const detailRows = rows.map((r, i) => {
      const startNW = i === 0 ? sim.start : rows[i - 1].netWorth;
      return "<tr" + (r.shortfall ? ' class="wp-short"' : "") + ">" +
        "<td>" + r.year + (r.age != null ? ' <span class="bs-kind">· ' + r.age + "</span>" : "") + "</td>" +
        '<td class="num">' + fmtMoney(startNW, { compact: true }) + "</td>" +
        '<td class="num">' + fmtMoney(r.salary, { compact: true }) + "</td>" +
        '<td class="num">' + fmtMoney(r.spend, { compact: true }) + "</td>" +
        '<td class="num">' + (r.tax > 0 ? fmtMoney(r.tax, { compact: true }) : "—") + "</td>" +
        '<td class="num ' + (r.surplus >= 0 ? "pos" : "neg") + '">' + fmtMoney(r.surplus, { sign: true, compact: true }) + "</td>" +
        '<td class="num' + (r.fin < 0 ? " neg" : "") + '">' + fmtMoney(r.fin, { compact: true }) + "</td>" +
        '<td class="num">' + (r.prop !== 0 ? fmtMoney(r.prop, { compact: true }) : "—") + "</td>" +
        '<td class="num' + (r.loans > 0 ? " neg" : "") + '">' + (r.loans > 0 ? fmtMoney(-r.loans, { compact: true }) : "—") + "</td>" +
        '<td class="num"><strong>' + fmtMoney(r.netWorth, { compact: true }) + "</strong></td>" +
        '<td class="wp-ev">' + r.events.map(e => esc(e.name)).join(", ") + "</td></tr>";
    }).join("");
    const table = '<details class="wp-detail"' + (App.wplanOpen ? " open" : "") + '><summary data-action="toggle-wplan-detail">Year-by-year detail</summary>' +
      '<div style="overflow-x:auto;margin-top:8px"><table class="tbl wp-tbl"><thead><tr>' +
      "<th>Year</th>" +
      '<th class="num">Start</th><th class="num">Income</th><th class="num">Spending</th><th class="num">Tax</th><th class="num">Saved</th>' +
      '<th class="num">Financial</th><th class="num">Property</th><th class="num">Debt</th><th class="num">Net worth</th><th>Events</th>' +
      "</tr></thead><tbody>" + detailRows + "</tbody></table></div>" +
      '<p class="method-note" style="margin-top:8px">Start is last year’s net worth. Saved = income − spending (purchases, down payments and windfalls land in their year but are events, not spending). Financial is cash + investments net of card debt; Debt is loan balances.</p></details>';
    return stats + chart + table +
      '<p class="method-note" style="margin-top:10px">Nominal unless marked. Investment returns pay the Mexican tax drag yearly on their REAL (above-inflation) component — blended from your Settings rates by the equity share (' +
      fmtMoney(sim.taxPaid, { compact: true }) + " of lifetime tax in this run). Existing loan payments live inside today’s spending (a payoff frees them); financed purchases add their down payment now and their new loan’s payments on top of spending until it dies. Property pays its carry cost every year. Estate: direct heirs are ISR-exempt in Mexico — settlement costs are the drag, and a testamento is the cheapest estate planning there is.</p>";
  },

  /* what a bad year does to the whole balance sheet — not just the portfolio */
  _stressPanel() {
    if (typeof stressTest !== "function") return "";
    const st = stressTest();
    if (!(Math.abs(st.netWorth) > 0)) return "";
    const rows = st.scenarios.map(s =>
      "<tr><td>" + esc(s.label) + "</td>" +
      '<td class="num ' + (s.impact >= 0 ? "pos" : "neg") + '">' + fmtMoney(s.impact, { sign: true, compact: true }) + "</td>" +
      '<td class="num">' + fmtPct(s.pct, 1) + "</td>" +
      '<td class="num">' + fmtMoney(s.after, { compact: true }) + "</td></tr>").join("");
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Stress test' +
      this._hint("Instant shocks applied to today's balance sheet: the equity slice (via look-through) takes the market hit, a peso devaluation re-prices everything not denominated in MXN, and property marks down. Each line is independent; the last stacks all three — roughly a 2008-style year. It says nothing about recovery, only how deep the first cut goes.") + "</div>" +
      '<span class="panel-sub">' + Math.round(st.nonMxnShare) + "% of net worth is non-MXN denominated</span></div>" +
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Scenario</th><th class="num">Impact</th><th class="num">% of net worth</th><th class="num">Net worth after</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<p class="method-note" style="margin-top:10px">A devaluation <em>helps</em> a balance sheet holding foreign assets in MXN terms — if your line is positive there, your USD exposure is a natural hedge. If it’s deeply negative, your wealth is short the dollar.</p></div>';
  },

  /* ================= CREDIT CARDS ================= */
  cards() {
    const s = Store.state;
    if (!s.cards.length) {
      return '<div class="section"><div class="empty"><div class="empty-glyph">' + icon("card") + '</div>' +
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
          '<button class="icon-btn" data-action="edit-card" data-id="' + c.id + '" title="Edit">' + icon("edit") + '</button>' +
          '<button class="icon-btn danger" data-action="del-card" data-id="' + c.id + '" title="Delete">' + icon("x") + '</button>' +
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
        '<div class="accrued-note" style="margin-top:6px">' + Math.round(util * 100) + "% used · " + (util >= 0.7 ? "high" : util >= 0.3 ? "moderate" : "healthy") + " · " + fmtMoneyIn(Math.max(0, c.limit - c.balance), c.currency, { compact: true }) + " available" +
          (Number(c.apr) > 0 ? ' · <span class="neg">~' + fmtMoneyIn(c.balance * (Number(c.apr) / 100) / 12, c.currency, { compact: true }) + "/mo interest</span>" : "") + "</div>" +
        '<div class="ccard-dates">' +
          '<div class="date-pill' + pillClass(dCut) + '"><span class="micro-label">Statement cut</span>' +
            '<span class="dp-val">' + fmtDateShort(cut) + '</span> <span class="dp-in">' + (dCut === 0 ? "today" : "in " + dCut + "d") + "</span></div>" +
          '<div class="date-pill' + pillClass(dPay) + '"><span class="micro-label">Payment due</span>' +
            '<span class="dp-val">' + fmtDateShort(pay) + '</span> <span class="dp-in">' + (dPay === 0 ? "today" : "in " + dPay + "d") + "</span></div>" +
        "</div>" +
      "</div>";
    }).join("");

    return stats + this.debtPayoffPanel() + this.buroPanel() + '<div class="grid cols-2 section">' + cardsHtml + "</div>";
  },

  /* Credit-score builder — an educational Buró de Crédito simulator. Pulls
     utilization and product count from the real cards, takes a few self-reported
     facts, and shows what each habit is worth so a beginner can build credit. */
  buroPanel() {
    if (typeof buroScore !== "function") return "";
    const b = App.buroDefaults ? App.buroDefaults() : {};
    const f = (k) => '<div class="field"><label>' + b[k].label + "</label>" +
      '<input class="buro-input fmt-num" type="text" inputmode="numeric" data-bk="' + k + '" value="' + fmtNumInput(App.buro[k]) + '">' +
      '<div class="hint">' + b[k].hint + "</div></div>";
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Credit score builder</div>' +
      '<span class="panel-sub">Buró de Crédito simulator · estimate</span></div>' +
      '<p class="method-note" style="margin-bottom:12px">Your real Buró score is private and uses more data — this is an educational estimate to show which habits build credit fastest. Utilization and number of cards come from your cards above; fill in the rest.</p>' +
      '<div class="grid cols-2">' + f("onTimeMonths") + f("lates") + f("ageYears") + f("inquiries") + "</div>" +
      '<div id="buro-out">' + this.buroOutput() + "</div></div>";
  },

  buroOutput() {
    const t = computeTotals();
    const util = t.creditLimit ? t.debt / t.creditLimit : 0;
    const products = (Store.state.cards || []).length;
    const inp = Object.assign({}, App.buro, { util: util, products: products });
    const r = buroScore(inp);
    const pos = ((r.score - r.min) / (r.max - r.min)) * 100;
    const gauge = '<div class="buro-gauge"><div class="buro-gauge-track">' +
      '<div class="buro-gauge-marker" style="left:' + Math.max(0, Math.min(100, pos)).toFixed(1) + '%"></div></div>' +
      '<div class="buro-gauge-scale"><span>' + r.min + "</span><span>" + r.max + "</span></div></div>";
    const head = '<div class="buro-head"><div class="buro-score ' + r.tone + '">' + fmtNum(r.score) +
      '<span class="buro-band">' + r.band + "</span></div>" + gauge + "</div>";
    const rows = r.factors.map(fa => {
      const cls = fa.sub >= 0.75 ? "pos" : fa.sub >= 0.45 ? "gold" : "neg";
      const col = fa.sub >= 0.75 ? "var(--mint)" : fa.sub >= 0.45 ? "var(--gold)" : "var(--rose)";
      return '<div class="buro-factor"><div class="buro-factor-top">' +
        '<span class="buro-factor-name">' + fa.label + ' <span class="buro-weight">' + Math.round(fa.weight * 100) + "%</span></span>" +
        '<span class="buro-factor-impact ' + (fa.impact > 0 ? "neg" : "pos") + '">' + (fa.impact > 0 ? "+" + fa.impact + " possible" : "maxed") + "</span></div>" +
        '<div class="buro-factor-track"><span style="width:' + (fa.sub * 100).toFixed(0) + "%;background:" + col + '"></span></div>' +
        '<div class="buro-factor-tip">' + esc(fa.tip) + "</div></div>";
    }).join("");
    const top = r.topAction && r.topAction.impact > 0
      ? '<div class="buro-action"><span class="micro-label">Biggest win right now</span><div class="buro-action-body">' +
        esc(r.topAction.label) + " — " + esc(r.topAction.tip) + ' <strong class="pos">(up to +' + r.topAction.impact + " pts)</strong></div></div>"
      : '<div class="buro-action"><div class="buro-action-body pos">You’re close to maxed out — keep these habits and your score holds strong.</div></div>';
    return head + '<div class="buro-factors section">' + rows + "</div>" + top;
  },

  /* debt-payoff calculator — snowball vs avalanche, live */
  debtPayoffPanel() {
    const debts = Store.state.cards.filter(c => conv(Number(c.balance) || 0, c.currency) > 0);
    if (!debts.length) return "";
    if (App.debtBudget == null) {
      const tot = debts.reduce((a, c) => a + conv(Number(c.balance) || 0, c.currency), 0);
      App.debtBudget = Math.max(500, Math.round(tot * 0.05 / 100) * 100);
    }
    const m = App.debtMethod || "avalanche";
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Debt payoff plan</div>' +
      '<span class="panel-sub">snowball vs avalanche · live</span></div>' +
      '<div class="grid cols-2">' +
        '<div class="field"><label>Monthly payment (' + displayCurrency() + ')</label>' +
          '<input class="debt-input fmt-num" type="text" inputmode="decimal" value="' + fmtNumInput(App.debtBudget) + '">' +
          '<div class="hint">The total you can put toward all cards each month.</div></div>' +
        '<div class="field"><label>Strategy</label>' +
          '<div class="price-range-bar">' +
            '<button class="range-btn' + (m === "avalanche" ? " on" : "") + '" data-action="debt-method" data-method="avalanche">Avalanche</button>' +
            '<button class="range-btn' + (m === "snowball" ? " on" : "") + '" data-action="debt-method" data-method="snowball">Snowball</button>' +
          "</div>" +
          '<div class="hint">Avalanche = highest APR first (cheapest). Snowball = smallest balance first (fastest wins).</div></div>' +
      "</div>" +
      '<div id="debt-out">' + this.debtPayoffOutput() + "</div></div>";
  },

  debtPayoffOutput() {
    const debts = Store.state.cards.filter(c => conv(Number(c.balance) || 0, c.currency) > 0)
      .map(c => ({ id: c.id, name: c.name, balance: conv(Number(c.balance) || 0, c.currency), apr: Number(c.apr) || 0 }));
    const budget = App.debtBudget || 0;
    const method = App.debtMethod || "avalanche";
    const plan = debtPayoff(debts, budget, method);
    if (!plan.feasible) {
      return '<div class="proj-note" style="color:var(--rose)">A ' + fmtMoney(budget) + "/mo payment is too low to clear this debt — interest keeps pace with it. Raise the monthly amount to see a payoff date.</div>";
    }
    const other = debtPayoff(debts, budget, method === "avalanche" ? "snowball" : "avalanche");
    const payoff = new Date(); payoff.setMonth(payoff.getMonth() + plan.months);
    const yrs = Math.floor(plan.months / 12), mos = plan.months % 12;
    const dur = (yrs ? yrs + "y " : "") + mos + "mo";
    const saving = other.feasible ? other.totalInterest - plan.totalInterest : null;
    const names = plan.order.map(id => (debts.find(d => d.id === id) || {}).name).filter(Boolean);
    const stat = (l, v, note, cls) => '<div class="stat"><span class="micro-label">' + l + '</span><div class="stat-value ' + (cls || "") + '">' + v + '</div><div class="stat-note">' + note + "</div></div>";
    return '<div class="grid cols-3 section" style="margin:14px 0 0">' +
      stat("Debt-free in", dur, "by " + fmtDateShort(payoff), "pos") +
      stat("Total interest", fmtMoney(plan.totalInterest, { compact: true }), "on " + fmtMoney(plan.startBalance, { compact: true }) + " owed", "neg") +
      stat(method === "avalanche" ? "vs snowball" : "vs avalanche",
        saving == null ? "—" : (saving >= 0 ? "saves " : "costs ") + fmtMoney(Math.abs(saving), { compact: true }),
        "in total interest", saving >= 0 ? "pos" : "neg") +
      "</div>" +
      (names.length ? '<div class="proj-note">Pay minimums on all, then pour every spare peso into <strong>' + esc(names[0]) + "</strong>" +
        (names.length > 1 ? ", then " + names.slice(1).map(esc).join(" → ") : "") + ".</div>" : "");
  },

  /* ================= PORTFOLIO ================= */

  /* Guided "start investing" flow for beginners — checks the order of operations
     (emergency fund → kill high-interest debt → invest) against the person's
     real numbers, then lays out a simple, Mexico-specific starter plan. */
  _startInvestingPanel() {
    if (typeof investReadiness !== "function") return "";
    const r = investReadiness();
    const cur = displayCurrency();
    // ---- readiness gates ----
    const gate = (ok, title, body, cls) =>
      '<div class="si-gate ' + (ok ? "ok" : (cls || "todo")) + '">' +
      '<span class="si-check">' + (ok ? "✓" : "•") + "</span>" +
      '<div><div class="si-gate-title">' + title + '</div><div class="si-gate-body">' + body + "</div></div></div>";
    const fundBody = r.monthsCovered != null
      ? "You have " + fmtMoney(r.fund, { compact: true }) + " in savings — about <strong>" + r.monthsCovered.toFixed(1) + " month" + (Math.abs(r.monthsCovered - 1) < 0.05 ? "" : "s") + "</strong> of spending. " +
        (r.fundOk ? "That covers the 3-month cushion." : "Aim for " + fmtMoney(r.fundTarget, { compact: true }) + " (3 months) before investing.")
      : (r.hasBudget ? "Log a savings account so we can size your cushion." : "Add a few budget months and a savings account so we can size your cushion.");
    const debtBody = r.debtOk
      ? "No high-interest card debt — nothing eating your returns."
      : "You owe " + fmtMoney(r.highDebt, { compact: true }) + " on cards above 15% APR. Paying that off is a <strong>guaranteed</strong> return no investment reliably beats — clear it first.";
    const gates = '<div class="si-gates">' +
      gate(r.fundOk, "Emergency fund first", fundBody) +
      gate(r.debtOk, "Clear high-interest debt", debtBody, "warn") +
      "</div>";
    // ---- the plan ----
    const step = (n, title, body) =>
      '<div class="si-step"><span class="si-num">' + n + '</span><div><div class="si-step-title">' + title + "</div>" +
      '<div class="si-step-body">' + body + "</div></div></div>";
    const plan =
      '<div class="si-plan section">' +
      step(1, "Open a low-cost brokerage", "In Mexico you can start with little: <strong>CetesDirecto</strong> (government CETES, no commissions) for safe yield, or a broker like GBM+, Kuspit or Bursanet for funds and ETFs.") +
      step(2, "Buy one broad index fund", "Don’t pick individual stocks to start. A single fund that tracks a wide market (an S&P 500 or global index instrument) gives you instant diversification for one low fee.") +
      step(3, "Automate " + fmtMoney(r.suggest, { compact: true }) + "/mo", "Set an automatic monthly contribution — even " + fmtMoney(r.suggest, { compact: true }) + " (~10% of your spending). Investing the same amount every month means you buy more when prices are low, less when high.") +
      step(4, "Use a PPR for retirement", "A <strong>Plan Personal de Retiro</strong> (PPR) is deductible from your ISR up to the legal cap — the government effectively co-funds your retirement savings. Worth it once the basics above are covered.") +
      step(5, "Then leave it alone", "The market wobbles; that’s normal. Buying and holding a diversified fund for years is what builds wealth — not trading. Don’t sell in a crash.") +
      "</div>";
    const verdict = r.ready
      ? '<div class="si-verdict pos">You’re ready. Your cushion is set and no costly debt is in the way — start with step 1 below.</div>'
      : '<div class="si-verdict gold">Build the foundation first (the unchecked steps above), then come back — the plan below is waiting.</div>';
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">New to investing? Start here</div>' +
      '<span class="panel-sub">a beginner’s order of operations · ' + cur + "</span></div>" +
      verdict + gates + plan +
      '<div class="si-foot"><button class="btn small ghost" data-action="nav" data-page="learn">Learn the basics →</button>' +
      '<button class="btn small ghost" data-action="nav" data-page="budget">Check my budget →</button></div>' +
      '<p class="method-note" style="margin-top:12px">Educational guidance, not personalized investment advice. Names are common Mexican options, not endorsements.</p></div>';
  },

  portfolio() {
    const s = Store.state;
    if (!s.holdings.length) {
      return this._startInvestingPanel() +
        '<div class="section"><div class="empty"><div class="empty-glyph">' + icon("growth") + '</div>' +
        "<h3>Already investing?</h3><p>Add the stocks and ETFs you own with the price you paid, and FinanceOS computes your returns as you update prices.</p>" +
        '<button class="btn primary" data-action="add-holding">+ Add your first position</button></div></div>' +
        this._realizedPanel();          // a fully-sold book still shows its history
    }
    // per-stock detail view
    if (App.holdingDetail) {
      const hd = Store.find("holdings", App.holdingDetail);
      if (hd) return this._portfolioDetail(hd);
      App.holdingDetail = null;
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
        '<div class="stat"><span class="micro-label">Best / Worst</span><div class="stat-value stat-sm">' +
          (best ? '<span class="pos">' + esc(best.h.symbol) + " " + fmtPct(best.p, 1) + "</span><br>" : "") +
          (worst && worst.h !== (best && best.h) ? '<span class="neg">' + esc(worst.h.symbol) + " " + fmtPct(worst.p, 1) + "</span>" : "") +
        "</div></div>" +
      "</div>";

    // allocation bar (weights in display currency)
    const sorted = s.holdings.slice().sort((a, b) =>
      conv(b.shares * b.currentPrice, b.currency) - conv(a.shares * a.currentPrice, a.currency));
    const mvTotal = t.marketValue || 1;
    const weight = h => conv(h.shares * h.currentPrice, h.currency) / mvTotal * 100;
    // concentration risk = share held in the top 3 positions
    const top3 = sorted.slice(0, 3).reduce((a, h) => a + weight(h), 0);
    const concTone = top3 > 70 ? "neg" : top3 > 50 ? "gold" : "pos";
    const concNote = s.holdings.length > 3
      ? '<span class="panel-sub ' + concTone + '">top 3 = ' + top3.toFixed(0) + "% of portfolio</span>"
      : '<span class="panel-sub">' + s.holdings.length + " position" + (s.holdings.length === 1 ? "" : "s") + "</span>";
    const alloc =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Allocation</div>' +
      concNote + "</div>" +
      '<div class="alloc-bar">' +
      sorted.map((h, i) =>
        '<span style="width:' + weight(h).toFixed(2) + '%;background:' + CHART_COLORS[i % CHART_COLORS.length] + '" data-tip="' + esc(h.symbol) + " · <strong>" + fmtMoney(conv(h.shares * h.currentPrice, h.currency), { compact: true }) + "</strong> · " + weight(h).toFixed(1) + '%"></span>').join("") +
      "</div>" +
      '<div class="comp-legend" style="margin-top:14px">' +
      sorted.map((h, i) =>
        '<span class="lg"><span class="dot" style="background:' + CHART_COLORS[i % CHART_COLORS.length] + '"></span>' + esc(h.symbol) + " " + weight(h).toFixed(1) + "%</span>").join("") +
      "</div></div>";

    const rows = sorted.map(h => {
      const cost = conv(h.shares * h.costBasis, h.currency), mv = conv(h.shares * h.currentPrice, h.currency);
      const pnl = mv - cost, pct = cost ? pnl / cost * 100 : 0;
      return "<tr>" +
        '<td><div class="pos-link" data-action="view-holding" data-id="' + h.id + '" title="See details &amp; price chart"><span class="sym-badge">' + esc(h.symbol.slice(0, 5)) + "</span>" +
          '<div><div class="cell-main">' + esc(h.name || h.symbol) + '</div><div class="cell-sub">' +
          (h.kind === "etf" ? "ETF" : "Stock") + " · " + esc(h.currency) +
          (Number(h.divPerShare) > 0 ? " · div " + fmtMoneyIn(h.divPerShare, h.currency) + "/sh" : "") +
          (h.accountId ? " · " + esc(Store.accountName(h.accountId)) : "") +
          (h.purchaseDate ? " · since " + fmtDateShort(parseISO(h.purchaseDate)) : "") +
          "</div></div></div></td>" +
        '<td class="num">' + fmtNum(h.shares) + "</td>" +
        '<td class="num">' + fmtMoneyIn(h.costBasis, h.currency) + "</td>" +
        '<td class="num"><input class="price-input fmt-num" type="text" inputmode="decimal" value="' + fmtNumInput(h.currentPrice) + '" data-price-id="' + h.id + '" title="Edit current price (' + esc(h.currency) + ')"></td>' +
        '<td class="num">' + fmtMoney(mv) + "</td>" +
        '<td class="num ' + (pnl >= 0 ? "pos" : "neg") + '">' + fmtMoney(pnl, { sign: true }) + '<div class="cell-sub ' + (pnl >= 0 ? "pos" : "neg") + '">' + fmtPct(pct) + "</div></td>" +
        '<td class="actions-cell">' +
          '<button class="btn small ghost" data-action="sell-holding" data-id="' + h.id + '" title="Record a sale (realized gain)">Sell</button>' +
          '<button class="icon-btn" data-action="edit-holding" data-id="' + h.id + '" title="Edit">' + icon("edit") + '</button>' +
          '<button class="icon-btn danger" data-action="del-holding" data-id="' + h.id + '" title="Delete without recording a sale">' + icon("x") + '</button>' +
        "</td></tr>";
    }).join("");

    const table =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Positions</div>' +
      '<span class="panel-sub">Paid &amp; Price in each listing\'s currency · Value &amp; Return in ' + esc(s.settings.currency) + "</span></div>" +
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr>' +
        "<th>Position</th><th class=\"num\">Shares</th><th class=\"num\">Paid</th><th class=\"num\">Price now</th><th class=\"num\">Value</th><th class=\"num\">Return</th><th></th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table></div></div>";

    const toggle = this._portfolioModeToggle();
    if (App.portfolioMode === "advanced") {
      return toggle + stats +
        this._advExposure() +
        this._advicePanel() +
        this._rebalancePanel() +
        this._advPerformanceMount() +
        this._advDividends() +
        this._advRiskMount() +
        this._flowsPanel() +
        alloc + table +
        this._realizedPanel() +
        '<p class="method-note section">Sector &amp; geography use a built-in classification of common instruments (with ETF look-through); edit any position to correct or fill it in. Risk &amp; performance use Yahoo Finance price history. The checkup’s ideas are rule-based educational observations — not personalized investment advice.</p>';
    }
    return toggle + stats + alloc + table + this._realizedPanel();
  },

  /* closed sales: realized gains for the year + the ISR the sale generates */
  _realizedPanel() {
    if (typeof realizedSummary !== "function") return "";
    const r = realizedSummary();
    if (!r.rows.length) return "";
    const stat = (l, v, n, tone) => '<div class="stat"><span class="micro-label">' + l + '</span><div class="stat-value ' + (tone || "") + '" style="font-size:21px">' + v + "</div>" + (n ? '<div class="stat-note">' + n + "</div>" : "") + "</div>";
    const stats = '<div class="grid cols-3 section" style="margin-top:0">' +
      stat("Realized " + r.year, fmtMoney(r.gainYear, { sign: true }), r.count + " sale" + (r.count === 1 ? "" : "s") + " · " + fmtMoney(r.proceedsYear, { compact: true }) + " proceeds", r.gainYear >= 0 ? "pos" : "neg") +
      stat("ISR on gains (est.)", r.taxRate > 0 ? fmtMoney(r.taxDue) : "—",
        r.taxRate > 0 ? r.taxRate + "% on the net gain — set aside for April" : "set your capital-gains rate in Settings", r.taxDue > 0 ? "gold" : "") +
      stat("All-time realized", fmtMoney(r.totalGain, { sign: true }), "across every recorded sale", r.totalGain >= 0 ? "pos" : "neg") +
      "</div>";
    const rows = r.rows.slice(0, 12).map(x =>
      "<tr><td>" + fmtDateShort(parseISO(x.date)) + "</td>" +
      "<td><span class=\"sym-badge\">" + esc(String(x.symbol).slice(0, 5)) + "</span> " + esc(x.symbol) + "</td>" +
      '<td class="num">' + fmtNum(x.shares) + "</td>" +
      '<td class="num">' + fmtMoneyIn(x.sellPrice, x.currency, { compact: true }) + "</td>" +
      '<td class="num ' + (x.gain >= 0 ? "pos" : "neg") + '">' + fmtMoney(conv(x.gain, x.currency), { sign: true }) + "</td>" +
      '<td class="actions-cell"><button class="icon-btn danger" data-action="del-realized" data-id="' + x.id + '" title="Delete this record">' + icon("x") + "</button></td></tr>").join("");
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Realized gains</div>' +
      '<span class="panel-sub">closed sales · avg-cost basis</span></div>' + stats +
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Date</th><th>Position</th><th class="num">Shares</th><th class="num">Price</th><th class="num">Gain</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      (r.gainYear < 0 ? '<p class="method-note" style="margin-top:10px">Your net result this year is a <strong>loss</strong> — in Mexico, listed-share losses can offset gains in the same year and carry forward up to 10 years. Keep the records.</p>' : "") +
      "</div>";
  },

  /* basic ⇄ advanced switch for the investments tab */
  _portfolioModeToggle() {
    const adv = App.portfolioMode === "advanced";
    return '<div class="section portfolio-mode-row">' +
      '<div class="seg-toggle">' +
        '<button class="seg-btn' + (!adv ? " on" : "") + '" data-action="portfolio-mode" data-mode="basic">Overview</button>' +
        '<button class="seg-btn' + (adv ? " on" : "") + '" data-action="portfolio-mode" data-mode="advanced">Advanced</button>' +
      "</div>" +
      (adv ? '<span class="portfolio-mode-hint">Full breakdown — exposure, risk &amp; performance</span>' : "") +
      "</div>";
  },

  /* ---- WS2: exposure — asset class, industry & geography (ETF look-through) ---- */
  _advExposure() {
    const e = (typeof portfolioExposure === "function") ? portfolioExposure() : null;
    if (!e || !(e.total > 0)) return "";
    const concTone = e.concentration === "high" ? "neg" : e.concentration === "moderate" ? "gold" : "pos";
    const head = '<div class="panel section"><div class="panel-head"><div class="panel-title">Exposure breakdown</div>' +
      '<span class="panel-sub ' + concTone + '">' + e.concentration + " · top sector " +
      (e.topSector ? esc(e.topSector.name) + " " + e.topSector.pct.toFixed(0) + "%" : "—") + "</span></div>" +
      '<div class="grid cols-3 stack-wide">' +
        this._exposureBlock("By asset class", e.byAssetClass) +
        this._exposureBlock("By industry", e.bySector) +
        this._exposureBlock("By geography", e.byRegion) +
      "</div>" +
      (e.unclassifiedPct > 0.5
        ? '<p class="method-note" style="margin-top:12px"><span class="gold">' + e.unclassifiedPct.toFixed(0) + "% of the book is unclassified.</span> Add a <strong>free Finnhub key</strong> (Settings → it also speeds up price updates) to auto-classify individual stocks by sector &amp; country, or open any position and set it manually. Broad ETFs ship with full look-through built in.</p>"
        : "") +
      "</div>";
    return head;
  },

  _exposureBlock(title, list) {
    if (!list || !list.length) return "";
    const bar = '<div class="comp-bar">' + list.map((x, i) =>
      '<span style="width:' + x.pct.toFixed(2) + '%;background:' + CHART_COLORS[i % CHART_COLORS.length] + '" data-tip="' +
      esc(x.name) + " · <strong>" + fmtMoney(x.value, { compact: true }) + "</strong> · " + x.pct.toFixed(1) + '%"></span>').join("") + "</div>";
    const legend = '<div class="exp-legend">' + list.slice(0, 8).map((x, i) =>
      '<div class="exp-row"><span class="exp-name"><span class="dot" style="background:' + CHART_COLORS[i % CHART_COLORS.length] + '"></span>' +
      esc(x.name) + '</span><span class="exp-pct">' + x.pct.toFixed(1) + "%</span></div>").join("") + "</div>";
    return '<div class="exp-block"><div class="micro-label" style="margin-bottom:8px">' + title + "</div>" + bar + legend + "</div>";
  },

  /* ---- portfolio doctor: rule-based improvement ideas ---- */
  _advicePanel() {
    if (typeof portfolioAdvice !== "function") return "";
    const ideas = portfolioAdvice();
    const wer = weightedExpenseRatio();
    if (!ideas.length && !wer) return "";
    const SEV = { high: ["neg", "Fix first"], medium: ["gold", "Worth doing"], idea: ["", "Idea"] };
    const cards = ideas.map(i => {
      const cand = (i.candidates || []).map(c =>
        '<span class="pd-cand">' + esc(c.symbol) + '<span class="pd-cand-sub">' + esc(c.name) + (c.er != null ? " · " + c.er + "%" : "") + "</span></span>").join("");
      return '<div class="pd-card ' + i.sev + '">' +
        '<div class="pd-head"><span class="pd-sev ' + SEV[i.sev][0] + '">' + SEV[i.sev][1] + "</span>" +
        '<span class="pd-title">' + i.title + "</span></div>" +
        '<p class="pd-body">' + i.body + "</p>" +
        (cand ? '<div class="pd-cands"><span class="micro-label">Instruments that address this</span>' + cand + "</div>" : "") +
      "</div>";
    }).join("");
    const werLine = wer
      ? '<span class="panel-sub">' + (ideas.length ? ideas.length + " finding" + (ideas.length === 1 ? "" : "s") + " · " : "") +
        "fund fees " + wer.pct.toFixed(2) + "%/yr ≈ " + fmtMoney(wer.annualCost, { compact: true }) + "/yr</span>"
      : '<span class="panel-sub">' + ideas.length + " findings</span>";
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Portfolio checkup' +
      this._hint("Rule-based observations from published portfolio-construction principles: concentration limits, home bias, asset mix, fund overlap, fee drag and cash drag. The instruments named are common, low-cost examples from the app's dataset — they are educational starting points for your own research, not personalized recommendations. Nothing here knows your full situation, horizon or taxes.") + "</div>" +
      werLine + "</div>" +
      (cards || '<p class="method-note">No findings — the book is diversified, cheap and fully invested by these rules. Keep it boring.</p>') +
      '<p class="method-note" style="margin-top:12px">Educational observations, not investment advice. Past performance isn’t predictive; do your own research or talk to an advisor before acting.</p></div>';
  },

  /* ---- rebalancing vs target allocation ---- */
  _rebalancePanel() {
    if (typeof rebalancePlan !== "function") return "";
    const e = portfolioExposure();
    if (!(e.total > 0)) return "";
    const saved = Store.state.settings.targetAlloc;
    // first run: propose targets = today's allocation, rounded — edit and save.
    // The standard classes always get a row so a 100%-equity book can still
    // set a bonds/cash target to work toward.
    const targets = Object.assign({ "Equity": 0, "Bonds": 0, "Cash": 0 }, saved || (function () {
      const t = {}; e.byAssetClass.forEach(c => { t[c.name] = Math.round(c.pct / 5) * 5; }); return t;
    })());
    const plan = rebalancePlan(targets);
    if (!plan) return "";
    const rows = plan.rows.map(r => {
      const over = r.drift > 5, under = r.drift < -5;
      const tone = over || under ? (over ? "gold" : "sky") : "";
      return "<tr><td>" + esc(r.name) + "</td>" +
        '<td class="num">' + r.current.toFixed(1) + "%</td>" +
        '<td class="num"><input class="ta-input" data-class="' + esc(r.name) + '" type="text" inputmode="numeric" value="' + r.target + '">%</td>' +
        '<td class="num ' + (Math.abs(r.drift) > 5 ? "gold" : "") + '">' + fmtPct(r.drift, 1) + "</td>" +
        '<td class="num ' + tone + '">' + (Math.abs(r.move) < 1 ? "—" : (r.move > 0 ? "add " : "trim ") + fmtMoney(Math.abs(r.move), { compact: true })) + "</td></tr>";
    }).join("");
    const status = !saved
      ? '<span class="panel-sub">set your targets below — proposed from today’s mix</span>'
      : plan.balanced
        ? '<span class="panel-sub pos">within the 5% band — no action needed</span>'
        : '<span class="panel-sub gold">max drift ' + plan.maxDrift.toFixed(1) + "% — outside the 5% band</span>";
    const warn = Math.abs(plan.targetSum - 100) > 0.5 && saved
      ? '<p class="method-note" style="margin-top:8px"><span class="gold">Targets sum to ' + Math.round(plan.targetSum) + "%</span> — adjust so they total 100%.</p>" : "";
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Rebalancing</div>' + status + "</div>" +
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Asset class</th><th class="num">Current</th><th class="num">Target</th><th class="num">Drift</th><th class="num">To rebalance</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<div class="import-actions" style="margin-top:10px"><button type="button" class="btn small" data-action="save-targets">Save targets</button></div>' +
      warn +
      '<p class="method-note" style="margin-top:8px">Drift = current − target (look-through, so an S&amp;P ETF counts as equities). The classic discipline: rebalance when any class drifts past 5 points, and prefer directing NEW money to the underweight class over selling (no taxable event). Informational only.</p></div>';
  },

  /* ---- WS4: performance (async mount) ---- */
  _advPerformanceMount() {
    const range = App.advRange || "1y";
    const labels = { "1mo": "1M", "6mo": "6M", "1y": "1Y", "5y": "5Y" };
    const btns = ["1mo", "6mo", "1y", "5y"].map(r =>
      '<button class="range-btn' + (r === range ? " on" : "") + '" data-action="adv-range" data-range="' + r + '">' + labels[r] + "</button>").join("");
    const body = (App.advData && App.advData.range === range)
      ? this._advPerformanceRender(App.advData)
      : '<div class="adv-loading">Loading price history from Yahoo Finance…</div>';
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Portfolio performance</div>' +
      '<span class="panel-sub">value of your current holdings over time</span></div>' +
      '<div class="price-range-bar" style="margin-bottom:12px">' + btns + "</div>" +
      '<div id="adv-perf">' + body + "</div></div>";
  },

  _advRiskMount() {
    const range = App.advRange || "1y";
    const body = (App.advData && App.advData.range === range)
      ? this._advRiskRender(App.advData)
      : '<div class="adv-loading">Loading…</div>';
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Risk &amp; volatility</div>' +
      '<span class="panel-sub">vs the S&amp;P 500 · annualized</span></div>' +
      '<div id="adv-risk">' + body + "</div></div>";
  },

  /* ---- dividend / passive-income panel (local, instant) ---- */
  _advDividends() {
    if (typeof dividendSummary !== "function") return "";
    const d = dividendSummary();
    if (!(d.annual > 0)) {
      return '<div class="panel section"><div class="panel-head"><div class="panel-title">Dividend income</div>' +
        '<span class="panel-sub">projected passive income</span></div>' +
        '<p class="method-note">No dividends recorded yet. Press <strong>↻ Update prices</strong> to auto-fill trailing dividends, or set "Dividend / share / year" when you edit a position.</p></div>';
    }
    const divTax = (Store.state.settings.tax && Number(Store.state.settings.tax.dividend)) || 0;
    const afterTax = d.annual * (1 - divTax / 100);
    const stat = (l, v, n, tone) => '<div class="stat"><span class="micro-label">' + l + '</span><div class="stat-value ' + (tone || "") + '" style="font-size:21px">' + v + "</div>" + (n ? '<div class="stat-note">' + n + "</div>" : "") + "</div>";
    const stats = '<div class="grid cols-4 section" style="margin-top:0">' +
      stat("Annual income", fmtMoney(d.annual, { compact: true }), "≈ " + fmtMoney(d.monthly, { compact: true }) + "/mo", "pos") +
      stat("Portfolio yield", d.portfolioYield.toFixed(2) + "%", "income ÷ value", "") +
      stat("Yield on cost", d.yieldOnCost.toFixed(2) + "%", "income ÷ what you paid", d.yieldOnCost > d.portfolioYield ? "pos" : "") +
      stat(divTax > 0 ? "After " + divTax + "% tax" : "Paying positions", divTax > 0 ? fmtMoney(afterTax, { compact: true }) + "/yr" : d.payers + " of " + d.positions, divTax > 0 ? "≈ " + fmtMoney(afterTax / 12, { compact: true }) + "/mo net" : "hold a dividend", "") +
      "</div>";
    const small = v => v < 10 ? fmtMoney(v) : fmtMoney(v, { compact: true });   // "$0.40", not a rounded "$0"
    const rows = d.rows.map(r =>
      "<tr><td><span class=\"sym-badge\">" + esc(String(r.symbol).slice(0, 5)) + "</span> " + esc(r.name) + "</td>" +
      '<td class="num">' + small(r.annual) + "</td>" +
      '<td class="num">' + small(r.annual / 12) + "</td>" +
      '<td class="num">' + r.yield.toFixed(2) + "%</td>" +
      '<td class="num">' + r.yieldOnCost.toFixed(2) + "%</td></tr>").join("");
    const table = '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Position</th>' +
      '<th class="num">Per year</th><th class="num">Per month</th><th class="num">Yield</th><th class="num">On cost</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Dividend income</div>' +
      '<span class="panel-sub">' + d.payers + " payer" + (d.payers === 1 ? "" : "s") + " · projected at current rates</span></div>" +
      stats + table +
      '<p class="method-note" style="margin-top:10px"><strong>Yield on cost</strong> is your dividend income against what you originally paid — it climbs over the years as companies raise payouts, which is the quiet engine of long-run income. Figures are trailing-twelve-month estimates, not guarantees.</p></div>';
  },

  /* underwater (drawdown) block, appended under the performance chart */
  _advDrawdownBlock(series) {
    const dd = (typeof drawdownInfo === "function") ? drawdownInfo(series) : null;
    if (!dd || !dd.series.length) return "";
    const pts = dd.series;
    const minDD = Math.min.apply(null, pts.map(p => p.dd));
    const W = 1000, H = 90, PAD = 6;
    const lo = Math.min(minDD, -0.0001);
    const X = (i) => PAD + (pts.length <= 1 ? 0 : i * (W - 2 * PAD) / (pts.length - 1));
    const Y = (v) => PAD + (v / lo) * (H - 2 * PAD);     // 0 at top, lo at bottom
    const line = pts.map((p, i) => X(i).toFixed(1) + "," + Y(p.dd).toFixed(1)).join(" ");
    const area = X(0).toFixed(1) + "," + PAD + " " + line + " " + X(pts.length - 1).toFixed(1) + "," + PAD;
    const ddTone = dd.maxDD <= -0.3 ? "neg" : dd.maxDD <= -0.15 ? "gold" : "pos";
    const curTxt = dd.recovered ? '<span class="pos">at a new high</span>' : '<span class="neg">' + fmtPct(dd.currentDD * 100, 1) + " below peak</span>";
    return '<div class="adv-dd"><div class="adv-dd-head"><span class="micro-label">Drawdown (value vs running peak)</span>' +
      '<span class="adv-dd-stats">max <strong class="' + ddTone + '">' + fmtPct(dd.maxDD * 100, 1) + "</strong> · now " + curTxt + "</span></div>" +
      '<div class="chart-wrap"><svg class="adv-dd-chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' +
        '<polygon points="' + area + '" fill="rgba(232,131,111,0.18)"/>' +
        '<polyline points="' + line + '" fill="none" stroke="#e8836f" stroke-width="1.8" stroke-linejoin="round"/>' +
      "</svg></div></div>";
  },

  _advItems(data) {
    return (data.holdings || []).filter(h => h.points && h.points.length > 1)
      .map(h => ({ id: h.id, symbol: h.symbol, name: h.name, shares: h.shares, fx: h.fx, beta: h.beta, points: h.points }));
  },

  _advWindowDays(range) { return range === "1mo" ? 30 : range === "6mo" ? 182 : range === "5y" ? 1825 : 365; },

  _advPerformanceRender(data) {
    const items = this._advItems(data);
    if (items.length < 1) return '<div class="adv-loading">Couldn’t load live price history (offline or blocked). Try again in a moment.</div>';
    const series = weightedValueSeries(items);
    if (series.length < 2) return '<div class="adv-loading">Not enough overlapping history to chart yet.</div>';
    const cur = displayCurrency();
    const cs = series.map(p => ({ t: p.t, c: p.v }));
    const now = series[series.length - 1].v, start = series[0].v;
    const chg = now - start, chgPct = start > 0 ? chg / start * 100 : 0;
    // day / month / year style change chips (only those the window reaches)
    const windows = [["1D", 1], ["1W", 7], ["1M", 30], ["3M", 91], ["6M", 182], ["1Y", 365]];
    const chips = windows.map(w => {
      const r = seriesReturnOver(series, w[1]);
      if (r == null) return "";
      const tone = r >= 0 ? "pos" : "neg";
      return '<div class="chg-chip"><span class="chg-lab">' + w[0] + '</span><span class="chg-val ' + tone + '">' + fmtPct(r * 100, 1) + "</span></div>";
    }).join("");
    const missing = items.length < (data.holdings || []).length
      ? '<p class="method-note" style="margin-top:10px">' + (data.holdings.length - items.length) + " of " + data.holdings.length + " positions had no live history and are excluded from this chart.</p>"
      : "";
    return '<div class="adv-perf-head"><div><div class="adv-perf-now">' + fmtMoney(now) + "</div>" +
        '<div class="adv-perf-chg ' + (chg >= 0 ? "pos" : "neg") + '">' + fmtMoney(chg, { sign: true, compact: true }) + " (" + fmtPct(chgPct, 1) + ") this window</div></div>" +
        '<div class="chg-chips">' + chips + "</div></div>" +
      this._priceLineChart(cs, { cur: cur }) +
      '<div class="price-source">current holdings × historical price · ' + series.length + " pts · Yahoo Finance · FX at today’s rate</div>" +
      this._advDrawdownBlock(series) +
      missing;
  },

  /* money-weighted return: needs only dates, so it renders offline. Prefers
     the account-level version (recorded deposits/withdrawals — captures
     dividends and closed sales) over the per-purchase fallback. */
  _xirrStat() {
    const stat = (l, v, n, tone) => '<div class="stat"><span class="micro-label">' + l + '</span><div class="stat-value ' + (tone || "") + '" style="font-size:21px">' + v + "</div>" + (n ? '<div class="stat-note">' + n + "</div>" : "") + "</div>";
    const ax = accountXirr();
    const hint = ax.source === "flows"
      ? this._hint("The IRR of the cash you actually moved in and out of the brokerage against what the account is worth today. Because buys, sells and dividends all stay inside the account, this number includes ALL of them — the truest personal return there is.")
      : this._hint("The IRR of your dated purchases against today's value. Current positions only — record your deposits and withdrawals in the Contributions panel below and this upgrades to a full account-level return that includes dividends and closed sales.");
    return stat("XIRR (money-weighted)" + hint,
      ax.rate == null ? "—" : fmtPct(ax.rate * 100, 1) + "/yr",
      ax.source === "flows" ? "from your recorded cash flows" : "from purchase dates · record flows to upgrade",
      ax.rate == null ? "" : ax.rate >= 0 ? "pos" : "neg");
  },

  /* ---- contributions & withdrawals: the money-in vs value picture ---- */
  _flowsPanel() {
    if (typeof accountXirr !== "function") return "";
    const s = Store.state;
    const flows = (s.flows || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const ax = accountXirr();
    const t = computeTotals();
    const head = '<div class="panel-head"><div class="panel-title">Contributions' +
      this._hint("Record every peso you move INTO the brokerage (deposits) and OUT of it (withdrawals). That's all the data needed for the account-level XIRR — the return that includes dividends, sales, everything — and the invested-vs-value picture below.") + "</div>" +
      '<span class="panel-sub"><button class="btn small ghost" data-action="add-flow" data-kind="deposit">+ Deposit</button> ' +
      '<button class="btn small ghost" data-action="add-flow" data-kind="withdrawal">− Withdrawal</button></span></div>';
    if (!flows.length) {
      return '<div class="panel section">' + head +
        '<p class="method-note">No flows recorded yet. Add your deposits (and any withdrawals) into the brokerage — even approximate dates work — and the XIRR above upgrades from purchase-based to a true account-level return.</p></div>';
    }
    const value = t.marketValue + t.investCash;
    const profit = value + ax.withdrawn - ax.invested;
    const stat = (l, v, n, tone) => '<div class="stat"><span class="micro-label">' + l + '</span><div class="stat-value ' + (tone || "") + '" style="font-size:21px">' + v + "</div>" + (n ? '<div class="stat-note">' + n + "</div>" : "") + "</div>";
    const stats = '<div class="grid cols-4 section" style="margin-top:0">' +
      stat("Net invested", fmtMoney(ax.invested - ax.withdrawn, { compact: true }), fmtMoney(ax.invested, { compact: true }) + " in · " + fmtMoney(ax.withdrawn, { compact: true }) + " out") +
      stat("Account value", fmtMoney(value, { compact: true }), "holdings + brokerage cash") +
      stat("True profit", fmtMoney(profit, { sign: true, compact: true }), "value + withdrawn − invested", profit >= 0 ? "pos" : "neg") +
      stat("Account XIRR", ax.rate == null ? "—" : fmtPct(ax.rate * 100, 1) + "/yr", "includes dividends & sales", ax.rate == null ? "" : ax.rate >= 0 ? "pos" : "neg") +
      "</div>";
    // invested-vs-value: cumulative contribution step line, value as end marker
    const cs = contributionSeries();
    let chart = "";
    if (cs.length >= 2) {
      const pts = cs.concat([{ t: todayMid().getTime(), v: cs[cs.length - 1].v }]);
      const vals = pts.map(p => p.v).concat([value]);
      const lo = Math.min.apply(null, vals.concat([0])), hi = Math.max.apply(null, vals) || 1;
      const span = (hi - lo) || 1;
      const W = 1000, H = 150, PAD = 8;
      const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
      const X = tm => PAD + (t1 === t0 ? 0 : (tm - t0) / (t1 - t0)) * (W - 2 * PAD);
      const Y = v => H - PAD - (v - lo) / span * (H - 2 * PAD);
      // step line for contributions
      let d = "";
      pts.forEach((p, i) => {
        if (i === 0) d += X(p.t).toFixed(1) + "," + Y(p.v).toFixed(1);
        else d += " " + X(p.t).toFixed(1) + "," + Y(pts[i - 1].v).toFixed(1) + " " + X(p.t).toFixed(1) + "," + Y(p.v).toFixed(1);
      });
      chart = '<div class="chart-wrap"><svg class="cf-fc-chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' +
        '<polyline points="' + d + '" fill="none" stroke="#9aa3b2" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>' +
        '<circle cx="' + X(t1).toFixed(1) + '" cy="' + Y(value).toFixed(1) + '" r="5" fill="#8fe3a6"/>' +
        '<line x1="' + X(t1).toFixed(1) + '" y1="' + Y(pts[pts.length - 1].v).toFixed(1) + '" x2="' + X(t1).toFixed(1) + '" y2="' + Y(value).toFixed(1) + '" stroke="#8fe3a6" stroke-width="1.5" stroke-dasharray="2 3"/>' +
        "</svg></div>" +
        '<div class="comp-legend" style="margin-top:8px"><span class="lg"><span class="dot" style="background:#9aa3b2"></span>Net invested</span>' +
        '<span class="lg"><span class="dot" style="background:#8fe3a6"></span>Value today</span>' +
        '<span class="lg ' + (profit >= 0 ? "pos" : "neg") + '" style="margin-left:auto">gap = ' + fmtMoney(profit, { sign: true, compact: true }) + " earned</span></div>";
    }
    const rows = flows.slice(0, 10).map(f =>
      '<div class="bs-row"><span class="bs-name">' + (f.kind === "withdrawal" ? "− Withdrawal" : "+ Deposit") +
        '<span class="bs-kind">' + fmtDateShort(parseISO(f.date)) + (f.note ? " · " + esc(f.note) : "") + "</span></span>" +
      '<span class="bs-amt' + (f.kind === "withdrawal" ? " neg" : "") + '">' + fmtMoneyIn(f.amount, f.currency, { compact: true }) + "</span>" +
      '<span class="bs-actions"><button class="icon-btn danger" data-action="del-flow" data-id="' + f.id + '" title="Delete">' + icon("x") + "</button></span></div>").join("");
    return '<div class="panel section">' + head + stats + chart +
      '<div style="margin-top:12px">' + rows + (flows.length > 10 ? '<p class="method-note">…and ' + (flows.length - 10) + " more</p>" : "") + "</div></div>";
  },

  _advRiskRender(data) {
    const items = this._advItems(data);
    if (items.length < 1) return '<div class="grid cols-3 section" style="margin-top:0">' + this._xirrStat() + "</div>" +
      '<div class="adv-loading">Couldn’t load live price history (offline or blocked) — volatility, beta and Sharpe need it. Try again in a moment.</div>';
    const bench = (data.bench && data.bench.length > 1) ? data.bench : null;
    const winDays = this._advWindowDays(data.range);
    const series = weightedValueSeries(items);
    const pSeries = series.map(p => ({ t: p.t, c: p.v }));
    const ppy = periodsPerYear(pSeries);
    const pVol = annualizedVol(seriesReturns(pSeries), ppy);
    const totalMv = computeTotals().marketValue || 1;
    // per-holding weight (current shares × today's FX × latest close ÷ book)
    const weightOf = it => it.shares * it.fx * it.points[it.points.length - 1].c / totalMv * 100;
    // portfolio beta: from the value series vs the S&P; if that's unavailable,
    // fall back to the weight-weighted average of holdings' (Finnhub) betas
    let pBeta = bench ? betaOf(pSeries, bench) : null, pBetaSrc = pBeta != null ? "history" : null;
    if (pBeta == null) {
      let bw = 0, ws = 0;
      items.forEach(it => { if (it.beta != null) { const w = weightOf(it); bw += it.beta * w; ws += w; } });
      if (ws > 0) { pBeta = bw / ws; pBetaSrc = "finnhub"; }
    }
    const stat = (l, v, n, tone) => '<div class="stat"><span class="micro-label">' + l + '</span><div class="stat-value ' + (tone || "") + '" style="font-size:21px">' + v + "</div>" + (n ? '<div class="stat-note">' + n + "</div>" : "") + "</div>";
    const volTone = pVol >= 0.25 ? "neg" : pVol >= 0.15 ? "gold" : "pos";
    const betaTxt = pBeta == null ? "—" : pBeta.toFixed(2);
    const betaNote = pBeta == null ? "add a free Finnhub key or more history"
      : (pBeta > 1.05 ? "swings harder than the market" : pBeta < 0.95 ? "steadier than the market" : "moves with the market") + (pBetaSrc === "finnhub" ? " · Finnhub" : "");
    // risk-adjusted + money-weighted returns — the numbers a pro actually asks for
    const rf = (Store.state.settings.riskFreePct != null ? Number(Store.state.settings.riskFreePct) : 7.5);
    const ra = riskAdjusted(pSeries, ppy, rf);
    const sharpeTone = v => v == null ? "" : v >= 1 ? "pos" : v >= 0.5 ? "gold" : "neg";
    const summary = '<div class="grid cols-3 section" style="margin-top:0">' +
      stat("Portfolio volatility", (pVol * 100).toFixed(1) + "%", "annualized · " + (ppy === 252 ? "daily" : ppy === 52 ? "weekly" : "monthly") + " data", volTone) +
      stat("Beta vs S&P 500", betaTxt, betaNote, pBeta == null ? "" : pBeta > 1.05 ? "gold" : "pos") +
      stat("Positions analyzed", items.length + " of " + (data.holdings || []).length, "with live history") +
      "</div>" +
      '<div class="grid cols-3 section" style="margin-top:0">' +
      this._xirrStat() +
      stat("Sharpe ratio" + this._hint("Annualized return above the risk-free rate (" + rf + "%, editable in Settings — think CETES) per unit of volatility, over this window. Above 1 is strong; below 0.5 means you're barely being paid for the risk."),
        ra && ra.sharpe != null ? ra.sharpe.toFixed(2) : "—", "vs " + rf + "% risk-free · this window", sharpeTone(ra && ra.sharpe)) +
      stat("Sortino ratio" + this._hint("Like Sharpe, but only DOWNSIDE volatility counts as risk — upside swings don't get punished. The kinder, arguably fairer cousin."),
        ra && ra.sortino != null ? ra.sortino.toFixed(2) : "—", "downside risk only", sharpeTone(ra && ra.sortino)) +
      "</div>";
    const rows = items.map(it => {
      const vol = annualizedVol(seriesReturns(it.points), periodsPerYear(it.points));
      // prefer the real Finnhub beta; fall back to one computed from history
      const histBeta = bench ? betaOf(it.points, bench) : null;
      const beta = it.beta != null ? it.beta : histBeta;
      const betaMark = (it.beta != null) ? '<span class="beta-src" title="Finnhub market beta">•</span>' : "";
      const corr = bench ? correlationOf(it.points, bench) : null;
      const ret = seriesReturnOver(it.points, winDays);
      const w = weightOf(it);
      return "<tr><td><span class=\"sym-badge\">" + esc(String(it.symbol).slice(0, 5)) + "</span> " + esc(it.symbol) + "</td>" +
        '<td class="num">' + w.toFixed(1) + "%</td>" +
        '<td class="num ' + (ret == null ? "" : ret >= 0 ? "pos" : "neg") + '">' + (ret == null ? "—" : fmtPct(ret * 100, 1)) + "</td>" +
        '<td class="num">' + (vol * 100).toFixed(1) + "%</td>" +
        '<td class="num">' + (beta == null ? "—" : beta.toFixed(2)) + betaMark + "</td>" +
        '<td class="num">' + (corr == null ? "—" : corr.toFixed(2)) + "</td></tr>";
    }).join("");
    const table = '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Position</th><th class="num">Weight</th>' +
      '<th class="num">Return</th><th class="num">Vol</th><th class="num">Beta</th><th class="num">Corr</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
    const note = '<p class="method-note" style="margin-top:10px"><strong>Volatility</strong> is the annualized standard deviation of returns — how much the value swings. <strong>Beta</strong> and <strong>correlation</strong> are measured against the S&amp;P 500: beta ~1 moves with the market, &gt;1 amplifies it; correlation near 1 means they move together (low correlation is what real diversification looks like). A <span class="beta-src">•</span> marks a beta from Finnhub (needs a free key); others are computed from price history.</p>';
    return summary + table + note;
  },

  /* async: pull each holding's price history (+ the S&P benchmark) for the
     selected range, cache on App.advData, then re-render the advanced view. */
  loadAdvancedData(range) {
    range = range || "1y";
    const interval = range === "5y" ? "1wk" : "1d";
    const holdings = Store.state.holdings || [];
    if (!holdings.length) return;
    App._advLoading = range;
    const mapH = (h, points) => ({ id: h.id, symbol: h.symbol, name: h.name || h.symbol, shares: Number(h.shares) || 0, currency: h.currency, fx: conv(1, h.currency), beta: isFinite(Number(h.beta)) ? Number(h.beta) : null, points: points });
    const jobs = holdings.map(h => Store.fetchHistory(h.symbol, range, interval)
      .then(d => mapH(h, (d && d.points) || null))
      .catch(() => mapH(h, null)));
    const benchJob = Store.fetchHistory("^GSPC", range, interval).then(d => (d && d.points) || null).catch(() => null);
    Promise.all([Promise.all(jobs), benchJob]).then(([hs, bench]) => {
      App._advLoading = null;
      App.advData = { range: range, holdings: hs, bench: bench, ts: Date.now() };
      if (App.page === "portfolio" && App.portfolioMode === "advanced") App.render();
    }).catch(() => { App._advLoading = null; });
  },

  /* ---------- single-stock detail ---------- */
  _portfolioDetail(h) {
    const cur = h.currency;
    const shares = Number(h.shares) || 0, paid = Number(h.costBasis) || 0, now = Number(h.currentPrice) || 0;
    const cost = conv(shares * paid, cur), mv = conv(shares * now, cur);
    const pnl = mv - cost, pct = cost ? pnl / cost * 100 : 0;
    const taxCG = (Store.state.settings.tax && Number(Store.state.settings.tax.capGains)) || 0;
    const div = Number(h.divPerShare) || 0;
    const annualDiv = conv(shares * div, cur);
    const yieldPct = now ? div / now * 100 : 0;
    const allocPct = mv / (computeTotals().marketValue || 1) * 100;
    const range = App.priceRange || "6mo";
    const rangeLabels = { "1mo": "1M", "6mo": "6M", "1y": "1Y", "5y": "5Y" };
    const rangeBtns = ["1mo", "6mo", "1y", "5y"].map(r =>
      '<button class="range-btn' + (r === range ? " on" : "") + '" data-action="price-range" data-range="' + r + '">' + rangeLabels[r] + "</button>").join("");

    // synchronous fallback chart: your cost basis at purchase → current price
    const pd = parseISO(h.purchaseDate);
    const fb = [];
    if (pd && paid > 0) fb.push({ t: pd.getTime(), c: paid });
    fb.push({ t: todayMid().getTime(), c: now });

    const stat = (l, v, n, tone) =>
      '<div class="stat"><span class="micro-label">' + l + '</span><div class="stat-value ' + (tone || "") + '" style="font-size:21px">' + v + "</div>" +
      (n ? '<div class="stat-note">' + n + "</div>" : "") + "</div>";

    return (
      '<div class="section"><button class="btn small ghost" data-action="back-portfolio">← All positions</button></div>' +
      '<div class="panel section">' +
        '<div class="detail-head">' +
          '<span class="sym-badge lg">' + esc(h.symbol.slice(0, 5)) + "</span>" +
          '<div class="detail-title"><div class="detail-name">' + esc(h.name || h.symbol) + "</div>" +
            '<div class="detail-meta">' + esc(h.symbol) + " · " + (h.kind === "etf" ? "ETF" : "Stock") + " · " + esc(cur) +
              (h.accountId ? " · " + esc(Store.accountName(h.accountId)) : "") +
              (h.purchaseDate ? " · since " + fmtDateShort(parseISO(h.purchaseDate)) : "") + "</div></div>" +
          '<div class="detail-actions">' +
            '<button class="icon-btn" data-action="edit-holding" data-id="' + h.id + '" title="Edit">' + icon("edit") + '</button>' +
            '<button class="icon-btn danger" data-action="del-holding" data-id="' + h.id + '" title="Delete">' + icon("x") + '</button></div>' +
        "</div>" +
        '<div class="detail-price"><div class="detail-now">' + fmtMoneyIn(now, cur) + "</div>" +
          '<div class="detail-chg ' + (pnl >= 0 ? "pos" : "neg") + '">' + fmtMoney(pnl, { sign: true, compact: true }) + " (" + fmtPct(pct, 1) + ") all-time</div></div>" +
        '<div class="price-range-bar">' + rangeBtns + "</div>" +
        '<div id="price-chart" class="price-chart-mount" data-symbol="' + esc(h.symbol) + '" data-range="' + range + '" data-cur="' + esc(cur) + '">' +
          this._priceLineChart(fb, { cur: cur }) +
          '<div class="price-loading">Loading live price history…</div>' +
        "</div>" +
      "</div>" +
      '<div class="grid cols-4 section">' +
        stat("Market value", fmtMoney(mv), allocPct.toFixed(1) + "% of portfolio") +
        stat("Total return", fmtMoney(pnl, { sign: true }), fmtPct(pct) + (taxCG > 0 && pnl > 0 ? " · " + fmtMoney(pnl * (1 - taxCG / 100), { sign: true, compact: true }) + " after tax" : ""), pnl >= 0 ? "pos" : "neg") +
        stat("Shares", fmtNum(shares), "avg cost " + fmtMoneyIn(paid, cur)) +
        stat("Dividends / yr", annualDiv > 0 ? fmtMoney(annualDiv) : "—", yieldPct > 0 ? yieldPct.toFixed(2) + "% yield" : "no dividend") +
      "</div>" +
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Update price</div><span class="panel-sub">in ' + esc(cur) + ' · or refresh all from Yahoo</span></div>' +
        '<div class="detail-update"><input class="price-input fmt-num" type="text" inputmode="decimal" value="' + fmtNumInput(now) + '" data-price-id="' + h.id + '">' +
        '<button class="btn small" data-action="refresh-prices">↻ Update all prices</button></div></div>'
    );
  },

  /* price line chart from [{t,c}] points (t = ms) */
  _priceLineChart(points, opts) {
    opts = opts || {};
    const cur = opts.cur || displayCurrency();
    if (!points || points.length < 2) return '<div class="all-clear" style="color:var(--text-mute)">No price history to chart yet.</div>';
    const cs = points.map(p => p.c);
    const n = points.length;
    // optional benchmark (e.g. S&P 500), resampled to n points and rebased to
    // this position's starting price so the two lines start together and the
    // chart reads as relative performance regardless of currency.
    let bench = null;
    if (opts.benchmark && opts.benchmark.length >= 2) {
      const b = opts.benchmark, nb = b.length, base = b[0].c || 1, p0 = cs[0];
      bench = points.map((p, i) => p0 * (b[Math.round((nb - 1) * (n <= 1 ? 0 : i / (n - 1)))].c / base));
    }
    const allV = bench ? cs.concat(bench) : cs;
    const min = Math.min.apply(null, allV), max = Math.max.apply(null, allV);
    const span = (max - min) || 1;
    const W = 1000, H = 230, PAD = 10;
    const X = (i) => PAD + (n <= 1 ? 0 : i * (W - 2 * PAD) / (n - 1));
    const Y = (c) => H - PAD - ((c - min) / span) * (H - 2 * PAD);
    const line = points.map((p, i) => X(i).toFixed(1) + "," + Y(p.c).toFixed(1)).join(" ");
    const area = line + " " + X(n - 1).toFixed(1) + "," + (H - PAD) + " " + X(0).toFixed(1) + "," + (H - PAD);
    const up = cs[n - 1] >= cs[0];
    const col = up ? "#8fe3a6" : "#e8836f";
    let benchSvg = "", benchLegend = "";
    if (bench) {
      const bl = bench.map((c, i) => X(i).toFixed(1) + "," + Y(c).toFixed(1)).join(" ");
      benchSvg = '<polyline points="' + bl + '" fill="none" stroke="#9aa3b2" stroke-width="1.8" stroke-dasharray="5 4" stroke-linejoin="round"/>';
      const myRet = cs[0] ? (cs[n - 1] / cs[0] - 1) * 100 : 0;
      const b0 = opts.benchmark[0].c, bN = opts.benchmark[opts.benchmark.length - 1].c;
      const bRet = b0 ? (bN / b0 - 1) * 100 : 0;
      const diff = myRet - bRet;
      benchLegend = '<div class="comp-legend" style="margin-top:10px">' +
        '<span class="lg"><span class="dot" style="background:' + col + '"></span>' + esc(opts.symbol || "This position") + " " + fmtPct(myRet, 1) + "</span>" +
        '<span class="lg"><span class="dot" style="background:#9aa3b2"></span>S&amp;P 500 ' + fmtPct(bRet, 1) + "</span>" +
        '<span class="lg ' + (diff >= 0 ? "pos" : "neg") + '" style="margin-left:auto">' + (diff >= 0 ? "beating" : "trailing") + " the market by " + Math.abs(diff).toFixed(1) + "%</span></div>";
    }
    return '<div class="chart-wrap"><svg class="price-chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="phfill" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + col + '" stop-opacity="0.22"/><stop offset="100%" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>' +
      '<polygon points="' + area + '" fill="url(#phfill)"/>' +
      benchSvg +
      '<polyline points="' + line + '" fill="none" stroke="' + col + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      "</svg>" +
      this._chartHits(points.map(p => ({ tip: fmtDateShort(new Date(p.t)) + " · <strong>" + fmtMoneyIn(p.c, cur) + "</strong>" }))) +
      "</div>" + benchLegend +
      '<div class="price-scale"><span>' + fmtDateShort(new Date(points[0].t)) + "</span>" +
        '<span>low ' + fmtMoneyIn(min, cur) + " · high " + fmtMoneyIn(max, cur) + "</span>" +
        "<span>" + fmtDateShort(new Date(points[n - 1].t)) + "</span></div>";
  },

  /* invisible full-height hit columns that reveal a value tooltip on tap */
  _chartHits(items) {
    const n = items.length;
    if (!n) return "";
    const w = 100 / n;
    return items.map((it, i) =>
      '<button type="button" class="chart-hit" data-tip="' + esc(it.tip) + '" style="left:' + (i * w).toFixed(3) + "%;width:" + w.toFixed(3) + '%" aria-label="' + esc(String(it.tip).replace(/<[^>]+>/g, "")) + '"></button>').join("");
  },

  /* called by App.render() after the page mounts — fetch live history async */
  afterRender(page) {
    if (page !== "portfolio") return;
    const mount = document.getElementById("price-chart");
    if (mount && mount.dataset.symbol) this.loadPriceChart(mount);
    // advanced mode: fetch the history dataset for the selected range once
    if (App.portfolioMode === "advanced" && (Store.state.holdings || []).length) {
      const range = App.advRange || "1y";
      const have = App.advData && App.advData.range === range;
      if (!have && App._advLoading !== range) this.loadAdvancedData(range);
    }
  },

  loadPriceChart(mount) {
    const sym = mount.dataset.symbol, range = mount.dataset.range, cur = mount.dataset.cur;
    const wantBench = sym !== "^GSPC";
    Promise.all([
      Store.fetchHistory(sym, range),
      wantBench ? Store.fetchHistory("^GSPC", range).catch(() => null) : Promise.resolve(null),
    ]).then(([data, bench]) => {
      const live = document.getElementById("price-chart");
      if (!live || live.dataset.symbol !== sym || live.dataset.range !== range) return; // re-rendered
      if (data && data.points && data.points.length >= 2) {
        const opts = { cur: cur, symbol: sym };
        if (bench && bench.points && bench.points.length >= 2) opts.benchmark = bench.points;
        live.innerHTML = this._priceLineChart(data.points, opts) +
          '<div class="price-source">' + data.points.length + " pts · Yahoo Finance" + (opts.benchmark ? " · vs S&amp;P 500" : "") + "</div>";
      } else {
        const l = live.querySelector(".price-loading");
        if (l) l.textContent = "Couldn't load live history (offline or blocked) — showing your cost vs current price.";
      }
    }).catch(() => {
      const l = document.getElementById("price-chart");
      const e = l && l.querySelector(".price-loading");
      if (e) e.textContent = "Couldn't load price history right now.";
    });
  },

  /* ---------- income projection: compounds interest, interactive ---------- */
  _incomeProjection(s, eb, tax, now) {
    const years = [1, 3, 5].indexOf(App.earnHorizon) !== -1 ? App.earnHorizon : 1;
    const horizonMonths = years * 12;
    const bucketSize = years <= 1 ? 1 : years <= 3 ? 3 : 6;   // monthly / quarterly / semiannual
    const taxI = Number(tax.interest) || 0;
    const provI = Number(tax.interestProvisional) || 0;
    const divMoNet = eb.divNet / 12;                          // flat monthly dividends (net)

    // interest-bearing balances (native ccy), compounded monthly so interest grows
    const accs = s.accounts.filter(a => Number(a.apy) > 0)
      .map(a => ({ apy: Number(a.apy), cur: a.currency, bal: Number(a.balance) || 0 }));

    const monthly = [];
    for (let i = 0; i < horizonMonths; i++) {
      const mStart = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
      let sched = 0;
      s.incomes.forEach(st => {
        sched += incomeOccurrences(st, (i === 0 && mStart < now) ? now : mStart, mEnd).length * conv(netPerDeposit(st), st.currency);
      });
      let interest = 0;
      accs.forEach(a => {
        const mInt = a.bal * (Math.pow(1 + a.apy / 100, 1 / 12) - 1);
        const credited = mInt - a.bal * (provI / 100) / 12;   // gross, less the provisional ISR on capital
        interest += conv(credited, a.cur);
        a.bal += credited;   // interest compounds in full; income ISR is settled yearly
      });
      monthly.push({ sched: sched, interest: interest, div: divMoNet, start: mStart, end: mEnd });
    }
    const endBal = accs.reduce((x, a) => x + conv(a.bal, a.cur), 0);

    const buckets = [];
    for (let i = 0; i < horizonMonths; i += bucketSize) {
      const sl = monthly.slice(i, i + bucketSize);
      buckets.push({
        sched: sl.reduce((x, m) => x + m.sched, 0),
        interest: sl.reduce((x, m) => x + m.interest, 0),
        div: sl.reduce((x, m) => x + m.div, 0),
        start: sl[0].start, end: sl[sl.length - 1].end,
      });
    }
    buckets.forEach(b => { b.total = b.sched + b.interest + b.div; });
    const grandTotal = buckets.reduce((x, b) => x + b.total, 0);
    const maxB = Math.max.apply(null, buckets.map(b => b.total).concat([1]));

    let sel = App.earnSel;
    if (sel == null || sel < 0 || sel >= buckets.length) sel = 0;

    const yr2 = (d) => "’" + String(d.getFullYear()).slice(2);
    const bLabel = (b) => MONTHS_SHORT[b.start.getMonth()] + (bucketSize > 1 || b.start.getMonth() === 0 ? " " + yr2(b.start) : "");

    const grid = [1, 2 / 3, 1 / 3].map(f =>
      '<div class="proj-grid" style="top:' + ((1 - f) * 100).toFixed(1) + '%"><span>' + fmtMoney(maxB * f, { compact: true }) + "</span></div>").join("");

    const bars = buckets.map((b, i) => {
      const hS = b.total > 0 ? b.sched / maxB * 100 : 0;
      const hP = b.total > 0 ? (b.interest + b.div) / maxB * 100 : 0;
      return '<div class="proj-col' + (i === sel ? " sel" : "") + '" data-action="earn-bucket" data-i="' + i + '" tabindex="0" role="button" aria-label="' + esc(bLabel(b) + ", " + fmtMoney(b.total, { compact: true }) + " total. Scheduled " + fmtMoney(b.sched, { compact: true }) + ", interest " + fmtMoney(b.interest, { compact: true }) + ", dividends " + fmtMoney(b.div, { compact: true })) + '" title="' + esc(bLabel(b) + " · " + fmtMoney(b.total, { compact: true })) + '">' +
        '<div class="proj-stack" style="height:' + Math.max(2, hS + hP).toFixed(1) + '%">' +
          '<div class="seg-income" style="flex:' + (b.sched || 0.001) + '"></div>' +
          '<div class="seg-interest" style="flex:' + ((b.interest + b.div) || 0.001) + '"></div>' +
        "</div></div>";
    }).join("");
    const axis = buckets.map(b => "<span>" + esc(bLabel(b)) + "</span>").join("");

    const b = buckets[sel];
    const rStart = sel === 0 && b.start < now ? now : b.start;
    const row = (label, val, color) =>
      '<div class="proj-row"><span><span class="proj-dot" style="background:' + color + '"></span>' + label + "</span><span class=\"proj-val\">" + fmtMoney(val) + "</span></div>";
    const detail =
      '<div class="proj-detail"><div class="proj-detail-head">' +
        '<div><div class="micro-label">' + fmtDateShort(rStart) + " – " + fmtDateShort(b.end) + "</div>" +
          '<div class="proj-detail-total">' + fmtMoney(b.total) + "</div></div>" +
        '<div class="micro-label" style="text-align:right">selected ' + (bucketSize === 1 ? "month" : bucketSize === 3 ? "quarter" : "half-year") + "</div></div>" +
      '<div class="proj-detail-rows">' +
        row("Scheduled income", b.sched, "var(--mint)") +
        row("Interest" + (taxI > 0 ? " (gross)" : ""), b.interest, "var(--gold)") +
        row("Dividends" + ((Number(tax.dividends) || 0) > 0 ? " (net)" : ""), b.div, "#e5c97b") +
      "</div></div>";

    const horizonBtns = [[1, "1Y"], [3, "3Y"], [5, "5Y"]].map(o =>
      '<button class="range-btn' + (years === o[0] ? " on" : "") + '" data-action="earn-horizon" data-years="' + o[0] + '">' + o[1] + "</button>").join("");

    return '<div class="panel section">' +
      '<div class="panel-head"><div class="panel-title">Income projection <span class="panel-sub">interest paid gross · dividends net · compounds monthly</span></div>' +
        '<div class="price-range-bar">' + horizonBtns + "</div></div>" +
      '<div class="comp-legend" style="margin:2px 0 14px">' +
        '<span class="lg"><span class="dot" style="background:var(--mint)"></span>Scheduled</span>' +
        '<span class="lg"><span class="dot" style="background:var(--gold)"></span>Interest + dividends</span>' +
        '<span class="lg" style="margin-left:auto">Total over ' + years + 'y · <strong style="color:var(--text)">' + fmtMoney(grandTotal, { compact: true }) + "</strong></span></div>" +
      '<div class="proj-plot">' + grid + '<div class="proj-bars">' + bars + "</div></div>" +
      '<div class="proj-axis">' + axis + "</div>" +
      detail +
      (endBal > 0 ? '<div class="proj-note">Tap a bar for its breakdown. Projected savings balance after ' + years + "y, interest reinvested: <strong>" + fmtMoney(endBal, { compact: true }) + "</strong> (no new contributions assumed).</div>" : '<div class="proj-note">Tap a bar for its breakdown.</div>') +
      (eb.intTaxDueApril > 0 ? '<div class="proj-note">Interest is paid gross — set aside ≈<strong>' + fmtMoney(eb.intTaxDueApril, { compact: true }) + "</strong>/yr for the ISR due in your April return" + (eb.intProvisional > 0 ? " (on top of the " + fmtMoney(eb.intProvisional, { compact: true }) + " already withheld on capital)" : "") + ".</div>" : "") +
    "</div>";
  },

  /* small tap-to-explain "?" chip — reuses the chart tooltip */
  _hint(text) {
    return ' <button type="button" class="info-chip" data-tip="' + esc(text) + '" aria-label="Explain: ' + esc(text) + '">?</button>';
  },

  /* income-by-source breakdown + passive vs active split */
  _incomeSources(s, eb) {
    const byCat = {};
    s.incomes.forEach(i => { const c = i.category || "Other"; byCat[c] = (byCat[c] || 0) + conv(monthlyEquivalentNet(i) * 12, i.currency); });
    const passiveCat = { Rent: 1, Dividends: 1 };
    const sources = [];
    Object.keys(byCat).forEach(c => { if (byCat[c] > 0) sources.push({ label: c, val: byCat[c], passive: !!passiveCat[c] }); });
    if (eb.intNet > 0) sources.push({ label: "Interest", val: eb.intNet, passive: true });
    if (eb.divNet > 0) sources.push({ label: "Dividends", val: eb.divNet, passive: true });
    if (eb.investNet > 0) sources.push({ label: "Investment", val: eb.investNet, passive: true });
    sources.sort((a, b) => b.val - a.val);
    const total = sources.reduce((x, y) => x + y.val, 0);
    if (!(total > 0)) return "";
    const passive = sources.filter(x => x.passive).reduce((x, y) => x + y.val, 0);
    const pShare = Math.round(passive / total * 100);
    const seg = sources.map((x, i) => {
      const pc = x.val / total * 100;
      return '<span style="width:' + pc.toFixed(2) + '%;background:' + CHART_COLORS[i % CHART_COLORS.length] +
        '" data-tip="' + esc(x.label) + " · <strong>" + fmtMoney(x.val, { compact: true }) + "/yr</strong> · " + pc.toFixed(0) + '%" aria-label="' + esc(x.label + " " + fmtMoney(x.val, { compact: true }) + " per year, " + pc.toFixed(0) + " percent") + '"></span>';
    }).join("");
    const legend = sources.map((x, i) =>
      '<span class="lg"><span class="dot" style="background:' + CHART_COLORS[i % CHART_COLORS.length] + '"></span>' + esc(x.label) + " · " + fmtMoney(x.val, { compact: true }) + "/yr" + (x.passive ? " · passive" : "") + "</span>").join("");
    const investNote = sources.some(x => x.label === "Investment")
      ? this._hint("Investment income = your holdings' market value × their long-run (≈10-year, or max available) average annual return, defaulting to 9% when there's no price history. Hit “Update prices” to refine it per holding.")
      : "";
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Where your income comes from <span class="panel-sub">net, per year</span>' + investNote + "</div>" +
      '<span class="chip-split">▲ Passive <strong class="pos">' + pShare + "%</strong> · Active " + (100 - pShare) + "%</span></div>" +
      '<div class="comp-bar" role="img" aria-label="Income by source: passive ' + pShare + ' percent, active ' + (100 - pShare) + ' percent">' + seg + "</div>" +
      '<div class="comp-legend" style="margin-top:14px">' + legend + "</div></div>";
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

    /* ---- income projection chart (compounding, interactive) ---- */
    const chart = this._incomeProjection(s, eb, tax, now);

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
          '<button class="icon-btn" data-action="edit-income" data-id="' + inc.id + '" title="Edit">' + icon("edit") + '</button>' +
          '<button class="icon-btn danger" data-action="del-income" data-id="' + inc.id + '" title="Delete">' + icon("x") + '</button>' +
        "</td></tr>";
    }).join("") : '<tr><td colspan="6" style="color:var(--text-mute);text-align:center;padding:26px">No income streams yet — add your salary or other recurring income.</td></tr>';

    const streams =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Income streams</div>' +
      '<button class="btn small primary" data-action="add-income">+ Add stream</button></div>' +
      '<div style="overflow-x:auto"><table class="tbl tbl-nowrap"><thead><tr>' +
        "<th>Stream</th><th>Deposits into</th><th class=\"num\">Net / deposit</th><th class=\"num\">≈ Monthly net</th><th>Next payment</th><th></th>" +
      "</tr></thead><tbody>" + streamsRows + "</tbody></table></div></div>";

    /* ---- interest by account ---- */
    const intAccounts = s.accounts.filter(a => Number(a.apy) > 0);
    const interestRows = intAccounts.length ? intAccounts.map(a =>
      "<tr>" +
        '<td><div class="cell-main">' + esc(a.name) + '</div><div class="cell-sub">' + esc(a.institution || "") + " · " + esc(a.currency) + "</div></td>" +
        '<td class="num">' + fmtMoney(conv(a.balance, a.currency)) + "</td>" +
        '<td class="num"><span class="tag mint">' + a.apy + "% APY</span></td>" +
        '<td class="num pos">' + fmtMoney(conv(dailyInterest(a), a.currency), { sign: true }) + "</td>" +
        '<td class="num pos">' + fmtMoney(conv(monthlyInterestEst(a), a.currency), { sign: true }) + "</td>" +
        '<td class="num pos">' + fmtMoney(conv(yearlyInterestEst(a), a.currency), { sign: true }) + "</td>" +
        '<td><div class="cell-main">' + esc(interestScheduleLabel(a)) + '</div><div class="cell-sub">next ' + fmtDateShort(nextInterestDate(a)) + "</div></td>" +
      "</tr>").join("") :
      '<tr><td colspan="7" style="color:var(--text-mute);text-align:center;padding:26px">No interest-bearing accounts. Set an APY on a savings account to see projections here.</td></tr>';

    const interestPanel =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Interest engine</div>' +
      '<span class="panel-sub">paid gross · ' + (tax.interest > 0 ? tax.interest + "% ISR on real interest, settled in April · " : "") + "compounding estimates per account</span></div>" +
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr>' +
        "<th>Account</th><th class=\"num\">Balance</th><th class=\"num\">Rate</th><th class=\"num\">Daily</th><th class=\"num\">Monthly</th><th class=\"num\">Yearly</th><th>Paid</th>" +
      "</tr></thead><tbody>" + interestRows + "</tbody></table></div>" +
      (eb.intTaxDueApril > 0 ? '<div class="proj-note" style="margin-top:10px">Interest lands in full and compounds gross. The ISR hits only the real interest (≈<strong>' + fmtMoney(eb.intReal) + "</strong>/yr above inflation), so set aside ≈<strong>" + fmtMoney(eb.intTaxDueApril) + "</strong> for your April return" + (eb.intProvisional > 0 ? ", after the " + fmtMoney(eb.intProvisional) + " provisional ISR the bank withholds on your capital" : "") + ".</div>" : "") + "</div>";

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
          sub: "Daily · " + a.apy + "% APY" + (tax.interest > 0 ? " · gross (ISR in April)" : "") + " → " + esc(a.name),
          amount: conv(interestPerPeriod(a) * days, a.currency), interest: true,
        });
        return;
      }
      let d = nextInterestDate(a, now), guard = 0;
      while (d <= to && guard++ < 12) {
        events.push({
          d, name: "Interest — " + a.name,
          sub: interestScheduleLabel(a) + " · " + a.apy + "% APY" + (tax.interest > 0 ? " · gross (ISR in April)" : "") + " → " + esc(a.name),
          amount: conv(interestPerPeriod(a), a.currency), interest: true,
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

    return stats + this._incomeSources(s, eb) + chart + '<div class="grid cols-2 stack-wide section" style="align-items:start">' + streams + timeline + "</div>" + interestPanel + divPanel;
  },

  /* ================= BUDGET & EXPENSES ================= */
  budget() {
    const s = Store.state;
    const months = expenseMonths();

    if (!months.length) {
      return '<div class="section"><div class="empty"><div class="empty-glyph">' + icon("pie") + '</div>' +
        "<h3>Track where your money goes</h3>" +
        "<p>Most people hate logging expenses by hand — so don't. Download the ready-made spreadsheet template, fill it in Excel or Google Sheets (or have your favourite AI fill it from your credit-card statements), and upload it. FinanceOS scores your spending, spots your biggest categories, and never double-counts a row.</p>" +
        '<div class="empty-actions">' +
          '<button class="btn primary" data-action="statement-import">' + icon("card") + ' Import statement PDF <span class="beta-pill">Beta</span></button>' +
          '<button class="btn" data-action="expense-template">↓ Download template</button>' +
          '<button class="btn ghost" data-action="expense-import">↑ Upload filled sheet</button>' +
          '<button class="btn ghost" data-action="add-expense">+ Add one manually</button>' +
        "</div>" +
        '<p class="empty-tip">Upload a card statement and FinanceOS reads it for you — privately, on your device. Nothing is ever uploaded. ' +
          'Or paste the template and your statement into ChatGPT/Claude. <a href="#" data-action="expense-import">See how →</a></p>' +
      "</div></div>";
    }

    // view: this-month detail or historic trends
    const view = App.budgetView === "trends" ? "trends" : "month";
    const viewToggle =
      '<div class="seg-toggle">' +
        '<button class="seg-btn' + (view === "month" ? " on" : "") + '" data-action="budget-view" data-view="month">This month</button>' +
        '<button class="seg-btn' + (view === "trends" ? " on" : "") + '" data-action="budget-view" data-view="trends">Trends</button>' +
      "</div>";
    const tools =
      '<div class="budget-controls-right">' +
        '<button class="btn small ghost" data-action="set-budgets">Set budgets</button>' +
        '<button class="btn small ghost" data-action="expense-import">↑ Upload sheet</button>' +
        '<button class="btn small" data-action="statement-import">' + icon("card") + ' Import PDF</button>' +
      "</div>";

    if (view === "trends") {
      const controls =
        '<div class="budget-controls section">' + viewToggle +
          '<span class="budget-count">' + months.length + " month" + (months.length === 1 ? "" : "s") + " tracked</span>" +
          tools +
        "</div>";
      return controls + this._budgetTrends();
    }

    // selected month — default to the most recent COMPLETE month so a partial
    // current month (e.g. a few days into a new statement) doesn't skew insights
    let mk = App.budgetMonth;
    if (!mk || months.indexOf(mk) === -1) mk = latestCompleteMonth() || months[0];
    const exps = expensesForMonth(mk).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const sc = budgetScore(mk);
    const g = scoreGrade(sc.score);
    const cats = categoryTotalsSorted(exps);
    const spend = sc.spend || 0;
    const inProgress = !sc.complete;

    const monthOpts = months.map(m =>
      '<option value="' + m + '"' + (m === mk ? " selected" : "") + ">" + monthLabel(m) +
        (m === currentMonthKey() ? " · in progress" : "") + "</option>").join("");
    const controls =
      '<div class="budget-controls section">' + viewToggle +
        '<select id="budget-month" class="budget-month">' + monthOpts + "</select>" +
        '<span class="budget-count">' + exps.length + " expense" + (exps.length === 1 ? "" : "s") +
          (inProgress ? " · in progress, day " + sc.daysElapsed + " of " + sc.daysTotal : "") + "</span>" +
        tools +
      "</div>";

    // ---- score hero ----
    const pct = (x) => Math.round(x * 100) + "%";
    const hero =
      '<div class="score-hero section">' +
        this._scoreRing(sc.score, g.tone, g.grade) +
        '<div class="score-meat">' +
          '<div class="micro-label">Spending health · ' + monthLabel(mk) + (inProgress ? " · in progress" : "") + "</div>" +
          '<div class="score-label ' + g.tone + '">' + g.label + "</div>" +
          '<div class="score-sub">' +
            (inProgress
              ? "<strong>" + fmtMoney(sc.monthlyExpenses, { compact: true }) + "</strong> spent in the first " + sc.daysElapsed + " day" + (sc.daysElapsed === 1 ? "" : "s") + " — the score is paced against the month so far. Pick a finished month above for a settled read."
              : sc.savingsRate != null
                ? "You saved <strong>" + pct(sc.savingsRate) + "</strong> of net income and spent <strong>" + fmtMoney(sc.monthlyExpenses, { compact: true }) + "</strong> of <strong>" + fmtMoney(sc.monthlyIncomeNet, { compact: true }) + "</strong>."
                : "Spent <strong>" + fmtMoney(sc.monthlyExpenses, { compact: true }) + "</strong>. Add income streams in Income for a savings-rate score.") +
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
        '<div class="stat"><span class="micro-label">Biggest category</span><div class="stat-value" style="display:flex;align-items:center;gap:9px">' + (topCat ? icon(topCat.meta.icon, "ic-cat") + esc(topCat.name) : "—") + '</div><div class="stat-note">' + (topCat ? fmtMoney(topCat.amount, { compact: true }) + (spend > 0 ? " · " + pct(topCat.amount / spend) : "") : "") + "</div></div>" +
        '<div class="stat"><span class="micro-label">Runway</span><div class="stat-value ' + (sc.runwayMonths >= 6 ? "pos" : sc.runwayMonths < 3 ? "neg" : "gold") + '">' + (isFinite(sc.runwayMonths) ? sc.runwayMonths.toFixed(1) + " mo" : "∞") + '</div><div class="stat-note">liquid assets at this rate</div></div>' +
      "</div>";

    // ---- 50/30/20 needs vs wants ----
    const needsPct = spend > 0 ? sc.needs / spend : 0;
    const wantsPct = spend > 0 ? sc.wants / spend : 0;
    const bucketPanel =
      '<div class="panel section"><div class="panel-head"><div class="panel-title">Needs vs wants</div>' +
        '<span class="panel-sub">50/30/20 guide · wants near 30% of income</span></div>' +
        '<div class="comp-bar">' +
          '<span style="width:' + (needsPct * 100) + '%;background:var(--sky)" data-tip="Needs · <strong>' + fmtMoney(sc.needs, { compact: true }) + "</strong> · " + pct(needsPct) + '"></span>' +
          '<span style="width:' + (wantsPct * 100) + '%;background:var(--gold)" data-tip="Wants · <strong>' + fmtMoney(sc.wants, { compact: true }) + "</strong> · " + pct(wantsPct) + '"></span>' +
        "</div>" +
        '<div class="comp-legend">' +
          '<span class="lg"><span class="dot" style="background:var(--sky)"></span>Needs ' + fmtMoney(sc.needs, { compact: true }) + " · " + pct(needsPct) + "</span>" +
          '<span class="lg"><span class="dot" style="background:var(--gold)"></span>Wants ' + fmtMoney(sc.wants, { compact: true }) + " · " + pct(wantsPct) + "</span>" +
        "</div>" +
      "</div>";

    // ---- category breakdown (actual vs budget, rollover-aware) ----
    const maxCat = cats.reduce((m, c) => Math.max(m, c.amount), 0) || 1;
    const catRows = cats.map(c => {
      const budget = effectiveBudgetForCategory(c.name, mk);
      const over = budget != null && c.amount > budget;
      const ratio = budget != null ? Math.min(1, c.amount / budget) : c.amount / maxCat;
      const barColor = budget != null ? (over ? "var(--rose)" : "var(--mint)") : "var(--sky)";
      return '<div class="bcat">' +
        '<div class="bcat-head"><span class="bcat-name">' + icon(c.meta.icon, "ic-cat") + esc(c.name) + "</span>" +
          '<span class="bcat-amt' + (over ? " neg" : "") + '">' + fmtMoney(c.amount, { compact: true }) +
            (budget != null ? ' <span class="bcat-budget">/ ' + fmtMoney(budget, { compact: true }) + "</span>" : "") + "</span></div>" +
        '<div class="bcat-track" data-tip="' + esc(c.name) + " · <strong>" + fmtMoney(c.amount, { compact: true }) + "</strong>" + (budget != null ? " of " + fmtMoney(budget, { compact: true }) + " budget" : "") + '"><span style="width:' + (ratio * 100) + '%;background:' + barColor + '"></span></div>' +
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
        '<td><span class="bcat-tag">' + icon(categoryMeta(e.category).icon) + esc(e.category) + "</span></td>" +
        '<td class="num">' + fmtMoneyIn(e.amount, e.currency) + "</td>" +
        '<td class="actions-cell"><button class="icon-btn" data-action="edit-expense" data-id="' + e.id + '" title="Edit">' + icon("edit") + '</button>' +
          '<button class="icon-btn danger" data-action="del-expense" data-id="' + e.id + '" title="Remove">' + icon("x") + '</button></td>' +
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
      this._recurringPanel() + this._irregularPanel() + bucketPanel + listPanel;
  },

  /* irregular-income planner — budget to the lean month, smooth the rest */
  _irregularPanel() {
    if (typeof irregularIncomePlan !== "function") return "";
    const d = App.irregDefaults ? App.irregDefaults() : {};
    const cur = displayCurrency();
    const f = (k) => '<div class="field"><label>' + d[k].label + "</label>" +
      '<input class="irreg-input fmt-num" type="text" inputmode="decimal" data-ik="' + k + '" value="' + fmtNumInput(App.irreg[k]) + '">' +
      '<div class="hint">' + d[k].hint + "</div></div>";
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Irregular income planner</div>' +
      '<span class="panel-sub">variable pay? budget the lean month · ' + cur + "</span></div>" +
      '<p class="method-note" style="margin-bottom:12px">If your income jumps around — freelance, commission, side gigs, an allowance — the trick is to budget to a <strong>lean</strong> month and stash the surplus from good months into a smoothing fund you draw on when things slow down.</p>' +
      '<div class="grid cols-3">' + f("low") + f("high") + f("essentials") + "</div>" +
      '<div id="irreg-out">' + this.irregularOutput() + "</div></div>";
  },

  irregularOutput() {
    const r = irregularIncomePlan(App.irreg);
    const stat = (l, v, note, cls) => '<div class="stat"><span class="micro-label">' + l + '</span><div class="stat-value ' + (cls || "") + '">' + v + '</div><div class="stat-note">' + note + "</div></div>";
    const volTone = r.volatility >= 0.5 ? "neg" : r.volatility >= 0.25 ? "gold" : "pos";
    const volLabel = r.volatility >= 0.5 ? "very bumpy" : r.volatility >= 0.25 ? "bumpy" : "fairly steady";
    const stats = '<div class="grid cols-4 section" style="margin-top:4px">' +
      stat("Budget to (lean month)", fmtMoney(r.baseline, { compact: true }),
        "spend as if this is all you’ll get", "pos") +
      stat("Stash in a good month", fmtMoney(r.goodMonthSave, { compact: true }),
        "surplus over essentials → buffer", "gold") +
      stat("Smoothing-fund target", fmtMoney(r.bufferTarget, { compact: true }),
        r.monthsToBuffer != null ? "~" + r.monthsToBuffer + " good month" + (r.monthsToBuffer === 1 ? "" : "s") + " to build" : "raise your good-month income", "gold") +
      stat("Income swing", Math.round(r.volatility * 100) + "%",
        volLabel, volTone) +
      "</div>";
    const verdict = r.coversEssentials
      ? '<p class="method-note" style="margin-top:4px">Even a lean month (' + fmtMoney(r.low, { compact: true }) + ") covers your " + fmtMoney(r.essentials, { compact: true }) + " of essentials — good. Budget your everyday spending to " + fmtMoney(r.baseline, { compact: true }) + " and sweep the rest of every good month into a fund of about " + fmtMoney(r.bufferTarget, { compact: true }) + ", so a slow stretch never forces debt.</p>"
      : '<p class="method-note" style="margin-top:4px"><span class="neg">A lean month (' + fmtMoney(r.low, { compact: true }) + ") falls " + fmtMoney(r.leanGap, { compact: true }) + " short of your " + fmtMoney(r.essentials, { compact: true }) + " essentials.</span> Until your floor rises, your smoothing fund is what bridges the gap — build it to about " + fmtMoney(r.bufferTarget, { compact: true }) + " during good months, and trim essentials where you can.</p>";
    return stats + verdict;
  },

  /* recurring charges / subscriptions found in the expense history */
  _recurringPanel() {
    const subs = (typeof detectRecurring === "function") ? detectRecurring(6) : [];
    if (!subs.length) return "";
    const total = subs.reduce((a, x) => a + conv(x.monthly, x.currency), 0);
    const rows = subs.map(x =>
      '<div class="sub-row"><span class="sub-name">' + icon(x.meta.icon, "ic-cat") + esc(x.name) + "</span>" +
      '<span class="sub-meta">seen ' + x.months + " mo · " + esc(x.category) + "</span>" +
      '<span class="sub-amt">' + fmtMoneyIn(x.monthly, x.currency, { compact: true }) + "/mo</span></div>").join("");
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Recurring expenses</div>' +
      '<span class="panel-sub">' + subs.length + " found · " + fmtMoney(total, { compact: true }) + "/mo · " + fmtMoney(total * 12, { compact: true }) + "/yr</span></div>" +
      '<div class="sub-list">' + rows + "</div>" +
      '<p class="method-note" style="margin-top:10px">Charges that repeat each month at a steady amount — subscriptions, rent, utilities, loan payments. Together they’re your fixed monthly base; cancel any subscription you don’t use, since small recurring leaks add up over a year.</p></div>';
  },

  /* cash-flow forecast: projected liquid balance over the next 60 days */
  _cashflowPanel() {
    const f = (typeof cashflowForecast === "function") ? cashflowForecast(60) : null;
    if (!f || !f.hasData) return "";
    const pts = f.points;
    const vals = pts.map(p => p.bal);
    const lo = Math.min(0, Math.min.apply(null, vals)), hi = Math.max(Math.max.apply(null, vals), 1);
    const span = (hi - lo) || 1;
    const W = 1000, H = 170, PAD = 8;
    const X = d => PAD + Math.min(1, daysBetween(pts[0].d, d) / f.horizon) * (W - 2 * PAD);
    const Y = v => H - PAD - (v - lo) / span * (H - 2 * PAD);
    const line = pts.map(p => X(p.d).toFixed(1) + "," + Y(p.bal).toFixed(1)).join(" ");
    const area = line + " " + X(pts[pts.length - 1].d).toFixed(1) + "," + (H - PAD) + " " + PAD + "," + (H - PAD);
    const col = f.min < 0 ? "#e8836f" : "#8fe3a6";
    const zY = Y(0).toFixed(1);
    const hits = this._chartHits(pts.map(p => ({
      tip: fmtDateShort(p.d) + (p.ev ? " · " + esc(p.ev.name) + " " + fmtMoney(p.ev.amt, { sign: true, compact: true }) : "") + " · balance <strong>" + fmtMoney(p.bal, { compact: true }) + "</strong>",
    })));
    const verdict = f.min < 0
      ? '<span class="neg">You dip to <strong>' + fmtMoney(f.min, { compact: true }) + "</strong> around " + fmtDateShort(f.minDate) + " — line up " + fmtMoney(-f.min, { compact: true }) + " before then.</span>"
      : '<span class="pos">You stay in the black — lowest is <strong>' + fmtMoney(f.min, { compact: true }) + "</strong> around " + fmtDateShort(f.minDate) + ".</span>";
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Will you make it to payday?</div>' +
      '<span class="panel-sub">checking + savings · income, bills &amp; everyday spending · next ' + f.horizon + " days</span></div>" +
      '<div class="chart-wrap"><div class="cf-fc-plot">' +
        '<svg class="cf-fc-chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' +
          '<defs><linearGradient id="cffill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + col + '" stop-opacity="0.22"/><stop offset="100%" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>' +
          (lo < 0 ? '<line x1="0" y1="' + zY + '" x2="' + W + '" y2="' + zY + '" stroke="var(--rose)" stroke-width="1" stroke-dasharray="4 4" opacity="0.7"/>' : "") +
          '<polygon points="' + area + '" fill="url(#cffill)"/>' +
          '<polyline points="' + line + '" fill="none" stroke="' + col + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
        "</svg>" + hits + "</div></div>" +
      '<div class="cf-fc-scale"><span>today · ' + fmtMoney(f.start, { compact: true }) + "</span><span>" + verdict + "</span><span>+" + f.horizon + "d · " + fmtMoney(f.end, { compact: true }) + "</span></div>" +
      (f.dailyBurn > 0 ? '<p class="method-note" style="margin-top:8px">Assumes about ' + fmtMoney(f.dailyBurn * 30, { compact: true }) + "/mo of everyday spending on top of your scheduled bills, based on your recent budget months.</p>" : "") +
      "</div>";
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

  /* shared score dial — used by the Budget score and the Overview health score */
  _scoreRing(score, tone, grade) {
    const deg = score == null ? 0 : Math.round(Math.max(0, Math.min(100, score)) * 3.6);
    const color = tone === "pos" ? "var(--mint)" : tone === "gold" ? "var(--gold)" : tone === "neg" ? "var(--rose)" : "var(--text-mute)";
    return '<div class="score-ring" style="background:conic-gradient(' + color + " " + deg + 'deg, var(--surface-3) 0)">' +
      '<div class="score-ring-in"><div class="score-num ' + tone + '">' + (score == null ? "—" : score) + "</div>" +
      (grade ? '<div class="score-grade">' + grade + "</div>" : "") + "</div></div>";
  },

  /* ---------- historic trends (WHOOP-style) ---------- */
  _budgetTrends() {
    const series = budgetSeries(12);
    const pct = (x) => (x == null ? "—" : Math.round(x * 100) + "%");

    // ---- comparison cards: this month vs trailing average ----
    const cmp = budgetComparison(3);
    let cards = "";
    if (cmp) {
      const card = (label, cur, base, fmt, lowerBetter) => {
        if (cur == null || base == null) return "";
        const diff = cur - base;
        const up = diff > 0;
        const good = lowerBetter ? diff < 0 : diff > 0;
        const arrow = Math.abs(diff) < (lowerBetter ? 0.0001 : 0.0001) ? "→" : (up ? "↑" : "↓");
        const tone = Math.abs(diff) < 1e-9 ? "" : good ? "pos" : "neg";
        return '<div class="cmp-card"><div class="micro-label">' + label + "</div>" +
          '<div class="cmp-cur">' + fmt(cur) + "</div>" +
          '<div class="cmp-delta ' + tone + '">' + arrow + " " + fmt(Math.abs(diff)) + ' <span>vs ' + cmp.months + "-mo avg</span></div></div>";
      };
      const money = (v) => fmtMoney(v, { compact: true });
      cards =
        '<div class="grid cols-3 section cmp-grid">' +
          card("Spending", cmp.cur.spend, cmp.spendAvg, money, true) +
          card("Savings rate", cmp.cur.savingsRate, cmp.saveAvg, pct, false) +
          card("Spending score", cmp.cur.score, cmp.scoreAvg, (v) => Math.round(v), false) +
        "</div>";
    }

    // ---- charts ----
    const spendChart = this._trendBars(series, {
      value: (r) => r.spend,
      color: (r, v) => { const b = totalBudget(); return (b > 0 && v > b) ? "var(--rose)" : "var(--mint)"; },
      refs: (function () {
        const out = []; const b = totalBudget(); const a = avgOf(series.filter(x => x.hasData), "spend");
        if (a) out.push({ value: a, color: "var(--text-mute)", label: "avg" });
        if (b > 0) out.push({ value: b, color: "var(--gold)", label: "budget" });
        return out;
      })(),
      fmt: (v) => fmtMoney(v, { compact: true }),
    });
    const scoreChart = this._trendBars(series, {
      value: (r) => r.score,
      max: 100,
      color: (r, v) => { const t = scoreGrade(v).tone; return t === "pos" ? "var(--mint)" : t === "gold" ? "var(--gold)" : "var(--rose)"; },
      fmt: (v) => Math.round(v),
    });
    const saveChart = this._trendLine(series, { value: (r) => r.savingsRate, fmt: (v) => pct(v) });

    const panel = (title, sub, body) =>
      '<div class="panel section"><div class="panel-head"><div class="panel-title">' + title + "</div>" +
      (sub ? '<span class="panel-sub">' + sub + "</span>" : "") + "</div>" + body + "</div>";

    // ---- category movers ----
    const movers = categoryMovers(3);
    const up = movers.filter(m => m.delta > 0).slice(0, 5);
    const down = movers.filter(m => m.delta < 0).slice(0, 5);
    const moverRow = (m) =>
      '<div class="mover"><span class="mover-name">' + icon(m.meta.icon, "ic-cat") + esc(m.name) + "</span>" +
      '<span class="mover-delta ' + (m.delta > 0 ? "neg" : "pos") + '">' + (m.delta > 0 ? "+" : "−") + fmtMoney(Math.abs(m.delta), { compact: true }) + "</span></div>";
    const moversPanel = (up.length || down.length)
      ? '<div class="grid cols-2 stack-wide section" style="align-items:start">' +
          panel("Spending more", "vs your recent average", up.length ? up.map(moverRow).join("") : '<div class="all-clear" style="color:var(--text-mute)">Nothing up.</div>') +
          panel("Spending less", "vs your recent average", down.length ? down.map(moverRow).join("") : '<div class="all-clear" style="color:var(--text-mute)">Nothing down.</div>') +
        "</div>"
      : "";

    // ---- streaks ----
    const st = budgetStreaks();
    const chips = [];
    if (st.saveStreak >= 1) chips.push('<div class="streak-chip pos"><div class="streak-n">' + st.saveStreak + "</div><div class=\"streak-lbl\">month" + (st.saveStreak === 1 ? "" : "s") + " saving in a row</div></div>");
    if (st.hasBudget) chips.push('<div class="streak-chip ' + (st.underStreak >= 1 ? "pos" : "") + '"><div class="streak-n">' + st.underStreak + "</div><div class=\"streak-lbl\">month" + (st.underStreak === 1 ? "" : "s") + " with every budget met</div></div>");
    if (st.best && st.best.savingsRate != null) chips.push('<div class="streak-chip gold"><div class="streak-n">' + pct(st.best.savingsRate) + "</div><div class=\"streak-lbl\">best savings rate · " + esc(st.best.short) + "</div></div>");
    const streaksPanel = chips.length ? panel("Streaks", st.count + " months tracked", '<div class="streak-row">' + chips.join("") + "</div>") : "";

    return cards +
      panel("Cash flow — in vs out", "income (net) vs spending, last " + series.length + " months", this._cashflowChart(series)) +
      panel("Monthly spending", "last " + series.length + " months", spendChart) +
      '<div class="grid cols-2 stack-wide section" style="align-items:start">' +
        panel("Spending-health score", "0–100 per month", scoreChart) +
        panel("Savings rate", "share of income kept", saveChart) +
      "</div>" +
      this._categoryTrends() +
      moversPanel + streaksPanel;
  },

  /* small-multiple mini bar charts: monthly spend per top category */
  _categoryTrends() {
    const cs = categorySeries(12, 6);
    if (!cs.cats.length || cs.months.length < 2) return "";
    const cards = cs.cats.map(cat => {
      const max = Math.max.apply(null, cat.values.concat([1]));
      const bars = cat.values.map((v, i) =>
        '<div class="ct-col" data-tip="' + esc(cs.months[i] + " · " + fmtMoney(v, { compact: true })) + '"><div class="ct-bar" style="height:' + Math.max(1.5, v / max * 100).toFixed(1) + '%"></div></div>').join("");
      const last = cat.values[cat.values.length - 1];
      const prev = cat.values.slice(0, -1);
      const avg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : 0;
      const tone = last > avg * 1.05 ? "neg" : last < avg * 0.95 ? "pos" : "";
      const arrow = last > avg * 1.05 ? "↑" : last < avg * 0.95 ? "↓" : "→";
      return '<div class="ct-card"><div class="ct-head">' +
        '<span class="ct-name">' + icon(cat.meta.icon, "ic-cat") + esc(cat.name) + "</span>" +
        '<span class="ct-last ' + tone + '">' + arrow + " " + fmtMoney(last, { compact: true }) + "</span></div>" +
        '<div class="ct-plot">' + bars + "</div></div>";
    }).join("");
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Spending by category</div>' +
      '<span class="panel-sub">top ' + cs.cats.length + " · last " + cs.months.length + " months</span></div>" +
      '<div class="ct-grid">' + cards + "</div></div>";
  },

  /* paired bars: net income vs spending per month, with a net-savings tooltip */
  _cashflowChart(series) {
    const rows = series.filter(r => r.hasData && (Number(r.income) > 0 || Number(r.spend) > 0));
    if (rows.length < 2) return '<div class="all-clear" style="color:var(--text-mute)">Not enough history yet — log another month to compare money in vs out.</div>';
    const max = Math.max.apply(null, rows.map(r => Math.max(Number(r.income) || 0, Number(r.spend) || 0)).concat([1]));
    const cols = rows.map(r => {
      const inc = Number(r.income) || 0, sp = Number(r.spend) || 0, net = inc - sp;
      const tip = (r.short || "") + " · in <strong>" + fmtMoney(inc, { compact: true }) + "</strong> · out <strong>" + fmtMoney(sp, { compact: true }) + "</strong> · net <strong class=\"" + (net >= 0 ? "pos" : "neg") + "\">" + fmtMoney(net, { compact: true, sign: true }) + "</strong>";
      return '<div class="cf-col" data-tip="' + esc(tip) + '"><div class="cf-pair">' +
        '<div class="cf-bar cf-in" style="height:' + (inc / max * 100).toFixed(1) + '%"></div>' +
        '<div class="cf-bar cf-out" style="height:' + (sp / max * 100).toFixed(1) + '%"></div>' +
        '</div><span class="cf-x">' + esc((r.short || "").split(" ")[0]) + "</span></div>";
    }).join("");
    return '<div class="comp-legend" style="margin-bottom:10px">' +
        '<span class="lg"><span class="dot" style="background:var(--mint)"></span>Income (net)</span>' +
        '<span class="lg"><span class="dot" style="background:var(--rose)"></span>Spending</span></div>' +
      '<div class="cf-plot">' + cols + "</div>";
  },

  /* bar trend: series rows -> bars; opts {value, color, refs, fmt, max} */
  _trendBars(series, opts) {
    const vals = series.map(opts.value).filter(v => v != null && isFinite(v));
    if (vals.length < 2) return '<div class="all-clear" style="color:var(--text-mute)">Not enough history yet — import another month to unlock this trend.</div>';
    const refs = opts.refs || [];
    let max = opts.max != null ? opts.max : Math.max.apply(null, vals.concat(refs.map(r => r.value)));
    if (!(max > 0)) max = 1;
    const refLines = refs.filter(r => r.value > 0 && r.value <= max * 1.02).map(r =>
      '<div class="trend-ref" style="bottom:' + (r.value / max * 100).toFixed(1) + '%;border-color:' + r.color + '"><span style="color:' + r.color + '">' + esc(r.label) + "</span></div>").join("");
    const cols = series.map(row => {
      const v = opts.value(row);
      const partial = row.complete === false;
      if (v == null || !isFinite(v)) return '<div class="trend-col"><div class="trend-bar trend-empty" data-tip="' + esc(row.label) + ' · <strong>—</strong>"></div></div>';
      const h = Math.max(1.5, Math.min(100, v / max * 100));
      const c = opts.color ? opts.color(row, v) : "var(--mint)";
      const lbl = row.label + " " + (opts.fmt ? opts.fmt(v) : String(v)) + (partial ? " (in progress)" : "");
      const tip = esc(row.label) + " · <strong>" + esc(opts.fmt ? opts.fmt(v) : String(v)) + "</strong>" + (partial ? " (in progress)" : "");
      return '<div class="trend-col"><div class="trend-bar' + (partial ? " trend-partial" : "") + '" tabindex="0" role="img" aria-label="' + esc(lbl) + '" style="height:' + h.toFixed(1) + "%;background:" + c + '" data-tip="' + tip + '"></div></div>';
    }).join("");
    const axis = series.map(r => "<span>" + esc(r.short) + "</span>").join("");
    return '<div class="trend"><div class="trend-plot">' + refLines + cols + '</div><div class="trend-axis">' + axis + "</div></div>";
  },

  /* line trend (handles negatives), for rates */
  _trendLine(series, opts) {
    const data = series.map((r, i) => ({ i: i, v: opts.value(r), row: r })).filter(d => d.v != null && isFinite(d.v));
    if (data.length < 2) return '<div class="all-clear" style="color:var(--text-mute)">Not enough history yet — import another month to unlock this trend.</div>';
    const vs = data.map(d => d.v);
    const min = Math.min.apply(null, vs.concat([0])), max = Math.max.apply(null, vs.concat([0]));
    const span = (max - min) || 1;
    const n = series.length, W = 1000, H = 150, PAD = 12;
    const X = (i) => PAD + (n <= 1 ? 0 : i * (W - 2 * PAD) / (n - 1));
    const Y = (v) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
    const line = data.map(d => X(d.i).toFixed(1) + "," + Y(d.v).toFixed(1)).join(" ");
    const zeroY = Y(0).toFixed(1);
    const lastV = data[data.length - 1].v;
    const fmt = opts.fmt || ((v) => v);
    return '<div class="trend"><div class="chart-wrap"><svg class="trend-svg" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' +
      '<line x1="' + PAD + '" y1="' + zeroY + '" x2="' + (W - PAD) + '" y2="' + zeroY + '" stroke="var(--hairline-strong)" stroke-width="1.5" stroke-dasharray="5 5"/>' +
      '<polyline points="' + line + '" fill="none" stroke="' + (lastV >= 0 ? "#8fe3a6" : "#e8836f") + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
      "</svg>" +
      this._chartHits(series.map(r => { const v = opts.value(r); return { tip: esc(r.label) + " · <strong>" + (v == null || !isFinite(v) ? "—" : fmt(v)) + "</strong>" }; })) +
      "</div>" +
      '<div class="trend-axis">' + series.map(r => "<span>" + esc(r.short) + "</span>").join("") + "</div></div>";
  },

  /* ================= MILESTONES ================= */
  milestones() {
    const s = Store.state;
    const hasAnything = s.accounts.length || s.cards.length || s.holdings.length || s.incomes.length;
    if (!hasAnything) {
      return '<div class="section"><div class="empty"><div class="empty-glyph">' + icon("award") + '</div>' +
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
        '<div class="pct-track" data-tip="You · <strong>' + topShareLabel(pct) + "</strong> · " + valueDisplay + '"><div class="pct-fill" style="width:' + Math.min(100, pct).toFixed(1) + '%"></div>' +
          '<span class="pct-mark" style="left:50%" data-tip="Global median"></span>' +
          '<span class="pct-mark" style="left:90%" data-tip="Top 10%"></span>' +
          '<span class="pct-mark" style="left:99%" data-tip="Top 1%"></span></div>' +
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

    return this._goalsPanel() + standing + badges + method;
  },

  /* savings goals / sinking funds — progress + monthly amount needed */
  _goalsPanel() {
    const goals = Store.state.goals || [];
    const head = '<div class="panel-head"><div class="panel-title">Savings goals</div>' +
      '<button class="btn small primary" data-action="add-goal">+ Add goal</button></div>';
    if (!goals.length) {
      return '<div class="panel section">' + head +
        '<div class="all-clear" style="color:var(--text-mute)">No goals yet — set a target like an emergency fund or a trip, and FinanceOS works out the monthly amount to get there.</div></div>';
    }
    const today = todayMid();
    const cards = goals.map(g => {
      const target = Number(g.target) || 0, saved = Math.max(0, Number(g.saved) || 0);
      const pct = target > 0 ? Math.min(100, saved / target * 100) : 0;
      const remaining = Math.max(0, target - saved);
      const done = remaining <= 0.005;
      let line, tone = "";
      if (done) { line = "Funded 🎉"; tone = "pos"; }
      else if (g.targetDate) {
        const d = parseISO(g.targetDate);
        const months = d ? (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth()) : null;
        if (d && (d < today || months <= 0)) { line = fmtMoneyIn(remaining, g.currency, { compact: true }) + " short · past the date"; tone = "neg"; }
        else line = "Need <strong>" + fmtMoneyIn(remaining / months, g.currency, { compact: true }) + "/mo</strong> by " + fmtDateShort(d) + " (" + months + " mo)";
      } else line = fmtMoneyIn(remaining, g.currency, { compact: true }) + " to go";
      return '<div class="goal-card"><div class="goal-head">' +
        '<span class="goal-name">' + esc(g.name) + "</span><span class=\"goal-actions\">" +
          '<button class="icon-btn" data-action="edit-goal" data-id="' + g.id + '" title="Edit">' + icon("edit") + "</button>" +
          '<button class="icon-btn danger" data-action="del-goal" data-id="' + g.id + '" title="Delete">' + icon("x") + "</button></span></div>" +
        '<div class="goal-amt">' + fmtMoneyIn(saved, g.currency, { compact: true }) + " <span>of " + fmtMoneyIn(target, g.currency, { compact: true }) + "</span></div>" +
        '<div class="goal-track"><div class="goal-fill' + (done ? " done" : "") + '" style="width:' + pct.toFixed(1) + '%"></div></div>' +
        '<div class="goal-line ' + tone + '">' + Math.round(pct) + "% · " + line + "</div></div>";
    }).join("");
    return '<div class="panel section">' + head + '<div class="goal-grid">' + cards + "</div></div>";
  },

  /* ================= LEARN ================= */
  learn() {
    return Learn.render();
  },

  /* ================= GUIDE ================= */
  guide() {
    // why-use-it benefits (snappy)
    const why = [
      ["◉", "One clear number", "Accounts, cards, investments, income and budget roll up into a single net-worth figure."],
      ["✦", "Real taxes & currencies", "After-tax projections, Mexican ISR on real interest, and any mix of currencies at live FX."],
      ["◔", "Plan the big decisions", "Retirement odds (Monte-Carlo), your FIRE number, and a snowball-vs-avalanche debt plan."],
      ["⛨", "Totally private", "Everything stays in this browser — no sign-up, no servers, optional PIN encryption."],
    ].map(b => '<div class="why-card"><span class="why-glyph">' + b[0] + "</span><div><strong>" + b[1] + "</strong><p>" + b[2] + "</p></div></div>").join("");

    const hero =
      '<div class="panel section guide-hero">' +
        '<div class="panel-head"><div class="panel-title">Why FinanceOS</div><span class="panel-sub">free · private · no sign-up</span></div>' +
        '<p class="guide-lede">Your whole financial life on one screen — and the tools to act on it. See what you have, where it’s going, and what’s next, all after tax and in any currency.</p>' +
        '<div class="why-grid">' + why + "</div>" +
        '<div class="guide-steps-mini"><span class="micro-label">Get going in 3 steps</span>' +
          "<ol><li><strong>Add what you have</strong> — accounts (with their rate), cards, holdings.</li>" +
          "<li><strong>Add what comes in</strong> — salary &amp; recurring income.</li>" +
          "<li><strong>Check in weekly</strong> — update prices &amp; balances; we recalc the rest.</li></ol></div>" +
      "</div>";

    // section card: glyph + title + one-line summary + a "See more" disclosure
    const sec = (glyph, title, summary, detail) =>
      '<div class="guide-card">' +
        '<div class="guide-card-head"><span class="guide-glyph">' + glyph + "</span>" +
          '<div class="guide-card-h"><h3>' + title + '</h3><p class="guide-sum">' + summary + "</p></div></div>" +
        '<details class="guide-more"><summary>See more</summary><ul>' +
          detail.map(i => "<li>" + i + "</li>").join("") + "</ul></details>" +
      "</div>";

    const cards = '<div class="guide-grid section">' +
      sec("▤", "Accounts & interest", "Balances plus interest that projects and compounds on your schedule.", [
        "Set the <strong>APY %</strong> on savings and FinanceOS projects daily, monthly and yearly interest automatically.",
        "Choose how often interest is paid — <strong>daily, monthly, quarterly or annually</strong> — and the exact day; the card shows the next payment.",
        "The <em>accrued</em> line is interest earned since you last updated the balance. Press <strong>Capitalize</strong> when the bank actually credits it.",
        "Interest is treated the Mexican way: paid gross, with ISR settled annually on the <strong>real</strong> (above-inflation) portion.",
      ]) +
      sec("▭", "Credit cards & debt payoff", "Utilization, due-date countdowns, and a snowball-vs-avalanche plan.", [
        "<strong>Statement cut</strong> closes the bill; <strong>payment due</strong> is the deadline. Alerts fire 5 days before the cut and 7 before payment.",
        "The colored bar is <strong>utilization</strong> (balance ÷ limit) — keep it under 30%; gold above 30%, red above 70%.",
        "The <strong>payoff planner</strong> compares <strong>avalanche</strong> (highest APR first) vs <strong>snowball</strong> (smallest balance first): months to debt-free, total interest, and which to attack.",
        "Tip: big purchases right <em>after</em> the cut date give the longest interest-free window.",
      ]) +
      sec("◮", "Portfolio & live prices", "Live quotes &amp; dividends (no key) and your return vs the S&amp;P 500.", [
        "Add each holding with the <strong>shares and average price you paid</strong>, in its listing currency.",
        "Press <strong>↻ Update prices</strong> for live quotes and annual dividends — <strong>no API key needed</strong> (an optional free finnhub.io key adds a direct source).",
        "The detail chart overlays the <strong>S&amp;P 500</strong> so you see whether you’re beating the market; a concentration readout flags if your top 3 dominate.",
        "Values and returns convert to your display currency at daily ECB rates.",
      ]) +
      sec("✦", "Income & taxes", "Gross or net income on any schedule — every projection is after-tax.", [
        "Schedules: <strong>monthly</strong>, <strong>every 15 days</strong>, <strong>every 14 days</strong> and <strong>weekly</strong>.",
        "Say whether an amount is <strong>gross</strong> (with your rate) or <strong>net</strong> — the timeline always shows what actually lands.",
        "Set tax on <strong>interest, dividends and capital gains</strong> in Settings; the 12-month chart projects net income + interest + dividends.",
      ]) +
      sec("◓", "Budget & expenses", "Import a sheet or paste a statement; get a spending-health score.", [
        "Hate logging? <strong>Download the template</strong> (Budget → Template), fill it in Excel/Sheets, and upload — or paste your statement into ChatGPT/Claude with the built-in prompt.",
        "<strong>Re-uploading is safe</strong> — every row is fingerprinted, so the same file never double-counts.",
        "Get a <strong>spending-health score</strong> from your savings rate, runway and needs-vs-wants, a 50/30/20 split, per-category budgets, and a <strong>cash-flow in-vs-out</strong> chart.",
        "<strong>Trends</strong> compares months: spending &amp; score over time, per-category small-multiples, movers, and streaks.",
      ]) +
      sec("◔", "Retirement, FIRE & debt", "Project your nest egg with market-risk bands and your FIRE number.", [
        "Drag <strong>return, years, contributions and withdrawal rate</strong> — the lifetime chart updates live, growing then drawing down.",
        "The shaded band is a <strong>Monte-Carlo</strong> range across 300 random-market runs; the <strong>success rate</strong> is how often the money outlives the plan. Tune <strong>volatility</strong> to stress-test.",
        "Your <strong>FIRE number</strong> = annual spending ÷ withdrawal rate (spending auto-fills from your budget and is editable). <strong>Coast FIRE</strong> shows when you can stop saving.",
      ]) +
      sec("◍", "Currencies", "Mix currencies freely; everything converts to your display currency.", [
        "Every account, card, position and income stream has its <strong>own currency</strong> — MXN accounts and USD stocks live together.",
        "Totals and charts convert to your <strong>display currency</strong> (sidebar selector) at daily ECB rates; net-worth history is stored in USD so switching never distorts the chart.",
      ]) +
      sec("✶", "Milestones & goals", "Your global percentile, savings goals, and habit achievements.", [
        "Set <strong>savings goals / sinking funds</strong> with a target and date — FinanceOS shows the monthly amount to get there and your progress.",
        "See your estimated <strong>global percentile</strong> for net worth and annual earnings (rough public-data estimates, for motivation).",
        "Unlock achievements for healthy habits — low utilization, an emergency fund, a diversified portfolio.",
      ]) +
      sec("✺", "Learn", "Bite-size interactive lessons plus a 20-year life sandbox.", [
        "Live calculators (compounding, the minimum-payment trap, the Rule of 72) plus real decisions with a <strong>10-year impact</strong> meter.",
        "The <strong>Wealth Builder sandbox</strong> plays 20 years where crashes, scams and job offers interrupt you — split your savings across cash, savings, index and a hot stock and live with the results.",
        "Balance wealth against a <strong>life-satisfaction meter</strong>: finish burned out and the grade drops.",
      ]) +
      sec("✧", "Charts are interactive", "Tap anything for the exact value.", [
        "<strong>Tap any chart</strong> — bars, the net-worth and price lines, allocation and composition bars — for the exact figure at that point.",
        "On <strong>Portfolio</strong> tap a position for its chart; on <strong>Income</strong> tap a projection bar; on <strong>Budget → Trends</strong> compare months and categories.",
        "Look for the <strong>“?” chips</strong> next to anything with assumptions — they explain (and often let you change) what’s behind the number.",
      ]) +
      sec("⛨", "Privacy & backups", "Local-only, optional AES-256 PIN, and .json export.", [
        "Everything lives <strong>only in this browser</strong> — nothing is ever uploaded. Errors now surface as on-screen alerts so a failed save or price fetch never passes silently.",
        "Turn on the <strong>PIN lock</strong> (⋯ menu) to encrypt your data with AES-256 — no PIN, no data, so don’t forget it.",
        "Use the <strong>eye button</strong> to blur amounts, and export a <strong>.json backup</strong> regularly (backups are unencrypted — store them safely).",
      ]) +
      "</div>";

    const faq =
      '<details class="panel section guide-faq"><summary><span class="panel-title">Good to know</span></summary>' +
      '<p class="method-note"><strong>Where is my data?</strong> In this browser’s local storage, key <code>financeos_v1</code>. ' +
      "<strong>Move it?</strong> Export on one device, import on another. " +
      "<strong>Currency switch?</strong> Changes display formatting and the USD conversion for milestones; it doesn’t convert your numbers. " +
      "<strong>Forgot your PIN?</strong> Encrypted data can’t be recovered — erase on the lock screen and import your latest backup.</p></details>";

    return hero + cards + faq;
  },

  /* ================= RETIREMENT ================= */
  retirement() {
    if (!App.retire) App.retire = App.retireDefaults();
    const r = App.retire;
    const mode = r.mode === "advanced" ? "advanced" : "basic";
    const top =
      '<div class="panel section retire-top">' +
        '<div class="retire-modes"><span class="micro-label">Retirement simulator</span>' +
          '<div class="price-range-bar">' +
            '<button class="range-btn' + (mode === "basic" ? " on" : "") + '" data-action="retire-mode" data-method="basic">Basic</button>' +
            '<button class="range-btn' + (mode === "advanced" ? " on" : "") + '" data-action="retire-mode" data-method="advanced">Advanced</button>' +
          "</div></div>" +
        this._retireExplainer(mode) +
      "</div>";
    const controls = mode === "advanced" ? this._retireControlsAdvanced(r) : this._retireControlsBasic(r);
    return top + controls + '<div id="retire-out">' + this.retirementOutput() + "</div>";
  },

  _retireExplainer(mode) {
    const common =
      "<li><strong>Starting amount</strong> — what you’ve already set aside <em>for retirement</em> (we seed it from your net worth for convenience; trim it down to just your retirement pot).</li>" +
      "<li><strong>Monthly contribution</strong> — what you add to that pot each month until you retire.</li>" +
      "<li><strong>Annual spending in retirement</strong> — what you’ll spend per year once retired; it drives the withdrawals and your FIRE number.</li>" +
      "<li><strong>Years to grow</strong> — years until you retire.</li>" +
      "<li><strong>Inflation</strong> — how fast prices rise; your spending grows with it so it keeps its buying power.</li>" +
      "<li><strong>Realistic crashes</strong> — the simulations don’t use endless random volatility. Crashes strike at random but are bounded like history: at most a <strong>55% drop</strong>, no more than <strong>3 down years in a row</strong>, and a <strong>recovery within ~6 years</strong>.</li>";
    const basic =
      "<li><strong>Annual return</strong> — the average yearly growth you expect before and during retirement.</li>" +
      "<li><strong>Withdrawal rate</strong> — the share of the pot you draw in year one (the 4% rule); it rises with inflation after.</li>";
    const adv =
      "<li><strong>Two phases, two risk profiles.</strong> <em>While saving</em> a paycheck covers your bills, so a crash doesn’t force you to sell — you lean into equities for growth (the “Equities while saving” slider). <em>In retirement</em> the paycheck stops, so a crash <em>while you withdraw</em> is real risk — you hold cash &amp; bond buffers and spend those first.</li>" +
      "<li><strong>Equities = whatever isn’t buffered.</strong> The cash and bond buffers are set in <em>years of spending</em>; everything beyond them stays in equities — your growth engine.</li>" +
      "<li><strong>Returns by sleeve</strong> — set the yearly growth you expect from equities, bonds and cash.</li>";
    return '<details class="retire-explain"><summary>What is this? Read before you start →</summary>' +
      '<p class="method-note" style="margin-top:10px"><strong>This plans your retirement fund</strong> — the pot you’ll live off after you stop working. It is <strong>not</strong> your total savings or net worth. The shaded band and the success rate come from 300 random-market simulations, so treat them as odds, not promises.</p>' +
      '<ul class="retire-help">' + common + (mode === "advanced" ? adv : basic) + "</ul></details>";
  },

  _retireControlsBasic(r) {
    const cur = displayCurrency();
    return '<div class="panel section retire-controls"><div class="panel-head">' +
      '<div class="panel-title">Assumptions</div><span class="panel-sub">drag to explore — everything updates live</span></div>' +
      '<div class="grid cols-3">' +
        '<div class="field"><label>Starting amount (' + cur + ')</label>' +
          '<input class="r-input fmt-num" data-rk="start" type="text" inputmode="decimal" value="' + fmtNumInput(r.start) + '">' +
          '<div class="hint">Your retirement pot today — seeded from net worth; edit down to just retirement savings.</div></div>' +
        '<div class="field"><label>Monthly contribution (' + cur + ')</label>' +
          '<input class="r-input fmt-num" data-rk="contrib" type="text" inputmode="decimal" value="' + fmtNumInput(r.contrib) + '">' +
          '<div class="hint">Extra you add every month while still saving.</div></div>' +
        '<div class="field"><label>Annual spending in retirement (' + cur + ')</label>' +
          '<input class="r-input fmt-num" data-rk="annualSpend" type="text" inputmode="decimal" value="' + fmtNumInput(r.annualSpend) + '">' +
          '<div class="hint">Drives the FIRE number. Pre-filled from your budget — override to model spending more or less.</div></div>' +
      "</div>" +
      '<div class="r-grid">' +
        this._rslider("ret", "Annual return", r.ret, 0, 15, 0.5, "%") +
        this._rslider("years", "Years to grow", r.years, 0, 50, 1, " yr") +
        this._rslider("withdraw", "Withdrawal rate", r.withdraw, 1, 10, 0.1, "%") +
        this._rslider("inflation", "Inflation", r.inflation, 0, 12, 0.1, "%") +
      "</div></div>";
  },

  _retireControlsAdvanced(r) {
    const cur = displayCurrency();
    const presets = [["Aggressive", 0, 0], ["Balanced", 1, 2], ["Buffered 1+3", 1, 3], ["Conservative", 2, 6]]
      .map(p => '<button class="sb-opt' + (p[1] === r.cashYears && p[2] === r.bondYears ? " sel" : "") + '" data-action="retire-bucket" data-method="' + p[1] + ":" + p[2] + '">' + p[0] + "</button>").join("");
    return '<div class="panel section retire-controls"><div class="panel-head">' +
      '<div class="panel-title">Strategy</div><span class="panel-sub">two phases: grow while you earn, then draw down</span></div>' +
      '<div class="grid cols-3">' +
        '<div class="field"><label>Starting amount (' + cur + ')</label>' +
          '<input class="r-input fmt-num" data-rk="start" type="text" inputmode="decimal" value="' + fmtNumInput(r.start) + '"></div>' +
        '<div class="field"><label>Monthly contribution (' + cur + ')</label>' +
          '<input class="r-input fmt-num" data-rk="contrib" type="text" inputmode="decimal" value="' + fmtNumInput(r.contrib) + '"></div>' +
        '<div class="field"><label>Annual spending in retirement (' + cur + ')</label>' +
          '<input class="r-input fmt-num" data-rk="annualSpend" type="text" inputmode="decimal" value="' + fmtNumInput(r.annualSpend) + '"></div>' +
      "</div>" +
      '<div class="sb-alloc-head"><span class="micro-label">Expected return by asset class &amp; horizon</span></div>' +
      '<div class="r-grid">' +
        this._rslider("eqRet", "Equities return", r.eqRet, 0, 18, 0.5, "%") +
        this._rslider("bondRet", "Bonds return", r.bondRet, 0, 14, 0.5, "%") +
        this._rslider("cashRet", "Cash return", r.cashRet, 0, 10, 0.5, "%") +
        this._rslider("inflation", "Inflation", r.inflation, 0, 12, 0.1, "%") +
        this._rslider("years", "Years to grow", r.years, 0, 50, 1, " yr") +
      "</div>" +
      '<div class="retire-phase"><div class="sb-alloc-head"><span class="micro-label">① While saving — you have income</span></div>' +
        '<p class="retire-phase-note">A paycheck covers your bills, so a market dip never forces you to sell. Lean into growth — the rest of your contributions go to bonds.</p>' +
        '<div class="r-grid"><div class="r-row r-row-wide"><label>Equities while saving' +
          '<span class="r-val-wrap"><input class="r-num" data-rk="accEquity" type="text" inputmode="numeric" value="' + r.accEquity + '" aria-label="Equities while saving (exact value)"><span class="r-suffix">%</span></span></label>' +
          '<input class="r-input" data-rk="accEquity" data-suffix="%" type="range" min="0" max="100" step="5" value="' + r.accEquity + '"></div></div></div>' +
      '<div class="retire-phase"><div class="sb-alloc-head"><span class="micro-label">② In retirement — no paycheck</span></div>' +
        '<p class="retire-phase-note">Now a crash hits <em>while you withdraw</em> — real risk. Keep a few years of spending safe in cash &amp; bonds, spend those first, and let stocks recover. Pick a risk profile or set the buffers:</p>' +
        '<div class="sb-opts sb-quick">' + presets + "</div>" +
        '<div class="r-grid">' +
          this._rslider("cashYears", "Cash buffer", r.cashYears, 0, 5, 0.5, " yr") +
          this._rslider("bondYears", "Bond buffer", r.bondYears, 0, 15, 0.5, " yr") +
        "</div>" +
        '<div class="retire-eq-note"><span class="dot" style="background:var(--mint)"></span><strong>Equities = everything else.</strong> Whatever isn’t in the cash and bond buffers stays invested in stocks — your growth engine. The buffers just shield it from being sold in a crash.</div>' +
      "</div></div>";
  },

  /* a slider + a paired text field: drag for feel, type for exactness */
  _rslider(key, label, val, min, max, step, suffix) {
    return '<div class="r-row"><label>' + label +
      '<span class="r-val-wrap"><input class="r-num" data-rk="' + key + '" type="text" inputmode="decimal" value="' + val + '" aria-label="' + label + ' (exact value)">' +
      '<span class="r-suffix">' + suffix + "</span></span></label>" +
      '<input class="r-input" data-rk="' + key + '" data-suffix="' + suffix + '" type="range" min="' + min +
      '" max="' + max + '" step="' + step + '" value="' + val + '"></div>';
  },

  retirementOutput() {
    const r = App.retire;
    return (r.mode === "advanced") ? this._retireOutputAdvanced(r) : this._retireOutputBasic(r);
  },

  _retireOutputBasic(r) {
    const VOL = 13;   // fixed, sensible diversified-portfolio volatility (no longer a slider)
    const sim = retirementProjection({
      start: r.start, ret: r.ret, years: r.years, contrib: r.contrib,
      withdraw: r.withdraw, inflation: r.inflation, maxDraw: 50,
    });
    const mc = retirementMonteCarlo({
      start: r.start, ret: r.ret, years: r.years, contrib: r.contrib,
      withdraw: r.withdraw, inflation: r.inflation, vol: VOL, maxDraw: 50, runs: 300,
    });
    const succ = Math.round(mc.successRate * 100);
    const succTone = succ >= 85 ? "pos" : succ >= 60 ? "gold" : "neg";
    const succHint = this._hint("Across " + mc.runs + " random lifetimes, markets follow real-world rules: ordinary years drift around your " + r.ret + "% return, but crashes strike at random — capped at a 55% peak-to-trough drop, no more than 3 straight down years, and a recovery within about 6 years (never an endless slide). Withdrawals rise with " + r.inflation + "% inflation. Success is the share of runs the money outlives " + sim.maxDraw + " years; a smaller withdrawal rate or more years raise it.");
    const stat = (label, val, note, cls) =>
      '<div class="stat"><span class="micro-label">' + label + '</span><div class="stat-value ' + (cls || "") +
      '">' + val + '</div><div class="stat-note">' + note + "</div></div>";
    const lasts = sim.sustainable ? sim.maxDraw + "+ yrs" : sim.depletedYear + " yr" + (sim.depletedYear === 1 ? "" : "s");
    const stats = '<div class="grid cols-4 section">' +
      stat("Nest egg at retirement", fmtMoney(sim.nest, { compact: true }),
        "in " + r.years + " yr · " + fmtMoney(sim.nestReal, { compact: true }) + " in today’s pesos", "gold") +
      stat("Monthly income" + this._hint("Your withdrawal in the <strong>first year</strong> of retirement (" + r.withdraw + "% of the nest egg). It doesn’t stay flat — the simulation raises it by " + r.inflation + "% every year so your buying power holds, and the success rate accounts for that rising spend. The “today’s pesos” figure is the same income expressed in today’s money."), fmtMoney(sim.monthlyIncome, { compact: true }),
        "first year · rises " + r.inflation + "%/yr · " + fmtMoney(sim.monthlyIncomeReal, { compact: true }) + " today", "pos") +
      stat("Money lasts (base case)", lasts,
        sim.sustainable ? "capital stays intact" : "until the pot runs dry", sim.sustainable ? "pos" : "neg") +
      stat("Success rate" + succHint, succ + "%",
        "of " + mc.runs + " random-market runs the money outlives " + sim.maxDraw + " yr", succTone) +
      "</div>";
    return stats + this._retireChart(sim, r, mc) + this._firePanel(r) + this._retireNote(sim, r, mc);
  },

  _retireOutputAdvanced(r) {
    if (!(Number(r.annualSpend) > 0)) {
      return '<div class="panel section"><div class="panel-head"><div class="panel-title">Set your annual spending</div></div>' +
        '<p class="method-note">The bucket strategy is built around <em>years of spending</em>, so enter your <strong>Annual spending in retirement</strong> above to run it.</p></div>';
    }
    const P = { start: r.start, contrib: r.contrib, years: r.years, annualSpend: r.annualSpend, inflation: r.inflation, eqRet: r.eqRet, bondRet: r.bondRet, cashRet: r.cashRet, cashYears: r.cashYears, bondYears: r.bondYears, accEquity: r.accEquity, maxDraw: 30 };
    const sim = retirementBuckets(P);
    const mc = retirementBucketsMC(Object.assign({}, P, { runs: 300 }));
    const succ = Math.round(mc.successRate * 100);
    const succTone = succ >= 85 ? "pos" : succ >= 60 ? "gold" : "neg";
    const lasts = sim.sustainable ? sim.maxDraw + "+ yrs" : sim.depletedYear + " yr" + (sim.depletedYear === 1 ? "" : "s");
    const stat = (l, v, note, cls) => '<div class="stat"><span class="micro-label">' + l + '</span><div class="stat-value ' + (cls || "") + '">' + v + '</div><div class="stat-note">' + note + "</div></div>";
    const succHint = this._hint("You grow steadily to retirement, then over a " + sim.maxDraw + "-year retirement we run 300 realistic markets: equity crashes hit at random but are capped — at most a 55% drop, no more than 3 down years in a row, and a recovery within ~6 years (bonds & cash wobble mildly). Spending rises with inflation; you draw cash → bonds → equities and refill the buffers from stocks only after up years, so you never sell low. Success = the share of runs the money lasts the full " + sim.maxDraw + " years.");
    const inflF2 = (Number(r.inflation) || 0) / 100;
    const incLastYr = (Number(r.annualSpend) || 0) * Math.pow(1 + inflF2, (Number(r.years) || 0) + sim.maxDraw - 1);
    const incHint = this._hint("This is your spending in the <strong>first year</strong> of retirement — your " + fmtMoney(r.annualSpend, { compact: true }) + " target (today’s pesos) grown by " + r.inflation + "% inflation over the " + r.years + " years until you retire. It does <strong>not</strong> stay flat: the simulation raises your withdrawal by " + r.inflation + "% every year so your buying power holds, so by the final year of a " + sim.maxDraw + "-year retirement you’d draw about " + fmtMoney(incLastYr, { compact: true }) + " (nominal). The success rate, depletion and the chart all account for this rising spend.");
    const stats = '<div class="grid cols-4 section">' +
      stat("Nest egg at retirement", fmtMoney(sim.nest, { compact: true }), "in " + r.years + " yr · " + fmtMoney(sim.nestReal, { compact: true }) + " today’s pesos", "gold") +
      stat("Annual income" + incHint, fmtMoney(sim.monthlyIncome * 12, { compact: true }), "first year · rises " + r.inflation + "%/yr · " + fmtMoney(r.annualSpend, { compact: true }) + " today", "pos") +
      stat("Money lasts (base case)", lasts, sim.sustainable ? "buffers hold up" : "until the pot runs dry", sim.sustainable ? "pos" : "neg") +
      stat("Success rate" + succHint, succ + "%", "of " + mc.runs + " bucket simulations", succTone) +
      "</div>";
    const chart = this._retireChart(sim, r, mc, {
      sub: "grow " + r.years + "y (" + r.accEquity + "% equities), then a " + r.cashYears + "y cash + " + r.bondYears + "y bond buffer · shaded = likely range",
      hint: "Solid line = steady base case. Shaded = 10th–90th percentile of 300 runs with realistic markets — equity crashes capped at a 55% drop, ≤3 down years in a row, recovery within ~6 years. The cash/bond buffers let you spend safe assets in a crash and refill from stocks only after they rebound — that shelter is the snowball.",
    });
    return stats + chart + this._bucketPanel(r, sim) + this._withdrawExplorer(r, P, sim) + this._strategyCompare(P, r) + this._firePanel(r) + this._bucketNote(sim, r);
  },

  /* Withdrawal-rate explorer — the nest egg above is fixed by how you SAVE, so
     this box holds that same nest and lets you dial the withdrawal rate up or
     down to see the trade-off: a higher rate means more income now but a higher
     chance of running dry. Defaults to the rate your target spending implies. */
  _withdrawExplorer(r, P, sim) {
    const nestReal = Number(sim.nestReal) || 0;
    if (!(nestReal > 0)) return "";
    const implied = (Number(r.annualSpend) || 0) / nestReal * 100;
    const RMIN = 2.5, RMAX = 9;
    const clampR = x => Math.max(RMIN, Math.min(RMAX, x));
    const inRange = implied >= RMIN && implied <= RMAX;
    // when the implied rate is off the scale, start at the classic 4% — pinning
    // the slider to a clamped extreme reads as "your rate" when it isn't
    const rate = App.retire.exploreSWR != null ? clampR(App.retire.exploreSWR) : (inRange ? implied : 4);
    const hint = this._hint("Your nest egg is fixed by how much you save (the assumptions above) — spending it faster or slower doesn’t change how big it gets, only how long it lasts. This slider holds that same nest egg and the same bucket strategy, then applies a different first-year withdrawal as a % of the nest (in today’s pesos, rising with inflation each year). " +
      (inRange ? "Your target spending of " + fmtMoney(r.annualSpend, { compact: true }) + " works out to about " + implied.toFixed(1) + "% — the starting point below." : "Your target spending of " + fmtMoney(r.annualSpend, { compact: true }) + " works out to about " + implied.toFixed(1) + "%, off this scale — so we start you at the classic 4% instead.") +
      " The classic 4% rule is a rough guide; lower is safer.");
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Explore your withdrawal rate' + hint + "</div>" +
      '<span class="panel-sub">same nest egg &amp; strategy · how much could you draw?</span></div>' +
      '<p class="method-note" style="margin-bottom:12px">' +
        (inRange ? "Your target implies about <strong>" + implied.toFixed(1) + "%</strong>."
          : "Your target implies about <strong>" + implied.toFixed(1) + "%</strong> — outside this scale, so the slider starts at the classic <strong>4%</strong>.") +
        " Slide to see how spending more or less changes your income and how long the money lasts — the chart and figures update live.</p>" +
      '<div class="r-grid"><div class="r-row r-row-wide"><label>Withdrawal rate' +
        '<span class="r-val-wrap"><input class="re-num" type="text" inputmode="decimal" value="' + rate.toFixed(1) + '" aria-label="Withdrawal rate (exact value)"><span class="r-suffix">%</span></span></label>' +
        '<input class="re-input" type="range" min="' + RMIN + '" max="' + RMAX + '" step="0.1" value="' + rate.toFixed(1) + '"></div></div>' +
      '<div id="retire-explore-out">' + this._withdrawExploreOut(r, P, sim) + "</div></div>";
  },

  /* rebuild P + base nest from App.retire and re-render just the explorer box
     (used by the slider's live handler so the rest of the page stays put) */
  _withdrawExploreRefresh() {
    const r = App.retire;
    const P = { start: r.start, contrib: r.contrib, years: r.years, annualSpend: r.annualSpend, inflation: r.inflation, eqRet: r.eqRet, bondRet: r.bondRet, cashRet: r.cashRet, cashYears: r.cashYears, bondYears: r.bondYears, accEquity: r.accEquity, maxDraw: 30 };
    const sim = retirementBuckets(P);
    return this._withdrawExploreOut(r, P, sim);
  },

  _withdrawExploreOut(r, P, sim) {
    const nestReal = Number(sim.nestReal) || 0;
    const RMIN = 2.5, RMAX = 9;
    const implied = (Number(r.annualSpend) || 0) / nestReal * 100;
    const clampR = x => Math.max(RMIN, Math.min(RMAX, x));
    const rate = App.retire.exploreSWR != null ? clampR(App.retire.exploreSWR)
      : (implied >= RMIN && implied <= RMAX ? implied : 4);
    const spend0 = rate / 100 * nestReal;                       // today's-pesos annual draw
    const eP = Object.assign({}, P, { annualSpend: spend0 });
    const eSim = retirementBuckets(eP);
    const eMc = retirementBucketsMC(Object.assign({}, eP, { runs: 300 }));
    const succ = Math.round(eMc.successRate * 100);
    const succTone = succ >= 85 ? "pos" : succ >= 60 ? "gold" : "neg";
    const lasts = eSim.sustainable ? eSim.maxDraw + "+ yrs" : eSim.depletedYear + " yr" + (eSim.depletedYear === 1 ? "" : "s");
    const infl = (Number(r.inflation) || 0) / 100, years = Math.max(0, Math.round(Number(r.years) || 0));
    const nominal1 = spend0 * Math.pow(1 + infl, years);        // first retirement year, nominal
    const targetSpend = Number(r.annualSpend) || 0;
    const diff = targetSpend > 0 ? (spend0 - targetSpend) / targetSpend : 0;
    const stat = (l, v, note, cls) => '<div class="stat"><span class="micro-label">' + l + '</span><div class="stat-value ' + (cls || "") + '">' + v + '</div><div class="stat-note">' + note + "</div></div>";
    const stats = '<div class="grid cols-4 section">' +
      stat("Annual income", fmtMoney(spend0, { compact: true }) + "/yr",
        fmtMoney(spend0 / 12, { compact: true }) + "/mo · today’s pesos", "pos") +
      stat("First year (nominal)", fmtMoney(nominal1, { compact: true }),
        "what you’d actually draw in yr " + (years + 1), "gold") +
      stat("Money lasts (base case)", lasts,
        eSim.sustainable ? "buffers hold up" : "until the pot runs dry", eSim.sustainable ? "pos" : "neg") +
      stat("Success rate", succ + "%",
        "of " + eMc.runs + " realistic-market runs", succTone) +
      "</div>";
    const chart = this._retireChart(eSim, r, eMc, {
      sub: "same nest egg · drawing " + rate.toFixed(1) + "% (" + fmtMoney(spend0, { compact: true }) + "/yr today’s pesos) · shaded = likely range",
      hint: "Same nest egg and bucket strategy as above — only the withdrawal rate changes. A higher rate lifts the line’s starting income but pulls it down faster; watch the shaded worst-case band to see if it survives the full retirement.",
    });
    const cmp = Math.abs(diff) < 0.005
      ? "This matches your target spending."
      : "That’s <strong>" + (diff > 0 ? "+" : "−") + Math.round(Math.abs(diff) * 100) + "%</strong> " + (diff > 0 ? "more" : "less") + " than your " + fmtMoney(targetSpend, { compact: true }) + " target.";
    const verdict = eSim.sustainable
      ? "At <strong>" + rate.toFixed(1) + "%</strong> you could draw <strong>" + fmtMoney(spend0, { compact: true }) + "/yr</strong> (today’s pesos) and the base case still lasts the full " + eSim.maxDraw + " years, with " + fmtMoney(eSim.endBalance, { compact: true }) + " left. " + cmp
      : "At <strong>" + rate.toFixed(1) + "%</strong> (" + fmtMoney(spend0, { compact: true }) + "/yr) the base case runs dry in about <strong>" + eSim.depletedYear + " years</strong> — too fast. Ease the rate down for a safer draw. " + cmp;
    return stats + chart + '<p class="method-note" style="margin-top:4px">' + verdict + "</p>";
  },

  _bucketPanel(r, sim) {
    const infl = (Number(r.inflation) || 0) / 100, years = Math.max(0, Math.round(Number(r.years) || 0));
    const spendRet1 = (Number(r.annualSpend) || 0) * Math.pow(1 + infl, years);
    const nest = sim.nest;
    const cash = Math.min(nest, r.cashYears * spendRet1);
    const bond = Math.min(Math.max(0, nest - cash), r.bondYears * spendRet1);
    const eq = Math.max(0, nest - cash - bond);
    const pct = v => nest > 0 ? v / nest * 100 : 0;
    const seg = (v, bg, label) => '<span style="width:' + pct(v).toFixed(2) + "%;background:" + bg + '" data-tip="' + esc(label + " · " + fmtMoney(v, { compact: true }) + " · " + Math.round(pct(v)) + "%") + '"></span>';
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Your buckets at retirement</div>' +
      '<span class="panel-sub">' + r.cashYears + "y cash + " + r.bondYears + "y bonds · everything else = equities</span></div>" +
      '<div class="comp-bar">' + seg(cash, "var(--text-mute)", "Cash") + seg(bond, "var(--sky)", "Bonds") + seg(eq, "var(--mint)", "Equities") + "</div>" +
      '<div class="comp-legend" style="margin-top:12px">' +
        '<span class="lg"><span class="dot" style="background:var(--text-mute)"></span>Cash ' + Math.round(pct(cash)) + "% · " + r.cashYears + "y</span>" +
        '<span class="lg"><span class="dot" style="background:var(--sky)"></span>Bonds ' + Math.round(pct(bond)) + "% · " + r.bondYears + "y</span>" +
        '<span class="lg"><span class="dot" style="background:var(--mint)"></span>Equities ' + Math.round(pct(eq)) + "%</span></div></div>";
  },

  _strategyCompare(P, r) {
    const profiles = [["Aggressive", 0, 0], ["Balanced", 1, 2], ["Buffered 1+3", 1, 3], ["Conservative", 2, 6]];
    const rows = profiles.map(p => {
      const mc = retirementBucketsMC(Object.assign({}, P, { cashYears: p[1], bondYears: p[2], runs: 600 }));
      const succ = Math.round(mc.successRate * 100);
      const cur = p[1] === r.cashYears && p[2] === r.bondYears;
      const last = mc.band[mc.band.length - 1];
      return "<tr" + (cur ? ' class="cur"' : "") + "><td>" + p[0] + (cur ? ' <span class="tag mint">current</span>' : "") + "</td>" +
        '<td class="num">' + p[1] + "y / " + p[2] + "y</td>" +
        '<td class="num ' + (succ >= 85 ? "pos" : succ >= 60 ? "gold" : "neg") + '">' + succ + "%</td>" +
        '<td class="num">' + fmtMoney(last.p10, { compact: true }) + "</td>" +
        '<td class="num">' + fmtMoney(last.p50, { compact: true }) + "</td>" +
        '<td class="num">' + (cur ? "" : '<button class="btn small ghost" data-action="retire-bucket" data-method="' + p[1] + ":" + p[2] + '">Use</button>') + "</td></tr>";
    }).join("");
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">Compare risk profiles</div>' +
      '<span class="panel-sub">same returns &amp; spending · different buffers · 30-yr retirement</span></div>' +
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Profile</th><th class="num">Cash / Bonds</th><th class="num">Success</th><th class="num">Worst case</th><th class="num">Median left</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<p class="method-note" style="margin-top:10px"><strong>Worst case</strong> is the 10th-percentile ending balance. A <em>modest</em> buffer (1–3 years) usually wins: it lets you spend cash &amp; bonds through a slump instead of selling stocks low, which lifts both the worst case and the success rate. But too big a buffer (e.g. 2y/6y) parks too much in low-return assets — that drag drops the median and, at higher spending, the success rate too. The sweet spot is a few years of cushion, not a fortress.</p></div>';
  },

  _bucketNote(sim, r) {
    const body = sim.sustainable
      ? "With a " + r.cashYears + "-year cash and " + r.bondYears + "-year bond buffer, the base case lasts the full " + sim.maxDraw + "+ years with " + fmtMoney(sim.endBalance, { compact: true }) + " left. The buffers mean you spend safe assets in downturns and let equities recover instead of selling them low."
      : "Even with the buffers, the base case runs dry in about <strong>" + sim.depletedYear + " years</strong> — spending outpaces the blend. Raise returns, spend less, grow longer, or carry a bigger equity share for more growth.";
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">What this means</div></div>' +
      '<p class="method-note">' + body + " Of the " + fmtMoney(sim.nest, { compact: true }) + " nest egg, " + fmtMoney(sim.contributed, { compact: true }) + " is money you put in and " + fmtMoney(sim.growth, { compact: true }) + " is growth. Figures are nominal unless marked “today’s pesos”.</p></div>";
  },

  /* FIRE number + Coast FIRE — nest egg that funds your spending forever */
  _firePanel(r) {
    const est = (typeof budgetSpendEstimate === "function") ? budgetSpendEstimate() : { annual: 0, months: 0, cov: 0, basis: "" };
    const annualSpend = Math.max(0, Number(r.annualSpend) || 0);
    const hint = this._hint("FIRE number = annual spending ÷ withdrawal rate (the slider above). Annual spending is the editable field in Assumptions" +
      (est.months ? ", pre-filled from your budget as the " + est.basis + " of your " + est.months + " logged month" + (est.months === 1 ? "" : "s") +
        (est.cov > 0.0001 ? " (which vary ±" + Math.round(est.cov * 100) + "% month-to-month)" : "") : "") +
      ". Coast FIRE = the amount that, growing at your real return for " + Math.max(1, Number(r.years) || 1) + " years, reaches the FIRE number with zero further saving.");
    if (!(annualSpend > 0)) {
      return '<div class="panel section"><div class="panel-head"><div class="panel-title">FIRE number' + hint + "</div></div>" +
        '<p class="method-note">Enter your <strong>Annual spending in retirement</strong> in the Assumptions above (or log a month or two on the Budget tab to auto-fill it) and FinanceOS will show your FIRE number — the nest egg that funds that spending forever at your withdrawal rate.</p></div>';
    }
    const swr = Math.max(0.5, Number(r.withdraw) || 4) / 100;
    const fire = annualSpend / swr;
    const now = Math.max(0, Number(r.start) || 0);
    const progress = fire > 0 ? Math.min(100, now / fire * 100) : 0;
    const realReturn = (Number(r.ret) || 0) - (Number(r.inflation) || 0);
    const years = Math.max(1, Number(r.years) || 1);
    const coast = fire / Math.pow(1 + Math.max(0, realReturn) / 100, years);
    const hitFire = now >= fire, hitCoast = now >= coast;
    const stat = (l, v, note, cls) => '<div class="stat"><span class="micro-label">' + l + '</span><div class="stat-value ' + (cls || "") + '">' + v + '</div><div class="stat-note">' + note + "</div></div>";
    const verdict = hitFire
      ? "You’ve reached <strong>FIRE</strong> — your assets can fund " + fmtMoney(annualSpend, { compact: true }) + "/yr indefinitely at " + r.withdraw + "%."
      : hitCoast
        ? "You’ve hit <strong>Coast FIRE</strong>: even with zero new savings, growth alone reaches your FIRE number in " + years + " years."
        : "You’re <strong>" + Math.round(progress) + "%</strong> of the way. Reach " + fmtMoney(coast, { compact: true }) + " (Coast FIRE) and you could stop saving and still arrive in " + years + " years.";
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">FIRE number' + hint + "</div>" +
      '<span class="panel-sub">spend ' + fmtMoney(annualSpend, { compact: true }) + "/yr · " + r.withdraw + "% rule</span></div>" +
      '<div class="grid cols-3 section" style="margin:0 0 6px">' +
        stat("FIRE number", fmtMoney(fire, { compact: true }), "≈ " + Math.round(1 / swr) + "× annual spend", "gold") +
        stat("You’re at", Math.round(progress) + "%", fmtMoney(now, { compact: true }) + " of " + fmtMoney(fire, { compact: true }), progress >= 100 ? "pos" : "") +
        stat("Coast FIRE", fmtMoney(coast, { compact: true }), hitCoast ? "reached — coasting" : "stop saving once here", hitCoast ? "pos" : "") +
      "</div>" +
      '<div class="goal-track"><div class="goal-fill' + (hitFire ? " done" : "") + '" style="width:' + progress.toFixed(1) + '%"></div></div>' +
      '<p class="method-note" style="margin-top:12px">' + verdict +
      (est.months ? " Spending estimate: " + est.basis + " from " + est.months + " logged month" + (est.months === 1 ? "" : "s") +
        (est.cov > 0.15 ? " — but it varies ±" + Math.round(est.cov * 100) + "% month-to-month, so treat this as rough and edit the Annual spending field" : "") + "."
        : " Set Annual spending in the Assumptions to refine this.") + "</p></div>";
  },

  _retireChart(sim, r, mc, opts) {
    opts = opts || {};
    const pts = sim.pts;
    if (pts.length < 2) return "";
    const n = pts.length;
    const band = (mc && mc.band) || [];
    const bandMax = band.slice(0, n).reduce((m, b) => Math.max(m, b.p90), 0);
    const max = Math.max(Math.max.apply(null, pts.map(p => p.bal)), bandMax) || 1;
    const W = 1000, H = 240, PAD = 8;
    const X = (i) => PAD + i * (W - 2 * PAD) / (n - 1);
    const Y = (v) => H - PAD - v / max * (H - 2 * PAD);
    const line = pts.map((p, i) => X(i).toFixed(1) + "," + Y(p.bal).toFixed(1)).join(" ");
    const area = line + " " + X(n - 1).toFixed(1) + "," + (H - PAD) + " " + X(0).toFixed(1) + "," + (H - PAD);
    // Monte-Carlo p10–p90 cone behind the base-case line
    let cone = "";
    if (band.length >= n) {
      const top = band.slice(0, n).map((b, i) => X(i).toFixed(1) + "," + Y(b.p90).toFixed(1)).join(" ");
      const bot = band.slice(0, n).map((b, i) => X(i).toFixed(1) + "," + Y(b.p10).toFixed(1)).reverse().join(" ");
      cone = '<polygon points="' + top + " " + bot + '" fill="rgba(143,201,227,0.16)"/>';
    }
    const rx = X(Math.min(r.years, n - 1));
    const grid = [1, 2 / 3, 1 / 3].map(f =>
      '<div class="proj-grid" style="top:' + ((1 - f) * 100).toFixed(1) + '%"><span>' + fmtMoney(max * f, { compact: true }) + "</span></div>").join("");
    const hits = this._chartHits(pts.map((p, i) => ({
      tip: (p.phase === "save" ? "Saving" : "Retired") + " · yr " + p.year + " · base <strong>" + fmtMoney(p.bal, { compact: true }) + "</strong>" +
        (band[i] ? " · range " + fmtMoney(band[i].p10, { compact: true }) + "–" + fmtMoney(band[i].p90, { compact: true }) : ""),
    })));
    const chartHint = this._hint(opts.hint ||
      ("The solid line is the steady base case (a flat " + r.ret + "% return). The shaded band is the 10th–90th percentile of " + ((mc && mc.runs) || 300) + " simulations with realistic markets — crashes hit at random but are capped at a 55% drop, at most 3 down years in a row, and a recovery within ~6 years — so in roughly 80% of those markets you end each year inside the band. Tap a point for its range."));
    const sub = opts.sub || ("grow " + r.years + "y at " + r.ret + "%, then draw " + r.withdraw + "%/yr · shaded = likely range");
    return '<div class="panel section"><div class="panel-head">' +
      '<div class="panel-title">Your money over a lifetime' + chartHint + "</div>" +
      '<span class="panel-sub">' + sub + "</span></div>" +
      '<div class="chart-wrap"><div class="retire-plot">' + grid +
        '<svg class="retire-chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' +
          '<defs><linearGradient id="retfill" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="rgba(143,227,166,0.30)"/>' +
            '<stop offset="100%" stop-color="rgba(143,227,166,0)"/></linearGradient></defs>' +
          cone +
          '<polygon points="' + area + '" fill="url(#retfill)"/>' +
          '<line x1="' + rx.toFixed(1) + '" y1="0" x2="' + rx.toFixed(1) + '" y2="' + H + '" stroke="#e6cb80" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.85"/>' +
          '<polyline points="' + line + '" fill="none" stroke="#8fe3a6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
        "</svg>" + hits + "</div></div>" +
      '<div class="retire-scale"><span>today · ' + fmtMoney(pts[0].bal, { compact: true }) + "</span>" +
        '<span class="gold">retire yr ' + r.years + " · " + fmtMoney(sim.nest, { compact: true }) + "</span>" +
        "<span>+" + sim.maxDraw + "y · " + fmtMoney(sim.endBalance, { compact: true }) + "</span></div></div>";
  },

  _retireNote(sim, r, mc) {
    const realR = sim.realReturn.toFixed(1);
    const succ = mc ? Math.round(mc.successRate * 100) : null;
    const body = sim.sustainable
      ? "At a <strong>" + realR + "% real return</strong> (" + r.ret + "% − " + r.inflation + "% inflation), a " + r.withdraw +
        "% withdrawal keeps its buying power and barely touches the principal — in the base case your income lasts " + sim.maxDraw +
        "+ years with " + fmtMoney(sim.endBalance, { compact: true }) + " left."
      : "A " + r.withdraw + "% withdrawal rising with " + r.inflation + "% inflation outpaces a " + r.ret +
        "% return, so the base case lasts about <strong>" + sim.depletedYear + " years</strong>. Lower the rate, grow longer, or add monthly contributions to extend it.";
    const risk = succ != null
      ? " Allowing for realistic crashes (random, but capped at a 55% drop and recovering within ~6 years), the money outlasts " + sim.maxDraw + " years in <strong class=\"" + (succ >= 85 ? "pos" : succ >= 60 ? "gold" : "neg") + "\">" + succ + "%</strong> of simulated runs."
      : "";
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">What this means</div></div>' +
      '<p class="method-note">' + body + risk + " Of the " + fmtMoney(sim.nest, { compact: true }) + " nest egg, " +
      fmtMoney(sim.contributed, { compact: true }) + " is money you put in and " +
      fmtMoney(sim.growth, { compact: true }) + " is investment growth. Figures are nominal unless marked “today’s pesos”.</p></div>";
  },
};
