/* FinanceOS — modals, forms, toasts */
"use strict";

const UI = {
  onSubmit: null,

  openModal(title, bodyHtml, opts) {
    opts = opts || {};
    this._lastFocus = document.activeElement;   // restore on close
    const root = document.getElementById("modal-root");
    root.innerHTML =
      '<div class="modal-overlay" data-action="close-modal-overlay">' +
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
          '<div class="modal-head">' +
            '<div class="modal-title" id="modal-title">' + title + "</div>" +
            '<button class="icon-btn" data-action="close-modal" title="Close" aria-label="Close dialog">' + icon("x") + '</button>' +
          "</div>" +
          '<form id="modal-form"><div class="modal-body">' + bodyHtml + "</div>" +
          '<div class="modal-foot">' +
            '<button type="button" class="btn ghost" data-action="close-modal">Cancel</button>' +
            '<button type="submit" class="btn primary">' + (opts.submitLabel || "Save") + "</button>" +
          "</div></form>" +
        "</div>" +
      "</div>";
    this.onSubmit = opts.onSubmit || null;
    const form = document.getElementById("modal-form");
    form.addEventListener("submit", e => {
      e.preventDefault();
      if (UI.onSubmit) UI.onSubmit(new FormData(form), form);
    });
    // keep Tab focus inside the dialog
    const modal = root.querySelector(".modal");
    modal.addEventListener("keydown", e => {
      if (e.key !== "Tab") return;
      const f = modal.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      const list = Array.prototype.filter.call(f, el => el.offsetParent !== null);
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    const first = form.querySelector("input, select, textarea");
    if (first) first.focus();
    else { const cb = modal.querySelector('[data-action="close-modal"]'); if (cb) cb.focus(); }
  },

  closeModal() {
    document.getElementById("modal-root").innerHTML = "";
    this.onSubmit = null;
    if (this._lastFocus && typeof this._lastFocus.focus === "function") {
      try { this._lastFocus.focus(); } catch (e) { /* element gone */ }
    }
    this._lastFocus = null;
  },

  toast(msg) {
    const root = document.getElementById("toast-root");
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = '<span class="t-dot"></span>' + esc(msg);
    root.appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 350); }, 2600);
  },

  field(label, inputHtml, hint, full, id) {
    return '<div class="field' + (full ? " full" : "") + '"' + (id ? ' id="' + id + '"' : "") + '><label>' + label + "</label>" +
      inputHtml + (hint ? '<div class="hint">' + hint + "</div>" : "") + "</div>";
  },

  currencySelect(name, selected) {
    const cur = selected || displayCurrency();
    return '<select name="' + name + '">' + CURRENCY_CODES.map(c =>
      '<option value="' + c + '"' + (cur === c ? " selected" : "") + ">" + c + "</option>").join("") + "</select>";
  },

  /* ---------- forms ---------- */

  accountForm(acc) {
    acc = acc || {};
    const isEdit = !!acc.id;
    const intDayOpts = sel => {
      let h = "";
      for (let i = 1; i <= 28; i++) h += '<option value="' + i + '"' + (Number(sel) === i ? " selected" : "") + ">" + ordinal(i) + "</option>";
      h += '<option value="31"' + (Number(sel) >= 29 ? " selected" : "") + ">Last day</option>";
      return h;
    };
    const body = '<div class="f-grid">' +
      this.field("Account name", '<input name="name" required maxlength="60" value="' + esc(acc.name || "") + '" placeholder="High-Yield Savings">', null, true) +
      this.field("Institution", '<input name="institution" maxlength="40" value="' + esc(acc.institution || "") + '" placeholder="Bank / fintech">') +
      this.field("Type",
        '<select name="type">' +
          ['checking', 'savings', 'investment'].map(t =>
            '<option value="' + t + '"' + (acc.type === t ? " selected" : "") + ">" + ACCOUNT_TYPE_META[t].label + "</option>"
          ).join("") +
        "</select>") +
      this.field("Current balance", '<input name="balance" type="number" inputmode="decimal" step="0.01" min="0" required value="' + (acc.balance != null ? acc.balance : "") + '" placeholder="0.00">') +
      this.field("Currency", this.currencySelect("currency", acc.currency), "Converted automatically in totals") +
      this.field("Interest rate — APY %", '<input name="apy" type="number" inputmode="decimal" step="0.01" min="0" max="100" value="' + (acc.apy != null && acc.apy !== 0 ? acc.apy : "") + '" placeholder="e.g. 7.50">', "Leave empty if the account pays no interest") +
      this.field("Interest paid",
        '<select name="interestFreq">' +
          [["daily", "Daily (compounds daily)"], ["monthly", "Monthly"], ["quarterly", "Quarterly"], ["annually", "Annually"]]
            .map(o => '<option value="' + o[0] + '"' + (interestFreqKey(acc) === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") +
        "</select>", "How often this account credits interest") +
      this.field("Paid on",
        '<select name="interestDay">' + intDayOpts(interestPayDay(acc)) + "</select>",
        "Day it lands · quarterly = Jan/Apr/Jul/Oct · annually = December", false, "interest-day-field") +
      "</div>";
    this.openModal(isEdit ? "Edit account" : "New account", body, {
      submitLabel: isEdit ? "Save changes" : "Add account",
      onSubmit(fd) {
        const balance = parseFloat(fd.get("balance")) || 0;
        const patch = {
          name: fd.get("name").trim(),
          institution: fd.get("institution").trim(),
          type: fd.get("type"),
          balance: balance,
          currency: fd.get("currency"),
          apy: parseFloat(fd.get("apy")) || 0,
          interestFreq: fd.get("interestFreq") || "monthly",
          interestDay: parseInt(fd.get("interestDay"), 10) || 31,
        };
        if (isEdit) {
          // reset the accrual clock only when the balance actually changes
          if (balance !== Number(acc.balance)) patch.balanceAsOf = toISO(todayMid());
          Store.update("accounts", acc.id, patch);
          UI.toast("Account updated");
        } else {
          patch.balanceAsOf = toISO(todayMid());
          Store.add("accounts", patch);
          UI.toast("Account added");
        }
        UI.closeModal();
        App.render();
      },
    });
    // hide the "Paid on" day when interest compounds daily
    const freqSel = document.querySelector("#modal-form [name=interestFreq]");
    const dayField = document.getElementById("interest-day-field");
    if (freqSel && dayField) {
      const sync = () => { dayField.style.display = freqSel.value === "daily" ? "none" : ""; };
      freqSel.addEventListener("change", sync);
      sync();
    }
  },

  cardForm(card) {
    card = card || {};
    const isEdit = !!card.id;
    const dayOpts = sel => {
      let h = "";
      for (let i = 1; i <= 31; i++) h += '<option value="' + i + '"' + (Number(sel) === i ? " selected" : "") + ">" + ordinal(i) + "</option>";
      return h;
    };
    const colors = ["c-forest", "c-ocean", "c-plum", "c-ember", "c-slate"];
    const curColor = card.color || "c-forest";
    const body = '<div class="f-grid">' +
      this.field("Card name", '<input name="name" required maxlength="60" value="' + esc(card.name || "") + '" placeholder="Platinum Rewards">', null, true) +
      this.field("Issuer", '<input name="issuer" maxlength="40" value="' + esc(card.issuer || "") + '" placeholder="Bank">') +
      this.field("Credit limit", '<input name="limit" type="number" inputmode="decimal" step="0.01" min="0" required value="' + (card.limit != null ? card.limit : "") + '">') +
      this.field("Current balance", '<input name="balance" type="number" inputmode="decimal" step="0.01" min="0" required value="' + (card.balance != null ? card.balance : "") + '">', "What you currently owe") +
      this.field("Currency", this.currencySelect("currency", card.currency)) +
      this.field("APR % (optional)", '<input name="apr" type="number" inputmode="decimal" step="0.01" min="0" max="200" value="' + (card.apr != null && card.apr !== 0 ? card.apr : "") + '">') +
      this.field("Statement cut day", '<select name="cutDay">' + dayOpts(card.cutDay || 1) + "</select>", "Day of month the statement closes") +
      this.field("Payment due day", '<select name="payDay">' + dayOpts(card.payDay || 20) + "</select>", "Day of month payment is due") +
      this.field("Card color",
        '<div class="swatches">' + colors.map(c =>
          '<div class="swatch ' + c + (c === curColor ? " sel" : "") + '" data-swatch="' + c + '"></div>'
        ).join("") + '<input type="hidden" name="color" value="' + curColor + '"></div>', null, true) +
      "</div>";
    this.openModal(isEdit ? "Edit credit card" : "New credit card", body, {
      submitLabel: isEdit ? "Save changes" : "Add card",
      onSubmit(fd) {
        const patch = {
          name: fd.get("name").trim(),
          issuer: fd.get("issuer").trim(),
          limit: parseFloat(fd.get("limit")) || 0,
          balance: parseFloat(fd.get("balance")) || 0,
          currency: fd.get("currency"),
          apr: parseFloat(fd.get("apr")) || 0,
          cutDay: parseInt(fd.get("cutDay"), 10),
          payDay: parseInt(fd.get("payDay"), 10),
          color: fd.get("color") || "c-forest",
        };
        if (isEdit) { Store.update("cards", card.id, patch); UI.toast("Card updated"); }
        else { Store.add("cards", patch); UI.toast("Card added"); }
        UI.closeModal();
        App.render();
      },
    });
  },

  holdingForm(h) {
    h = h || {};
    const isEdit = !!h.id;
    const invAccounts = Store.state.accounts.filter(a => a.type === "investment");
    const acctOpts = '<option value="">— None —</option>' + invAccounts.map(a =>
      '<option value="' + a.id + '"' + (h.accountId === a.id ? " selected" : "") + ">" + esc(a.name) + "</option>").join("");
    const body = '<div class="f-grid">' +
      this.field("Ticker symbol", '<input name="symbol" required maxlength="12" style="text-transform:uppercase" value="' + esc(h.symbol || "") + '" placeholder="VOO">') +
      this.field("Type",
        '<select name="kind">' +
          '<option value="stock"' + (h.kind === "stock" ? " selected" : "") + ">Stock</option>" +
          '<option value="etf"' + (h.kind === "etf" ? " selected" : "") + ">ETF</option>" +
        "</select>") +
      this.field("Name", '<input name="hname" maxlength="60" value="' + esc(h.name || "") + '" placeholder="Vanguard S&P 500 ETF">', null, true) +
      this.field("Shares", '<input name="shares" type="number" inputmode="decimal" step="any" min="0" required value="' + (h.shares != null ? h.shares : "") + '">', "Fractional shares allowed") +
      this.field("Prices in", this.currencySelect("currency", h.currency || "USD"), "Currency of this listing (US tickers: USD)") +
      this.field("Avg. price paid", '<input name="costBasis" type="number" inputmode="decimal" step="any" min="0" required value="' + (h.costBasis != null ? h.costBasis : "") + '">', "Per share") +
      this.field("Current price", '<input name="currentPrice" type="number" inputmode="decimal" step="any" min="0" required value="' + (h.currentPrice != null ? h.currentPrice : "") + '">', "Auto-updates with a Finnhub key") +
      this.field("Dividend / share / year", '<input name="divPerShare" type="number" inputmode="decimal" step="any" min="0" value="' + (h.divPerShare != null && h.divPerShare !== 0 ? h.divPerShare : "") + '">', "Optional — auto-fills when refreshing prices") +
      this.field("Purchase date", '<input name="purchaseDate" type="date" value="' + esc(h.purchaseDate || toISO(todayMid())) + '">') +
      this.field("Held in account", '<select name="accountId">' + acctOpts + "</select>", invAccounts.length ? null : "Tip: add an Investment account to link", true) +
      "</div>";
    this.openModal(isEdit ? "Edit position" : "New position", body, {
      submitLabel: isEdit ? "Save changes" : "Add position",
      onSubmit(fd) {
        const patch = {
          symbol: fd.get("symbol").trim().toUpperCase(),
          kind: fd.get("kind"),
          name: fd.get("hname").trim(),
          shares: parseFloat(fd.get("shares")) || 0,
          currency: fd.get("currency"),
          costBasis: parseFloat(fd.get("costBasis")) || 0,
          currentPrice: parseFloat(fd.get("currentPrice")) || 0,
          divPerShare: parseFloat(fd.get("divPerShare")) || 0,
          purchaseDate: fd.get("purchaseDate") || toISO(todayMid()),
          accountId: fd.get("accountId") || "",
        };
        if (isEdit) { Store.update("holdings", h.id, patch); UI.toast("Position updated"); }
        else { Store.add("holdings", patch); UI.toast("Position added"); }
        UI.closeModal();
        App.render();
      },
    });
  },

  incomeForm(inc) {
    inc = inc || {};
    const isEdit = !!inc.id;
    const acctOpts = Store.state.accounts.map(a =>
      '<option value="' + a.id + '"' + (inc.accountId === a.id ? " selected" : "") + ">" + esc(a.name) + "</option>").join("");
    const dayOpts = sel => {
      let hh = "";
      for (let i = 1; i <= 31; i++) hh += '<option value="' + i + '"' + (Number(sel) === i ? " selected" : "") + ">" + ordinal(i) + "</option>";
      return hh;
    };
    const freq = inc.frequency || "monthly";
    const body = '<div class="f-grid">' +
      this.field("Income name", '<input name="name" required maxlength="60" value="' + esc(inc.name || "") + '" placeholder="Salary — Acme Corp">', null, true) +
      this.field("Category",
        '<select name="category">' +
          ["Salary", "Freelance", "Rent", "Dividends", "Business", "Other"].map(c =>
            '<option' + (inc.category === c ? " selected" : "") + ">" + c + "</option>").join("") +
        "</select>") +
      this.field("Amount per deposit", '<input name="amount" type="number" inputmode="decimal" step="0.01" min="0" required value="' + (inc.amount != null ? inc.amount : "") + '">') +
      this.field("Currency", this.currencySelect("currency", inc.currency)) +
      this.field("This amount is",
        '<select name="amountType" id="amount-type-select">' +
          '<option value="net"' + ((inc.amountType || "net") === "net" ? " selected" : "") + ">Net — after taxes (take-home)</option>" +
          '<option value="gross"' + (inc.amountType === "gross" ? " selected" : "") + ">Gross — before taxes</option>" +
        "</select>", null, true) +
      '<div id="taxrate-wrap" class="full"' + (inc.amountType === "gross" ? "" : ' style="display:none"') + ">" +
        this.field("Effective tax rate %", '<input name="taxRate" type="number" inputmode="decimal" step="0.1" min="0" max="99" value="' + (inc.taxRate != null && inc.taxRate !== 0 ? inc.taxRate : "") + '" placeholder="e.g. 21">', "Withholding applied to each deposit — projections use the net amount", true) +
      "</div>" +
      this.field("Deposits into", '<select name="accountId" required>' + (acctOpts || '<option value="">No accounts yet</option>') + "</select>", null, true) +
      this.field("Frequency",
        '<select name="frequency" id="freq-select">' +
          '<option value="monthly"' + (freq === "monthly" ? " selected" : "") + ">Monthly</option>" +
          '<option value="quincena"' + (freq === "quincena" ? " selected" : "") + ">Every 15 days (15th & month-end)</option>" +
          '<option value="biweekly"' + (freq === "biweekly" ? " selected" : "") + ">Every 14 days</option>" +
          '<option value="weekly"' + (freq === "weekly" ? " selected" : "") + ">Weekly</option>" +
        "</select>") +
      '<div id="payday-wrap"' + (freq !== "monthly" ? ' style="display:none"' : "") + ">" +
        this.field("Day of month", '<select name="payDay">' + dayOpts(inc.payDay || 1) + "</select>") +
      "</div>" +
      this.field("First payment date", '<input name="startDate" type="date" required value="' + esc(inc.startDate || toISO(todayMid())) + '">', "Used as the anchor for weekly / 14-day schedules", true) +
      "</div>";
    this.openModal(isEdit ? "Edit income stream" : "New income stream", body, {
      submitLabel: isEdit ? "Save changes" : "Add income",
      onSubmit(fd) {
        if (!fd.get("accountId")) { UI.toast("Add an account first — income needs a destination"); return; }
        const patch = {
          name: fd.get("name").trim(),
          category: fd.get("category"),
          amount: parseFloat(fd.get("amount")) || 0,
          currency: fd.get("currency"),
          amountType: fd.get("amountType"),
          taxRate: parseFloat(fd.get("taxRate")) || 0,
          accountId: fd.get("accountId"),
          frequency: fd.get("frequency"),
          payDay: parseInt(fd.get("payDay"), 10) || 1,
          startDate: fd.get("startDate"),
        };
        if (isEdit) { Store.update("incomes", inc.id, patch); UI.toast("Income updated"); }
        else { Store.add("incomes", patch); UI.toast("Income stream added"); }
        UI.closeModal();
        App.render();
      },
    });
    document.getElementById("freq-select").addEventListener("change", e => {
      document.getElementById("payday-wrap").style.display = e.target.value === "monthly" ? "" : "none";
    });
    document.getElementById("amount-type-select").addEventListener("change", e => {
      document.getElementById("taxrate-wrap").style.display = e.target.value === "gross" ? "" : "none";
    });
  },

  settingsForm() {
    const st = Store.state.settings;
    const tax = st.tax || { interest: 0, dividends: 0, capGains: 0 };
    const fxNote = st.fx && st.fx.asOf
      ? "Live ECB rates as of " + fmtDate(parseISO(st.fx.asOf)) + " · 1 USD = " + fmtNum(st.fx.rates.MXN, 2) + " MXN · " + fmtNum(st.fx.rates.EUR, 3) + " EUR"
      : "Using built-in fallback rates — refresh from the ⋯ menu when online";
    const body =
      '<div class="f-grid">' +
      this.field("Finnhub API key (optional)",
        '<input name="finnhubKey" value="' + esc(st.finnhubKey || "") + '" placeholder="works without one — Yahoo fallback" autocomplete="off">',
        "“Update prices” works with no key via Yahoo (through a public CORS proxy, which sees only the ticker symbols). A free finnhub.io key adds a direct, faster source for stock quotes. Stored only in this browser.", true) +
      this.field("Tax on interest %", '<input name="taxInterest" type="number" step="0.1" min="0" max="99" value="' + (tax.interest || "") + '" placeholder="0">', "e.g. ISR retention in Mexico") +
      this.field("Tax on dividends %", '<input name="taxDividends" type="number" step="0.1" min="0" max="99" value="' + (tax.dividends || "") + '" placeholder="0">', "withholding rate") +
      this.field("Tax on capital gains %", '<input name="taxCapGains" type="number" step="0.1" min="0" max="99" value="' + (tax.capGains || "") + '" placeholder="0">', "applied to projected gains", true) +
      '<div class="field full"><div class="hint">' + fxNote + "</div></div>" +
      "</div>";
    this.openModal("Settings — taxes & live data", body, {
      submitLabel: "Save settings",
      onSubmit(fd) {
        Store.state.settings.finnhubKey = (fd.get("finnhubKey") || "").trim();
        Store.state.settings.tax = {
          interest: parseFloat(fd.get("taxInterest")) || 0,
          dividends: parseFloat(fd.get("taxDividends")) || 0,
          capGains: parseFloat(fd.get("taxCapGains")) || 0,
        };
        Store.save();
        UI.toast("Settings saved");
        UI.closeModal();
        App.render();
      },
    });
  },

  pinForm() {
    if (!cryptoAvailable()) {
      UI.toast("PIN lock needs a secure context — open the app via https:// or localhost");
      return;
    }
    if (Store.pinEnabled) {
      const body = '<p style="color:var(--text-dim);font-size:13.5px;margin-bottom:14px">Your data is encrypted with your PIN. Enter it to turn the lock off — your data stays intact, just stored unencrypted again. To change your PIN, disable the lock and set a new one.</p>' +
        '<div class="f-grid">' +
        this.field("Current PIN", '<input name="pin" type="password" inputmode="numeric" minlength="4" maxlength="8" required autocomplete="off">', null, true) +
        "</div>";
      this.openModal("PIN lock — enabled", body, {
        submitLabel: "Disable lock",
        async onSubmit(fd) {
          const ok = await Store.verifyPin(fd.get("pin"));
          if (!ok) { UI.toast("Wrong PIN"); return; }
          await Store.disablePin();
          UI.toast("PIN lock disabled");
          UI.closeModal();
          App.render();
        },
      });
    } else {
      const body = '<p style="color:var(--text-dim);font-size:13.5px;margin-bottom:14px">Your data will be encrypted on this device (AES-256) and FinanceOS will ask for the PIN every time it opens. <strong>There is no recovery</strong> — if you forget the PIN, the only way back is erasing your data, so keep an exported backup somewhere safe.</p>' +
        '<div class="f-grid">' +
        this.field("New PIN (4–8 digits)", '<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" required autocomplete="off">') +
        this.field("Repeat PIN", '<input name="pin2" type="password" inputmode="numeric" minlength="4" maxlength="8" required autocomplete="off">') +
        "</div>";
      this.openModal("Set up PIN lock", body, {
        submitLabel: "Encrypt & lock",
        async onSubmit(fd) {
          const pin = fd.get("pin"), pin2 = fd.get("pin2");
          if (!/^[0-9]{4,8}$/.test(pin)) { UI.toast("PIN must be 4–8 digits"); return; }
          if (pin !== pin2) { UI.toast("PINs don't match"); return; }
          await Store.enablePin(pin);
          UI.toast("PIN lock enabled — your data is now encrypted");
          UI.closeModal();
          App.render();
        },
      });
    }
  },

  expenseForm(e) {
    e = e || {};
    const isEdit = !!e.id;
    const catOpts = EXPENSE_CATEGORIES.map(c =>
      '<option value="' + esc(c.name) + '"' + (e.category === c.name ? " selected" : "") + ">" + esc(c.name) + "</option>").join("");
    const body = '<div class="f-grid">' +
      this.field("Date", '<input name="date" type="date" required value="' + esc(e.date || toISO(todayMid())) + '">') +
      this.field("Amount", '<input name="amount" type="number" inputmode="decimal" step="0.01" required value="' + (e.amount != null ? e.amount : "") + '" placeholder="0.00">', "Positive for spending · minus for a refund") +
      this.field("Description", '<input name="description" maxlength="80" value="' + esc(e.description || "") + '" placeholder="Where it went">', null, true) +
      this.field("Category", '<select name="category">' + catOpts + "</select>") +
      this.field("Currency", this.currencySelect("currency", e.currency)) +
      "</div>";
    this.openModal(isEdit ? "Edit expense" : "Add expense", body, {
      submitLabel: isEdit ? "Save changes" : "Add expense",
      onSubmit(fd) {
        const exp = {
          date: fd.get("date"),
          amount: parseFloat(fd.get("amount")) || 0,
          description: (fd.get("description") || "").trim().slice(0, 80),
          category: fd.get("category"),
          currency: fd.get("currency"),
          source: isEdit ? (e.source || "manual") : "manual",
        };
        exp.sig = expenseSig(exp);
        if (isEdit) { Store.update("expenses", e.id, exp); UI.toast("Expense updated"); }
        else { Store.add("expenses", exp); UI.toast("Expense added"); }
        UI.closeModal();
        App.render();
      },
    });
  },

  budgetsForm() {
    const b = Store.state.budgets || {};
    const firstCur = EXPENSE_CATEGORIES.map(c => b[c.name] && b[c.name].currency).find(Boolean) || displayCurrency();
    const rows = EXPENSE_CATEGORIES.map((c, i) => {
      const v = b[c.name] && b[c.name].amount != null ? b[c.name].amount : "";
      return this.field('<span class="field-ic">' + icon(c.icon) + "</span>" + esc(c.name),
        '<input name="b' + i + '" type="number" inputmode="decimal" step="0.01" min="0" value="' + v + '" placeholder="—">');
    }).join("");
    const body =
      '<p class="modal-note">Set an optional monthly limit per category — leave blank for no limit. Your spending each month is tracked against these.</p>' +
      this.field("Budget currency", this.currencySelect("budgetCurrency", firstCur), "Applies to every limit below", true) +
      '<div class="f-grid">' + rows + "</div>";
    this.openModal("Monthly budgets", body, {
      submitLabel: "Save budgets",
      onSubmit(fd) {
        const cur = fd.get("budgetCurrency") || displayCurrency();
        const next = {};
        EXPENSE_CATEGORIES.forEach((c, i) => {
          const v = parseFloat(fd.get("b" + i));
          if (v > 0) next[c.name] = { amount: Math.round(v * 100) / 100, currency: cur };
        });
        Store.state.budgets = next;
        Store.save();
        UI.toast("Budgets saved");
        UI.closeModal();
        App.render();
      },
    });
  },

  expenseImportHelp() {
    const body =
      '<p class="modal-note">Fill the template in Excel, Google Sheets or Numbers — or let your favourite AI fill it from your card statements — then upload the CSV. Re-uploading is safe: duplicate rows are detected and never added twice.</p>' +
      '<ol class="import-steps">' +
        "<li><strong>Download</strong> the template — columns: Date, Description, Category, Amount, Currency.</li>" +
        "<li><strong>Fill it</strong> yourself, or paste it plus your statement into ChatGPT/Claude using the prompt below.</li>" +
        "<li><strong>Upload</strong> the saved <code>.csv</code> here.</li>" +
      "</ol>" +
      '<label class="micro-label" style="display:block;margin:16px 0 6px">Prompt for your AI</label>' +
      '<textarea class="ai-prompt" readonly rows="7">' + esc(BudgetIO.aiPrompt()) + "</textarea>" +
      '<div class="import-actions">' +
        '<button type="button" class="btn small ghost" data-action="copy-ai-prompt">⧉ Copy prompt</button>' +
        '<button type="button" class="btn small ghost" data-action="expense-template">↓ Download template</button>' +
      "</div>";
    this.openModal("Upload expenses", body, {
      submitLabel: "Choose CSV file…",
      onSubmit() {
        UI.closeModal();
        document.getElementById("expense-file").click();
      },
    });
  },

  confirm(title, message, onYes) {
    this.openModal(title, '<p style="color:var(--text-dim);font-size:14px">' + message + "</p>", {
      submitLabel: "Confirm",
      onSubmit() { UI.closeModal(); onYes(); },
    });
    const submitBtn = document.querySelector("#modal-form .btn.primary");
    if (submitBtn) { submitBtn.classList.remove("primary"); submitBtn.classList.add("danger-ghost"); }
  },
};
