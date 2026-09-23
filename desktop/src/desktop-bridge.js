/**
 * VIBELY Desktop Injected Bridge
 * Provides custom titlebar UI, shortcut integrations, and external link handling
 */
(function () {
  if (window.__vibelyDesktopInjected) return;
  window.__vibelyDesktopInjected = true;

  document.addEventListener('DOMContentLoaded', () => {
    initDesktopUI();
    initShortcuts();
    initExternalLinks();
  });

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initDesktopUI();
    initShortcuts();
    initExternalLinks();
  }

  function initDesktopUI() {
    if (document.getElementById('vibely-desktop-titlebar')) return;
    document.body.classList.add('vibely-desktop-app');

    const titlebar = document.createElement('div');
    titlebar.id = 'vibely-desktop-titlebar';
    titlebar.innerHTML = `
      <div class="desktop-titlebar-left">
        <img src="assets/icons/icon-24.png" onerror="this.src='/static/icons/icon-24.png'; this.onerror=null;" alt="Vibely" class="desktop-titlebar-logo">
        <span>VIBELY</span>
        <span class="desktop-titlebar-tagline">· Social Media</span>
      </div>

      <div class="desktop-titlebar-center">
        <div class="desktop-titlebar-search-trigger" id="titlebar-search-trigger" title="Quick Search">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span>Search VIBELY</span>
          <kbd class="desktop-titlebar-search-kbd">Ctrl K</kbd>
        </div>
      </div>

      <div class="desktop-titlebar-right">
        <button id="vibely-win-min" class="desktop-win-btn" title="Minimize">−</button>
        <button id="vibely-win-max" class="desktop-win-btn" title="Maximize">□</button>
        <button id="vibely-win-close" class="desktop-win-btn desktop-win-close" title="Close">✕</button>
      </div>
    `;

    document.body.insertBefore(titlebar, document.body.firstChild);

    // Setup window controls
    const minBtn = document.getElementById('vibely-win-min');
    const maxBtn = document.getElementById('vibely-win-max');
    const closeBtn = document.getElementById('vibely-win-close');
    const searchTrigger = document.getElementById('titlebar-search-trigger');

    if (window.vibelyDesktop) {
      minBtn?.addEventListener('click', () => window.vibelyDesktop.minimize());
      maxBtn?.addEventListener('click', () => window.vibelyDesktop.maximize());
      closeBtn?.addEventListener('click', () => window.vibelyDesktop.close());

      window.vibelyDesktop.onMaximizeChange?.((isMax) => {
        if (maxBtn) {
          maxBtn.textContent = isMax ? '❐' : '□';
          maxBtn.title = isMax ? 'Restore' : 'Maximize';
        }
      });
    }

    searchTrigger?.addEventListener('click', triggerSearch);
  }

  function triggerSearch() {
    if (typeof window.openSearchModal === 'function') {
      window.openSearchModal();
      return;
    }
    const searchBtn = document.getElementById('nav-search-btn') || 
                      document.querySelector('[data-action="search"]') || 
                      document.querySelector('.search-input');
    if (searchBtn) {
      searchBtn.click();
      if (searchBtn.focus) searchBtn.focus();
    }
  }

  function initShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ctrl+K or Cmd+K: Open Search
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        triggerSearch();
        return;
      }

      // Escape: Close open modals
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal.active, .modal-backdrop.active, .modal-overlay.active');
        if (activeModal) {
          activeModal.classList.remove('active');
          if (typeof window.closeAllModals === 'function') {
            window.closeAllModals();
          }
        }
        return;
      }

      // Ctrl+Enter: Submit composer if active
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.id === 'post-content' || activeEl.closest('.post-composer') || activeEl.closest('#post-form'))) {
          e.preventDefault();
          const submitBtn = document.getElementById('post-submit-btn') || 
                            document.querySelector('#post-form button[type="submit"]') ||
                            document.querySelector('.composer-submit-btn');
          if (submitBtn && !submitBtn.disabled) {
            submitBtn.click();
          }
        }
      }
    });
  }

  function initExternalLinks() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link || !link.href) return;

      const href = link.href;
      // If external website link (not local backend, not mailto, not javascript, not hash)
      if (href.startsWith('http://') || href.startsWith('https://')) {
        const url = new URL(href);
        const currentOrigin = window.location.origin;
        if (url.origin !== currentOrigin && !url.hostname.includes('127.0.0.1') && !url.hostname.includes('localhost')) {
          e.preventDefault();
          if (window.vibelyDesktop && window.vibelyDesktop.openExternal) {
            window.vibelyDesktop.openExternal(href);
          } else {
            window.open(href, '_blank');
          }
        }
      }
    });
  }
})();
