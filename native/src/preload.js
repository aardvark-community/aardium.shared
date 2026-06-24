const electron = require('electron')
const remote = require('@electron/remote')
const shm = require('node-shared-mem')

electron.remote = remote;
var aardvark = {};
document.aardvark = aardvark;
window.aardvark = aardvark;

aardvark.openFileDialog = function (config, callback) {
	if (!callback) callback = config;
	electron.remote.dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] }).then(e => callback(e.filePaths));
};

aardvark.moveWindowTop = function () {
	electron.remote.getCurrentWindow().moveTop();
}

aardvark.focusWindow = function () {
	electron.remote.getCurrentWindow().focus();
}

aardvark.setMenu = function (template) {
	const menu = rem.Menu.buildFromTemplate(template)
	electron.remote.Menu.setApplicationMenu(menu)
};

aardvark.openMemoryMapping = function (name, length) {
	return new shm.SharedMemory(name, length);
};

aardvark.dialog = remote.dialog;
aardvark.electron = electron;

aardvark.captureFullscreen = function (path) {
	aardvark.electron.remote.getCurrentWindow().capturePage(function (e) {
		aardvark.electron.remote.require('fs').writeFile(path, e.toPNG());
	});
};
// ===== Aardium.Shared: R2 zero-copy shim (openSharedTexture / bindSharedTextureChannel / <aardvark-surface>) =====
// Baked in so the patched browser exposes openSharedTexture by default — no per-app preload needed.
// Aardvark zero-copy shim — extracted from content_shell shell_render_frame_observer.cc
// Electron preload: runs at document-start, before page scripts (matches window-clear injection).
(function() {
  if (!window.aardvark) window.aardvark = {};
  var av = window.aardvark;
  if (av.__sharedTextureShimInstalled) return;
  av.__sharedTextureShimInstalled = true;

  // The currently-active surface (the one openSharedTexture targets). In the
  // R1 ClientCode there is exactly one <aardvark-surface> per renderer.
  av.__activeSurface = null;

  if (!customElements.get('aardvark-surface')) {
    class AardvarkSurface extends HTMLElement {
      connectedCallback() {
        if (!this.__canvas) {
          var c = document.createElement('canvas');
          c.setAttribute('data-aardvark', '');
          c.style.display = 'block';
          c.style.width = '100%';
          c.style.height = '100%';
          c.style.background = '#000';
          this.__canvas = c;
          this.appendChild(c);
        }
        this.style.display = this.style.display || 'block';
        av.__activeSurface = this;
      }
      // R1 ClientCode sets surface.width/height; mirror onto the gated canvas
      // (device pixels — the producer renders at exactly this size).
      set width(w)  { if (this.__canvas) this.__canvas.width  = w; }
      get width()   { return this.__canvas ? this.__canvas.width  : 0; }
      set height(h) { if (this.__canvas) this.__canvas.height = h; }
      get height()  { return this.__canvas ? this.__canvas.height : 0; }
      releaseSharedTexture() {
        if (this.__canvas) {
          this.__canvas.removeAttribute('data-aardvark-texid');
          this.__canvas.removeAttribute('data-aardvark-channel');
        }
        if (av.__activeSurface === this) av.__activeSurface = null;
      }
    }
    customElements.define('aardvark-surface', AardvarkSurface);
  }

  // Bind/listen the fd side-channel socket for `channel` and start accepting REG
  // messages (the native painter performs the bind on first paint after the
  // channel attribute is present — the renderer is the LISTENER per the R1
  // contract; the server connects as client).
  av.bindSharedTextureChannel = function(channel) {
    var s = av.__activeSurface;
    if (s && s.__canvas) s.__canvas.setAttribute('data-aardvark-channel', channel);
  };

  // Make the active <aardvark-surface> composite the registered handle for `id`
  // (sets its TextureLayer to that mailbox + SetNeedsDisplay — the per-frame swap).
  av.openSharedTexture = function(id) {
    var s = av.__activeSurface;
    if (s && s.__canvas) {
      s.__canvas.setAttribute('data-aardvark-texid', id);
      // Toggle a tick attribute so the style/paint is invalidated and the native
      // painter re-runs the swap for this frame.
      s.__canvas.setAttribute('data-aardvark-tick',
          ((+(s.__canvas.getAttribute('data-aardvark-tick') || 0) + 1) & 0xffff));
    }
  };
})();
