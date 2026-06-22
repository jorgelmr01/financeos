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
        '<div class="stat"><span class="micro-label">Liquid cash</span><div class="stat-value">' + fmtMoney(t.cash + t.savings + t.investCash) + '</div><div class="stat-note">' + s.accounts.length + " account" + (s.accounts.length === 1 ? "" : "s") + "</div></div>" +
        '<div class="stat"><span class="micro-label">Portfolio value</span><div class="stat-value">' + fmtMoney(t.marketValue) + '</div><div class="stat-note ' + (t.pnl >= 0 ? "pos" : "neg") + '">' + fmtMoney(t.pnl, { sign: true }) + " (" + fmtPct(t.invested ? t.pnl / t.invested * 100 : 0, 1) + ")</div></div>" +
        '<div class="stat"><span class="micro-label">Credit available</span><div class="stat-value">' + fmtMoney(Math.max(0, t.creditLimit - t.debt)) + '</div><div class="stat-note">of ' + fmtMoney(t.creditLimit, { compact: true }) + " total limit</div></div>" +
        '<div class="stat"><span class="micro-label">Monthly income (net)</span><div class="stat-value gold">' + fmtMoney(eb.monthlyNet) + '</div><div class="stat-note">after tax · incl. interest &amp; dividends</div></div>' +
      "</div>" +

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

    return stats + '<div class="grid cols-2 section">' + cards + "</div>";
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

    return stats + '<div class="grid cols-2 section">' + cardsHtml + "</div>";
  },

  /* ================= PORTFOLIO ================= */
  portfolio() {
    const s = Store.state;
    if (!s.holdings.length) {
      return '<div class="section"><div class="empty"><div class="empty-glyph">' + icon("growth") + '</div>' +
        "<h3>No positions yet</h3><p>Add the stocks and ETFs you own with the price you paid. FinanceOS computes your returns as you update prices.</p>" +
        '<button class="btn primary" data-action="add-holding">+ Add your first position</button></div></div>';
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
        '<td class="num"><input class="price-input" type="number" step="any" min="0" value="' + h.currentPrice + '" data-price-id="' + h.id + '" title="Edit current price (' + esc(h.currency) + ')"></td>' +
        '<td class="num">' + fmtMoney(mv) + "</td>" +
        '<td class="num ' + (pnl >= 0 ? "pos" : "neg") + '">' + fmtMoney(pnl, { sign: true }) + '<div class="cell-sub ' + (pnl >= 0 ? "pos" : "neg") + '">' + fmtPct(pct) + "</div></td>" +
        '<td class="actions-cell">' +
          '<button class="icon-btn" data-action="edit-holding" data-id="' + h.id + '" title="Edit">' + icon("edit") + '</button>' +
          '<button class="icon-btn danger" data-action="del-holding" data-id="' + h.id + '" title="Delete">' + icon("x") + '</button>' +
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
        '<div class="detail-update"><input class="price-input" type="number" step="any" min="0" value="' + now + '" data-price-id="' + h.id + '">' +
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
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr>' +
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

    // ---- category breakdown (actual vs budget) ----
    const maxCat = cats.reduce((m, c) => Math.max(m, c.amount), 0) || 1;
    const catRows = cats.map(c => {
      const budget = budgetForCategory(c.name);
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
        "Dividends feed the Earnings page and your annual-earnings milestone automatically. If a ticker still reports no dividend, set <strong>Dividend / share / year</strong> yourself in the position editor (pencil button) — manual values are never overwritten.",
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
        "Switch to <strong>Trends</strong> to compare months: this month vs your trailing average, spending &amp; score charts, the categories you're spending more/less on, and saving streaks.",
        "Insights default to your most recent <strong>complete</strong> month — the current month is marked <em>“in progress”</em> and its score is paced against the days elapsed, so a few days into a new statement never looks like you suddenly saved a fortune.",
      ]) +
      card("◔", "Charts are interactive", [
        "<strong>Tap any chart</strong> — bars, the net-worth and price lines, allocation and composition bars — to see the exact value for that point or segment.",
        "On the <strong>Portfolio</strong>, tap a position for a price chart and full detail; on <strong>Income</strong>, tap a projection bar for that period's breakdown; on <strong>Budget → Trends</strong>, compare months and categories over time.",
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

  /* ================= RETIREMENT ================= */
  retirement() {
    if (!App.retire) App.retire = App.retireDefaults();
    const r = App.retire;
    const cur = displayCurrency();
    const controls =
      '<div class="panel section retire-controls"><div class="panel-head">' +
        '<div class="panel-title">Assumptions</div>' +
        '<span class="panel-sub">drag to explore — everything updates live</span></div>' +
        '<div class="grid cols-2">' +
          '<div class="field"><label>Starting amount (' + cur + ')</label>' +
            '<input class="r-input" data-rk="start" type="number" min="0" step="1000" value="' + r.start + '">' +
            '<div class="hint">Seeded from your current net worth — edit freely, or hit “Use my net worth”.</div></div>' +
          '<div class="field"><label>Monthly contribution (' + cur + ')</label>' +
            '<input class="r-input" data-rk="contrib" type="number" min="0" step="500" value="' + r.contrib + '">' +
            '<div class="hint">Extra you add every month while still saving.</div></div>' +
        "</div>" +
        '<div class="r-grid">' +
          this._rslider("ret", "Annual return", r.ret, 0, 15, 0.5, "%") +
          this._rslider("years", "Years to grow", r.years, 0, 50, 1, " yr") +
          this._rslider("withdraw", "Withdrawal rate", r.withdraw, 1, 10, 0.1, "%") +
          this._rslider("inflation", "Inflation", r.inflation, 0, 12, 0.1, "%") +
        "</div>" +
      "</div>";
    return controls + '<div id="retire-out">' + this.retirementOutput() + "</div>";
  },

  _rslider(key, label, val, min, max, step, suffix) {
    return '<div class="r-row"><label>' + label +
      '<output class="r-val" data-rv="' + key + '">' + val + suffix + "</output></label>" +
      '<input class="r-input" data-rk="' + key + '" data-suffix="' + suffix + '" type="range" min="' + min +
      '" max="' + max + '" step="' + step + '" value="' + val + '"></div>';
  },

  retirementOutput() {
    const r = App.retire;
    const sim = retirementProjection({
      start: r.start, ret: r.ret, years: r.years, contrib: r.contrib,
      withdraw: r.withdraw, inflation: r.inflation, maxDraw: 50,
    });
    const mc = retirementMonteCarlo({
      start: r.start, ret: r.ret, years: r.years, contrib: r.contrib,
      withdraw: r.withdraw, inflation: r.inflation, vol: 12, maxDraw: 50, runs: 300,
    });
    const succ = Math.round(mc.successRate * 100);
    const succTone = succ >= 85 ? "pos" : succ >= 60 ? "gold" : "neg";
    const stat = (label, val, note, cls) =>
      '<div class="stat"><span class="micro-label">' + label + '</span><div class="stat-value ' + (cls || "") +
      '">' + val + '</div><div class="stat-note">' + note + "</div></div>";
    const lasts = sim.sustainable ? sim.maxDraw + "+ yrs" : sim.depletedYear + " yr" + (sim.depletedYear === 1 ? "" : "s");

    const stats = '<div class="grid cols-4 section">' +
      stat("Nest egg at retirement", fmtMoney(sim.nest, { compact: true }),
        "in " + r.years + " yr · " + fmtMoney(sim.nestReal, { compact: true }) + " in today’s pesos", "gold") +
      stat("Monthly income", fmtMoney(sim.monthlyIncome, { compact: true }),
        "at " + r.withdraw + "% · " + fmtMoney(sim.monthlyIncomeReal, { compact: true }) + " today’s pesos", "pos") +
      stat("Money lasts (base case)", lasts,
        sim.sustainable ? "capital stays intact" : "until the pot runs dry", sim.sustainable ? "pos" : "neg") +
      stat("Success rate", succ + "%",
        "of " + mc.runs + " random-market runs the money outlives " + sim.maxDraw + " yr", succTone) +
      "</div>";

    return stats + this._retireChart(sim, r, mc) + this._retireNote(sim, r, mc);
  },

  _retireChart(sim, r, mc) {
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
    return '<div class="panel section"><div class="panel-head">' +
      '<div class="panel-title">Your money over a lifetime</div>' +
      '<span class="panel-sub">grow ' + r.years + "y at " + r.ret + "%, then draw " + r.withdraw + "%/yr · shaded = likely range</span></div>" +
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
      ? " Allowing for real market swings (±" + Math.round(mc.vol) + "% a year), the money outlasts " + sim.maxDraw + " years in <strong class=\"" + (succ >= 85 ? "pos" : succ >= 60 ? "gold" : "neg") + "\">" + succ + "%</strong> of simulated runs."
      : "";
    return '<div class="panel section"><div class="panel-head"><div class="panel-title">What this means</div></div>' +
      '<p class="method-note">' + body + risk + " Of the " + fmtMoney(sim.nest, { compact: true }) + " nest egg, " +
      fmtMoney(sim.contributed, { compact: true }) + " is money you put in and " +
      fmtMoney(sim.growth, { compact: true }) + " is investment growth. Figures are nominal unless marked “today’s pesos”.</p></div>";
  },
};
