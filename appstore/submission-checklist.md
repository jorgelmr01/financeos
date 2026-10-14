# FinanceOS — App Store Submission Checklist

From finished code to **Ready for Sale**. Assumes the web app is complete and tested, and that you're building the iOS app with Capacitor.

---

## Phase 1 — Apple Developer enrollment
- [ ] Enroll in the **Apple Developer Program** ($99/year) at developer.apple.com — required to submit apps. Use the legal entity name you want shown as the seller.
- [ ] Enable **two-factor authentication** on the Apple ID tied to the enrollment.

## Phase 2 — Build the iOS app with Capacitor (on a Mac)

Prerequisites: macOS with Xcode (latest stable) and Node.js installed.

```bash
# 1. From the project root: install dependencies
npm ci

# 2. Add the iOS platform (first time only)
npx cap add ios

# 3. Sync the web build into the native project (re-run after every web change)
npm run build        # or whatever your build command is — Capacitor needs the built web assets
npx cap sync ios

# 4. Open in Xcode to configure signing
npx cap open ios
```

In Xcode (first time only):
- [ ] Select the `App` target → **Signing & Capabilities** → choose your Team, set a unique **Bundle Identifier** (e.g. `app.financeos.ios`). It must match the App ID you'll register in App Store Connect.
- [ ] Set **Version** to `1.0` and **Build** to `1`.
- [ ] In `Info.plist`, add the key **`ITSAppUsesNonExemptEncryption`** = `NO` (Boolean). Justification: the app uses only standard HTTPS/TLS for network calls and standard AES-256-GCM (via Web Crypto) for optional on-device PIN encryption — no proprietary cryptography. This answers the export-compliance question automatically.
- [ ] Confirm the app runs on a simulator and a real device (test the PIN lock, the "Update prices" quote refresh, and a statement-PDF import).

Archive and upload (either path works):
- [ ] **Xcode path:** Product → **Archive** → Distribute App → **App Store Connect** → Upload. (Simplest, recommended.)
- [ ] **CLI path:**
  ```bash
  cd ios/App
  xcodebuild -workspace App.xcworkspace -scheme App -configuration Release \
    -destination 'generic/platform=iOS' \
    -archivePath build/App.xcarchive archive
  xcodebuild -exportArchive -archivePath build/App.xcarchive \
    -exportOptionsPlist ExportOptions.plist -exportPath build/export
  ```
  (You'll need an `ExportOptions.plist` with `method = app-store` and your team ID.)

## Phase 3 — Create the App Store Connect record
- [ ] In App Store Connect → **My Apps** → **+** → New App: name **FinanceOS**, primary language, bundle ID (from Phase 2), SKU (anything unique, e.g. `financeos-ios-001`), user access.
- [ ] Under the version `1.0` record, fill in the listing from `listing-en.md` (and `listing-es.md` under the Spanish localization):
  - Name (30 chars), subtitle (30 chars), keywords (100 chars), promotional text (170 chars), description (4000 chars), What's New, support URL, privacy policy URL.
- [ ] Set **price: Free**, no in-app purchases.
- [ ] **Categories:** Primary `Finance`. (Secondary optional — `Business` is the closest fit; skip it if unsure.)
- [ ] Upload the **app icon** (1024 × 1024 px, no transparency, no rounded corners — repo has `icon-1024.png`; verify it meets this).
- [ ] Upload screenshots per `screenshot-shotlist.md` (6.9" and 6.5" sets, EN + ES).

## Phase 4 — Age rating
- [ ] Complete the rating questionnaire. Suggested outcome: **4+**.
- [ ] Justification: no objectionable content, no gambling, no social features, no user-generated content, no web browsing. The Wealth Builder sandbox and Learn games use clearly hypothetical scenarios — they are educational simulations, not gambling or real trading.

## Phase 5 — Privacy nutrition label
- [ ] Answer **"Data Not Collected"** for all categories.
- [ ] Justification (keep handy in case of questions): the app has no account, no analytics, no ads, and no server. All user data stays in on-device local storage. The only network calls are (a) Frankfurter API for ECB exchange rates — request contains only currency codes; (b) Yahoo Finance via a public CORS proxy — request contains only stock ticker symbols; (c) optional user-supplied Finnhub key, stored on-device. None of Apple's 14 data categories (contact info, financial info, location, identifiers, usage data, diagnostics, etc.) are collected by the developer.
- [ ] Make sure the **privacy policy URL is live** before submitting (`privacy-policy.md` → publish to your site; it is marked as needing a lawyer's review first).

## Phase 6 — Export compliance
- [ ] In App Store Connect, when asked about encryption: the `ITSAppUsesNonExemptEncryption = NO` key in Info.plist (Phase 2) covers this automatically.
- [ ] Rationale to keep on file: the app uses only standard HTTPS/TLS plus AES-256-GCM via the platform Web Crypto API for optional local data protection — standard, publicly available cryptography, no proprietary algorithms → exempt under EAR Category 5, Part 2 (mass-market / Note 4).

## Phase 7 — TestFlight
- [ ] The uploaded build appears in App Store Connect → TestFlight. Add **internal testers** (up to 100, no review needed) and install on real devices.
- [ ] Test the full loop: first launch → "Load sample data" → PIN lock on/off → quote refresh → PDF import → backup export.
- [ ] Fix anything found, bump the **Build** number, re-archive, re-upload.

## Phase 8 — Submit for review
- [ ] In the version page: select the tested build, confirm screenshots, pricing, and rating, then **Submit for Review**.
- [ ] Paste the **review notes** from `listing-en.md` into the "Notes" field (no login needed, "Load sample data", offline behavior, no personalized advice, free/no IAP).
- [ ] Typical review time: 24–48 hours.

## Phase 9 — After approval
- [ ] Release: choose **manual release** so you can press "Ready for Sale" when you're ready (safer than automatic for a v1.0).
- [ ] Monitor the App Store Connect analytics and crash reports in the first week.

---

## Common rejection risks for this app — and how they're mitigated

| Risk (Guideline) | Mitigation |
|---|---|
| **5.1.1 — Privacy policy / data collection.** Reviewers check that the label matches reality. | Label is "Data Not Collected" — true: no server, no analytics, no account. Privacy policy URL is live and says the same in plain language. |
| **4.2 — Minimum functionality / "demo" feel.** An empty finance app looks unfinished to a reviewer. | Review notes point to **"Load sample data"** on first launch — one tap gives a full, realistic dataset to exercise every feature. |
| **5.2.1 — Legal / financial services.** Apps that look like banks or brokerages get extra scrutiny. | Review notes state clearly: no money movement, no bank connections, no personalized advice. Learn games and Wealth Builder are labeled in-app as hypothetical/educational; wealth percentiles are disclosed as rough estimates from public datasets. |
| **2.1 — Crashes / broken links.** | TestFlight pass on real devices first; verify support and privacy URLs return 200 before submitting; no placeholder text anywhere in the app or listing. |
| **5.1.2 — Data use not matching description.** Quote refresh sends ticker symbols through a proxy — a reviewer could flag "financial info" leaving the device. | The privacy policy discloses exactly what is sent (ticker symbols only, no holdings or identity). This is public market data lookup, not collection of user financial info. |
| **Guideline 3.1 — Payments.** | Free app, no IAP, no subscriptions, no external payment links — nothing to trigger this. |
