# Scanner

An iOS document scanner built with Expo / React Native.

- **Auto edge detection + auto-capture + multi-page** via Apple VisionKit
  (`modules/document-scanner`, a small local native module).
- **Three scan modes** — Black & White Document, Colour Document, Colour Photo —
  applied with a GPU colour grade (`src/lib/imageProcessing.ts`). The look of
  each mode is pure JS and can be changed with an OTA update.
- **Portrait / landscape** is detected per page from its aspect ratio; the PDF
  page is sized to match, and each page has a manual **Rotate** control.
- **Review** screen: full-screen preview, **Retake**, **Rotate**, reorder, and
  **Delete** per page; **Add pages** appends more.
- **Name & Send**: name the file, then **Email** (Mail compose sheet with the PDF
  attached), **Save to Files**, or **Share via WhatsApp** (iOS share sheet — see
  note below), plus a generic share option.
- **OTA updates** via EAS Update — push JS changes without rebuilding.

## How the pieces fit

| Concern | Where | OTA-updatable? |
| --- | --- | --- |
| Scanner camera UI, edge detection, auto-capture | `modules/document-scanner` (Swift / VisionKit) | No — needs a rebuild |
| Colour modes, review, naming, PDF, export, navigation | `src/**` (JS) | **Yes** |
| App identity, permissions, native deps | `app.json`, `package.json` | No — needs a rebuild |

> **WhatsApp:** iOS has no public URL scheme to attach a file directly to a
> WhatsApp chat. The button opens the iOS share sheet with the PDF attached;
> pick WhatsApp there, then choose the chat. The app checks that WhatsApp is
> installed and disables the button if it is not.

---

## One-time setup

### 1. Link the project to EAS (for OTA updates)

You need a free [expo.dev](https://expo.dev) account (already logged in).

```bash
cd ios-scanner
npm install
npx eas-cli login          # or set EXPO_TOKEN
npx eas-cli init           # creates the EAS project, writes extra.eas.projectId
npx eas-cli update:configure   # sets updates.url in app.json
```

After this, `app.json` has your real `projectId` and
`updates.url` (`https://u.expo.dev/<projectId>`). Commit that change.

### 2. Add the Expo token as a GitHub secret

So the OTA workflow can publish:

1. expo.dev → **Account settings → Access tokens → Create token**.
2. In the GitHub repo → **Settings → Secrets and variables → Actions → New
   repository secret**: name `EXPO_TOKEN`, value = the token.

### 3. Push to GitHub

```bash
git init
git add -A
git commit -m "Initial scanner app"
gh repo create ios-scanner --public --source . --push
```

---

## Building the IPA (unsigned, for sideloading)

The **Build unsigned IPA** GitHub Action runs on a macOS runner, does
`expo prebuild` + `pod install` + `xcodebuild archive` with **code signing
disabled**, and packages the `.app` into an `.ipa`.

- **Trigger manually:** GitHub → **Actions → Build unsigned IPA → Run workflow**.
- **Trigger by tag** (also creates a Release with the IPA attached):

  ```bash
  git tag v1.0.0
  git push origin v1.0.0
  ```

Download the IPA from the workflow run's **Artifacts** (`scanner-unsigned-ipa`)
or from the Release.

### Sideloading

The IPA is **unsigned**. Install it with a tool that signs on-device with your
Apple ID:

- **SideStore / AltStore** (on-device refresh, no computer needed after setup), or
- **Sideloadly** (from a computer).

Free Apple IDs: the app runs for 7 days, then re-install. A paid Apple Developer
account extends this to 1 year.

### Download to the iPhone over WiFi

`dist-server/` is a zero-dependency LAN server (like the Till APK one, but on
port **8010** so both can run together):

```bash
npm run serve:pull   # pull the newest CI-built IPA into dist-server/ (needs gh)
npm run serve         # serve it; prints the http://<LAN-IP>:8010 URL
```

Open that URL in Safari on the iPhone, tap to download the `.ipa` (lands in
Files), then import it into SideStore / AltStore / TrollStore / Sideloadly.

---

## Making changes

### JS-only change (screens, colour modes, PDF layout, export logic)

```bash
# edit files under src/
git commit -am "Tweak colour-doc contrast"
git push            # ota-update.yml publishes to the "production" channel
```

The installed app picks up the update on its next launch and shows a banner to
restart. Or publish by hand: `npm run ota`.

### Native change (new native module, permissions, app icon, SDK bump)

Bump `version` in `app.json` (this is the `runtimeVersion`), then build a new
IPA and re-sideload. OTA updates only apply to a matching runtime version.

---

## Local development

```bash
npm start                       # Metro (dev client)
```

You cannot run the VisionKit scanner in the iOS Simulator (no camera). Use a
dev build on a real device: `npx expo run:ios --device`.

## Project layout

```
App.tsx                     navigation + providers
src/
  screens/                  Home, Review, Export
  components/               Button / overlay / mode sheet
  lib/
    scanFlow.ts             scan -> process -> persist orchestration
    imageProcessing.ts      Skia colour grade + rotate + orientation
    pdf.ts                  pdf-lib multi-page assembly
    export.ts               Mail / share sheet / WhatsApp
    storage.ts              on-device document library (expo-file-system)
    updates.ts              EAS Update check
  state/DocsContext.tsx     in-memory document list
modules/document-scanner/   local Expo native module (VisionKit)
.github/workflows/
  build-ipa.yml             unsigned IPA on macOS runner
  ota-update.yml            eas update on push to main
```
