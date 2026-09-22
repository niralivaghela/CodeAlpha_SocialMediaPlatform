/**
 * VIBELY THEME ENGINE
 * Primary theme: LIGHT-FIRST ('light')
 * Supports 'light', 'dark', and 'system'
 * Persists preference in localStorage
 */

(function () {
  const STORAGE_KEY = 'vibely_theme';

  function getSavedPreference() {
    return localStorage.getItem(STORAGE_KEY) || 'light';
  }

  function resolveTheme(preference) {
    if (preference === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return preference === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(preference) {
    const resolved = resolveTheme(preference);
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-preference', preference);

    // Sync any theme selects
    document.querySelectorAll('.theme-select-input, #theme-select').forEach(sel => {
      sel.value = preference;
    });
  }

  function setTheme(preference) {
    localStorage.setItem(STORAGE_KEY, preference);
    applyTheme(preference);
  }

  // Initial apply immediately before render
  const initialPref = getSavedPreference();
  applyTheme(initialPref);

  // Listen to OS changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getSavedPreference() === 'system') {
        applyTheme('system');
      }
    });
  }

  window.VibelyTheme = {
    get: getSavedPreference,
    set: setTheme,
    apply: applyTheme,
    resolve: resolveTheme,
  };
})();
