const { packager } = require('@electron/packager');
const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.join(__dirname, '..');

async function main() {
  try {
    // 1. Version: explicit env wins, else aardpack parse of RELEASE_NOTES, else package.json
    console.log('[1/2] Determining application version...');
    let version = process.env.AARDIUM_SHARED_VERSION;
    if (!version) {
      try {
        version = execSync('dotnet aardpack --parse-only', { encoding: 'utf8' })
          .trim().split('\n').filter(s => s.trim()).pop().trim();
      } catch (e) {
        version = require('../package.json').version;
      }
    }
    execSync(`npm version ${version} --no-git-tag-version --allow-same-version`, { stdio: 'inherit' });
    console.log(`Version: ${version}`);

    // 2. Target platform/arch from args (e.g. --platform=linux --arch=x64)
    const args = process.argv.slice(2).reduce((acc, arg) => {
      const [key, val] = arg.replace(/^--/, '').split('=');
      acc[key] = val;
      return acc;
    }, {});
    const platform = args.platform || process.platform;
    const arch = args.arch || process.arch;
    console.log(`[2/2] Packaging Aardium.Shared for ${platform} (${arch})...`);

    const year = process.env.AARDIUM_SHARED_YEAR || String(new Date().getFullYear());

    const opts = {
      dir: rootDir,
      out: path.join(rootDir, 'dist'),
      platform,
      arch,
      overwrite: true,
      // `dir` is native/ and `out` is native/dist, so without an ignore the
      // packager bundles dist/ (the previous build!), nuget/, patches/, the
      // electron-zip, and other non-runtime cruft into app.asar — ballooning it
      // every rebuild (2MB → 100s of MB). Keep only the app runtime.
      ignore: [
        /^\/dist($|\/)/,
        /^\/nuget($|\/)/,
        /^\/patches($|\/)/,
        /^\/scripts($|\/)/,
        /^\/build($|\/)/,
        /^\/\.git($|\/)/,
        /^\/package-lock\.json$/,
        /^\/electron-zip($|\/)/
      ],
      icon: path.join(rootDir, 'aardvark'),
      appCopyright: `Copyright (C) ${year} Aardvark Platform Team. All Rights Reserved.`,
      win32metadata: {
        FileDescription: 'Aardium.Shared',
        ProductName: 'Aardium.Shared',
        OriginalFilename: 'Aardium.Shared.exe'
      }
    };

    // Use our PATCHED zero-copy Electron rather than the vanilla download.
    // The build machine zips its patched Electron build as
    //   electron-v42.4.1-<platform>-<arch>.zip   (standard Electron dist layout)
    // into a directory and points AARDIUM_ELECTRON_ZIP_DIR at it.
    if (process.env.AARDIUM_ELECTRON_ZIP_DIR) {
      opts.electronZipDir = process.env.AARDIUM_ELECTRON_ZIP_DIR;
      console.log(`Using patched Electron from ${opts.electronZipDir}`);
    } else {
      console.warn('WARNING: AARDIUM_ELECTRON_ZIP_DIR not set — packager will download VANILLA Electron (NO zero-copy patch).');
    }

    const appPaths = await packager(opts);
    console.log(`Successfully packaged Aardium.Shared at:\n`, appPaths.join('\n'));
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

main();
