# Privacy Policy — FinanceOS

> ⚠️ **Draft — needs a lawyer's review before publishing.** This policy was written to describe the app accurately in plain language, but it is not legal advice. Have a qualified attorney review it (especially for GDPR/CCPA wording and your contact details) before you put it on your website or link it in App Store Connect.

**Last updated:** [DATE — set before publishing]
**Applies to:** FinanceOS v1.0 and later (iOS app)

## The short version

FinanceOS does not collect your data. There is no account, no signup, no analytics, no ads, and no tracking. Everything you enter stays on your device. The only times the app talks to the internet are to fetch public market data (stock prices and exchange rates) — and those requests contain nothing personal about you.

## What we do NOT collect

We collect **zero** personal data. Specifically, we never collect, store, or transmit:

- Your name, email address, phone number, or any contact details
- Your location
- Device identifiers (no IDFA, IDFV, or advertising IDs)
- Financial account numbers, card numbers, or bank credentials — FinanceOS never connects to your bank
- Your balances, transactions, budgets, goals, or anything you type into the app
- Usage analytics, crash reports, or behavioral data
- Anything for advertising

There is simply no server on our end that could receive this information — the app is fully client-side.

## Where your data lives

Everything you enter in FinanceOS is stored **only on your device**, in the app's local storage. It is never uploaded, synced to a cloud, or shared with anyone. If you delete the app, your data is deleted with it.

- **Backups:** You can export your data as a `.json` file from the app's menu. That file is yours to keep — note that exported files are **not encrypted**, so store them somewhere safe.
- **No cloud backup:** FinanceOS does not back up your data to iCloud or any other service. Your export file is your backup.

## PIN lock and encryption

If you turn on the PIN lock in Settings, your on-device data is encrypted with **AES-256-GCM**. Your encryption key is derived from your PIN on your device (PBKDF2, 150,000 iterations) and never leaves it. We cannot see, reset, or recover your PIN — if you forget it, your encrypted data cannot be recovered by us or anyone else.

## Network requests the app makes

FinanceOS works fully offline. It only contacts the internet for two kinds of public market data, and neither request includes anything personal:

1. **Exchange rates** — daily rates from the European Central Bank via the free Frankfurter API (`api.frankfurter.dev`). The request contains only currency codes (e.g. "USD to MXN"). No personal data is sent.
2. **Stock and ETF quotes** — price and dividend data from Yahoo Finance, fetched through a public CORS proxy (`corsproxy.io`, falling back to `api.allorigins.win`). The request contains **only the ticker symbols** you asked to update (e.g. "AAPL", "VOO") — never your holdings, balances, or identity. Note: as with any internet request, the proxy operator technically receives your IP address along with the ticker symbols, but nothing that identifies you or your finances.
3. **Optional:** if you enter your own free Finnhub API key in Settings, quotes are fetched directly from Finnhub instead. The key is stored only on your device.

You can use the entire app without ever triggering these requests — simply don't tap "Update prices," and turn off automatic rate refreshes in Settings.

## What we do with your data

Nothing — because we never receive it. We do not sell, rent, share, or analyze any user data, because no user data ever reaches us.

## Your rights

Because we hold no data about you, there is nothing to access, correct, or delete on our servers. Your rights over your data are simple and absolute:

- **See everything:** it's all in the app, on your device.
- **Delete everything:** clear the app's data in Settings, or delete the app entirely.
- **Take it with you:** export a `.json` backup any time.

If privacy regulations (such as GDPR or CCPA) apply to you, note that as a "data controller" we process no personal data at all — the considerations above describe the full extent of our data handling.

## Children

FinanceOS collects no data from anyone, including children. The app contains no ads, no chat, no social features, and no way to contact other users.

## Changes to this policy

If this policy ever changes, we will post the new version at the URL below with a new "Last updated" date. Because the app collects no data and has no way to reach you, material changes will also be noted in the App Store "What's New" text.

## Contact

Questions about this policy or about privacy in FinanceOS:

- Email: [privacy@financeos.app — replace with a real monitored address]
- Support: https://financeos.app/support (placeholder — replace before publishing)

---

*Plain-language summary: your money details never leave your phone. We couldn't sell your data if we wanted to — we never see it.*
