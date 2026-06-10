# FinanceOS — Your complete financial command center

Track every corner of your financial life in one place: accounts with automatic interest calculations, credit cards with cut/payment alerts, a stock & ETF portfolio with live return math, and an earnings dashboard that maps every income stream to the exact account and date it hits.

**100% private by design** — FinanceOS is a fully client-side app. No server, no signup, no tracking. Your data lives only in your browser, optionally encrypted with a PIN.

## Run it

Open `index.html` in any modern browser, or serve the folder:

```
npx serve .
```

> PIN-lock encryption uses the Web Crypto API, which requires a secure context (`https://`, `localhost`, or a local file). Everything else works anywhere.

## Features

| Page | What it does |
|---|---|
| **Overview** | Net worth, **net worth history chart**, asset composition, smart alerts, upcoming deposits, portfolio snapshot, global-percentile chip |
| **Accounts** | Checking / savings / investment accounts with APY — daily, monthly & yearly interest projections (net of tax), live accrual since the last balance update, one-click "Capitalize" |
| **Credit Cards** | Limits, balances, utilization bars, statement-cut & payment-due countdowns with alerts (≤5 days for cut, ≤7 for payment, high-utilization warnings) |
| **Portfolio** | Stocks & ETFs with shares + price paid in the listing's currency; **live quotes & dividends** via a free Finnhub key (or edit prices inline), allocation chart, after-tax returns, best/worst positions |
| **Earnings** | Salaries & recurring income (monthly, every 15 days / quincena, every 14 days, weekly) with **gross/net + tax-rate handling**, mapped to receiving accounts; interest & dividend engines, 30-day deposit timeline, 12-month net projection chart |
| **Milestones** | Gamification: your estimated global percentile for net worth and gross annual earnings, distance to the next "top X%" bracket, and 16 achievements for healthy financial habits |
| **Guide** | A built-in manual: how each page works, credit-card date mechanics, currencies, taxes, and how to keep your data safe |

## Multi-currency & live data

- Every account, card, position and income stream carries its **own currency** (USD/MXN/EUR/GBP) — mix Mexican bank accounts with US stocks freely.
- Totals convert to your display currency using **daily ECB exchange rates** (Frankfurter API, no key needed), refreshed automatically with an offline fallback.
- **Live stock/ETF prices and annual dividends** via [Finnhub](https://finnhub.io/register) — paste a free API key in Settings and hit "↻ Update prices" on the Portfolio page.
- Net worth history is snapshotted daily in USD, so switching display currency never distorts the chart.

## Taxes

Declare each income stream as **gross** (with an effective withholding rate) or **net** — projections, timeline and charts always show what actually lands. Global rates for **interest, dividends, and capital gains** live in Settings and flow through every projection in the app.

## Keeping your finances safe

- **Local-first**: data never leaves the browser (`localStorage`, key `financeos_v1`).
- **PIN lock**: optional AES-256-GCM encryption at rest (PBKDF2-derived key, 150k iterations). The app boots to a lock screen; no PIN, no data.
- **Privacy mode**: one click blurs every amount on screen — for coffee shops and screen shares.
- **Backups**: export/import `.json` from the sidebar `⋯` menu; the app reminds you when a backup is older than 30 days. Exports are unencrypted — store them safely.

## Notes

- The currency switch (USD/MXN/EUR/GBP) changes display formatting and the USD conversion used for percentiles; it does not convert your balances.
- Global percentiles are rough, motivational estimates interpolated from public datasets (UBS/Credit Suisse Global Wealth Report, World Inequality Database, ~2024).
- Built with vanilla HTML/CSS/JS — no dependencies, no build step.
