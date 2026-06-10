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
| **Overview** | Net worth, asset composition, smart alerts, upcoming deposits, portfolio snapshot, global-percentile chip |
| **Accounts** | Checking / savings / investment accounts with APY — daily, monthly & yearly interest projections, live accrual since the last balance update, one-click "Capitalize" |
| **Credit Cards** | Limits, balances, utilization bars, statement-cut & payment-due countdowns with alerts (≤5 days for cut, ≤7 for payment, high-utilization warnings) |
| **Portfolio** | Stocks & ETFs with shares + price paid; edit the "Price now" column inline to refresh returns, allocation chart, best/worst positions |
| **Earnings** | Salaries & recurring income (monthly, every 15 days / quincena, every 14 days, weekly) mapped to receiving accounts, per-account interest engine, 30-day deposit timeline, 12-month projection chart |
| **Milestones** | Gamification: your estimated global percentile for net worth and total annual earnings, distance to the next "top X%" bracket, and 14 achievements for healthy financial habits |
| **Guide** | A built-in manual: how each page works, credit-card date mechanics, and how to keep your data safe |

## Keeping your finances safe

- **Local-first**: data never leaves the browser (`localStorage`, key `financeos_v1`).
- **PIN lock**: optional AES-256-GCM encryption at rest (PBKDF2-derived key, 150k iterations). The app boots to a lock screen; no PIN, no data.
- **Privacy mode**: one click blurs every amount on screen — for coffee shops and screen shares.
- **Backups**: export/import `.json` from the sidebar `⋯` menu; the app reminds you when a backup is older than 30 days. Exports are unencrypted — store them safely.

## Notes

- The currency switch (USD/MXN/EUR/GBP) changes display formatting and the USD conversion used for percentiles; it does not convert your balances.
- Global percentiles are rough, motivational estimates interpolated from public datasets (UBS/Credit Suisse Global Wealth Report, World Inequality Database, ~2024).
- Built with vanilla HTML/CSS/JS — no dependencies, no build step.
