# Provenance

Desktop app vendored from T3 Code (MIT), commit `d1d15c67`
(`https://github.com/pingdotgg/t3code.git`), 2026-09-13.
Excluded from upstream: `apps/mobile`, `apps/marketing`, `.repos/`, `.git/`.
Our marketing site lives in `website/` (separate concern, untouched).

## Paralla branding deltas (vs upstream)

- `scripts/build-desktop-artifact.ts`: `DESKTOP_APP_ID` → `ai.paralla.app`,
  `artifactName` → `Paralla-Setup-${version}-${arch}.${ext}`, staged
  `author` → `{ name: "Paralla" }` (electron-builder 26 stamps the exe
  CompanyName from `author.name`; `win.versionInfo` no longer exists in v26),
  staged `description` → Paralla tagline.
- `apps/desktop/package.json`: `productName` → `Paralla`.
- `assets/prod/t3-black-windows.ico`: content replaced with our
  `website/resources/Icon.ico` (same path — win icon staging, permission
  helpers, and runtime icon resolution all funnel through this file).
- `apps/desktop/src/app/DesktopEnvironment.ts`: `APP_BASE_NAME` → `Paralla`
  (window title + app name; data-dir intentionally still `t3code*` so
  existing state migrates), plus the two display-name test
  expectations in `DesktopAppIdentity.test.ts`.
- `appUserModelId` → `ai.paralla.app[.dev]`: Windows groups taskbar icons by
  this ID, so keeping `com.t3tools.t3code` showed the old T3 glyph from the
  icon cache even with a new exe icon.
- Upstream remote is not configured here; to pull updates:
  `git init`-free snapshot — re-copy from a fresh clone and re-apply the
  deltas above (confined to `scripts/build-desktop-artifact.ts`,
  `apps/desktop/package.json`, `DesktopEnvironment.ts`, one test file,
  the prod `.ico` asset, and display-string rebrand across web/desktop/server
  sources — identifiers like `t3code://`, `@t3tools`, `~/.t3` untouched).

## Root renames (shipping structure)

- `t3.json` → `paralla.json` (zero code refs; `$schema` URL kept functional).
- `oxlint-plugin-t3code/` → `oxlint-plugin-paralla/` (+ package name;
  refs updated in `pnpm-workspace.yaml`, `vite.config.ts`,
  `scripts/release-smoke.ts`, plugin `test/utils.ts`, lockfile importer key).
- Root `package.json` name → `paralla`; root `README.md` rewritten as the
  Paralla shipping front page.
- Kept as-is on purpose: `@t3tools/*` workspace names (renaming churns the
  lockfile + cross-manifest `workspace:*` refs for zero shipped effect),
  `LICENSE` (© T3 Tools Inc. retained per MIT terms), `assets/` sources,
  `docs/`, `infra/`, agent dot-dirs.

## Legacy

The previous hand-rolled Electron app (server + web + NSIS installer) was
removed. A source backup (no node_modules, no old .exe artifacts) is kept at
`../paralla-backup-20260913.tar.gz` (Desktop folder).
