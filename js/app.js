/* FinanceOS — controller: routing, events, init */
"use strict";

const App = {
  page: "overview",
  budgetMonth: null,   // selected month on the Budget page (YYYY-MM)
  budgetView: "month", // "month" | "trends"
  holdingDetail: null, // open position id on the Portfolio page
  portfolioMode: "basic", // investments tab: "basic" | "advanced"
  advRange: "1y",      // advanced-view history range
  advData: null,       // cached fetched history dataset for the advanced view
  _advLoading: null,   // range currently being fetched (guards against re-fetch loops)
  priceRange: "6mo",   // price-history range for the detail chart
  earnHorizon: 1,      // income projection horizon in years (1|3|5)
  earnSel: 0,          // selected projection bucket
  retire: null,        // retirement-calculator assumptions (lazy-init from net worth)
  debtMethod: "avalanche", // debt-payoff strategy: "avalanche" | "snowball"
  debtBudget: null,    // monthly payment budget for the payoff calculator
  buro: null,          // self-reported inputs for the credit-score simulator
  irreg: null,         // inputs for the irregular-income planner
  wplan: null,         // wealth-projection assumptions (lazy-init)

  PAGE_META: {
    overview:   { title: "Today",        actions: "" },
    accounts:   { title: "Accounts",     actions: '<button class="btn primary" data-action="add-account">+ Add account</button>' },
    cards:      { title: "Credit Cards", actions: '<button class="btn" data-action="cards-ics" title="Download an .ics file with every cut & due date — drop it into Google or Apple Calendar for real reminders">⤓ Calendar</button><button class="btn primary" data-action="add-card">+ Add card</button>' },
    portfolio:  { title: "Portfolio",    actions: '<button class="btn" data-action="refresh-prices">↻ Update prices</button><button class="btn primary" data-action="add-holding">+ Add position</button>' },
    earnings:   { title: "Income",       actions: '<button class="btn primary" data-action="add-income">+ Add income stream</button>' },
    budget:     { title: "Budget",       actions: '<button class="btn" data-action="expense-template">↓ Template</button><button class="btn" data-action="expense-import">↑ Upload</button><button class="btn primary" data-action="add-expense">+ Add expense</button>' },
    retirement: { title: "Retirement",   actions: '<button class="btn" data-action="retire-reset">↺ Use my net worth</button>' },
    milestones: { title: "Milestones",   actions: "" },
    learn:      { title: "Learn",        actions: "" },
    guide:      { title: "Guide",        actions: "" },
  },

  /* starting assumptions for the retirement calculator, seeded from current
     net worth and the configured inflation rate */
  retireDefaults() {
    const t = computeTotals();
    const infl = (Store.state.settings.tax && Number(Store.state.settings.tax.inflation)) || 4.5;
    const est = (typeof budgetSpendEstimate === "function") ? budgetSpendEstimate() : { annual: 0, months: 0 };
    const spend = Math.round(est.annual);
    // seed the monthly contribution from what they actually save (net income −
    // budget spend) — a zero default makes every projection look hopeless for
    // someone who is in fact saving heavily
    let contrib = 0;
    if (est.months > 0 && typeof earningsBreakdown === "function") {
      const net = Number(earningsBreakdown().monthlyNet) || 0;
      contrib = Math.max(0, Math.round((net - est.annual / 12) / 100) * 100);
    }
    return {
      mode: "basic",
      start: Math.max(0, Math.round(t.netWorth)), contrib: contrib, ret: 8, years: 20, withdraw: 4, inflation: infl, annualSpend: spend,
      // advanced (bucket-strategy) inputs
      eqRet: 10, bondRet: 7, cashRet: 4.5, cashYears: 1, bondYears: 2, accEquity: 100,
      exploreSWR: null,  // withdrawal-rate explorer slider (null = follow your target)
    };
  },

  /* metadata for the credit-score simulator inputs (labels, hints, defaults) */
  buroDefaults() {
    if (!this.buro) this.buro = { onTimeMonths: 12, lates: 0, ageYears: 2, inquiries: 1 };
    return {
      onTimeMonths: { label: "On-time payment streak (months)", hint: "How many months running you’ve paid every bill on time." },
      lates:        { label: "Late payments (last 2 years)", hint: "Any payment 30+ days late that got reported." },
      ageYears:     { label: "Oldest account age (years)", hint: "Age of your longest-held credit line." },
      inquiries:    { label: "Hard inquiries (last 12 months)", hint: "New-credit applications that pulled your report." },
    };
  },

  /* metadata + sensible defaults for the irregular-income planner, seeded from
     the user's scheduled income and budget spend where available */
  irregDefaults() {
    if (!this.irreg) {
      const eb = (typeof earningsBreakdown === "function") ? earningsBreakdown() : { monthlyNet: 0 };
      const spend = (typeof budgetSpendEstimate === "function") ? Math.round(budgetSpendEstimate().annual / 12) : 0;
      const high = Math.round(eb.monthlyNet) || (spend ? Math.round(spend * 1.5) : 0);
      // seed lean = good: don't invent a swing the user doesn't have — they
      // lower the lean month themselves if their income actually varies
      this.irreg = { low: high, high: high, essentials: spend };
    }
    return {
      low:        { label: "A lean month (net)", hint: "What you bring home in a slow month." },
      high:       { label: "A good month (net)", hint: "What you bring home in a strong month." },
      essentials: { label: "Essential spending / mo", hint: "Rent, food, transport, minimums — the must-pays." },
    };
  },

  navigate(page) {
    this.page = page;
    this.holdingDetail = null;   // always land on the portfolio list, not a stale detail
    document.querySelectorAll(".nav-item").forEach(b =>
      b.classList.toggle("active", b.dataset.page === page));
    this.render();
    this.setNav(false);            // close the mobile drawer after choosing a page
    window.scrollTo({ top: 0 });
  },

  /* floating value tooltip for charts — works on tap (mobile) and click */
  showTip(el, e) {
    const tip = document.getElementById("chart-tip");
    if (!tip) return;
    tip.innerHTML = el.getAttribute("data-tip");
    tip.classList.add("show");
    const x = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
    const y = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
    const r = tip.getBoundingClientRect();
    let left = x - r.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - r.width - 8));
    let top = y - r.height - 14;
    if (top < 8) top = y + 20;
    tip.style.left = left + "px";
    tip.style.top = top + "px";
    clearTimeout(this._tipTimer);
    this._tipTimer = setTimeout(() => this.hideTip(), 2800);
  },
  hideTip() {
    const tip = document.getElementById("chart-tip");
    if (tip) tip.classList.remove("show");
  },

  /* show/hide the mobile navigation drawer */
  setNav(open) {
    document.body.classList.toggle("nav-open", open);
    const t = document.querySelector(".nav-toggle");
    if (t) t.setAttribute("aria-expanded", open ? "true" : "false");
  },

  render() {
    if (!Store.state) return; // locked — nothing to render yet
    const meta = this.PAGE_META[this.page];
    document.getElementById("page-title").textContent = tr(meta.title);
    document.getElementById("topbar-actions").innerHTML = I18N.translateHtml(meta.actions);
    document.getElementById("page").innerHTML = I18N.translateHtml(Pages[this.page]());
    I18N.applyChrome();
    if (Pages.afterRender) Pages.afterRender(this.page);

    // compute initial values for any live learn-widgets just rendered
    document.querySelectorAll(".lw").forEach(el => {
      const w = typeof WIDGETS !== "undefined" && WIDGETS[el.dataset.lw];
      if (w) w.update(el);
    });

    const t = computeTotals();
    document.getElementById("sidebar-networth").textContent = fmtMoney(t.netWorth, { compact: true });
    const sparkEl = document.getElementById("sidebar-spark");
    if (sparkEl) {
      const snaps = Store.state.snapshots || [];
      sparkEl.innerHTML = snaps.length >= 2 ? sparkline(snaps.map(x => fromUSD(x.usd)), { w: 132, h: 22 }) : "";
    }

    const today = new Date();
    document.getElementById("page-date").textContent =
      today.toLocaleDateString(I18N.active() ? "es-MX" : "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    // privacy mode + lock button visibility
    document.body.classList.toggle("privacy", !!Store.state.settings.privacy);
    const eye = document.getElementById("privacy-btn");
    if (eye) { eye.classList.toggle("active", !!Store.state.settings.privacy); eye.innerHTML = icon("eye"); }
    const lockBtn = document.getElementById("lock-btn");
    if (lockBtn) { lockBtn.style.display = Store.pinEnabled ? "" : "none"; lockBtn.innerHTML = icon("lock"); }

    // theme
    const light = Store.state.settings.theme === "light";
    document.body.classList.toggle("light", light);
    const themeBtn = document.getElementById("theme-btn");
    if (themeBtn) {
      themeBtn.innerHTML = icon(light ? "moon" : "sun");
      themeBtn.title = light ? "Switch to dark mode" : "Switch to light mode";
    }

    Store.recordSnapshot();
  },

  /* credit any interest the schedule says is due, then tell the user once */
  settleInterest() {
    const r = Store.settleInterest();
    if (r && r.count) {
      UI.toast("Credited " + fmtMoney(r.credited) + " interest to " + r.count + " account" + (r.count === 1 ? "" : "s") + " on schedule");
    }
    return r;
  },

  showLock() {
    const root = document.getElementById("lock-root");
    root.innerHTML =
      '<div class="lock-screen"><div class="lock-card">' +
        '<div class="brand-mark">F<span>/</span></div>' +
        '<h2>Locked</h2>' +
        '<p>Your data is encrypted. Enter your PIN to open FinanceOS.</p>' +
        '<form id="unlock-form">' +
          '<input id="pin-input" class="pin-input" type="password" inputmode="numeric" maxlength="8" placeholder="• • • •" autocomplete="off" autofocus>' +
          '<button type="submit" class="btn primary" style="width:100%">Unlock</button>' +
        "</form>" +
        '<div class="lock-error" id="lock-error"></div>' +
        '<button class="lock-forgot" data-action="lock-erase">Forgot your PIN? Erase data &amp; start over</button>' +
      "</div></div>";
    document.getElementById("unlock-form").addEventListener("submit", async e => {
      e.preventDefault();
      const pin = document.getElementById("pin-input").value;
      const ok = await Store.unlock(pin);
      if (ok) {
        root.innerHTML = "";
        document.getElementById("currency-select").value = Store.state.settings.currency;
        this.settleInterest();
        this.render();
        Store.refreshFx().then(changed => { if (changed) this.render(); });
      } else {
        const err = document.getElementById("lock-error");
        err.textContent = "Wrong PIN — try again";
        const card = root.querySelector(".lock-card");
        card.classList.remove("shake");
        void card.offsetWidth; // restart animation
        card.classList.add("shake");
        document.getElementById("pin-input").value = "";
        document.getElementById("pin-input").focus();
      }
    });
    document.getElementById("pin-input").focus();
  },

  handleAction(action, id, el) {
    switch (action) {
      case "nav": this.navigate(el.dataset.page); break;

      case "retire-reset": {
        this.retire = this.retireDefaults();
        this.render();
        UI.toast("Reset to your current net worth");
        break;
      }

      case "retire-mode": {
        if (!this.retire) this.retire = this.retireDefaults();
        this.retire.mode = el.dataset.method === "advanced" ? "advanced" : "basic";
        this.render();
        break;
      }

      case "retire-bucket": {
        if (!this.retire) this.retire = this.retireDefaults();
        const parts = String(el.dataset.method || "").split(":");
        this.retire.cashYears = parseFloat(parts[0]) || 0;
        this.retire.bondYears = parseFloat(parts[1]) || 0;
        this.render();
        break;
      }

      case "toggle-nav": this.setNav(!document.body.classList.contains("nav-open")); break;
      case "close-nav": this.setNav(false); break;

      case "add-account": UI.accountForm(); break;
      case "edit-account": UI.accountForm(Store.find("accounts", id)); break;
      case "del-account": {
        const a = Store.find("accounts", id);
        UI.confirm("Delete account?", "“" + esc(a.name) + "” and its interest tracking will be removed. Linked positions and income streams stay but become unassigned.", () => {
          Store.remove("accounts", id);
          UI.toast("Account deleted");
          App.render();
        });
        break;
      }
      case "capitalize": {
        const a = Store.find("accounts", id);
        // Credit the gross interest (it compounds in full) less only the bank's
        // provisional ISR on capital; the income ISR is settled in April.
        const provR = (Store.state.settings.tax && Number(Store.state.settings.tax.interestProvisional)) || 0;
        const days = Math.max(0, daysBetween(parseISO(a.balanceAsOf) || todayMid(), todayMid()));
        const credited = accruedInterest(a) - (Number(a.balance) || 0) * (provR / 100) * (days / 365);
        Store.update("accounts", id, {
          balance: Math.round((Number(a.balance) + credited) * 100) / 100,
          balanceAsOf: toISO(todayMid()),
        });
        UI.toast("Added " + fmtMoneyIn(credited, a.currency) + " of accrued interest to " + a.name);
        this.render();
        break;
      }

      case "refresh-prices": {
        if (!Store.state.holdings.length) { UI.toast("No positions to update yet"); break; }
        UI.toast("Fetching live prices & dividends…");
        Store.fetchQuotes().then(res => {
          if (res.prices === 0 && res.divs === 0) {
            UI.toast("Couldn't reach any price service — check your connection and try again", { type: "error" });
          } else {
            let msg = "Updated " + res.prices + " price" + (res.prices === 1 ? "" : "s") + ", " + res.divs + " dividend" + (res.divs === 1 ? "" : "s");
            UI.toast(msg, { type: "success" });
            if (res.failed.length) UI.toast("Couldn't get a fresh price for " + res.failed.join(", ") + " — kept the last known price. Check the symbol or try again.", { type: "warn" });
            if (res.keyBad) UI.toast("Finnhub rejected your key — data came from the Yahoo fallback; fix the key in Settings", { type: "warn" });
            if (res.noDiv && res.noDiv.length) UI.toast("No dividend data found for " + res.noDiv.join(", ") + " — set div/share via the edit (pencil) button if it pays one", { type: "warn" });
          }
          App.render();
        }).catch(err => {
          console.error("FinanceOS: price sync failed", err);
          UI.toast("Price update failed unexpectedly — your data is unchanged. Try again in a moment.", { type: "error" });
        });
        break;
      }

      case "app-settings": UI.settingsForm(); break;

      case "refresh-fx":
        UI.toast("Refreshing exchange rates…");
        Store.refreshFx(true).then(ok => {
          UI.toast(ok ? "Exchange rates updated (ECB)" : "Couldn't reach the rate service — using cached rates", ok ? { type: "success" } : { type: "warn" });
          App.render();
        }).catch(err => {
          console.error("FinanceOS: FX refresh failed", err);
          UI.toast("Couldn't refresh exchange rates — using cached rates.", { type: "warn" });
        });
        break;

      case "add-card": UI.cardForm(); break;
      case "edit-card": UI.cardForm(Store.find("cards", id)); break;
      case "del-card": {
        const c = Store.find("cards", id);
        UI.confirm("Delete card?", "“" + esc(c.name) + "” will be removed along with its alerts.", () => {
          Store.remove("cards", id);
          UI.toast("Card deleted");
          App.render();
        });
        break;
      }

      case "add-goal": UI.goalForm(); break;
      case "edit-goal": UI.goalForm(Store.find("goals", id)); break;
      case "del-goal": {
        const g = Store.find("goals", id);
        UI.confirm("Delete goal?", "“" + esc(g.name) + "” will be removed.", () => {
          Store.remove("goals", id);
          UI.toast("Goal deleted");
          App.render();
        });
        break;
      }

      case "debt-method": this.debtMethod = el.dataset.method; {
        const out = document.getElementById("debt-out");
        if (out) out.innerHTML = Pages.debtPayoffOutput();
        document.querySelectorAll("[data-action='debt-method']").forEach(b => b.classList.toggle("on", b.dataset.method === this.debtMethod));
        break;
      }

      case "view-holding": this.holdingDetail = id; this.render(); window.scrollTo({ top: 0 }); break;
      case "back-portfolio": this.holdingDetail = null; this.render(); window.scrollTo({ top: 0 }); break;
      case "price-range": this.priceRange = el.dataset.range; this.render(); break;
      case "portfolio-mode": this.portfolioMode = el.dataset.mode; this.render(); break;
      case "adv-range": this.advRange = el.dataset.range; this.render(); break;

      case "add-holding": UI.holdingForm(); break;
      case "edit-holding": UI.holdingForm(Store.find("holdings", id)); break;
      case "sell-holding": UI.sellForm(Store.find("holdings", id)); break;
      case "save-targets": {
        const t = {};
        document.querySelectorAll(".ta-input").forEach(inp => {
          const v = parseNum(inp.value);
          if (v > 0) t[inp.dataset.class] = v;
        });
        Store.state.settings.targetAlloc = t;
        Store.save();
        UI.toast("Target allocation saved");
        this.render();
        break;
      }

      case "annual-report":
        Report.download();
        UI.toast("Annual report downloaded — open it and print to PDF for your records");
        document.getElementById("data-menu-pop").classList.remove("open");
        break;

      case "add-plan": UI.planForm(); break;
      case "edit-plan": UI.planForm(Store.find("plan", id)); break;
      case "del-plan": Store.remove("plan", id); this.render(); break;

      case "add-flow": UI.flowForm(el.dataset.kind); break;
      case "del-flow": Store.remove("flows", id); this.render(); break;

      case "add-asset": UI.assetForm(); break;
      case "edit-asset": UI.assetForm(Store.find("assets", id)); break;
      case "del-asset":
        UI.confirm("Delete this asset?", "It leaves your balance sheet and net worth.", () => { Store.remove("assets", id); App.render(); });
        break;
      case "add-liability": UI.liabilityForm(); break;
      case "edit-liability": UI.liabilityForm(Store.find("liabilities", id)); break;
      case "del-liability":
        UI.confirm("Delete this liability?", "It leaves your balance sheet and net worth.", () => { Store.remove("liabilities", id); App.render(); });
        break;
      case "del-realized":
        UI.confirm("Delete this sale record?", "The realized gain leaves your tax summary. The position itself is not restored.", () => {
          Store.remove("realized", id);
          UI.toast("Sale record deleted");
          App.render();
        });
        break;
      case "del-holding": {
        const h = Store.find("holdings", id);
        UI.confirm("Delete position?", "Remove " + esc(h.symbol) + " (" + fmtNum(h.shares) + " shares) from your portfolio?", () => {
          Store.remove("holdings", id);
          UI.toast("Position deleted");
          App.render();
        });
        break;
      }

      case "earn-horizon": this.earnHorizon = parseInt(el.dataset.years, 10) || 1; this.earnSel = 0; this.render(); break;
      case "earn-bucket": this.earnSel = parseInt(el.dataset.i, 10) || 0; this.render(); break;

      case "add-income": UI.incomeForm(); break;
      case "edit-income": UI.incomeForm(Store.find("incomes", id)); break;
      case "del-income": {
        const inc = Store.find("incomes", id);
        UI.confirm("Delete income stream?", "“" + esc(inc.name) + "” will stop appearing in projections and the timeline.", () => {
          Store.remove("incomes", id);
          UI.toast("Income stream deleted");
          App.render();
        });
        break;
      }

      case "budget-view": this.budgetView = el.dataset.view; this.render(); break;

      case "add-expense": UI.expenseForm(); break;
      case "edit-expense": UI.expenseForm(Store.find("expenses", id)); break;
      case "del-expense": {
        const e = Store.find("expenses", id);
        Store.remove("expenses", id);
        UI.toast("Expense removed" + (e ? " — " + fmtMoneyIn(e.amount, e.currency) : ""));
        App.render();
        break;
      }

      case "expense-template":
        BudgetIO.downloadTemplate();
        UI.toast("Template downloaded — fill it in Excel/Sheets or let your AI do it, then Upload");
        break;

      case "expense-import":
        UI.expenseImportHelp();
        break;

      case "statement-import":
        UI.statementImportIntro();
        break;

      case "expense-pick-file":
        UI.closeModal();
        document.getElementById("expense-file").click();
        break;

      case "copy-ai-prompt":
        (navigator.clipboard ? navigator.clipboard.writeText(BudgetIO.aiPrompt()) : Promise.reject())
          .then(() => UI.toast("AI prompt copied — paste it with your statement"))
          .catch(() => UI.toast("Select the prompt text and copy it manually"));
        break;

      case "set-budgets": UI.budgetsForm(); break;

      case "clear-expenses":
        UI.confirm("Clear all expenses?", "Every imported and manually-added expense will be removed. Your budgets and everything else stay. This can't be undone.", () => {
          Store.state.expenses = [];
          Store.save();
          UI.toast("All expenses cleared");
          App.render();
        });
        break;

      case "toggle-data-menu":
        document.getElementById("data-menu-pop").classList.toggle("open");
        break;

      case "toggle-privacy":
        Store.state.settings.privacy = !Store.state.settings.privacy;
        Store.save();
        this.render();
        break;

      case "toggle-theme":
        Store.state.settings.theme = Store.state.settings.theme === "light" ? "dark" : "light";
        Store.save();
        this.render();
        break;

      case "pin-settings":
        UI.pinForm();
        break;

      case "lock-now":
        // saved state is already encrypted; reloading boots into the lock screen
        location.reload();
        break;

      case "lock-erase":
        if (window.confirm("This permanently erases the encrypted data in this browser. Continue?")) {
          Store.reset();
          location.reload();
        }
        break;

      case "sample":
        if (Store.state.accounts.length || Store.state.cards.length || Store.state.holdings.length) {
          UI.confirm("Load sample data?", "This replaces your current data with a demo dataset. Export first if you want a backup.", () => {
            Store.loadSample();
            Store.settleInterest();
            UI.toast("Sample data loaded — explore away");
            App.render();
          });
        } else {
          Store.loadSample();
          Store.settleInterest();
          UI.toast("Sample data loaded — explore away");
          this.render();
        }
        break;

      case "onboard-dismiss":
        Store.state.settings.onboardDone = true;
        Store.save();
        this.render();
        break;

      case "cards-ics": {
        if (!Store.state.cards.length) { UI.toast("Add a card first — then export its dates"); break; }
        const ics = icsForCards(Store.state.cards, { months: 6 });
        const blob = new Blob([ics], { type: "text/calendar" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "financeos-tarjetas.ics";
        a.click();
        URL.revokeObjectURL(a.href);
        UI.toast("Calendar file downloaded — open it to add 6 months of cut & due dates");
        break;
      }

      case "export": {
        Store.state.settings.lastExport = toISO(todayMid());
        Store.save();
        const blob = new Blob([JSON.stringify(Store.state, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "financeos-backup-" + toISO(todayMid()) + ".json";
        a.click();
        URL.revokeObjectURL(a.href);
        UI.toast("Backup exported — keep it somewhere safe");
        this.render();
        break;
      }

      case "import":
        document.getElementById("import-file").click();
        break;

      case "reset":
        UI.confirm("Erase everything?", "All accounts, cards, positions and income streams will be permanently deleted from this browser.", () => {
          Store.reset();
          UI.toast("All data erased");
          App.render();
        });
        break;

      case "close-modal": UI.closeModal(); break;

      default:
        if (action.indexOf("learn-") === 0 || action.indexOf("sb-") === 0) {
          Learn.handle(action, el);
        }
    }
  },

  async init() {
    const res = await Store.load();
    if (Store.state) {
      document.getElementById("currency-select").value = Store.state.settings.currency;
    }
    // saved data existed but couldn't be read — warn instead of silently resetting
    if (Store.loadFailed) {
      setTimeout(() => UI.toast("Couldn't read your saved data — it may be corrupted. Import your last .json backup from the ⋯ menu.", { type: "error", duration: 12000 }), 600);
    }

    /* swap the nav glyphs for the consistent SVG icon set */
    const navIcons = { overview: "home", accounts: "bank", cards: "card", portfolio: "growth", earnings: "wallet", budget: "pie", retirement: "clock", milestones: "award", learn: "cap", guide: "book" };
    document.querySelectorAll(".nav-item").forEach(b => {
      const g = b.querySelector(".nav-glyph");
      if (g && navIcons[b.dataset.page]) g.innerHTML = icon(navIcons[b.dataset.page]);
    });

    /* global click delegation */
    document.addEventListener("click", e => {
      const sw = e.target.closest(".swatch");
      if (sw) {
        sw.parentElement.querySelectorAll(".swatch").forEach(x => x.classList.remove("sel"));
        sw.classList.add("sel");
        sw.parentElement.querySelector('input[name="color"]').value = sw.dataset.swatch;
        return;
      }
      // chart value tooltips (tap a bar/point to see its value)
      const tipEl = e.target.closest("[data-tip]");
      if (tipEl) { this.showTip(tipEl, e); } else { this.hideTip(); }

      const t = e.target.closest("[data-action]");
      if (t) {
        if (t.dataset.action === "close-modal-overlay") {
          if (e.target === t) UI.closeModal();
          return;
        }
        this.handleAction(t.dataset.action, t.dataset.id, t);
      }
      // close data menu when clicking elsewhere
      if (!e.target.closest(".data-menu")) {
        const pop = document.getElementById("data-menu-pop");
        if (pop) pop.classList.remove("open");
      }
    });

    /* live learn-widget sliders */
    document.addEventListener("input", e => {
      // live thousands separators on money fields (keeps the caret in place)
      const nf = e.target.closest(".fmt-num");
      if (nf) reformatNumInput(nf);

      const w = e.target.closest(".lw");
      if (w && typeof WIDGETS !== "undefined" && WIDGETS[w.dataset.lw]) WIDGETS[w.dataset.lw].update(w);

      // sandbox allocation sliders — update in place, no page re-render (no flicker)
      const sa = e.target.closest(".sb-alloc-input");
      if (sa && typeof Learn !== "undefined" && Learn.session && Learn.session.alloc) {
        Learn.updateAlloc(sa.dataset.bucket, sa.value);
        return;
      }

      /* retirement calculator — recompute just the results, keep inputs alive
         (so a slider drag isn't interrupted by a full re-render) */
      const ri = e.target.closest(".r-input");
      if (ri && this.retire) {
        const k = ri.dataset.rk;
        this.retire[k] = parseNum(ri.value);
        // changing an assumption changes the nest egg, so re-sync the withdrawal
        // explorer to the rate your (new) target spending implies
        this.retire.exploreSWR = null;
        const num = document.querySelector('.r-num[data-rk="' + k + '"]');
        if (num && document.activeElement !== num) num.value = ri.value;
        const out = document.getElementById("retire-out");
        if (out) out.innerHTML = Pages.retirementOutput();
      }

      /* the slider's paired text field — type an exact value, slider follows */
      const rn = e.target.closest(".r-num");
      if (rn && this.retire) {
        const k = rn.dataset.rk;
        const v = parseNum(rn.value);
        if (isFinite(v) && rn.value.trim() !== "") {
          this.retire[k] = v;
          this.retire.exploreSWR = null;
          const sl = document.querySelector('.r-input[data-rk="' + k + '"]');
          if (sl) sl.value = v;                    // the range clamps its own display
          const out = document.getElementById("retire-out");
          if (out) out.innerHTML = Pages.retirementOutput();
        }
      }

      /* withdrawal-rate explorer: recompute just its box (keep the slider drag) */
      const rei = e.target.closest(".re-input");
      if (rei && this.retire) {
        this.retire.exploreSWR = parseNum(rei.value);
        const num = rei.closest(".r-row").querySelector(".re-num");
        if (num && document.activeElement !== num) num.value = Number(rei.value).toFixed(1);
        const out = document.getElementById("retire-explore-out");
        if (out) out.innerHTML = Pages._withdrawExploreRefresh();
      }

      const ren = e.target.closest(".re-num");
      if (ren && this.retire) {
        const v = parseNum(ren.value);
        if (isFinite(v) && ren.value.trim() !== "" && v > 0) {
          this.retire.exploreSWR = v;
          const sl = ren.closest(".r-row").querySelector(".re-input");
          if (sl) sl.value = v;
          const out = document.getElementById("retire-explore-out");
          if (out) out.innerHTML = Pages._withdrawExploreRefresh();
        }
      }

      /* debt payoff: live recompute on the monthly-budget input */
      const di = e.target.closest(".debt-input");
      if (di) {
        this.debtBudget = parseNum(di.value);
        const out = document.getElementById("debt-out");
        if (out) out.innerHTML = Pages.debtPayoffOutput();
      }

      /* wealth projection: sliders + exact fields recompute just the output */
      const wp = e.target.closest(".wp-input");
      if (wp && this.wplan) {
        const k = wp.dataset.wk;
        this.wplan[k] = parseNum(wp.value);
        const num = document.querySelector('.wp-num[data-wk="' + k + '"]');
        if (num && document.activeElement !== num) num.value = wp.value;
        const out = document.getElementById("wplan-out");
        if (out) out.innerHTML = Pages._wealthPlanOut();
      }
      const wn = e.target.closest(".wp-num");
      if (wn && this.wplan) {
        const k = wn.dataset.wk;
        const v = parseNum(wn.value);
        if (isFinite(v) && wn.value.trim() !== "") {
          this.wplan[k] = v;
          const sl = document.querySelector('.wp-input[data-wk="' + k + '"]');
          if (sl) sl.value = v;
          const out = document.getElementById("wplan-out");
          if (out) out.innerHTML = Pages._wealthPlanOut();
        }
      }

      /* credit-score simulator: live recompute on any self-reported input */
      const bi = e.target.closest(".buro-input");
      if (bi) {
        this.buroDefaults();
        this.buro[bi.dataset.bk] = parseNum(bi.value);
        const out = document.getElementById("buro-out");
        if (out) out.innerHTML = Pages.buroOutput();
      }

      /* irregular-income planner: live recompute on any input */
      const ii = e.target.closest(".irreg-input");
      if (ii) {
        this.irregDefaults();
        this.irreg[ii.dataset.ik] = parseNum(ii.value);
        const out = document.getElementById("irreg-out");
        if (out) out.innerHTML = Pages.irregularOutput();
      }
    });

    /* inline price edits (portfolio) */
    document.addEventListener("change", e => {
      const input = e.target.closest("[data-price-id]");
      if (input) {
        const v = parseNum(input.value);
        if (!isNaN(v) && v >= 0) {
          Store.update("holdings", input.dataset.priceId, { currentPrice: v });
          UI.toast("Price updated");
          this.render();
        }
        return;
      }
      if (e.target.id === "currency-select") {
        Store.state.settings.currency = e.target.value;
        Store.save();
        this.render();
      }
      if (e.target.id === "budget-month") {
        this.budgetMonth = e.target.value;
        this.render();
      }
    });

    /* import file */
    document.getElementById("import-file").addEventListener("change", e => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          Store.replaceAll(data);
          document.getElementById("currency-select").value = Store.state.settings.currency;
          UI.toast("Data imported", { type: "success" });
          this.render();
        } catch (err) {
          UI.toast("Import failed — that file isn't a valid FinanceOS backup.", { type: "error" });
        }
      };
      reader.onerror = () => UI.toast("Couldn't read that file — check it isn't open elsewhere and try again.", { type: "error" });
      reader.readAsText(f);
      e.target.value = "";
    });

    /* expense spreadsheet import (CSV) — dedup-aware */
    document.getElementById("expense-file").addEventListener("change", e => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const res = BudgetIO.importText(reader.result);
        if (res.errors.length && res.added === 0 && res.skipped === 0) {
          UI.toast(res.errors[0], { type: "error" });
        } else {
          let msg = "Imported " + res.added + " expense" + (res.added === 1 ? "" : "s");
          if (res.skipped) msg += " · " + res.skipped + " duplicate" + (res.skipped === 1 ? "" : "s") + " skipped";
          UI.toast(msg, { type: "success" });
          if (res.errors.length) UI.toast(res.errors.length + " row" + (res.errors.length === 1 ? "" : "s") + " skipped: " + res.errors[0], { type: "warn" });
          if (res.added) {
            App.budgetMonth = null; // jump to the latest month with data
            App.navigate("budget");
          }
        }
      };
      reader.onerror = () => UI.toast("Couldn't read that file — check it isn't open elsewhere and try again.", { type: "error" });
      reader.readAsText(f);
      e.target.value = "";
    });

    /* statement PDF import (Beta) — parsed entirely on-device, never uploaded */
    document.getElementById("statement-file").addEventListener("change", async e => {
      const f = e.target.files[0];
      e.target.value = "";
      if (!f) return;
      if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
        UI.toast("Please choose a PDF statement", { type: "warn" });
        return;
      }
      UI.statementProgress("Reading statement on your device…");
      try {
        const parse = await Statements.parse(f, (p) => {
          if (p && p.phase === "ocr") {
            UI.statementProgress(
              "This statement is a scan — reading it on your device with OCR.",
              "Page " + Math.min(p.page + 1, p.pages) + " of " + p.pages + " · nothing is uploaded"
            );
          }
        });
        UI.statementReview(parse);
      } catch (err) {
        console.error("FinanceOS: statement parse failed", err);
        UI.closeModal();
        UI.toast("Couldn't read that PDF — it may be password-protected or corrupted.", { type: "error" });
      }
    });

    /* escape closes the modal, then the nav drawer, then any chart tooltip */
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") { UI.closeModal(); App.setNav(false); App.hideTip(); }
    });

    if (res.locked) this.showLock();
    else { this.settleInterest(); this.render(); }

    // refresh ECB rates in the background (daily); re-render if they changed
    if (Store.state) {
      Store.refreshFx().then(changed => { if (changed) this.render(); });
    }
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
