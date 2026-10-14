# FinanceOS → App Store: iOS build guide

Everything below runs on a **Mac** (Apple Silicon or Intel) with Xcode. The
web app itself needs no changes — Capacitor wraps it in a native shell.

## 0. Prerequisites

- macOS with **Xcode 15+** installed (App Store) + command-line tools: `xcode-select --install`
- **Node 20+**: `node --version`
- An **Apple Developer account** ($99/year) at [developer.apple.com](https://developer.apple.com) — enroll as an Individual. Approval can take a day or two, so do this first.
- CocoaPods: `sudo gem install cocoapods` (Capacitor iOS uses it)

## 1. Create the native project (one time)

From the repo root:

```bash
npm install
npx cap add ios        # scaffolds ios/App/App.xcworkspace (needs macOS)
npx cap sync ios       # copies the web app into the native shell
```

Commit the `ios/` folder afterwards so the project is reproducible.

> Re-run `npx cap sync ios` every time you change the web code, before
> archiving a new build.

## 2. Xcode project settings

1. Open `ios/App/App.xcworkspace` (not `.xcodeproj`) in Xcode.
2. Select the **App** target → **Signing & Capabilities**:
   - Team: your Apple Developer team
   - Bundle Identifier: `com.financeos.app` (change it in `capacitor.config.ts` first if you want another ID — then `npx cap sync ios`)
   - Enable **Automatically manage signing**
3. **App icon**: in `ios/App/App/Assets.xcassets`, open `AppIcon` and drag in
   `appstore/icon-1024.png` — Xcode generates every required size from it.
   (App Store icons must have no transparency; this one is a flat PNG.)
4. **Launch screen**: the default Capacitor splash uses `backgroundColor`
   (`#0a0d0b`). For a branded launch, add a `LaunchScreen.storyboard` with
   the F/ mark centered — or ship the color-only splash for v1.0.
5. **Info.plist** — add a Boolean key (privacy manifest safe):
   - `ITSAppUsesNonExemptEncryption` = **NO**
   
   Why NO: the app uses only standard iOS HTTPS (ATS) plus WebCrypto
   AES-256-GCM to encrypt the user's own data at rest behind their PIN.
   That's the "encryption for data protection" exemption — no export
   license needed. (If you later add anything exotic, re-answer in App
   Store Connect.)

Notes specific to this app:

- The service worker (`sw.js`) is a no-op inside the native shell
  (custom `capacitor://` scheme) — harmless; **offline works better than on
  the web** because every asset ships inside the app bundle.
- `localStorage` persists in WKWebView; PIN encryption uses WebCrypto,
  fully supported.
- The file inputs (JSON import, CSV upload, statement PDF) use the iOS
  document picker — no extra plugins needed. Camera import isn't used.
- The Google Fonts `<link>` needs network on first launch; the app falls
  back to system fonts offline.

## 3. TestFlight

1. In Xcode: **Product → Archive**, then **Distribute App → App Store Connect**.
2. At [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **My Apps → + → New App**:
   - Platform: iOS, Name: `FinanceOS`, Bundle ID: `com.financeos.app`,
     SKU: anything (e.g. `financeos-ios-1`), primary language + price (Free).
3. Upload a build; when processing finishes, add yourself as an
   **internal tester** (TestFlight tab) — installs in minutes, no review.

Smoke-test on a real device: fresh install → pick a country → Load sample
data → walk every tab → set a PIN → kill and relaunch (lock screen shows).

## 4. Submit for review

Fill in the listing from `appstore/listing-en.md` (+ `listing-es.md` for the
Spanish localization), upload screenshots per `appstore/screenshot-shotlist.md`,
set the age rating (4+), and answer the privacy questionnaire as
**"Data Not Collected"** (nothing leaves the device; the two network calls —
ECB rates and Yahoo quotes via a CORS proxy — carry no personal data; see
`appstore/privacy-policy.md`).

Paste `appstore/listing-en.md`'s **review notes** into the "Notes for Review"
field: they tell the reviewer no login is needed and how to get demo data
in one tap.

Then **Submit for Review**. Typical first review: 24–48h.

## 5. Versioning

- Bump `version` in `package.json` and the Xcode target's **Version/Build**
  numbers for every submission (`npx cap sync` does not do this for you).
- Keep a `CHANGELOG.md` if you want release notes discipline.
