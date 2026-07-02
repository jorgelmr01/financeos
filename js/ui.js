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
        '<div class="modal' + (opts.wide ? " wide" : "") + '" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
          '<div class="modal-head">' +
            '<div class="modal-title" id="modal-title">' + I18N.translateHtml('>'+title+'<').slice(1,-1) + "</div>" +
            '<button class="icon-btn" data-action="close-modal" title="Close" aria-label="Close dialog">' + icon("x") + '</button>' +
          "</div>" +
          '<form id="modal-form"><div class="modal-body">' + I18N.translateHtml(bodyHtml) + "</div>" +
          '<div class="modal-foot">' +
            '<button type="button" class="btn ghost" data-action="close-modal">' + tr("Cancel") + '</button>' +
            '<button type="submit" class="btn primary">' + tr(opts.submitLabel || "Save") + "</button>" +
          "</div></form>" +
        "</div>" +
      "</div>";
    this.onSubmit = opts.onSubmit || null;
    const form = document.getElementById("modal-form");
    form.addEventListener("submit", e => {
      e.preventDefault();
      // strip the display grouping (commas) from formatted number fields so the
      // existing parseFloat(fd.get(...)) logic reads clean numbers
      form.querySelectorAll(".fmt-num").forEach(el => { el.value = el.value.replace(/,/g, ""); });
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

  /* toast(msg) or toast(msg, "error"|"warn"|"success") or toast(msg, {type,duration}) */
  toast(msg, opts) {
    opts = opts || {};
    if (typeof opts === "string") opts = { type: opts };
    const type = opts.type || "";
    const dur = opts.duration || (type === "error" ? 7000 : type === "warn" ? 4800 : 2600);
    const root = document.getElementById("toast-root");
    if (!root) { if (type === "error") console.error("FinanceOS:", msg); return; }
    const el = document.createElement("div");
    el.className = "toast" + (type ? " " + type : "");
    el.setAttribute("role", type === "error" ? "alert" : "status");
    el.innerHTML = '<span class="t-dot"></span>' + esc(msg);
    root.appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 350); }, dur);
  },

  field(label, inputHtml, hint, full, id) {
    return '<div class="field' + (full ? " full" : "") + '"' + (id ? ' id="' + id + '"' : "") + '><label>' + tr(label) + "</label>" +
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
      this.field("Current balance", '<input name="balance" type="text" inputmode="decimal" class="fmt-num" required value="' + (acc.balance != null ? fmtNumInput(acc.balance) : "") + '" placeholder="0.00">') +
      this.field("Currency", this.currencySelect("currency", acc.currency), "Converted automatically in totals") +
      this.field("Interest rate — annual % (APY)", '<input name="apy" type="number" inputmode="decimal" step="0.01" min="0" max="100" value="' + (acc.apy != null && acc.apy !== 0 ? acc.apy : "") + '" placeholder="e.g. 11.50">', "The yearly rate. For custom intervals & fixed terms it's pro-rated to the period — not paid in full each time.") +
      this.field("Interest paid",
        '<select name="interestFreq">' +
          [["daily", "Daily (compounds daily)"], ["monthly", "Monthly"], ["quarterly", "Quarterly"],
           ["annually", "Annually"], ["everyN", "Every N days (custom)"], ["term", "Fixed term (pays at maturity)"]]
            .map(o => '<option value="' + o[0] + '"' + (interestFreqKey(acc) === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") +
        "</select>", "Daily compounds · quarterly lands Jan/Apr/Jul/Oct · annually in December") +
      this.field("Paid on",
        '<select name="interestDay">' + intDayOpts(interestPayDay(acc)) + "</select>",
        "Day of the month it's credited", false, "interest-day-field") +
      this.field('<span id="days-label">Every N days</span>',
        '<input name="interestEveryDays" type="number" inputmode="numeric" min="1" max="3650" step="1" value="' + (acc.interestEveryDays != null ? acc.interestEveryDays : "") + '" placeholder="e.g. 547">',
        '<span id="days-hint">Interest is credited every N days from the start date.</span>', false, "interest-days-field") +
      this.field("Starting",
        '<input name="interestStart" type="date" value="' + esc(acc.interestStart || toISO(todayMid())) + '">',
        "When the term begins / began", false, "interest-start-field") +
      "</div>" +
      '<div class="interest-preview" id="interest-preview" hidden></div>';
    this.openModal(isEdit ? "Edit account" : "New account", body, {
      submitLabel: isEdit ? "Save changes" : "Add account",
      onSubmit(fd) {
        const balance = parseFloat(fd.get("balance")) || 0;
        const freq = fd.get("interestFreq") || "monthly";
        const dayCount = (freq === "everyN" || freq === "term");
        const patch = {
          name: fd.get("name").trim(),
          institution: fd.get("institution").trim(),
          type: fd.get("type"),
          balance: balance,
          currency: fd.get("currency"),
          apy: parseFloat(fd.get("apy")) || 0,
          interestFreq: freq,
          interestDay: parseInt(fd.get("interestDay"), 10) || 31,
          interestEveryDays: dayCount ? Math.max(1, parseInt(fd.get("interestEveryDays"), 10) || 365) : null,
          interestStart: dayCount ? (fd.get("interestStart") || toISO(todayMid())) : null,
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
    // show only the schedule fields that apply to the chosen frequency:
    //   monthly → Paid on · everyN/term → length + start date · others → none
    const form = document.getElementById("modal-form");
    const freqSel = form && form.querySelector("[name=interestFreq]");
    if (freqSel) {
      const daysInput = form.querySelector("[name=interestEveryDays]");
      const dayField = document.getElementById("interest-day-field");
      const daysField = document.getElementById("interest-days-field");
      const startField = document.getElementById("interest-start-field");
      const daysLabel = document.getElementById("days-label");
      const daysHint = document.getElementById("days-hint");
      const previewEl = document.getElementById("interest-preview");
      const show = (el, on) => { if (el) el.style.display = on ? "" : "none"; };

      // live, plain-language preview of what each payout works out to — so the
      // annual-vs-period distinction is obvious before saving.
      const num = (name) => parseNum(form.querySelector("[name=" + name + "]").value);
      const preview = () => {
        if (!previewEl) return;
        const apy = num("apy"), bal = num("balance");
        const f = freqSel.value;
        if (apy <= 0 || bal <= 0) { previewEl.hidden = true; return; }
        const a = {
          balance: bal, apy: apy, currency: form.querySelector("[name=currency]").value,
          interestFreq: f, interestDay: parseInt(form.querySelector("[name=interestDay]").value, 10) || 31,
          interestEveryDays: parseInt(daysInput.value, 10) || null,
          interestStart: form.querySelector("[name=interestStart]").value || toISO(todayMid()),
          balanceAsOf: toISO(todayMid()),
        };
        if ((f === "everyN" || f === "term") && !(a.interestEveryDays >= 1)) { previewEl.hidden = true; return; }
        const per = interestPerPeriod(a);
        const amt = fmtMoneyIn(per, a.currency, { sign: true });
        const next = fmtDateShort(nextInterestDate(a));
        const pct = (per / bal * 100).toFixed(2);
        let html;
        if (f === "term") {
          const d = interestPeriodDays(a);
          html = "<strong>" + amt + "</strong> at maturity in <strong>" + d + " days</strong> (≈ " + next + ") — " +
            apy + "% a year works out to " + pct + "% over this term.";
        } else if (f === "everyN") {
          const d = interestPeriodDays(a);
          const yrs = d > 400 ? " (" + (d / 365).toFixed(1) + " years' worth)" : "";
          html = "<strong>" + amt + "</strong> every " + d + " days" + yrs + " — next ≈ " + next + ".";
        } else {
          const word = { daily: "per day", monthly: "per month", quarterly: "per quarter", annually: "per year" }[f] || "each payout";
          html = "<strong>" + amt + "</strong> " + word + " · next ≈ " + next + ".";
        }
        previewEl.innerHTML = html;
        previewEl.hidden = false;
      };

      const sync = () => {
        const f = freqSel.value;
        const dayCount = (f === "everyN" || f === "term");
        show(dayField, f === "monthly");
        show(daysField, dayCount);
        show(startField, dayCount);
        if (daysInput) daysInput.required = dayCount;   // can't save a term without a length
        if (daysLabel) daysLabel.textContent = f === "term" ? "Term length (days)" : "Every N days";
        if (daysHint) daysHint.textContent = f === "term"
          ? "Length of the deposit — common: 28, 91, 182, 364 days (Cetes / CDs). Interest pays at maturity."
          : "Interest is credited every N days from the start date.";
        preview();
      };
      freqSel.addEventListener("change", sync);
      form.addEventListener("input", preview);
      sync();
    }
  },

  goalForm(goal) {
    goal = goal || {};
    const isEdit = !!goal.id;
    const body = '<div class="f-grid">' +
      this.field("Goal name", '<input name="name" required maxlength="60" value="' + esc(goal.name || "") + '" placeholder="Emergency fund, trip to Japan…">', null, true) +
      this.field("Target amount", '<input name="target" type="text" inputmode="decimal" class="fmt-num" required value="' + (goal.target != null ? fmtNumInput(goal.target) : "") + '">', "What you want to save in total") +
      this.field("Saved so far", '<input name="saved" type="text" inputmode="decimal" class="fmt-num" value="' + (goal.saved != null ? fmtNumInput(goal.saved) : "") + '">', "Bump this up as you set money aside") +
      this.field("Currency", this.currencySelect("currency", goal.currency)) +
      this.field("Target date (optional)", '<input name="targetDate" type="date" value="' + esc(goal.targetDate || "") + '">', "We’ll work out the monthly amount you need to get there", true) +
      "</div>";
    this.openModal(isEdit ? "Edit goal" : "New savings goal", body, {
      submitLabel: isEdit ? "Save changes" : "Add goal",
      onSubmit(fd) {
        const patch = {
          name: (fd.get("name") || "").trim(),
          target: parseFloat(fd.get("target")) || 0,
          saved: parseFloat(fd.get("saved")) || 0,
          currency: fd.get("currency"),
          targetDate: fd.get("targetDate") || "",
        };
        if (isEdit) { Store.update("goals", goal.id, patch); UI.toast("Goal updated", { type: "success" }); }
        else { Store.add("goals", patch); UI.toast("Goal added", { type: "success" }); }
        UI.closeModal();
        App.render();
      },
    });
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
      this.field("Credit limit", '<input name="limit" type="text" inputmode="decimal" class="fmt-num" required value="' + (card.limit != null ? fmtNumInput(card.limit) : "") + '">') +
      this.field("Current balance", '<input name="balance" type="text" inputmode="decimal" class="fmt-num" required value="' + (card.balance != null ? fmtNumInput(card.balance) : "") + '">', "What you currently owe") +
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
      this.field("Shares", '<input name="shares" type="text" inputmode="decimal" class="fmt-num" required value="' + (h.shares != null ? fmtNumInput(h.shares) : "") + '">', "Fractional shares allowed") +
      this.field("Prices in", this.currencySelect("currency", h.currency || "USD"), "Currency of this listing (US tickers: USD)") +
      this.field("Avg. price paid", '<input name="costBasis" type="text" inputmode="decimal" class="fmt-num" required value="' + (h.costBasis != null ? fmtNumInput(h.costBasis) : "") + '">', "Per share") +
      this.field("Current price", '<input name="currentPrice" type="text" inputmode="decimal" class="fmt-num" required value="' + (h.currentPrice != null ? fmtNumInput(h.currentPrice) : "") + '">', "Auto-updates with a Finnhub key") +
      this.field("Dividend / share / year", '<input name="divPerShare" type="text" inputmode="decimal" class="fmt-num" value="' + (h.divPerShare != null && h.divPerShare !== 0 ? fmtNumInput(h.divPerShare) : "") + '">', "Optional — auto-fills when refreshing prices") +
      this.field("Purchase date", '<input name="purchaseDate" type="date" value="' + esc(h.purchaseDate || toISO(todayMid())) + '">') +
      this.field("Held in account", '<select name="accountId">' + acctOpts + "</select>", invAccounts.length ? null : "Tip: add an Investment account to link", true) +
      this._holdingClassFields(h) +
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
        const cls = {};
        if (fd.get("clsAsset")) cls.assetClass = fd.get("clsAsset");
        if (fd.get("clsSector")) cls.sector = fd.get("clsSector");
        if (fd.get("clsRegion")) cls.region = fd.get("clsRegion");
        patch.cls = Object.keys(cls).length ? cls : null;
        if (isEdit) { Store.update("holdings", h.id, patch); UI.toast("Position updated"); }
        else { Store.add("holdings", patch); UI.toast("Position added"); }
        UI.closeModal();
        App.render();
      },
    });
  },

  /* off-platform assets & liabilities — the rest of the balance sheet */
  assetForm(a) {
    a = a || {};
    const isEdit = !!a.id;
    const kinds = [["property", "Property / real estate"], ["vehicle", "Vehicle"], ["business", "Business / private equity"], ["crypto", "Crypto (held elsewhere)"], ["other", "Other"]];
    const body = '<div class="f-grid">' +
      this.field("Name", '<input name="name" required maxlength="60" value="' + esc(a.name || "") + '" placeholder="Departamento CDMX">', null, true) +
      this.field("Type", '<select name="kind">' + kinds.map(k => '<option value="' + k[0] + '"' + (a.kind === k[0] ? " selected" : "") + ">" + k[1] + "</option>").join("") + "</select>") +
      this.field("Current value", '<input name="value" type="text" inputmode="decimal" class="fmt-num" required value="' + (a.value != null ? fmtNumInput(a.value) : "") + '">', "Your best market estimate — update it when it changes") +
      this.field("Currency", this.currencySelect("currency", a.currency), null, true) +
      "</div>";
    this.openModal(isEdit ? "Edit asset" : "New asset", body, {
      submitLabel: isEdit ? "Save changes" : "Add asset",
      onSubmit(fd) {
        const patch = { name: fd.get("name").trim(), kind: fd.get("kind"), value: parseFloat(fd.get("value")) || 0, currency: fd.get("currency") };
        if (isEdit) Store.update("assets", a.id, patch); else Store.add("assets", patch);
        UI.toast(isEdit ? "Asset updated" : "Asset added"); UI.closeModal(); App.render();
      },
    });
  },

  liabilityForm(l) {
    l = l || {};
    const isEdit = !!l.id;
    const kinds = [["mortgage", "Mortgage"], ["auto", "Auto loan"], ["personal", "Personal loan"], ["student", "Student loan"], ["other", "Other"]];
    const body = '<div class="f-grid">' +
      this.field("Name", '<input name="name" required maxlength="60" value="' + esc(l.name || "") + '" placeholder="Hipoteca depa">', null, true) +
      this.field("Type", '<select name="kind">' + kinds.map(k => '<option value="' + k[0] + '"' + (l.kind === k[0] ? " selected" : "") + ">" + k[1] + "</option>").join("") + "</select>") +
      this.field("Balance owed", '<input name="balance" type="text" inputmode="decimal" class="fmt-num" required value="' + (l.balance != null ? fmtNumInput(l.balance) : "") + '">') +
      this.field("Annual rate % (APR)", '<input name="apr" type="number" inputmode="decimal" step="0.01" min="0" max="120" value="' + (l.apr != null && l.apr !== 0 ? l.apr : "") + '" placeholder="10.4">') +
      this.field("Monthly payment", '<input name="payment" type="text" inputmode="decimal" class="fmt-num" value="' + (l.payment != null && l.payment !== 0 ? fmtNumInput(l.payment) : "") + '">', "With APR + payment, FinanceOS computes your payoff horizon and remaining interest") +
      this.field("Currency", this.currencySelect("currency", l.currency)) +
      "</div>";
    this.openModal(isEdit ? "Edit liability" : "New liability", body, {
      submitLabel: isEdit ? "Save changes" : "Add liability",
      onSubmit(fd) {
        const patch = { name: fd.get("name").trim(), kind: fd.get("kind"), balance: parseFloat(fd.get("balance")) || 0, apr: parseFloat(fd.get("apr")) || 0, payment: parseFloat(fd.get("payment")) || 0, currency: fd.get("currency") };
        if (isEdit) Store.update("liabilities", l.id, patch); else Store.add("liabilities", patch);
        UI.toast(isEdit ? "Liability updated" : "Liability added"); UI.closeModal(); App.render();
      },
    });
  },

  /* a planned life event for the wealth projection: a future purchase, a
     raise in a specific year, or a windfall */
  planForm(e) {
    e = e || {};
    const isEdit = !!e.id;
    const y0 = todayMid().getFullYear();
    const kind = e.kind || "purchase";
    const kinds = [["purchase", "Purchase (house, car…)"], ["raise", "Salary raise"], ["windfall", "Windfall (bonus, sale, inheritance)"]];
    const body = '<div class="f-grid">' +
      this.field("Type", '<select name="kind" id="plan-kind">' + kinds.map(k => '<option value="' + k[0] + '"' + (kind === k[0] ? " selected" : "") + ">" + k[1] + "</option>").join("") + "</select>") +
      this.field("Year", '<input name="year" type="number" min="' + (y0 + 1) + '" max="' + (y0 + 40) + '" step="1" required value="' + (e.year || y0 + 4) + '">') +
      this.field("Name", '<input name="name" maxlength="40" value="' + esc(e.name || "") + '" placeholder="Casa CDMX, coche, bono…">', null, true) +
      this.field("Amount", '<input name="amount" type="text" inputmode="decimal" class="fmt-num" value="' + (e.amount != null && e.amount !== 0 ? fmtNumInput(e.amount) : "") + '">', "For purchases & windfalls", false, "plan-amount-field") +
      this.field("Currency", this.currencySelect("currency", e.currency), null, false, "plan-cur-field") +
      this.field("Raise %", '<input name="pct" type="number" step="0.5" min="-50" max="200" value="' + (e.pct != null ? e.pct : "") + '" placeholder="10">', "Salary changes by this % from that year on", false, "plan-pct-field") +
      '<div class="field full" id="plan-asset-field"><label class="check-row"><input type="checkbox" name="asset"' + (e.asset ? " checked" : "") + "> " +
        'Becomes an asset (a house keeps its value on your balance sheet; a vacation doesn’t)</label></div>' +
      "</div>";
    this.openModal(isEdit ? "Edit life event" : "New life event", body, {
      submitLabel: isEdit ? "Save changes" : "Add event",
      onSubmit(fd) {
        const k = fd.get("kind");
        const patch = {
          kind: k, year: parseInt(fd.get("year"), 10) || (y0 + 1),
          name: (fd.get("name") || "").trim(),
          amount: parseFloat(fd.get("amount")) || 0,
          pct: parseFloat(fd.get("pct")) || 0,
          currency: fd.get("currency"),
          asset: k === "purchase" && fd.get("asset") != null,
        };
        if (k !== "raise" && !(patch.amount > 0)) { UI.toast("Enter the amount", "error"); return; }
        if (k === "raise" && !patch.pct) { UI.toast("Enter the raise %", "error"); return; }
        if (isEdit) Store.update("plan", e.id, patch); else Store.add("plan", patch);
        UI.toast(isEdit ? "Event updated" : "Event added");
        UI.closeModal(); App.render();
      },
    });
    // show only the fields the chosen kind uses
    const sync = () => {
      const k = document.getElementById("plan-kind").value;
      const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? "" : "none"; };
      show("plan-amount-field", k !== "raise");
      show("plan-cur-field", k !== "raise");
      show("plan-pct-field", k === "raise");
      show("plan-asset-field", k === "purchase");
    };
    document.getElementById("plan-kind").addEventListener("change", sync);
    sync();
  },

  /* record cash moved into / out of the brokerage (for account-level XIRR) */
  flowForm(kind) {
    const isW = kind === "withdrawal";
    const body = '<div class="f-grid">' +
      this.field("Amount", '<input name="amount" type="text" inputmode="decimal" class="fmt-num" required placeholder="10,000">') +
      this.field("Currency", this.currencySelect("currency")) +
      this.field("Date", '<input name="date" type="date" required value="' + toISO(todayMid()) + '">', "Approximate is fine — the return barely moves for a few days' difference") +
      this.field("Note", '<input name="note" maxlength="40" placeholder="' + (isW ? "e.g. trip, emergency" : "e.g. monthly deposit, bonus") + '">') +
      "</div>";
    this.openModal(isW ? "Record withdrawal" : "Record deposit", body, {
      submitLabel: isW ? "Add withdrawal" : "Add deposit",
      onSubmit(fd) {
        const amount = parseFloat(fd.get("amount")) || 0;
        if (!(amount > 0)) { UI.toast("Enter the amount", "error"); return; }
        Store.add("flows", { kind: isW ? "withdrawal" : "deposit", amount: amount, currency: fd.get("currency"), date: fd.get("date"), note: (fd.get("note") || "").trim() });
        UI.toast(isW ? "Withdrawal recorded" : "Deposit recorded");
        UI.closeModal(); App.render();
      },
    });
  },

  /* record a (partial) sale of a position → realized gain + smaller holding */
  sellForm(h) {
    if (!h) return;
    const held = Number(h.shares) || 0;
    const body = '<div class="f-grid">' +
      this.field("Shares to sell", '<input name="shares" type="text" inputmode="decimal" class="fmt-num" required value="' + fmtNumInput(held) + '">', "You hold " + fmtNum(held)) +
      this.field("Sale price / share (" + esc(h.currency) + ")", '<input name="price" type="text" inputmode="decimal" class="fmt-num" required value="' + (h.currentPrice != null ? fmtNumInput(h.currentPrice) : "") + '">', "Avg cost " + fmtMoneyIn(h.costBasis, h.currency)) +
      this.field("Sale date", '<input name="date" type="date" value="' + toISO(todayMid()) + '">', null, true) +
      "</div>" +
      '<p class="modal-note" style="margin-top:10px">The realized gain (sale minus average cost) is recorded for your yearly tax picture. Selling everything removes the position.</p>';
    this.openModal("Sell " + esc(h.symbol), body, {
      submitLabel: "Record sale",
      onSubmit(fd) {
        const qty = parseNum(fd.get("shares")), price = parseNum(fd.get("price"));
        if (!(qty > 0) || !(price >= 0)) { UI.toast("Enter the shares and the sale price", "error"); return; }
        const rec = sellHolding(h.id, { shares: qty, price: price, date: fd.get("date") || undefined });
        UI.closeModal();
        if (rec) {
          UI.toast("Sold " + fmtNum(rec.shares) + " " + rec.symbol + " · " + (rec.gain >= 0 ? "gain " : "loss ") + fmtMoneyIn(Math.abs(rec.gain), rec.currency, { compact: true }));
          App.render();
        }
      },
    });
  },

  /* optional classification overrides for the advanced portfolio view. Blank =
     "Auto" (use the built-in dataset for known tickers). Shows what we detect. */
  _holdingClassFields(h) {
    if (typeof SECTORS === "undefined") return "";
    const cls = (h && h.cls) || {};
    const det = (typeof classifyHolding === "function") ? classifyHolding(h || {}) : null;
    const opts = (arr, sel) => '<option value="">Auto</option>' +
      arr.map(o => '<option value="' + esc(o) + '"' + (sel === o ? " selected" : "") + ">" + esc(o) + "</option>").join("");
    const detNote = det && det.known
      ? "We detect: " + esc(det.assetClass) + (Object.keys(det.sectors).length === 1 ? " · " + esc(Object.keys(det.sectors)[0]) : " · multi-sector ETF") + " · " + esc(Object.keys(det.regions)[0] || "—") + (det.source === "finnhub" ? " (auto via Finnhub)" : "")
      : "Unknown ticker — set these here, or add a free Finnhub key to auto-classify it on the next price update.";
    return '<div class="field full"><label style="margin-bottom:2px">Classification <span class="beta-pill">advanced · optional</span></label>' +
      '<div class="hint" style="margin-top:0">' + detNote + "</div></div>" +
      this.field("Asset class", '<select name="clsAsset">' + opts(ASSET_CLASSES, cls.assetClass) + "</select>", null, true) +
      this.field("Sector / industry", '<select name="clsSector">' + opts(SECTORS, cls.sector) + "</select>", null, true) +
      this.field("Geography", '<select name="clsRegion">' + opts(REGIONS, cls.region) + "</select>", null, true);
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
      this.field("Amount per deposit", '<input name="amount" type="text" inputmode="decimal" class="fmt-num" required value="' + (inc.amount != null ? fmtNumInput(inc.amount) : "") + '">') +
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
      this.field("Language",
        '<select name="lang">' +
          '<option value="auto"' + (!st.lang || st.lang === "auto" ? " selected" : "") + ">" + tr("Auto (browser)") + "</option>" +
          '<option value="es"' + (st.lang === "es" ? " selected" : "") + ">Español</option>" +
          '<option value="en"' + (st.lang === "en" ? " selected" : "") + ">English</option>" +
        "</select>",
        "Interface language. Course lessons are in Spanish either way.", true) +
      this.field("Finnhub API key (optional)",
        '<input name="finnhubKey" value="' + esc(st.finnhubKey || "") + '" placeholder="works without one — Yahoo fallback" autocomplete="off">',
        "“Update prices” works with no key via Yahoo (through a public CORS proxy, which sees only the ticker symbols). A free finnhub.io key adds a direct, faster source for stock quotes — and powers the Advanced portfolio view: it auto-classifies single stocks by sector &amp; country and pulls each one's market beta. Stored only in this browser.", true) +
      this.field("Annual ISR on interest %", '<input name="taxInterest" type="number" step="0.1" min="0" max="99" value="' + (tax.interest || "") + '" placeholder="0">', "In Mexico interest is paid gross and you settle this in your April return — and only on the real interest (above inflation), never withheld at source") +
      this.field("Provisional ISR on capital %", '<input name="taxIntProvisional" type="number" step="0.01" min="0" max="20" value="' + (tax.interestProvisional || "") + '" placeholder="0.5">', "Small advance (≈0.5%, set yearly by the Ley de Ingresos) the bank withholds on your capital; it's a credit against the annual ISR above") +
      this.field("Inflation assumption %", '<input name="inflation" type="number" step="0.1" min="0" max="50" value="' + (tax.inflation != null ? tax.inflation : "") + '" placeholder="4.5">', "Used for taxable real interest (nominal − inflation) and the Retirement calculator's today's-pesos values. A rational long-run Mexico figure is ≈4–4.5%") +
      this.field("Tax on dividends %", '<input name="taxDividends" type="number" step="0.1" min="0" max="99" value="' + (tax.dividends || "") + '" placeholder="0">', "withholding rate — withheld at source (definitive 10% in Mexico)") +
      this.field("Tax on capital gains %", '<input name="taxCapGains" type="number" step="0.1" min="0" max="99" value="' + (tax.capGains || "") + '" placeholder="0">', "applied to projected gains") +
      this.field("Risk-free rate %", '<input name="riskFree" type="number" step="0.1" min="0" max="30" value="' + (st.riskFreePct != null ? st.riskFreePct : "") + '" placeholder="7.5">', "For Sharpe/Sortino — think CETES 28d") +
      this.field("Auto-credit interest",
        '<label class="switch-row"><input type="checkbox" name="autoInterest"' + (st.autoInterest !== false ? " checked" : "") + '> ' +
        "Add interest to balances on its schedule</label>",
        "When on, FinanceOS credits each account the interest it has earned by today, following its pay schedule — so balances, net worth and projections stay current. Turn off to keep balances exactly as you enter them.", true) +
      '<div class="field full"><div class="hint">' + fxNote + "</div></div>" +
      "</div>";
    this.openModal("Settings — taxes & live data", body, {
      submitLabel: "Save settings",
      onSubmit(fd) {
        Store.state.settings.finnhubKey = (fd.get("finnhubKey") || "").trim();
        Store.state.settings.tax = {
          interest: parseFloat(fd.get("taxInterest")) || 0,
          interestProvisional: parseFloat(fd.get("taxIntProvisional")) || 0,
          inflation: parseFloat(fd.get("inflation")) || 0,
          dividends: parseFloat(fd.get("taxDividends")) || 0,
          capGains: parseFloat(fd.get("taxCapGains")) || 0,
        };
        Store.state.settings.autoInterest = fd.get("autoInterest") != null;
        Store.state.settings.lang = fd.get("lang") || "auto";
        const rfv = parseFloat(fd.get("riskFree"));
        Store.state.settings.riskFreePct = isFinite(rfv) ? rfv : null;
        I18N.refresh();
        Store.save();
        Store.settleInterest();          // apply immediately if just turned on
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
    const catOpts = allCategories().map(c =>
      '<option value="' + esc(c.name) + '"' + (e.category === c.name ? " selected" : "") + ">" + esc(c.name) + "</option>").join("");
    const body = '<div class="f-grid">' +
      this.field("Date", '<input name="date" type="date" required value="' + esc(e.date || toISO(todayMid())) + '">') +
      this.field("Amount", '<input name="amount" type="text" inputmode="decimal" class="fmt-num" required value="' + (e.amount != null ? fmtNumInput(e.amount) : "") + '" placeholder="0.00">', "Positive for spending · minus for a refund") +
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
    const cats = allCategories();
    const firstCur = cats.map(c => b[c.name] && b[c.name].currency).find(Boolean) || displayCurrency();
    const rows = cats.map((c, i) => {
      const v = b[c.name] && b[c.name].amount != null ? fmtNumInput(b[c.name].amount) : "";
      return this.field('<span class="field-ic">' + icon(c.icon) + "</span>" + esc(c.name) +
        (c.custom ? ' <button type="button" class="link-btn cat-del" data-cat="' + esc(c.name) + '" title="Remove this category">×</button>' : ""),
        '<input name="b' + i + '" type="text" inputmode="decimal" class="fmt-num" value="' + v + '" placeholder="—">');
    }).join("");
    const body =
      '<p class="modal-note">Set an optional monthly limit per category — leave blank for no limit. Your spending each month is tracked against these.</p>' +
      this.field("Budget currency", this.currencySelect("budgetCurrency", firstCur), "Applies to every limit below", true) +
      '<label class="check-row"><input type="checkbox" name="rollover"' + (Store.state.settings.budgetRollover ? " checked" : "") + "> " +
        "Roll last month's leftover into this month's limits <span class=\"hint\" style=\"display:block\">Underspend a category and next month's envelope grows; overspend and it shrinks (one month of memory, never below zero).</span></label>" +
      '<div class="f-grid">' + rows + "</div>" +
      '<div class="field full" style="margin-top:6px"><label>Add your own category</label>' +
        '<div class="cat-add-row"><input name="newCat" maxlength="24" placeholder="e.g. Mascotas, Colegiaturas">' +
        '<select name="newCatBucket"><option value="wants">Want</option><option value="needs">Need</option></select></div>' +
        '<div class="hint">It appears in every category picker; classify it as a need or a want for the 50/30/20 view.</div></div>';
    this.openModal("Monthly budgets", body, {
      submitLabel: "Save budgets",
      onSubmit(fd) {
        const cur = fd.get("budgetCurrency") || displayCurrency();
        const next = {};
        cats.forEach((c, i) => {
          const v = parseFloat(fd.get("b" + i));
          if (v > 0) next[c.name] = { amount: Math.round(v * 100) / 100, currency: cur };
        });
        Store.state.budgets = next;
        Store.state.settings.budgetRollover = !!fd.get("rollover");
        const nc = String(fd.get("newCat") || "").trim();
        if (nc) {
          const exists = allCategories().some(c => c.name.toLowerCase() === nc.toLowerCase());
          if (!exists) {
            Store.state.settings.customCats = (Store.state.settings.customCats || [])
              .concat([{ name: nc, bucket: fd.get("newCatBucket") === "needs" ? "needs" : "wants" }]);
          }
        }
        Store.save();
        UI.toast("Budgets saved");
        UI.closeModal();
        App.render();
      },
    });
    // removing a custom category keeps its historical expenses (they fall back
    // to a generic look) — it just leaves the pick-lists
    document.querySelectorAll(".cat-del").forEach(btn => btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-cat");
      Store.state.settings.customCats = (Store.state.settings.customCats || []).filter(c => c.name !== name);
      delete (Store.state.budgets || {})[name];
      Store.save();
      UI.budgetsForm();          // re-render the modal with the list updated
    }));
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
      "</div>" +
      '<div class="import-or"><span>or skip the spreadsheet</span></div>' +
      '<button type="button" class="btn small full-w" data-action="statement-import">' + icon("card") +
        ' Import a statement PDF <span class="beta-pill">Beta</span></button>' +
      '<p class="modal-note" style="margin-top:8px;font-size:12px;color:var(--text-faint)">Reads Amex, Klar, Openbank &amp; Santander statements on your device — nothing is uploaded.</p>';
    this.openModal("Upload expenses", body, {
      submitLabel: "Choose CSV file…",
      onSubmit() {
        UI.closeModal();
        document.getElementById("expense-file").click();
      },
    });
  },

  /* ---------- Statement import (Beta): PDF parsed entirely on-device ---------- */
  statementImportIntro() {
    if (!Statements.available()) {
      this.toast("PDF reader still loading — try again in a moment");
      return;
    }
    const body =
      '<p class="modal-note">Upload a credit-card or bank statement <strong>PDF</strong> and FinanceOS reads the transactions for you. ' +
      "You review and tweak everything before anything is saved.</p>" +
      '<div class="privacy-card">' + icon("lock") +
        "<div><strong>100% on your device.</strong> The PDF is parsed right here in your browser — it is never uploaded, " +
        "sent to a server, or stored anywhere but on this device.</div></div>" +
      '<ul class="import-steps">' +
        "<li>Tuned for <strong>Amex</strong>, <strong>Klar</strong>, <strong>Openbank</strong> and <strong>Santander</strong>; BBVA, Banorte, Citibanamex, Nu, HSBC and most other banks are recognized and read with a generic parser.</li>" +
        "<li>Scanned (image) statements are read with <strong>on-device OCR</strong> — slower, and still 100% private.</li>" +
        "<li>Every row is <strong>editable in review</strong>: fix a description or amount before importing. Payments and card transfers are detected and left unchecked (they aren't expenses).</li>" +
        "<li>Re-uploading is safe — duplicate rows are never added twice.</li>" +
      "</ul>" +
      '<p class="modal-note" style="margin-top:10px;color:var(--text-faint);font-size:12px">Scanned statements (like Santander) are read with on-device OCR — that takes a little longer and still never leaves your device. Double-check the amounts before importing.</p>';
    this.openModal('Import from statement <span class="beta-pill">Beta</span>', body, {
      submitLabel: "Choose PDF…",
      onSubmit() {
        UI.closeModal();
        document.getElementById("statement-file").click();
      },
    });
  },

  statementProgress(title, detail) {
    const root = document.getElementById("modal-root");
    const existing = document.getElementById("stmt-progress");
    if (existing) {
      const t = existing.querySelector(".sp-title"); if (t) t.textContent = title;
      const d = existing.querySelector(".sp-detail"); if (d) d.textContent = detail || "";
      return;
    }
    root.innerHTML =
      '<div class="modal-overlay"><div class="modal" role="dialog" aria-modal="true" id="stmt-progress">' +
        '<div class="modal-body" style="text-align:center;padding:30px 22px">' +
          '<div class="spinner" aria-hidden="true"></div>' +
          '<div class="sp-title" style="font-weight:600;color:var(--text);margin-top:16px">' + esc(title) + "</div>" +
          '<div class="sp-detail" style="color:var(--text-faint);font-size:12.5px;margin-top:7px">' + esc(detail || "") + "</div>" +
        "</div>" +
      "</div></div>";
  },

  _catOptions(selected) {
    const cats = allCategories();
    // an imported/legacy category outside the list still shows as selected
    const known = cats.some(c => c.name === selected);
    return cats.map(c =>
      '<option value="' + esc(c.name) + '"' + (c.name === selected ? " selected" : "") + ">" + esc(c.name) + "</option>").join("") +
      (!known && selected ? '<option value="' + esc(selected) + '" selected>' + esc(selected) + "</option>" : "");
  },

  statementReview(parse) {
    if (parse.scanned || !parse.rows.length) {
      const msg = (parse.warnings && parse.warnings[0]) || "No transactions could be read from this PDF.";
      const body =
        '<div class="privacy-card warn">' + icon("eye") + "<div>" + esc(msg) + "</div></div>" +
        '<p class="modal-note">You can still add these expenses with the spreadsheet template — fill it yourself or let your AI fill it from the statement.</p>' +
        '<div class="import-actions">' +
          '<button type="button" class="btn small ghost" data-action="expense-template">↓ Download template</button>' +
          '<button type="button" class="btn small ghost" data-action="copy-ai-prompt">⧉ Copy AI prompt</button>' +
        "</div>";
      this.openModal("Couldn't read that statement", body, { submitLabel: "OK", onSubmit() { UI.closeModal(); } });
      return;
    }

    const rowsHtml = parse.rows.map((r, i) => {
      const tag = r.type === "payment" ? '<span class="stmt-tag pay">payment</span>'
                : r.type === "refund" ? '<span class="stmt-tag ref">refund</span>'
                : r.type === "fee" ? '<span class="stmt-tag fee">fee</span>' : "";
      const amtCls = r.amount < 0 ? " neg" : "";
      const dateLabel = (function () { const d = parseISO(r.date); return d ? fmtDateShort(d) : r.date; })();
      const disabled = (r.type === "payment");                  // category irrelevant for payments
      return '<div class="stmt-row" data-i="' + i + '">' +
        '<input type="checkbox" class="stmt-inc"' + (r.include ? " checked" : "") + ' aria-label="Include ' + esc(r.description) + '">' +
        '<span class="stmt-date">' + esc(dateLabel) + "</span>" +
        '<span class="stmt-desc"><input class="stmt-desc-in" type="text" maxlength="80" value="' + esc(r.description) + '" aria-label="Description">' + tag + "</span>" +
        '<select class="stmt-cat"' + (disabled ? " disabled" : "") + ">" + this._catOptions(r.category) + "</select>" +
        '<span class="stmt-amt' + amtCls + '"><input class="stmt-amt-in" type="text" inputmode="decimal" value="' + (Math.round(r.amount * 100) / 100) + '" aria-label="Amount (' + esc(r.currency) + ')" title="Amount in ' + esc(r.currency) + ' — edit if it was misread">' + "</span>" +
      "</div>";
    }).join("");

    const nCharge = parse.rows.filter(r => r.include).length;
    const warn = (parse.warnings && parse.warnings.length)
      ? '<div class="privacy-card warn">' + icon("eye") + "<div>" + esc(parse.warnings[0]) + "</div></div>" : "";

    // reconciliation badge — does our charge sum match the statement's printed total?
    let recon = "";
    const rc = parse.reconcile;
    if (rc && rc.printed != null) {
      if (rc.ok) {
        recon = '<div class="recon ok">' + icon("award") + "<div>Adds up — your charges match the statement total of " +
          esc(fmtMoneyIn(rc.printed, parse.currency)) + ".</div></div>";
      } else {
        recon = '<div class="recon bad">' + icon("eye") + "<div>Heads up: the charges read total " +
          esc(fmtMoneyIn(rc.parsed, parse.currency)) + ", but the statement lists " + esc(fmtMoneyIn(rc.printed, parse.currency)) +
          " (" + (rc.diff > 0 ? "+" : "") + esc(fmtMoneyIn(rc.diff, parse.currency)) + "). A row may be missing or misread — worth a quick look.</div></div>";
      }
    }

    const body =
      '<div class="stmt-summary"><span class="stmt-bank">' + icon("card") + " " + esc(parse.bankLabel) + "</span>" +
        '<span class="stmt-meta">' + parse.rows.length + " transactions found · " + parse.currency + "</span></div>" +
      '<div class="privacy-card slim">' + icon("lock") + "<div>Parsed on your device — nothing was uploaded. Review and edit, then import.</div></div>" +
      warn + recon +
      '<div class="stmt-bulk"><button type="button" class="link-btn" data-stmt-bulk="all">Select all</button>' +
        '<button type="button" class="link-btn" data-stmt-bulk="charges">Only purchases</button>' +
        '<button type="button" class="link-btn" data-stmt-bulk="none">None</button></div>' +
      '<div class="stmt-table">' + rowsHtml + "</div>" +
      '<div class="stmt-foot-note" id="stmt-count">' + nCharge + " selected</div>";

    this.openModal('Review transactions <span class="beta-pill">Beta</span>', body, {
      submitLabel: "Import selected",
      wide: true,                        // the table needs room to breathe
      onSubmit() { UI.commitStatement(parse); },
    });

    // wire bulk actions + live count (modal lives inside #modal-root)
    const root = document.getElementById("modal-root");
    const updateCount = () => {
      const n = root.querySelectorAll(".stmt-inc:checked").length;
      const el = document.getElementById("stmt-count");
      if (el) el.textContent = n + " selected";
    };
    root.querySelectorAll("[data-stmt-bulk]").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-stmt-bulk");
        root.querySelectorAll(".stmt-row").forEach(row => {
          const cb = row.querySelector(".stmt-inc");
          const isPay = row.querySelector(".stmt-tag.pay");
          if (mode === "all") cb.checked = true;
          else if (mode === "none") cb.checked = false;
          else if (mode === "charges") cb.checked = !isPay && !row.querySelector(".stmt-tag.ref");
        });
        updateCount();
      });
    });
    root.querySelectorAll(".stmt-inc").forEach(cb => cb.addEventListener("change", updateCount));
  },

  commitStatement(parse) {
    const root = document.getElementById("modal-root");
    const picked = [];
    root.querySelectorAll(".stmt-row").forEach(row => {
      const cb = row.querySelector(".stmt-inc");
      if (!cb || !cb.checked) return;
      const i = +row.getAttribute("data-i");
      const base = parse.rows[i];
      if (!base) return;
      const sel = row.querySelector(".stmt-cat");
      const descIn = row.querySelector(".stmt-desc-in");
      const amtIn = row.querySelector(".stmt-amt-in");
      const editedAmt = amtIn ? parseNum(amtIn.value) : base.amount;
      picked.push({
        date: base.date,
        description: (descIn && descIn.value.trim()) || base.description,
        category: sel && sel.value ? sel.value : base.category,
        amount: isFinite(editedAmt) && editedAmt !== 0 ? editedAmt : base.amount,
        currency: base.currency,
      });
    });
    UI.closeModal();
    if (!picked.length) { this.toast("Nothing selected"); return; }
    const res = Statements.commit(picked);
    let msg = "Imported " + res.added + " expense" + (res.added === 1 ? "" : "s");
    if (res.skipped) msg += " · " + res.skipped + " duplicate" + (res.skipped === 1 ? "" : "s") + " skipped";
    this.toast(msg);
    if (res.added) { App.budgetMonth = null; App.navigate("budget"); }
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
