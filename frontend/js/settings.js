/**
 * VIBELY SETTINGS — ADVANCED MANAGEMENT
 */

async function initSettingsPage() {
  initSettingsTabs();
  loadCurrentSettings();
  loadFollowRequests();
  loadActiveSessions();
  loadMutedUsers();
  loadBlockedUsers();

  // Theme selector
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.value = VibelyTheme.get();
    themeSelect.addEventListener('change', (e) => {
      VibelyTheme.set(e.target.value);
      showToast(`Theme updated to ${e.target.value}.`, 'success');
    });
  }

  // Privacy toggle
  const privacyToggle = document.getElementById('privacy-account-toggle');
  privacyToggle?.addEventListener('change', async (e) => {
    try {
      await API.patch('/users/profile/', { is_private: e.target.checked });
      showToast(e.target.checked ? 'Account is now Private 🔒' : 'Account is now Public 🌐', 'success');
    } catch {
      showToast('Failed to update privacy settings.', 'error');
    }
  });
}

function initSettingsTabs() {
  document.querySelectorAll('.settings-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));

      e.target.classList.add('active');
      const targetSectionId = e.target.dataset.section;
      document.getElementById(targetSectionId)?.classList.add('active');
    });
  });

  // Check URL hash
  if (window.location.hash) {
    const hash = window.location.hash.replace('#', '');
    const matchedBtn = document.querySelector(`.settings-nav-btn[data-section="section-${hash}"]`);
    if (matchedBtn) matchedBtn.click();
  }
}

async function loadCurrentSettings() {
  try {
    const user = await API.get('/auth/me/');
    if (!user || !user.authenticated) return;

    const privacyToggle = document.getElementById('privacy-account-toggle');
    if (privacyToggle) privacyToggle.checked = !!user.is_private;

    const msgSelect = document.getElementById('privacy-who-message');
    if (msgSelect && user.who_can_message) msgSelect.value = user.who_can_message;

    const commentSelect = document.getElementById('privacy-who-comment');
    if (commentSelect && user.who_can_comment) commentSelect.value = user.who_can_comment;
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function savePrivacyPreferences() {
  const whoMessage = document.getElementById('privacy-who-message')?.value;
  const whoComment = document.getElementById('privacy-who-comment')?.value;

  try {
    await API.patch('/users/profile/', {
      who_can_message: whoMessage,
      who_can_comment: whoComment
    });
    showToast('Interaction preferences saved! ✓', 'success');
  } catch (err) {
    showToast('Failed to update preferences.', 'error');
  }
}

// Follow Requests
async function loadFollowRequests() {
  const container = document.getElementById('follow-requests-container');
  if (!container) return;

  try {
    const requests = await API.get('/users/follow-requests/');
    if (requests.length === 0) {
      container.innerHTML = '<div class="text-muted text-xs" style="padding: 0.5rem 0;">No pending follow requests.</div>';
      return;
    }

    container.innerHTML = requests.map(r => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border-subtle);">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          ${renderAvatarHTML(r.requester, 'avatar-sm', false)}
          <div>
            <div class="font-semibold text-sm" style="color: var(--text-main);">${escapeHTML(r.requester.display_name || r.requester.username)}</div>
            <div class="text-muted text-xs">@${escapeHTML(r.requester.username)}</div>
          </div>
        </div>
        <div style="display: flex; gap: 0.4rem;">
          <button class="btn btn-coral btn-xs" onclick="handleFollowRequestAction(${r.id}, 'accept', this)">Accept</button>
          <button class="btn btn-secondary btn-xs" onclick="handleFollowRequestAction(${r.id}, 'reject', this)">Reject</button>
        </div>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<div class="text-danger text-xs">Failed to load requests.</div>';
  }
}

async function handleFollowRequestAction(reqId, action, btn) {
  try {
    const res = await API.post(`/users/follow-requests/${reqId}/action/`, { action });
    showToast(res.message, 'success');
    const row = btn.closest('div').parentElement;
    if (row) row.remove();
  } catch (err) {
    showToast('Failed to process request.', 'error');
  }
}

// Password Change
async function handleChangePassword(e) {
  e.preventDefault();
  const current_password = document.getElementById('pw-current').value;
  const new_password = document.getElementById('pw-new').value;
  const confirm_password = document.getElementById('pw-confirm').value;

  if (new_password !== confirm_password) {
    showToast('New passwords do not match.', 'error');
    return;
  }

  try {
    const res = await API.post('/auth/change-password/', {
      current_password,
      new_password,
      confirm_password
    });
    showToast(res.message || 'Password updated! ✓', 'success');
    document.getElementById('change-password-form').reset();
  } catch (err) {
    showToast(err.error || 'Failed to update password.', 'error');
  }
}

// Active Sessions
async function loadActiveSessions() {
  const container = document.getElementById('sessions-container');
  if (!container) return;

  try {
    const sessions = await API.get('/auth/sessions/');
    container.innerHTML = sessions.map(s => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem; background: var(--bg-surface-secondary); border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 0.65rem;">
        <div>
          <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">
            💻 ${escapeHTML(s.device)} ${s.is_current ? '<span class="badge-pill font-bold" style="background: var(--accent-mint); color: #fff; font-size: 0.65rem;">Active Now</span>' : ''}
          </div>
          <div class="text-muted text-xs" style="margin-top: 0.2rem;">IP: ${escapeHTML(s.ip_address)} • ${escapeHTML(s.user_agent)}</div>
        </div>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<div class="text-danger text-xs">Sessions telemetry unavailable.</div>';
  }
}

// Muted Users
async function loadMutedUsers() {
  const container = document.getElementById('muted-users-container');
  if (!container) return;

  try {
    const muted = await API.get('/users/muted/');
    if (muted.length === 0) {
      container.innerHTML = '<div class="text-muted text-sm">You have not muted any users.</div>';
      return;
    }

    container.innerHTML = muted.map(u => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border-subtle);">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          ${renderAvatarHTML(u, 'avatar-sm')}
          <div>
            <div class="font-semibold text-sm" style="color: var(--text-main);">${escapeHTML(u.display_name || u.username)}</div>
            <div class="text-muted text-xs">@${escapeHTML(u.username)}</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="unmuteUser('${encodeURIComponent(u.username)}')">Unmute</button>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<div class="text-danger text-sm">Failed to load muted accounts.</div>';
  }
}

async function unmuteUser(username) {
  const user = decodeURIComponent(username);
  try {
    await API.post(`/users/${user}/mute/`);
    showToast(`Unmuted @${user}.`, 'info');
    loadMutedUsers();
  } catch {
    showToast('Failed to unmute user.', 'error');
  }
}

// Blocked Users
async function loadBlockedUsers() {
  const container = document.getElementById('blocked-users-container');
  if (!container) return;

  try {
    const blocked = await API.get('/users/blocked/');
    if (blocked.length === 0) {
      container.innerHTML = '<div class="text-muted text-sm">You have not blocked any accounts.</div>';
      return;
    }

    container.innerHTML = blocked.map(u => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border-subtle);">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          ${renderAvatarHTML(u, 'avatar-sm')}
          <div>
            <div class="font-semibold text-sm" style="color: var(--text-main);">${escapeHTML(u.display_name || u.username)}</div>
            <div class="text-muted text-xs">@${escapeHTML(u.username)}</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="unblockUser('${encodeURIComponent(u.username)}')">Unblock</button>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<div class="text-danger text-sm">Failed to load blocked accounts.</div>';
  }
}

async function unblockUser(username) {
  const user = decodeURIComponent(username);
  try {
    await API.post(`/users/${user}/block/`);
    showToast(`Unblocked @${user}.`, 'info');
    loadBlockedUsers();
  } catch {
    showToast('Failed to unblock user.', 'error');
  }
}

// Danger Zone
async function promptDeactivateAccount() {
  const password = prompt('Please enter your account password to confirm deactivation:');
  if (!password) return;

  try {
    const res = await API.post('/auth/deactivate/', { password });
    alert(res.message || 'Your account has been deactivated. Logging out...');
    window.location.href = 'login.html';
  } catch (err) {
    showToast(err.error || 'Failed to deactivate account.', 'error');
  }
}

async function promptDeleteAccount() {
  const password = prompt('Enter your password to proceed with PERMANENT DELETION:');
  if (!password) return;

  const confirmation = prompt('To confirm permanent deletion, type DELETE in all caps:');
  if (confirmation !== 'DELETE') {
    showToast('Deletion aborted. Confirmation phrase did not match.', 'info');
    return;
  }

  try {
    const res = await API.post('/auth/delete/', { password, confirm_text: 'DELETE' });
    alert(res.message || 'Your account has been permanently deleted.');
    window.location.href = 'register.html';
  } catch (err) {
    showToast(err.error || 'Failed to delete account.', 'error');
  }
}
