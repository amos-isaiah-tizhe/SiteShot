/* ============================================================
   OneXp SiteShot — PWA Registration
   Network-first: new SW activates immediately on deploy.
   ============================================================ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none', // Always check server for SW updates
      });

      // Check for updates every 60 seconds
      setInterval(() => reg.update(), 60 * 1000);

      // New SW found — activate immediately without waiting
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Tell new SW to skip waiting and take control
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      // When SW takes control, reload the page to get fresh content
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

    } catch (err) {
      console.warn('Service Worker registration failed:', err);
    }
  });
}
// ---- Custom install prompt ----
let deferredPrompt = null;
const installBar  = document.getElementById('pwa-install-bar');
const installBtn  = document.getElementById('pwa-install-btn');
const dismissBtn  = document.getElementById('pwa-dismiss-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Don't show if user previously dismissed
  if (!localStorage.getItem('pwa-dismissed') && installBar) {
    installBar.style.display = 'flex';
  }
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      installBar.style.display = 'none';
    }
    deferredPrompt = null;
  });
}

if (dismissBtn) {
  dismissBtn.addEventListener('click', () => {
    installBar.style.display = 'none';
    localStorage.setItem('pwa-dismissed', '1');
  });
}

// Hide bar if already installed
window.addEventListener('appinstalled', () => {
  if (installBar) installBar.style.display = 'none';
  deferredPrompt = null;
});