/* FinanceOS — controller: routing, events, init */
"use strict";

const App = {
  page: "overview",

  PAGE_META: {
    overview:   { title: "Overview",     actions: "" },
    accounts:   { title: "Accounts",     actions: '<button class="btn primary" data-action="add-account">+ Add account</button>' },
    cards:      { title: "Credit Cards", actions: '<button class="btn primary" data-action="add-card">+ Add card</button>' },
    portfolio:  { title: "Portfolio",    actions: '<button class="btn" data-action="refresh-prices">↻ Update prices</button><button class="btn primary" data-action="add-holding">+ Add position</button>' },
    earnings:   { title: "Earnings",     actions: '<button class="btn primary" data-action="add-income">+ Add income stream</button>' },
    milestones: { title: "Milestones",   actions: "" },
    learn:      { title: "Learn",        actions: "" },
    guide:      { title: "Guide",        actions: "" },
  },

  navigate(page) {
    this.page = page;
    document.querySelectorAll(".nav-item").forEach(b =>
      b.classList.toggle("active", b.dataset.page === page));
    this.render();
    window.scrollTo({ top: 0 });
  },

  render() {
    if (!Store.state) return; // locked — nothing to render yet
    const meta = this.PAGE_META[this.page];
    document.getElementById("page-title").textContent = meta.title;
    document.getElementById("topbar-actions").innerHTML = meta.actions;
    document.getElementById("page").innerHTML = Pages[this.page]();

    const t = computeTotals();
    document.getElementById("sidebar-networth").textContent = fmtMoney(t.netWorth, { compact: true });

    const today = new Date();
    document.getElementById("page-date").textContent =
      today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    // privacy mode + lock button visibility
    document.body.classList.toggle("privacy", !!Store.state.settings.privacy);
    const eye = document.getElementById("privacy-btn");
    if (eye) eye.classList.toggle("active", !!Store.state.settings.privacy);
    const lockBtn = document.getElementById("lock-btn");
    if (lockBtn) lockBtn.style.display = Store.pinEnabled ? "" : "none";

    // theme
    const light = Store.state.settings.theme === "light";
    document.body.classList.toggle("light", light);
    const themeBtn = document.getElementById("theme-btn");
    if (themeBtn) {
      themeBtn.textContent = light ? "☾" : "☀";
      themeBtn.title = light ? "Switch to dark mode" : "Switch to light mode";
    }

    Store.recordSnapshot();
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
        const taxI = (Store.state.settings.tax && Number(Store.state.settings.tax.interest)) || 0;
        const accruedNet = accruedInterest(a) * (1 - taxI / 100);
        Store.update("accounts", id, {
          balance: Math.round((Number(a.balance) + accruedNet) * 100) / 100,
          balanceAsOf: toISO(todayMid()),
        });
        UI.toast("Added " + fmtMoneyIn(accruedNet, a.currency) + " of net accrued interest to " + a.name);
        this.render();
        break;
      }

      case "refresh-prices": {
        if (!(Store.state.settings.finnhubKey || "").trim()) {
          UI.settingsForm();
          UI.toast("Paste a free Finnhub API key first — get one at finnhub.io/register");
          break;
        }
        if (!Store.state.holdings.length) { UI.toast("No positions to update yet"); break; }
        UI.toast("Fetching live prices…");
        Store.fetchQuotes().then(res => {
          if (res.error === "bad-key") UI.toast("Finnhub rejected the key — check it in Settings");
          else if (res.error) UI.toast("Price update failed — are you online?");
          else {
            let msg = "Updated " + res.prices + " price" + (res.prices === 1 ? "" : "s") + ", " + res.divs + " dividend" + (res.divs === 1 ? "" : "s");
            if (res.failed.length) msg += " · no quote for " + res.failed.join(", ");
            UI.toast(msg);
            if (res.metricBlocked) {
              UI.toast("Your Finnhub plan doesn't expose dividend data — set div/share manually via ✎ on each position");
            } else if (res.noDiv && res.noDiv.length) {
              UI.toast("No dividend data for " + res.noDiv.join(", ") + " — common for ETFs; set div/share manually via ✎");
            }
          }
          App.render();
        });
        break;
      }

      case "app-settings": UI.settingsForm(); break;

      case "refresh-fx":
        UI.toast("Refreshing exchange rates…");
        Store.refreshFx(true).then(ok => {
          UI.toast(ok ? "Exchange rates updated (ECB)" : "Couldn't reach the rate service — using cached rates");
          App.render();
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

      case "add-holding": UI.holdingForm(); break;
      case "edit-holding": UI.holdingForm(Store.find("holdings", id)); break;
      case "del-holding": {
        const h = Store.find("holdings", id);
        UI.confirm("Delete position?", "Remove " + esc(h.symbol) + " (" + fmtNum(h.shares) + " shares) from your portfolio?", () => {
          Store.remove("holdings", id);
          UI.toast("Position deleted");
          App.render();
        });
        break;
      }

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
            UI.toast("Sample data loaded — explore away");
            App.render();
          });
        } else {
          Store.loadSample();
          UI.toast("Sample data loaded — explore away");
          this.render();
        }
        break;

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

    /* global click delegation */
    document.addEventListener("click", e => {
      const sw = e.target.closest(".swatch");
      if (sw) {
        sw.parentElement.querySelectorAll(".swatch").forEach(x => x.classList.remove("sel"));
        sw.classList.add("sel");
        sw.parentElement.querySelector('input[name="color"]').value = sw.dataset.swatch;
        return;
      }
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

    /* inline price edits (portfolio) */
    document.addEventListener("change", e => {
      const input = e.target.closest("[data-price-id]");
      if (input) {
        const v = parseFloat(input.value);
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
          UI.toast("Data imported");
          this.render();
        } catch (err) {
          UI.toast("Import failed — not a valid FinanceOS backup");
        }
      };
      reader.readAsText(f);
      e.target.value = "";
    });

    /* escape closes modal */
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") UI.closeModal();
    });

    if (res.locked) this.showLock();
    else this.render();

    // refresh ECB rates in the background (daily); re-render if they changed
    if (Store.state) {
      Store.refreshFx().then(changed => { if (changed) this.render(); });
    }
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
