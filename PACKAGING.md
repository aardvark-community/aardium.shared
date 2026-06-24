# Aardium.Shared — native browser packaging

The F# lib (`src/Aardium.Shared/Bootstrap.fs`, a verbatim Aardium mirror) downloads a
per-platform NuGet package on first use:

    Aardium.Shared-{platform}-{arch}        platform ∈ Win32|Linux|Darwin, arch ∈ x64|arm64

versioned to match the lib, from `nuget.org/api/v2/package/<name>/<version>`. It unzips the
nupkg to `<cache>/Aardium.Shared/{arch}/{version}/`, then on Linux/macOS untars
`tools/Aardium.Shared-{Platform}-{arch}.tar.gz`, then locates the binary via `binaryPaths`:
`{binaryName}`, `{arch}/{version}/{binaryName}`, `{arch}/{version}/tools/{binaryName}`.

`binaryName`:
- Win32  → `Aardium.Shared.exe`
- Linux  → `Aardium.Shared`
- Darwin → `Aardium.Shared.app/Contents/MacOS/Aardium.Shared`

## Required native nupkg layout (everything under `tools/`)
- **Linux**:   `tools/Aardium.Shared-Linux-x64.tar.gz`   → untars to `Aardium.Shared` + resources
- **macOS**:   `tools/Aardium.Shared-Darwin-arm64.tar.gz` → untars to `Aardium.Shared.app`
- **Windows**: `tools/<app dir contents>` (`Aardium.Shared.exe` + resources), no tar.gz

## Per-platform build (run on the machine that has the patched Electron build)
1. **Zip the patched Electron** as `electron-v42.4.1-{platform}-{arch}.zip` (the standard Electron
   dist layout — binary + `resources/` + `*.pak` + `locales/` + ...). Put it in a directory and
   `export AARDIUM_ELECTRON_ZIP_DIR=<dir>`.
   - ★ Build this zip with the Electron build's own **`ninja -C out/Release electron:electron_dist_zip`**
     target (→ `out/Release/dist.zip`), NOT a raw `zip` of `out/Release` (that tree is 60+GB of build
     intermediates with an unstripped 1.2GB binary; the dist target strips the binary and adds
     `chrome-sandbox`, `version`, and the license files that a plain build omits). Rename `dist.zip` →
     `electron-v42.4.1-{platform}-{arch}.zip`.
   - ★ CRC TRAP: the dist-zip action can write a **bad CRC for the `electron` member** if it runs in the
     same invocation as the strip step. ALWAYS `unzip -t` the zip after building (and after copying it
     between machines — though a matching md5 means the copy is fine and the source itself is bad). If it
     fails, just re-run the `electron_dist_zip` target once and re-test. A bad-CRC member extracts as raw
     bytes here but `@electron/packager` (and any strict unzip) REJECTS it at build time.
2. `cd native && npm run setup` — installs deps and rebuilds `node-shared-mem` against Electron 42.4.1.
   Use `npm run setup`, **not** a bare `npm install`: `node-shared-mem@2.1.0` uses C++20 `std::string::starts_with`
   but declares no C++ standard in its `binding.gyp`, so node-gyp's default (gnu++17 on gcc/clang, older on MSVC)
   fails to compile — and because the module has `gypfile:true`, npm auto-builds it during install *before* any
   fix can run, then rolls back the whole `node_modules`. `npm run setup` does
   `npm install --ignore-scripts` → `patch-package` (applies `patches/node-shared-mem+2.1.0.patch`, which adds
   `-std=c++20` for gcc/clang, `CLANG_CXX_LANGUAGE_STANDARD=c++20` for macOS, `/std:c++20` for MSVC) →
   `electron-rebuild node-shared-mem`. Works cold on all three platforms with no manual env. (`npm install` re-runs
   the same via `postinstall` once deps exist, but only `npm run setup` survives a clean checkout.)
3. `AARDIUM_SHARED_VERSION=1.0.0 npm run build:{win32|linux|darwin}:{x64|arm64}` → bundles this app
   (`main.js` + the baked-in R2 preload in `src/preload.js`) onto the patched Electron via
   `@electron/packager`, renames the product to `Aardium.Shared`, and produces
   `native/dist/Aardium.Shared-{Platform}-{arch}.tar.gz` (a directory on Windows).
   - ★ Set **`AARDIUM_SHARED_VERSION=1.0.0`** (or the matching lib version) — build.js otherwise calls
     `dotnet aardpack --parse-only` to derive the version, which fails if aardpack/the .NET tool isn't on
     the build box. The env var short-circuits that.
   - ★ The GPU/zero-copy switches are **baked into `main.js`** via `app.commandLine.appendSwitch(...)`,
     gated only by `process.platform` (Linux: `enable-features=Vulkan`, `use-vulkan=native`,
     `disable-gpu-sandbox`, `ignore-gpu-blocklist`). So the shipped browser does zero-copy with **no CLI
     flag and no env var** — and it MUST be baked, because Aardium's option parser rejects unknown CLI
     switches and `ELECTRON_EXTRA_LAUNCH_ARGS` does not reach the GPU child process. macOS/win32 switch
     stubs are in the same block.
   - ★ build.js sets an `ignore` list (dist/nuget/patches/scripts/electron-zip/…) so the packager does
     NOT bundle the build outputs into `app.asar`. Without it, `app.asar` balloons every rebuild (it would
     re-pack the previous `dist/`). Sanity check a fresh build: `app.asar` should be ~2MB, not 100s of MB.
4. **macOS only**: sign + notarize the `.app` **before** tar.gz'ing — reuse the translocate app's
   codesign/notarize setup on the macbook (cert in keychain, `build/entitlements.mac.plist`,
   `scripts/notarize.js`). Hardened runtime + the entitlements are required for the mach/IOSurface path.
5. **Pack the per-platform nupkg** with the tar.gz (or Windows dir) under `tools/`. Simplest:
   a `paket.template` (`type file`) referencing the artifact `==> tools`, then `dotnet paket pack`;
   or `nuget pack` a per-platform `.nuspec`.
6. **Publish**: `dotnet nuget push Aardium.Shared-{platform}-{arch}.<version>.nupkg -k <key> -s https://api.nuget.org/v3/index.json --skip-duplicate`
   (key at `~/.config/puresg/nuget.key`).

The lib package (`Aardium.Shared`) is packed from `src/Aardium.Shared` via its `paket.template`.
