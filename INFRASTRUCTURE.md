# Aardium.Shared — Build Infrastructure & Zero-Copy State

_As of 2026-07-01. This is the machine/checkout map for building & publishing the
zero-copy browser, plus where the still-unpublished server half lives._

## TL;DR

Zero-copy rendering into the browser has **two halves**:

| Half | What | Where | State |
|---|---|---|---|
| **Browser** | Patched Electron that can import a shared GPU texture (`openSharedTexture`) | `Aardium.Shared` package | ✅ **Published to NuGet 1.0.0** |
| **Server** | `SharedTextureTransfer` — exports the render target so the browser can import it | `aardvark.dom` master, **published in `Aardvark.Dom` (latest `1.2.0-prerelease0007`)** | ✅ **merged + published + end-to-end zero-copy tested on Linux** (2026-07-01; a y-flip was found & fixed, rest worked) |

**The zero-copy loop is closed on NuGet** — published `Aardium.Shared` browser +
published `Aardvark.Dom` server, end-to-end verified on Linux. Historical note: a demo
pinned to `Aardvark.Dom 1.2.0-prerelease0004` gets `using JpegTransfer` because that
release **predates the merge** — its server only ships Jpeg + SharedMemory. Fix = bump
to `1.2.0-prerelease0007` (or later). The browser being correct
(`aardvark.openSharedTexture` defined) is necessary but not sufficient — the server must
also offer the transfer. See **Status / what's left** below.

## Published packages (NuGet, all v1.0.0, 2026-06-30)

- `Aardium.Shared` (F# lib, ~33 KB) — download-on-first-use bootstrap, API-exact mirror of Aardium
- `Aardium.Shared-Linux-x64` (~124 MB)
- `Aardium.Shared-Win32-x64` (~152 MB)
- `Aardium.Shared-Darwin-arm64` (~122 MB) — **Developer ID signed + Apple-notarized + stapled**

All four proven: fresh-consumer e2e (`Aardium.Init()` downloads native off NuGet →
resolves binary → `IsInitialized=true`), and zero-copy composite proven per platform.

## Machines & checkouts

### airtop — orchestrator / lib build / publish (this box)
- `100.81.242.100` (Tailscale). Linux, RTX 5060.
- Checkouts under `~/projects/`:
  - **`Aardium.Shared`** — CANONICAL source, `master @ bc4726b` (github.com/aardvark-community/aardium.shared). Lib nupkg + all 4 gathered nupkgs in `bin/pack/`.
  - **`aardvark.dom`** — `model-trafo-stack-uniform @ a41fb81` (the `0004` published line; only Jpeg+SharedMemory transfers).
  - **`aardvark.dom-sharing`** — `zerocopy-texture-sharing @ 64b97c5` (the server-side SharedTexture code; **now merged into `aardvark.dom` master** — this working copy is historical).
- NuGet push key: `~/.config/puresg/nuget.key` (aardvark-community).
- Packed the lib nupkg and the Darwin nupkg (from the pulled signed tar.gz); pushed all 4.
- ⚠️ Cannot GPU-composite-prove here: the Claude Code bubblewrap sandbox starves the Electron GPU child of `dri_gbm.so`.

### hekla — Linux native build + zero-copy proof
- Checkout: **`~/aardium.shared`** — Aardium.Shared repo, `master @ eb6c70c` (early base + local Linux build edits; NOT the canonical bc4726b).
- Patched Electron zip: `~/aardium-electron-zip/electron-v42.4.1-linux-x64.zip`.
- Output nupkg: `~/aardium.shared/native/nupkg-out/Aardium.Shared-Linux-x64.1.0.0.nupkg`.
- Sharing/producer checkout: `~/aardvark.dom-sharing`.
- Proven: visible dma-buf zero-copy cube, ~55.6 fps producer-bound. Non-sandboxed GPU — this is the Linux proof box (not airtop).

### zephyrus — Windows native build + zero-copy proof
- Checkout: **`D:\aardium-shared-win`**.
- Output nupkg: `D:\aardium-shared-win\native\nuget\Aardium.Shared-Win32-x64.1.0.0.nupkg`.
- Proven: DXGI keyed-mutex composite.
- (Electron zip dir under the same tree; exact path not re-verified in this pass.)

### macbook — macOS native build + sign + notarize
- _Offline at doc-write time; paths below are from this session's confirmed use._
- Checkout: **`~/Projects/Aardium.Shared`** (capital P) — `master @ eb6c70c` base + local edits (macOS `--no-sandbox` GPU stub in `main.js`, and `appBundleId` sed'd into `build.js` for this build). NOT the canonical bc4726b.
- Patched Electron zip: `~/aardium-electron-zip/electron-v42.4.1-darwin-arm64.zip`.
- Producer checkout: `~/Development/aardvark.dom-sharing` (built to `bin/Release/net8.0/Demo.dll`).
- Signing:
  - **Developer ID Application: Georg Haaser (4LQPQ4H9LQ)** — the original cert+key were lost (forgotten `.p12` pw at `~/Development/signing-identities.p12`); **recreated fresh in Xcode 2026-06-30**, now in the login keychain.
  - Reference scripts: `~/Development/PRo3D/aardium/{signbuild.sh,app_notarizer.sh}`.
  - Notarization: Apple ID `gh@aardworx.at`, team `4LQPQ4H9LQ`, app-specific password named **"Aardium-Shared"**.
  - Signed `.app` → `tar -czf` (preserves signature+staple) → pulled to airtop → packed into the Darwin nupkg.

> **Note on checkout drift:** hekla and macbook build from stale `eb6c70c` base clones
> with local patches; the canonical, fully-committed source is **airtop `~/projects/Aardium.Shared @ bc4726b`** (= github master). Any rebuild should sync those clones to `bc4726b` first (it already contains the macOS stub, `appBundleId`, the C++20 patch, and all paket templates).

## Aardium.Shared repo

- **github.com/aardvark-community/aardium.shared**, `master @ bc4726b` (canonical = airtop clone).
- Build/packaging details: see `PACKAGING.md` and `README.md` in this repo.
- Per-platform native build via `@electron/packager` onto the PATCHED Electron 42.4.1 (`AARDIUM_ELECTRON_ZIP_DIR` → the `electron-v42.4.1-<platform>-<arch>.zip`).

## Status / what's left

- ✅ Server `SharedTextureTransfer` **merged to `aardvark.dom` master and published** (latest `Aardvark.Dom 1.2.0-prerelease0007`).
- ✅ **End-to-end zero-copy verified on Linux** (published Aardium.Shared browser + published server); a y-flip was found & fixed, the rest worked.
- ⬜ Demos: bump off `1.2.0-prerelease0004` (predates the merge → Jpeg) to `1.2.0-prerelease0007` or later.
- ⬜ Confirm end-to-end on Windows + macOS — the browser halves are proven per-platform, but the merged-server zero-copy path is only verified on Linux so far.

**Runtime gate:** `SharedTextureTransfer.IsSupported` requires a **Vulkan** runtime
(`SharedTextureTransfer.fs:694` → "runtime is not Vulkan"). The server must initialize
Vulkan, not GL, or it falls back to Jpeg even with the right packages.

## Cross-references

- Session memory: `aardvark-dom-aardium-shared.md` (packaging gotchas, macOS signing flow, GPU flag baking).
- Producer bug (separate, in `aardvark.dom-sharing`): intermittent startup crash
  `expected color attachment Colors ... Rgba8 but Bgra8` (`RemoteHtmlBackend.fs:90`).
