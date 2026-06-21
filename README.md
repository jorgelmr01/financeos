# FinanceOS — Your complete financial command center

Track every corner of your financial life in one place: accounts with automatic interest calculations, credit cards with cut/payment alerts, a stock & ETF portfolio with live return math, and an earnings dashboard that maps every income stream to the exact account and date it hits.

**100% private by design** — FinanceOS is a fully client-side app. No server, no signup, no tracking. Your data lives only in your browser, optionally encrypted with a PIN.

## Run it

Open `index.html` in any modern browser, or serve the folder:

```
npx serve .
```

> PIN-lock encryption uses the Web Crypto API, which requires a secure context (`https://`, `localhost`, or a local file). Everything else works anywhere.

## Install on your iPhone (or Android)

FinanceOS is an installable **PWA** — add it to your home screen and it launches full-screen like a native app, with its own icon, offline support, and no browser chrome.

It needs to be reachable over **HTTPS** for install + offline to work. Two easy ways:

- **GitHub Pages (recommended):** in the repo, *Settings → Pages → Deploy from branch → `main` / root*. Open the published `https://…github.io/…` URL on your phone.
- **Local network:** run `npx serve .` on your computer, then on your iPhone (same Wi‑Fi) open `http://<your-computer-ip>:3000`. *(Add-to-home-screen works, but full offline caching needs HTTPS.)*

**On iPhone (Safari):** open the URL → tap the **Share** button → **Add to Home Screen** → **Add**. Launch it from the new “FinanceOS” icon — it opens edge-to-edge, status bar and all.

**On Android (Chrome):** open the URL → menu **⋮** → **Install app** / **Add to Home screen**.

Your data still lives only on the device, in that browser's storage — installing doesn't change the privacy model.

## Features

| Page | What it does |
|---|---|
| **Today** | A single **Financial Health score (0–100)** that rolls cash flow, debt, safety net and growth into one honest number, a "what needs attention now" feed, net-worth (with daily change) and history chart, asset composition, upcoming deposits and a one-tap **Log expense** |
| **Accounts** | Checking / savings / investment accounts with APY and a flexible interest schedule — **daily, monthly (pick the day), quarterly, annually, every N days, or a fixed term** (CDs / Cetes / plazo fijo that pay at maturity). FinanceOS **auto-credits interest to balances on their schedule** (net of tax) so net worth and projections stay current — toggle off in Settings. Live accrual since the last balance update, one-click "Capitalize", and a live payout preview in the form |
| **Credit Cards** | Limits, balances, utilization bars, statement-cut & payment-due countdowns with alerts (≤5 days for cut, ≤7 for payment, high-utilization warnings) |
| **Portfolio** | Stocks & ETFs with shares + price paid in the listing's currency; **live quotes & dividends** (no key needed) or edit prices inline; allocation chart, **return-by-position chart**, after-tax returns, best/worst. **Tap any position** for a detail view with a **price-evolution chart** (1M/6M/1Y/5Y) and full per-stock stats |
| **Earnings** | Salaries & recurring income (monthly, every 15 days / quincena, every 14 days, weekly) with **gross/net + tax-rate handling**, mapped to receiving accounts; interest & dividend engines, 30-day deposit timeline, 12-month net projection chart |
| **Budget** | Expenses by category with a **spending-health score** (savings rate · runway · needs-vs-wants), insights & advice, a 50/30/20 breakdown and per-category budgets. Fill a **downloadable spreadsheet template** (or have your AI fill it from your statements), or **import a statement PDF directly** *(Beta — Amex/Klar/Openbank/Santander, parsed 100% on-device, with on-device OCR for scanned statements)* — re-uploads never duplicate rows |
| **Milestones** | Gamification: your estimated global percentile for net worth and gross annual earnings, distance to the next "top X%" bracket, and 19 achievements for healthy financial habits |
| **Learn** | Four interactive scenario games (~3 min each) on paychecks, credit cards, market crashes and inflation — every choice shows its 10-year impact — plus **Wealth Builder**, a 20-year investing sandbox with random crashes, emergencies and a mattress-saver baseline to beat. Scores earn XP and levels. |
| **Guide** | A built-in manual: how each page works, credit-card date mechanics, currencies, taxes, and how to keep your data safe |

## Multi-currency & live data

- Every account, card, position and income stream carries its **own currency** (USD/MXN/EUR/GBP) — mix Mexican bank accounts with US stocks freely.
- Totals convert to your display currency using **daily ECB exchange rates** (Frankfurter API, no key needed), refreshed automatically with an offline fallback.
- **Live stock/ETF prices and annual dividends with no API key**: "↻ Update prices" pulls quotes and the actual dividend payments of the trailing 12 months (Yahoo Finance data via a public CORS proxy — it sees only ticker symbols, never your finances). Works for ETFs and stocks alike. An optional free [Finnhub](https://finnhub.io/register) key adds a direct quote source.
- Net worth history is snapshotted daily in USD, so switching display currency never distorts the chart.

## Budgeting without the data entry

Most people quit budgeting apps because logging every expense is miserable. FinanceOS skips that:

1. **Download the template** (Budget → Template) — a spreadsheet with columns `Date, Description, Category, Amount, Currency`, embedded instructions, and the full category list. It opens in Excel, Google Sheets or Numbers.
2. **Fill it** however you like — by hand, or paste it together with your **credit-card statement** into ChatGPT/Claude and ask it to return the rows. The exact prompt is one click away in the Upload dialog.
3. **Upload the CSV.** Every row is fingerprinted (date + amount + category + description + currency), so importing the **same file twice, or overlapping months, never creates duplicates** — while genuine same-day repeats are still kept.

### Or just drop in your statement PDF *(Beta)*

Skip the spreadsheet entirely: **Budget → Import PDF** reads a credit-card or bank statement and turns it into expenses for you. It's tuned for **American Express**, **Klar**, **Openbank** and **Santander** statements, with a generic reader for other banks. You get a **review screen** — every transaction with a guessed category, payments and transfers pre-unchecked, amounts you can verify — and nothing is saved until you press *Import* (with the same duplicate-proof fingerprinting).

Statements print their own charge total, so the review screen **reconciles** what it read against that figure: a green "adds up" badge when they match, or a heads-up when they don't — a row may be missing or misread. It's the safety net that matters most for scanned imports.

The whole thing runs **entirely on your device**: the PDF is parsed in your browser with a self-hosted copy of [PDF.js](https://mozilla.github.io/pdf.js/) (bundled under `/vendor`). The file is **never uploaded, never sent to a server, and never stored anywhere but on your device** — exactly what you'd want for a financial statement.

Some banks (e.g. **Santander**) issue statements as **scanned images** with no text layer. FinanceOS reads those too, with **on-device OCR** — a self-hosted, lazily-loaded copy of [Tesseract.js](https://tesseract.projectnaptha.com/) (WebAssembly) renders each page and recognizes the text locally. It's slower (a progress bar shows which page it's on) and still 100% private — nothing leaves the device. Because OCR can occasionally misread a digit, scanned imports show a reminder to double-check amounts on the review screen.

You then get a **spending-health score (0–100)** built from your savings rate, how many months your liquid assets could cover spending (runway), and your **needs-vs-wants** split, plus plain-language insights, a 50/30/20 view, biggest-category callouts, month-over-month trends, and optional **per-category monthly budgets**. Two achievements (*Budgeter*, *Frugal*) tie it into the milestones.

Flip the Budget page to **Trends** for a WHOOP-style historic view: this month measured against your **trailing 3-month average** (spending, savings rate, score), **monthly spending and score charts** (with average and budget reference lines), a **savings-rate line**, the **categories you're spending more/less on** versus your recent baseline, and **streaks** (months saving in a row, months with every budget met, best savings month).

## Taxes

Declare each income stream as **gross** (with an effective withholding rate) or **net** — projections, timeline and charts always show what actually lands. Global rates for **interest, dividends, and capital gains** live in Settings and flow through every projection in the app.

## Keeping your finances safe

- **Local-first**: data never leaves the browser (`localStorage`, key `financeos_v1`).
- **PIN lock**: optional AES-256-GCM encryption at rest (PBKDF2-derived key, 150k iterations). The app boots to a lock screen; no PIN, no data.
- **Privacy mode**: one click blurs every amount on screen — for coffee shops and screen shares.
- **Backups**: export/import `.json` from the sidebar `⋯` menu; the app reminds you when a backup is older than 30 days. Exports are unencrypted — store them safely.

## Appearance

Two hand-tuned themes, toggled with the ☀/☾ button in the sidebar: **"ledger after midnight"** (dark, default) and **"morning ledger"** (warm paper light mode). Credit cards stay dark in both — like the cards in your wallet.

## Notes

- The currency switch (USD/MXN/EUR/GBP) changes display formatting and the USD conversion used for percentiles; it does not convert your balances.
- Global percentiles are rough, motivational estimates interpolated from public datasets (UBS/Credit Suisse Global Wealth Report, World Inequality Database, ~2024).
- Built with vanilla HTML/CSS/JS — no dependencies, no build step.
- The money-critical logic (interest schedules, amount/date parsing, dedup, statement parsing & reconciliation) has a headless test suite: run `node test/money.test.mjs`. In a finance app the one bug you can't ship is a wrong number.
