### 1.1.0
- `gpu "<adapter-id>"` builder option pins the browser's GPU process to a chosen adapter (Windows: forwards Chromium's `--use-adapter-luid`), so it composites on the same physical GPU as the render device. Windows + Linux natives updated; macOS keeps the 1.0.0 binary (native version is decoupled from the lib version).

### 1.0.0
- Initial release. Mirrors the Aardium API (`Aardium.Init` / `Run` / `StartOffscreenServer`, `AardiumConfig`, the `run { }` builder) under namespace `Aardium.Shared`.
- Ships a patched Electron 42.4.1 with true zero-copy GPU texture sharing (Linux dma-buf / Windows DXGI keyed-mutex / macOS IOSurface). The R2 preload (`openSharedTexture` / `bindSharedTextureChannel` / `<aardvark-surface>`) is baked into the browser, so zero-copy works with no per-app preload.
- Native browser is downloaded on first use as per-platform NuGet packages `Aardium.Shared-{Win32|Linux|Darwin}-{x64|arm64}`, versioned to match the lib.
