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
2. `cd native && npm install` — rebuilds `node-shared-mem` against Electron 42.4.1 (`electron-rebuild`).
3. `npm run build:{win32|linux|darwin}:{x64|arm64}` → bundles this app (`main.js` + the baked-in R2
   preload in `src/preload.js`) onto the patched Electron via `@electron/packager`, renames the
   product to `Aardium.Shared`, and produces `native/dist/Aardium.Shared-{Platform}-{arch}.tar.gz`
   (a directory on Windows).
4. **macOS only**: sign + notarize the `.app` **before** tar.gz'ing — reuse the translocate app's
   codesign/notarize setup on the macbook (cert in keychain, `build/entitlements.mac.plist`,
   `scripts/notarize.js`). Hardened runtime + the entitlements are required for the mach/IOSurface path.
5. **Pack the per-platform nupkg** with the tar.gz (or Windows dir) under `tools/`. Simplest:
   a `paket.template` (`type file`) referencing the artifact `==> tools`, then `dotnet paket pack`;
   or `nuget pack` a per-platform `.nuspec`.
6. **Publish**: `dotnet nuget push Aardium.Shared-{platform}-{arch}.<version>.nupkg -k <key> -s https://api.nuget.org/v3/index.json --skip-duplicate`
   (key at `~/.config/puresg/nuget.key`).

The lib package (`Aardium.Shared`) is packed from `src/Aardium.Shared` via its `paket.template`.
