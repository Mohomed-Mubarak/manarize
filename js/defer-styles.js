/* ============================================================
   MANARIZE — Deferred Stylesheet Loader
   ============================================================
   Activates all <link> tags marked with data-defer="true".
   These are initially set to media="print" (non-render-blocking)
   and switched to media="all" once the page has loaded.

   This replaces inline onload handlers which are blocked by CSP
   script-src-elem directives (no hash/nonce for inline scripts).

   Also tracks when every deferred stylesheet has actually finished
   downloading (link.sheet becomes non-null once parsed, regardless
   of the media it was fetched under) and fires a global
   "styles:ready" event + window.__stylesReady flag once they all
   have. loader.js waits on this before revealing the page, so a
   slow connection shows the loading screen instead of a flash of
   unstyled content.

   Usage in HTML:
     <link rel="stylesheet" href="..." media="print" data-defer="true">
   ============================================================ */

(function () {
  function waitForLink(link) {
    return new Promise(function (resolve) {
      if (link.sheet) { resolve(); return; }
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        // ~5s cap per stylesheet so one failed/blocked request
        // can't hang the whole page forever.
        if (link.sheet || tries > 100) {
          clearInterval(iv);
          resolve();
        }
      }, 50);
    });
  }

  function markReady() {
    if (window.__stylesReady) return;
    window.__stylesReady = true;
    window.dispatchEvent(new Event('styles:ready'));
  }

  function activateDeferredLinks() {
    var links = Array.prototype.slice.call(
      document.querySelectorAll('link[data-defer="true"]')
    );
    links.forEach(function (link) { link.media = 'all'; });

    if (!links.length) { markReady(); return; }
    Promise.all(links.map(waitForLink)).then(markReady);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activateDeferredLinks);
  } else {
    activateDeferredLinks();
  }
  // Also fire on window load as a safety net
  window.addEventListener('load', activateDeferredLinks);
})();
