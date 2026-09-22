/**
 * VIBELY NAVIGATION & SESSION GUARD
 * Powers Top Navigation Bar, Profile Dropdown, Search, and Mobile Bottom Nav
 */

let currentUser = null;

async function initNavigation(requireAuth = true) {
  try {
    currentUser = await API.getCurrentUser();

    if (requireAuth && !currentUser) {
      window.location.href = 'login.html';
      return null;
    }

    if (currentUser) {
      window.currentUser = currentUser;
      updateNavUser(currentUser);
      updateNavBadges(currentUser.unread_notifications_count, currentUser.unread_messages_count);

      // Periodic badge polling every 8s
      setInterval(pollNavCounts, 8000);
    }

    initGlobalSearchListener();
    initCinematicBrandReveal();
    initKeyboardShortcuts();
    injectUniversalModals();
    injectDesktopLeftNav(currentUser);

    return currentUser;
  } catch (err) {
    if (requireAuth) {
      window.location.href = 'login.html';
    }
    return null;
  }
}

/* -------------------------------------------------------------
   CINEMATIC BRAND REVEAL (600-800ms)
   ------------------------------------------------------------- */
function initCinematicBrandReveal() {
  if (sessionStorage.getItem('vibely_revealed')) return;

  const revealEl = document.createElement('div');
  revealEl.id = 'vibely-brand-reveal';
  revealEl.innerHTML = `
    <div class="reveal-logo-mark">
      <span>VIBELY</span>
      <span class="reveal-sparkle">✦</span>
    </div>
    <div class="reveal-tagline">Share. Connect. Discover.</div>
  `;
  document.body.appendChild(revealEl);

  setTimeout(() => {
    revealEl.classList.add('fade-out');
    setTimeout(() => {
      revealEl.remove();
      sessionStorage.setItem('vibely_revealed', 'true');
    }, 500);
  }, 750);
}

function updateNavUser(user) {
  // Update nav profile avatar
  const avatarElements = document.querySelectorAll('.nav-avatar-placeholder');
  avatarElements.forEach(el => {
    if (user.avatar_url) {
      el.innerHTML = `<img src="${escapeHTML(user.avatar_url)}" alt="${escapeHTML(user.username)}" class="avatar-img">`;
    } else {
      el.textContent = user.initials || user.username.slice(0, 2).toUpperCase();
    }
  });

  // Dynamic greeting if home page greeting header exists
  const greetingEl = document.getElementById('user-dynamic-greeting');
  if (greetingEl) {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const name = user.first_name ? escapeHTML(user.first_name) : escapeHTML(user.display_name.split(' ')[0]);
    greetingEl.innerHTML = `${timeOfDay}, ${name} ✨`;
  }

  // Inject Admin link if user is staff/superuser
  if (user.is_staff || user.is_superuser) {
    const dropdown = document.getElementById('nav-profile-dropdown');
    if (dropdown && !document.getElementById('nav-admin-link')) {
      const adminLink = document.createElement('a');
      adminLink.id = 'nav-admin-link';
      adminLink.href = 'admin.html';
      adminLink.className = 'dropdown-item';
      adminLink.style.fontWeight = '700';
      adminLink.style.color = 'var(--coral-primary)';
      adminLink.innerHTML = '🛡️ Admin Center';
      const settingsLink = dropdown.querySelector('a[href="settings.html"]');
      if (settingsLink) {
        dropdown.insertBefore(adminLink, settingsLink.nextSibling);
      } else {
        dropdown.appendChild(adminLink);
      }
    }
  }
}

function updateNavBadges(notifCount = 0, msgCount = 0) {
  const notifBadge = document.getElementById('nav-notif-badge');
  if (notifBadge) {
    if (notifCount > 0) {
      notifBadge.textContent = notifCount > 99 ? '99+' : notifCount;
      notifBadge.style.display = 'flex';
      notifBadge.classList.add('badge-pulse');
    } else {
      notifBadge.style.display = 'none';
      notifBadge.classList.remove('badge-pulse');
    }
  }

  const leftNotifBadge = document.getElementById('left-notif-badge');
  if (leftNotifBadge) {
    if (notifCount > 0) {
      leftNotifBadge.textContent = notifCount > 99 ? '99+' : notifCount;
      leftNotifBadge.style.display = 'inline-flex';
    } else {
      leftNotifBadge.style.display = 'none';
    }
  }

  const msgBadge = document.getElementById('nav-msg-badge');
  if (msgBadge) {
    if (msgCount > 0) {
      msgBadge.textContent = msgCount > 99 ? '99+' : msgCount;
      msgBadge.style.display = 'flex';
    } else {
      msgBadge.style.display = 'none';
    }
  }

  const leftMsgBadge = document.getElementById('left-msg-badge');
  if (leftMsgBadge) {
    if (msgCount > 0) {
      leftMsgBadge.textContent = msgCount > 99 ? '99+' : msgCount;
      leftMsgBadge.style.display = 'inline-flex';
    } else {
      leftMsgBadge.style.display = 'none';
    }
  }
}

async function pollNavCounts() {
  try {
    const data = await API.get('/auth/me/');
    if (data && data.authenticated) {
      updateNavBadges(data.unread_notifications_count, data.unread_messages_count);
    }
  } catch {
    // Ignore network blips during polling
  }
}

function injectDesktopLeftNav(user) {
  const layout = document.querySelector('.editorial-layout');
  if (!layout || document.getElementById('desktop-left-nav')) return;

  const currentPath = window.location.pathname;
  const isHome = currentPath.includes('feed.html') || currentPath.endsWith('/') || currentPath === '';
  const isExplore = currentPath.includes('explore.html');
  const isMessages = currentPath.includes('messages.html');
  const isNotifs = currentPath.includes('notifications.html');
  const isActivity = currentPath.includes('activity.html');
  const isSettings = currentPath.includes('settings.html');
  const isProfile = currentPath.includes('profile.html');
  const isAdmin = currentPath.includes('admin.html');

  const navAside = document.createElement('aside');
  navAside.id = 'desktop-left-nav';
  navAside.className = 'left-nav-rail';
  navAside.innerHTML = `
    <div class="left-nav-inner">
      <nav class="left-nav-links">
        <a href="feed.html" class="left-nav-item ${isHome ? 'active' : ''}">
          <span class="nav-icon">🏠</span>
          <span class="nav-text">Home</span>
        </a>
        <a href="explore.html" class="left-nav-item ${isExplore ? 'active' : ''}">
          <span class="nav-icon">🧭</span>
          <span class="nav-text">Discover</span>
        </a>
        <a href="feed.html?filter=following" class="left-nav-item">
          <span class="nav-icon">👥</span>
          <span class="nav-text">Following</span>
        </a>
        <a href="messages.html" class="left-nav-item ${isMessages ? 'active' : ''}">
          <span class="nav-icon">💬</span>
          <span class="nav-text">Messages</span>
          <span class="nav-badge-pill" id="left-msg-badge" style="display: none; margin-left: auto;"></span>
        </a>
        <a href="notifications.html" class="left-nav-item ${isNotifs ? 'active' : ''}">
          <span class="nav-icon">🔔</span>
          <span class="nav-text">Alerts</span>
          <span class="nav-badge-pill" id="left-notif-badge" style="display: none; margin-left: auto;"></span>
        </a>
        <a href="feed.html?filter=bookmarks" class="left-nav-item">
          <span class="nav-icon">🔖</span>
          <span class="nav-text">Saved</span>
        </a>
        <a href="activity.html" class="left-nav-item ${isActivity ? 'active' : ''}">
          <span class="nav-icon">📊</span>
          <span class="nav-text">Activity</span>
        </a>
        <a href="profile.html" class="left-nav-item ${isProfile ? 'active' : ''}">
          <span class="nav-icon">👤</span>
          <span class="nav-text">Profile</span>
        </a>
        <a href="settings.html" class="left-nav-item ${isSettings ? 'active' : ''}">
          <span class="nav-icon">⚙️</span>
          <span class="nav-text">Settings</span>
        </a>
        ${user && (user.is_staff || user.is_superuser) ? `
          <a href="admin.html" class="left-nav-item ${isAdmin ? 'active' : ''}" style="color: var(--primary);">
            <span class="nav-icon">🛡️</span>
            <span class="nav-text">Admin Hub</span>
          </a>
        ` : ''}
      </nav>

      <button class="btn btn-coral left-nav-create-btn" onclick="if(typeof focusComposer === 'function'){focusComposer();}else{window.location.href='feed.html?action=create';}">
        ＋ Create
      </button>

      ${user ? `
        <div class="left-nav-user-card" onclick="window.location.href='profile.html'">
          ${renderAvatarHTML(user, 'avatar-sm', true)}
          <div class="user-meta" style="min-width: 0; flex: 1;">
            <div class="font-bold text-sm text-truncate" style="color: var(--text-main);">${escapeHTML(user.display_name || user.username)}</div>
            <div class="text-muted text-xs text-truncate">@${escapeHTML(user.username)}</div>
          </div>
          <button class="btn-icon" title="Sign Out" onclick="event.stopPropagation(); handleLogout();" style="margin-left: auto;">
            🚪
          </button>
        </div>
      ` : ''}
    </div>
  `;

  layout.prepend(navAside);
}

function toggleProfileDropdown() {
  const menu = document.getElementById('nav-profile-dropdown');
  if (menu) {
    menu.classList.toggle('active');
  }
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('nav-profile-dropdown');
  const trigger = document.getElementById('nav-avatar-trigger');
  if (dropdown && dropdown.classList.contains('active')) {
    if (!dropdown.contains(e.target) && !trigger?.contains(e.target)) {
      dropdown.classList.remove('active');
    }
  }
});

/* -------------------------------------------------------------
   UNIVERSAL SEARCH OVERLAY & KEYBOARD SHORTCUTS
   ------------------------------------------------------------- */
let searchDebounceTimer = null;
let searchSelectedIndex = -1;

function initGlobalSearchListener() {
  const searchInputs = document.querySelectorAll('.nav-search-input');
  searchInputs.forEach(input => {
    input.addEventListener('click', (e) => {
      e.preventDefault();
      openSearchOverlay();
    });
    input.addEventListener('focus', (e) => {
      e.preventDefault();
      openSearchOverlay();
    });
  });
}

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Open search on '/' if not inside an input/textarea
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      openSearchOverlay();
    }
    // Close modals on Esc
    if (e.key === 'Escape') {
      closeSearchOverlay();
      closeShareSheet();
      closeReportModal();
    }
  });
}

function openSearchOverlay() {
  const overlay = document.getElementById('universal-search-overlay');
  if (!overlay) return;
  overlay.classList.add('active');
  const input = document.getElementById('search-overlay-input');
  if (input) {
    input.focus();
    input.select();
  }
}

function closeSearchOverlay() {
  const overlay = document.getElementById('universal-search-overlay');
  overlay?.classList.remove('active');
}

async function handleOverlaySearchInput(val) {
  clearTimeout(searchDebounceTimer);
  const container = document.getElementById('search-overlay-results-container');
  if (!container) return;

  const query = val.trim();
  if (!query) {
    container.innerHTML = `
      <div style="padding: 1.5rem 1.25rem; color: var(--text-muted); font-size: 0.9rem;">
        Type @username, #topic, or keyword to search across Vibely.
      </div>
    `;
    return;
  }

  searchDebounceTimer = setTimeout(async () => {
    container.innerHTML = '<div class="text-muted text-sm text-center" style="padding: 1.5rem;">Searching...</div>';
    try {
      const data = await API.get('/search/', { q: query });
      renderOverlaySearchResults(data, query);
    } catch {
      container.innerHTML = '<div class="text-danger text-sm text-center" style="padding: 1.5rem;">Search failed.</div>';
    }
  }, 250);
}

function renderOverlaySearchResults(data, query) {
  const container = document.getElementById('search-overlay-results-container');
  if (!container) return;

  const users = data.users || [];
  const posts = data.posts || [];
  const tags = data.hashtags || [];

  if (users.length === 0 && posts.length === 0 && tags.length === 0) {
    container.innerHTML = `
      <div style="padding: 2rem 1rem; text-align: center;">
        <div style="font-size: 1.75rem; margin-bottom: 0.35rem;">🔍</div>
        <div class="font-bold text-sm" style="color: var(--text-main);">No results found for "${escapeHTML(query)}"</div>
        <p class="text-muted text-xs" style="margin-top: 0.25rem;">Try another search term or explore trending topics.</p>
      </div>
    `;
    return;
  }

  let html = '';

  if (users.length > 0) {
    html += `<div style="padding: 0.5rem 1.25rem 0.25rem; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">People</div>`;
    users.slice(0, 4).forEach(u => {
      html += `
        <a href="profile.html?u=${encodeURIComponent(u.username)}" class="search-result-row" onclick="closeSearchOverlay()">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            ${renderAvatarHTML(u, 'avatar-sm', true)}
            <div>
              <div class="font-bold text-sm" style="color: var(--text-main);">${escapeHTML(u.display_name || u.username)}</div>
              <div class="text-muted text-xs">@${escapeHTML(u.username)}</div>
            </div>
          </div>
          <span class="text-muted text-xs">View</span>
        </a>
      `;
    });
  }

  if (tags.length > 0) {
    html += `<div style="padding: 0.75rem 1.25rem 0.25rem; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Topics</div>`;
    tags.slice(0, 3).forEach(t => {
      html += `
        <a href="explore.html?tag=${encodeURIComponent(t.name)}" class="search-result-row" onclick="closeSearchOverlay()">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-weight: 800; color: var(--primary);">#</span>
            <span class="font-bold text-sm" style="color: var(--text-main);">${escapeHTML(t.name)}</span>
          </div>
          <span class="text-muted text-xs">${t.post_count} posts</span>
        </a>
      `;
    });
  }

  container.innerHTML = html;
}

/* -------------------------------------------------------------
   UNIVERSAL SHARE SHEET MODAL
   ------------------------------------------------------------- */
let currentShareUrl = '';
let currentShareTitle = '';

function openShareSheet(url, title = 'Check this out on Vibely!') {
  currentShareUrl = url || window.location.href;
  currentShareTitle = title;

  // If mobile Web Share is supported, try it directly
  if (navigator.share && window.innerWidth <= 768) {
    navigator.share({
      title: currentShareTitle,
      url: currentShareUrl,
    }).catch(() => {});
    return;
  }

  const modal = document.getElementById('universal-share-modal');
  if (modal) {
    document.getElementById('share-modal-url-input').value = currentShareUrl;
    modal.classList.add('active');
  }
}

function closeShareSheet() {
  document.getElementById('universal-share-modal')?.classList.remove('active');
}

function copyShareLink() {
  const input = document.getElementById('share-modal-url-input');
  if (input) {
    input.select();
    navigator.clipboard.writeText(input.value);
    showToast('Link copied to clipboard! ✓', 'success');
    closeShareSheet();
  }
}

/* -------------------------------------------------------------
   UNIVERSAL REPORT MODAL
   ------------------------------------------------------------- */
let currentReportTargetType = null;
let currentReportTargetId = null;

function openReportModal(targetType, targetId) {
  currentReportTargetType = targetType;
  currentReportTargetId = targetId;

  const modal = document.getElementById('universal-report-modal');
  if (modal) {
    document.getElementById('report-details-input').value = '';
    const firstRadio = modal.querySelector('input[name="report-reason"]');
    if (firstRadio) firstRadio.checked = true;
    modal.classList.add('active');
  }
}

function closeReportModal() {
  document.getElementById('universal-report-modal')?.classList.remove('active');
}

async function submitReport() {
  const selectedReason = document.querySelector('input[name="report-reason"]:checked')?.value || 'other';
  const details = document.getElementById('report-details-input')?.value.trim() || '';

  try {
    await API.post('/reports/', {
      target_type: currentReportTargetType,
      target_id: currentReportTargetId,
      reason: selectedReason,
      details: details,
    });
    showToast('Report submitted. Thank you for keeping Vibely safe. ✓', 'info');
    closeReportModal();
  } catch (err) {
    showToast(err.message || 'Failed to submit report.', 'error');
  }
}

/* -------------------------------------------------------------
   INJECT UNIVERSAL MODALS DYNAMICALLY (Search, Share, Report)
   ------------------------------------------------------------- */
function injectUniversalModals() {
  if (document.getElementById('universal-search-overlay')) return;

  const modalsContainer = document.createElement('div');
  modalsContainer.innerHTML = `
    <!-- Search Overlay -->
    <div id="universal-search-overlay" class="search-overlay-backdrop" onclick="if(event.target === this) closeSearchOverlay()">
      <div class="search-overlay-card">
        <div class="search-overlay-input-wrap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" id="search-overlay-input" class="search-overlay-input" placeholder="Search people, tags, and posts..." oninput="handleOverlaySearchInput(this.value)">
          <span class="search-kbd-pill">ESC</span>
        </div>
        <div class="search-overlay-results" id="search-overlay-results-container">
          <div style="padding: 1.5rem 1.25rem; color: var(--text-muted); font-size: 0.9rem;">
            Type to search across Vibely...
          </div>
        </div>
      </div>
    </div>

    <!-- Share Sheet Modal -->
    <div id="universal-share-modal" class="modal-backdrop" onclick="if(event.target === this) closeShareSheet()">
      <div class="modal-box" style="max-width: 440px;">
        <div class="modal-header">
          <h3 style="font-size: 1.15rem; font-weight: 700;">Share Post</h3>
          <button class="btn-icon" onclick="closeShareSheet()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="share-sheet-grid">
            <button class="share-sheet-btn" onclick="copyShareLink()">
              <span class="share-sheet-icon">🔗</span>
              <span>Copy Link</span>
            </button>
            <a href="https://twitter.com/intent/tweet?url=" target="_blank" id="share-twitter-btn" class="share-sheet-btn" onclick="this.href='https://twitter.com/intent/tweet?text='+encodeURIComponent(currentShareTitle)+'&url='+encodeURIComponent(currentShareUrl)">
              <span class="share-sheet-icon">🐦</span>
              <span>X / Twitter</span>
            </a>
            <a href="https://wa.me/?text=" target="_blank" id="share-whatsapp-btn" class="share-sheet-btn" onclick="this.href='https://wa.me/?text='+encodeURIComponent(currentShareTitle+' '+currentShareUrl)">
              <span class="share-sheet-icon">💬</span>
              <span>WhatsApp</span>
            </a>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label text-xs">Direct Link</label>
            <div style="display: flex; gap: 0.5rem;">
              <input type="text" id="share-modal-url-input" class="form-control text-xs" readonly>
              <button class="btn btn-secondary btn-sm" onclick="copyShareLink()">Copy</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Report Modal -->
    <div id="universal-report-modal" class="modal-backdrop" onclick="if(event.target === this) closeReportModal()">
      <div class="modal-box" style="max-width: 460px;">
        <div class="modal-header">
          <h3 style="font-size: 1.15rem; font-weight: 700;">Report to Vibely</h3>
          <button class="btn-icon" onclick="closeReportModal()">&times;</button>
        </div>
        <div class="modal-body">
          <p class="text-secondary text-sm">Please specify why you are reporting this content. Our moderation team reviews reports promptly.</p>
          <div class="report-reasons-list">
            <label class="report-reason-item">
              <input type="radio" name="report-reason" value="spam" checked>
              <span class="text-sm font-semibold">Spam or commercial advertising</span>
            </label>
            <label class="report-reason-item">
              <input type="radio" name="report-reason" value="harassment">
              <span class="text-sm font-semibold">Harassment, bullying, or hate speech</span>
            </label>
            <label class="report-reason-item">
              <input type="radio" name="report-reason" value="inappropriate">
              <span class="text-sm font-semibold">Inappropriate or adult content</span>
            </label>
            <label class="report-reason-item">
              <input type="radio" name="report-reason" value="fake_account">
              <span class="text-sm font-semibold">Impersonation or fake account</span>
            </label>
            <label class="report-reason-item">
              <input type="radio" name="report-reason" value="other">
              <span class="text-sm font-semibold">Other violation</span>
            </label>
          </div>
          <div class="form-group">
            <label class="form-label text-xs">Additional Details (Optional)</label>
            <textarea id="report-details-input" class="form-control text-sm" placeholder="Provide extra context to help our review..." rows="2"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" onclick="closeReportModal()">Cancel</button>
          <button class="btn btn-coral btn-sm" onclick="submitReport()">Submit Report</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalsContainer);
}

async function handleLogout() {
  try {
    await API.post('/auth/logout/');
    showToast('Signed out of Vibely.', 'info');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 400);
  } catch (err) {
    showToast('Error signing out.', 'error');
  }
}

// Universal Modal Dismissal (ESC key & Backdrop Click)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active, .modal-backdrop.active, .modal-overlay.active, .story-viewer-modal.active, .lightbox-modal.active').forEach(modal => {
      modal.classList.remove('active');
    });
    const overlay = document.getElementById('search-dropdown-overlay');
    if (overlay) overlay.style.display = 'none';
  }
});

document.addEventListener('click', (e) => {
  if (e.target.matches('.modal.active, .modal-backdrop.active, .modal-overlay.active')) {
    e.target.classList.remove('active');
  }
});

