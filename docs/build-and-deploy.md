# Build and deploy

DevTools ships two ways from one codebase:

| | Web app | Desktop app |
| --- | --- | --- |
| Lives at | https://tools.msar.me (GitHub Pages) | macOS, Windows, Linux installers (GitHub Releases, Homebrew) |
| Built by | `yarn build` | `yarn desktop:build` (Tauri, `src-tauri/`) |
| Shipped by | `.github/workflows/deploy.yml` on a `v*` tag (e.g. `v1.0.10`) | `.github/workflows/desktop.yml` on a `desktop-v*` tag |
| Updates | Service worker + `version.json` check | Tauri updater (`latest.json` on the latest GitHub Release) |

---

## 1. Versioning

The single source of truth is `version` in `package.json`. The desktop app reads it too (`"version": "../package.json"` in `src-tauri/tauri.conf.json`).

- The pre-commit hook (`.githooks/pre-commit`) bumps the **patch** version on every commit.
- `yarn version:minor` / `yarn version:major` for bigger bumps.
- Skip the bump for one commit: `SKIP_BUMP=1 git commit ...` or `yarn bump:skip` before committing.

---

## 2. Web app

### Develop and build

```bash
yarn install
```

```bash
yarn dev
```

```bash
yarn build
```

`yarn build` typechecks, then writes `dist/` with one HTML file per tool, the PWA service worker (`sw.js`) and `version.json`.

### Deploy

Pushing a release tag (e.g. `git tag v1.0.10 && git push origin v1.0.10`) runs `.github/workflows/deploy.yml`, which builds and publishes `dist/` to GitHub Pages. Open tabs notice the new `version.json` and offer a reload.

---

## 3. How desktop and web stay separate

Desktop-only code never reaches the web build:

- **`src-tauri/`**: the Rust shell (menubar item, global shortcut, updater, settings). The web build ignores it.
- **`src/desktop/`**: the web side of the desktop app (`bridge.ts` for the Tauri commands and events, `DesktopSettings.vue` for the gear button and settings dialog).
- **`__DESKTOP__`**: a compile-time flag defined in `vite.config.ts`. It's `true` only when the Tauri CLI runs the build (it sets `TAURI_ENV_PLATFORM`). Every use of `src/desktop/` sits behind it, so in the web build the code is removed and its chunks (`DesktopSettings`, `@tauri-apps/api`) aren't emitted or precached.
- **PWA**: the desktop build turns the service worker off (`VitePWA({ disable: isTauri })`) and skips `setupPwa()`. The web-only *Install* button is hidden in the desktop app.

Rules for new code:

- Put desktop-only UI and logic in `src/desktop/`. Import it only behind `if (__DESKTOP__)` or `__DESKTOP__ ? defineAsyncComponent(...) : null`.
- Don't import `@tauri-apps/*` anywhere outside `src/desktop/`.
- Check after changes: run `yarn build`, then this should print nothing:

```bash
grep -rlE "__TAURI|desktop://|DesktopSettings" dist/
```

---

## 4. Desktop app

### Features

- **Menubar item**: Open DevTools, Search Tools (shows the shortcut), Recent Tools, Launch at Login, Settings, Check for Updates, Quit.
- **Launcher shortcut**: `⌥⇧Space` (Alt+Shift+Space) by default. Opens tool search from anywhere; press again or Esc to hide. Change or turn off in Desktop settings.
- **Desktop settings** (gear in the header, or *Settings…* in the menubar): launcher shortcut, launch at login, keep running when closed, show in Dock (macOS), update options.
- **Updates**: checked on launch and every 6 hours. *Install updates automatically* downloads in the background and applies on the next restart.
- Single instance, remembered window size and position, exports saved to Downloads, external links open in the browser.

Settings are stored in `settings.json` in the app config folder (`~/Library/Application Support/dev.msar.devtools/` on macOS).

### Prerequisites

- Node 22 + Yarn (Corepack)
- Rust stable (`rustup`)
- Platform tools: see [Tauri prerequisites](https://tauri.app/start/prerequisites/). On Linux: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libxdo-dev`.

### Develop

```bash
yarn desktop:dev
```

Starts Vite on port 1420 and opens the app with hot reload. Rust changes rebuild and relaunch automatically.

### Build locally

A quick build without the signed update bundle:

```bash
yarn tauri build --config src-tauri/tauri.build-check.conf.json
```

A full release build (needs the signing key, see below):

```bash
TAURI_SIGNING_PRIVATE_KEY="$HOME/.tauri/devtools.key" yarn desktop:build
```

Output goes to `src-tauri/target/release/bundle/` (`.app`/`.dmg` on macOS, `.msi`/`.exe` on Windows, `.AppImage`/`.deb` on Linux). Add `--debug` for a faster, unoptimised build.

> After a desktop build, `dist/` holds the desktop variant (no service worker). Run `yarn build` again before testing or deploying the web app locally. CI always builds each from a clean checkout.

---

## 5. One-time setup for releases

### Updater signing key (required)

Updates are verified with a key pair. The **public** key is in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). The **private** key is at `~/.tauri/devtools.key` on the machine that created it.

1. **Back it up** (password manager or other secure storage). If it's lost, existing installs can never receive another update, and you'd have to ship a new key in a build users install manually.
2. Add it to the repo as the `TAURI_SIGNING_PRIVATE_KEY` secret (GitHub → Settings → Secrets and variables → Actions), or with the GitHub CLI:

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/devtools.key
```

3. If the key has a password, also add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. (The current key has none.)

To create a new key pair (only if starting over):

```bash
yarn tauri signer generate -w ~/.tauri/devtools.key
```

Then replace `pubkey` in `tauri.conf.json` with the contents of `~/.tauri/devtools.key.pub`.

### macOS signing and notarisation (optional)

Without it, macOS asks users to confirm the first launch (right-click → Open, or System Settings → Privacy & Security → Open Anyway). To sign and notarise, add these secrets from an Apple Developer account:

| Secret | What |
| --- | --- |
| `APPLE_CERTIFICATE` | Base64 of the exported Developer ID Application `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | Password of that `.p12` |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Name (TEAMID)` |
| `APPLE_ID` / `APPLE_PASSWORD` | Apple ID and an app-specific password |
| `APPLE_TEAM_ID` | Your team ID |

### Branch protection

`homebrew.yml` commits the updated cask straight to `main` using `GITHUB_TOKEN`. If `main` is protected, allow GitHub Actions to push, or change the workflow to open a pull request instead.

---

## 6. Releasing the desktop app

1. Make sure `main` has the changes and `package.json` has the version you want (say `1.0.12`).
2. Tag and push:

```bash
git tag desktop-v1.0.12
```

```bash
git push origin main desktop-v1.0.12
```

3. `desktop.yml` builds on macOS (Apple Silicon and Intel), Windows and Linux and creates a **draft** release *DevTools Desktop v1.0.12* with:
   - installers (`.dmg`, `.msi`, `.exe`, `.AppImage`, `.deb`)
   - signed update bundles (`.app.tar.gz`, `.sig`, …)
   - `latest.json`, the updater manifest
4. Check the draft on GitHub (edit the notes if you like; they appear in the in-app update toast).
5. **Publish** the release. This:
   - makes `releases/latest/download/latest.json` point at it, so installed apps find the update
   - runs `homebrew.yml`, which updates `Casks/devtools.rb` with the new version and DMG checksums and commits it to `main`

You can also start a release from **Actions → Desktop app → Run workflow** (with *Publish installers to a draft release* ticked); the tag is created from the version in `package.json`.

The tag must match `package.json`: the release tag is `desktop-v<version>`, and the cask's download URL is built from it.

### Build checks

Pull requests and pushes to `main` that touch `src-tauri/`, `src/desktop/` or the workflow run the same build on every OS without publishing. They skip the signed update bundles (`--config src-tauri/tauri.build-check.conf.json`), so they don't need the signing secret. Installers are attached to the run as artifacts for 7 days.

---

## 7. Homebrew

The cask lives in this repo at `Casks/devtools.rb`, so the repo doubles as a tap:

```bash
brew tap 4msar/tools https://github.com/4msar/tools
```

```bash
brew install --cask devtools
```

- `homebrew.yml` keeps `version` and both `sha256` values current. Until the first desktop release is published they're placeholders, so `brew install` fails until then.
- `auto_updates true` tells Homebrew the app updates itself, so `brew upgrade` skips it (unless `--greedy`).
- `brew uninstall --zap --cask devtools` also removes settings, caches and the login item.
- To refresh the cask for an existing release by hand: **Actions → Homebrew cask → Run workflow** with the tag (e.g. `desktop-v1.0.12`).

Moving to a dedicated tap later (`4msar/homebrew-tap`, so users run `brew install 4msar/tap/devtools`) means copying the cask there and pointing the workflow's checkout/push at that repo with a token that can write to it.

---

## 8. How updates work

1. The app requests `https://github.com/4msar/tools/releases/latest/download/latest.json` on launch (after ~10 s), every 6 hours, and on *Check for Updates…*.
2. If the version there is newer, it shows a toast (or downloads it straight away when *Install updates automatically* is on).
3. The downloaded bundle is checked against the public key before it's installed. Unsigned or tampered bundles are rejected.
4. A restart applies it. On Windows the installer runs in passive mode.

Notes:

- `releases/latest` ignores drafts and pre-releases. Nothing reaches users until you publish, and marking a release as pre-release keeps it from users.
- Linux: only the AppImage updates itself. `.deb` installs need a manual upgrade.
- Any other kind of GitHub Release in this repo would also become "latest". Keep releases desktop-only, or point `plugins.updater.endpoints` at a fixed URL.

---

## 9. Troubleshooting

| Problem | Fix |
| --- | --- |
| CI: *A public key has been found, but no private key* | The `TAURI_SIGNING_PRIVATE_KEY` secret is missing or empty. |
| Update check says *Couldn't check* | No published release yet, or `latest.json` is missing from it (release built without the signing key). |
| *Signature verification failed* | The release was signed with a different key than the `pubkey` in the installed app. |
| macOS: *"DevTools" can't be opened* | Unsigned build: right-click → Open, or sign and notarise (section 5). |
| Launcher shortcut doesn't register | Another app uses it. Pick a different one in Desktop settings. |
| Cask commit fails | `main` is protected; see Branch protection above. |
| Desktop UI shows up on the web | Something in `src/desktop/` was imported without a `__DESKTOP__` gate; see section 3. |
