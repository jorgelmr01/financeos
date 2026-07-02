/* FinanceOS — Annual report
   ----------------------------------------------------------------------------
   One self-contained, printable HTML document with the whole financial year:
   net worth and its change, income, spending, portfolio results, realized
   gains, the tax picture and the balance sheet. Built entirely from local
   data and downloaded as a file — print it to PDF from the browser. */
"use strict";

const Report = {
  /* gather every number the report shows — pure-ish, testable */
  data(year) {
    const y = year || todayMid().getFullYear();
    const t = computeTotals();
    const eb = earningsBreakdown();
    const cur = displayCurrency();

    // net worth path from snapshots within the year
    const snaps = (Store.state.snapshots || []).filter(s => String(s.d).slice(0, 4) === String(y));
    const nwStart = snaps.length ? fromUSD(snaps[0].usd) : null;
    const nwNow = t.netWorth;

    // spending: the year's complete months from the budget series
    const series = (typeof budgetSeries === "function" ? budgetSeries(null) : [])
      .filter(m => m.mk.slice(0, 4) === String(y) && m.hasData);
    const spend = series.reduce((a, m) => a + (Number(m.spend) || 0), 0);
    const saveRates = series.map(m => m.savingsRate).filter(v => v != null);
    const avgSave = saveRates.length ? saveRates.reduce((a, b) => a + b, 0) / saveRates.length : null;
    const catTotals = {};
    (Store.state.expenses || []).forEach(e => {
      if (String(e.date).slice(0, 4) !== String(y)) return;
      const c = e.category || "Other";
      catTotals[c] = (catTotals[c] || 0) + conv(Number(e.amount) || 0, e.currency);
    });
    const topCats = Object.keys(catTotals).map(k => ({ name: k, amount: catTotals[k] }))
      .sort((a, b) => b.amount - a.amount).slice(0, 8);

    // portfolio & taxes
    const rs = (typeof realizedSummary === "function") ? realizedSummary(String(y)) : { gainYear: 0, taxDue: 0, count: 0 };
    const ax = (typeof accountXirr === "function") ? accountXirr() : { rate: null };
    const wer = (typeof weightedExpenseRatio === "function") ? weightedExpenseRatio() : null;
    const divTaxRate = (Store.state.settings.tax && Number(Store.state.settings.tax.dividends)) || 0;

    return {
      year: y, currency: cur, generated: toISO(todayMid()),
      netWorth: { now: nwNow, start: nwStart, change: nwStart != null ? nwNow - nwStart : null, snaps: snaps.length },
      income: {
        monthlyNet: eb.monthlyNet, annualNet: eb.monthlyNet * 12,
        interestGross: eb.intGross, dividendsNet: eb.divNet,
      },
      spending: { total: spend, months: series.length, avgSavingsRate: avgSave, topCats: topCats },
      portfolio: {
        marketValue: t.marketValue, invested: t.invested, unrealized: t.pnl,
        xirr: ax.rate, xirrSource: ax.source || "purchases",
        feesPct: wer ? wer.pct : null, feesCost: wer ? wer.annualCost : null,
        realizedGain: rs.gainYear, realizedCount: rs.count,
      },
      taxes: {
        interestISR: eb.intAnnualISR != null ? eb.intAnnualISR : null,
        interestProvisional: eb.intProvisional != null ? eb.intProvisional : null,
        dividendWithheld: (eb.divGross || 0) * divTaxRate / 100,
        capGainsDue: rs.taxDue,
      },
      balance: {
        cash: t.cash + t.savings + t.investCash, investments: t.marketValue, other: t.otherAssets,
        assets: t.assets, cards: t.debt, loans: t.otherDebt, liabilities: t.totalDebt,
        liquidNW: t.liquidAssets - t.debt, debtToAssets: t.assets > 0 ? t.totalDebt / t.assets : 0,
      },
    };
  },

  /* the printable document */
  html(year) {
    const d = this.data(year);
    const M = v => v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: d.currency, maximumFractionDigits: 0 }).format(v);
    const P = (v, dg) => v == null ? "—" : (v > 0 ? "+" : "") + (v * 100).toFixed(dg == null ? 1 : dg) + "%";
    const row = (l, v, note) => '<tr><td>' + l + "</td><td class=\"n\">" + v + "</td><td class=\"note\">" + (note || "") + "</td></tr>";
    const sec = (title, body) => '<section><h2>' + title + "</h2>" + body + "</section>";
    const table = rows => '<table>' + rows + "</table>";

    const cats = d.spending.topCats.map(c => row(c.name, M(c.amount))).join("");
    return "<!doctype html><html><head><meta charset='utf-8'><title>FinanceOS — Annual Report " + d.year + "</title><style>" +
      "body{font-family:Georgia,'Times New Roman',serif;max-width:760px;margin:40px auto;padding:0 24px;color:#1d2721;line-height:1.5}" +
      "h1{font-size:26px;margin-bottom:2px} .sub{color:#5e6b60;font-size:13px;margin-bottom:28px}" +
      "h2{font-size:15px;letter-spacing:.04em;text-transform:uppercase;color:#177a42;border-bottom:2px solid #177a42;padding-bottom:4px;margin:30px 0 10px}" +
      "table{width:100%;border-collapse:collapse;font-size:14px}" +
      "td{padding:6px 4px;border-bottom:1px solid #e6e2d3} td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600}" +
      "td.note{color:#5e6b60;font-size:12px;text-align:right;width:34%}" +
      ".big{font-size:34px;font-weight:700;margin:6px 0} .pos{color:#177a42}.neg{color:#bd4a33}" +
      ".foot{margin-top:34px;color:#5e6b60;font-size:11.5px;border-top:1px solid #e6e2d3;padding-top:12px}" +
      "@media print{body{margin:10mm auto}}" +
      "</style></head><body>" +
      "<h1>Annual Report " + d.year + "</h1>" +
      "<div class='sub'>FinanceOS · generated " + d.generated + " · all figures in " + d.currency + " · private, built on your device</div>" +
      "<div class='big " + (d.netWorth.now >= 0 ? "pos" : "neg") + "'>" + M(d.netWorth.now) + "</div>" +
      "<div class='sub'>Net worth" + (d.netWorth.change != null ? " · " + (d.netWorth.change >= 0 ? "+" : "") + M(d.netWorth.change).replace("$-", "-$") + " this year (from " + M(d.netWorth.start) + ")" : "") + "</div>" +
      sec("Income", table(
        row("Net income (monthly run-rate)", M(d.income.monthlyNet), "≈ " + M(d.income.annualNet) + "/yr") +
        row("Interest earned (gross)", M(d.income.interestGross), "per year, current balances") +
        row("Dividends (net)", M(d.income.dividendsNet), "per year, current positions"))) +
      sec("Spending", table(
        row("Total spending", M(d.spending.total), d.spending.months + " tracked month" + (d.spending.months === 1 ? "" : "s")) +
        row("Average savings rate", d.spending.avgSavingsRate == null ? "—" : Math.round(d.spending.avgSavingsRate * 100) + "%", "of net income") +
        cats)) +
      sec("Portfolio", table(
        row("Market value", M(d.portfolio.marketValue), "cost basis " + M(d.portfolio.invested)) +
        row("Unrealized P/L", M(d.portfolio.unrealized), "") +
        row("Money-weighted return (XIRR)", P(d.portfolio.xirr), d.portfolio.xirrSource === "flows" ? "from recorded cash flows" : "from purchase dates") +
        row("Fund fees", d.portfolio.feesPct == null ? "—" : d.portfolio.feesPct.toFixed(2) + "%/yr", d.portfolio.feesCost != null ? "≈ " + M(d.portfolio.feesCost) + "/yr" : "") +
        row("Realized gains (" + d.year + ")", M(d.portfolio.realizedGain), d.portfolio.realizedCount + " sale" + (d.portfolio.realizedCount === 1 ? "" : "s")))) +
      sec("Tax picture (estimates)", table(
        row("ISR on real interest", M(d.taxes.interestISR), "due with the April return") +
        row("Provisional ISR withheld", M(d.taxes.interestProvisional), "credit against the above") +
        row("Dividend ISR withheld", M(d.taxes.dividendWithheld), "definitive at source") +
        row("ISR on realized gains", M(d.taxes.capGainsDue), "10% of net gains, listed shares"))) +
      sec("Balance sheet", table(
        row("Cash & savings", M(d.balance.cash), "") +
        row("Investments", M(d.balance.investments), "") +
        row("Property & other assets", M(d.balance.other), "") +
        row("<strong>Total assets</strong>", "<strong>" + M(d.balance.assets) + "</strong>", "") +
        row("Credit cards", M(-d.balance.cards), "") +
        row("Loans & mortgages", M(-d.balance.loans), "") +
        row("<strong>Net worth</strong>", "<strong>" + M(d.netWorth.now) + "</strong>",
          "liquid " + M(d.balance.liquidNW) + " · debt/assets " + Math.round(d.balance.debtToAssets * 100) + "%"))) +
      "<div class='foot'>Figures are estimates assembled from the data you entered in FinanceOS — verify against official statements before filing anything. Tax lines are educational estimates, not tax advice. Print this page to PDF for your records.</div>" +
      "</body></html>";
  },

  download(year) {
    const y = year || todayMid().getFullYear();
    const blob = new Blob([this.html(y)], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "financeos-annual-report-" + y + ".html";
    a.click();
    URL.revokeObjectURL(a.href);
  },
};
