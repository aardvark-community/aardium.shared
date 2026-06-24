# Aardium.Shared

[![Publish](https://github.com/aardvark-community/aardium.shared/actions/workflows/publish.yml/badge.svg)](https://github.com/aardvark-community/aardium.shared/actions/workflows/publish.yml)

A lightweight Electron browser with **true zero-copy GPU texture sharing**, mirroring the
[Aardium](https://github.com/aardvark-community/aardium) API exactly — only the name differs.

It ships a **patched Electron 42.4.1** whose compositor imports a GPU texture produced by an
Aardvark renderer with **no CPU copy** (Linux dma-buf / Windows DXGI keyed-mutex / macOS IOSurface)
and composites it in DOM order. The R2 JS bridge (`openSharedTexture` / `bindSharedTextureChannel`
/ `<aardvark-surface>`) is **baked into the browser**, so zero-copy works out of the box with no
per-app preload.

## Usage (identical to Aardium, under `Aardium.Shared`)

```fsharp
open Aardium.Shared

Aardium.Init()      // downloads the native patched browser on first use

Aardium.run {
    url "http://localhost:8888"
    width 1280
    height 720
}
```

The public API — `Aardium.Init` / `Run` / `StartOffscreenServer` / `IsInitialized`, the
`AardiumConfig` record and the `run { }` builder — is byte-for-byte the Aardium API; the only
differences are the namespace/package name (`Aardium.Shared`) and the native package names.

## How it ships

- **`Aardium.Shared`** (this lib) — the F# API, downloaded from NuGet.
- **`Aardium.Shared-{Win32|Linux|Darwin}-{x64|arm64}`** — the native patched browser, one NuGet
  package per platform, downloaded on first use into `LocalAppData/Aardium.Shared`.

See [`PACKAGING.md`](PACKAGING.md) for how the native packages are built from the patched Electron.
