/**
 * VIBELY PROFILE PAGE
 */

let profileUser = null;
let activeProfileTab = 'posts';

async function initProfilePage() {
  const urlParams = new URLSearchParams(window.location.search);
  const targetUsername = urlParams.get('u') || urlParams.get('user') || (currentUser ? currentUser.username : null);

  if (!targetUsername) {
    window.location.href = 'feed.html';
    return;
  }

  try {
    profileUser = await API.get(`/users/${encodeURIComponent(targetUsername)}/`);
    renderProfileHeader(profileUser);
    loadProfilePosts(activeProfileTab);
    initEditProfileModal();
  } catch (err) {
    showToast('Failed to load profile.', 'error');
  }

  // Profile tabs (support both .profile-tab-pill and .profile-tab-btn)
  document.querySelectorAll('.profile-tab-pill, .profile-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.profile-tab-pill, .profile-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      activeProfileTab = e.target.dataset.tab;
      loadProfilePosts(activeProfileTab);
    });
  });
}

function renderProfileHeader(user) {
  const container = document.getElementById('profile-header-container');
  if (!container) return;

  const isSelf = user.is_self;
  const isFollowing = user.is_following;
  const hasPendingRequest = user.has_pending_follow_request || user.has_pending_request;
  const isMuted = user.is_muted;

  // Follow button label & style
  let followBtnText = 'Follow';
  let followBtnClass = 'btn-coral';
  if (isFollowing) {
    followBtnText = 'Following';
    followBtnClass = 'btn-secondary';
  } else if (hasPendingRequest) {
    followBtnText = 'Requested';
    followBtnClass = 'btn-secondary';
  }

  // Mutual followers
  let mutualHTML = '';
  const mutualList = user.mutual_followers || user.mutual_followers_sample || [];
  const mutualCount = user.mutual_followers_count || mutualList.length;
  if (mutualCount > 0 && mutualList.length > 0) {
    const firstMutual = mutualList[0].username;
    const extraCount = mutualCount - 1;
    mutualHTML = `
      <div class="mutual-followers-pill">
        <span class="mutual-avatars-stack">
          ${mutualList.map(m => renderAvatarHTML(m, 'avatar-xs', false)).join('')}
        </span>
        <span>Followed by <strong>@${escapeHTML(firstMutual)}</strong> ${extraCount > 0 ? `and ${extraCount} other${extraCount > 1 ? 's' : ''}` : ''} you follow</span>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="profile-shell-card" style="overflow: hidden;">
      <!-- Cover Banner -->
      <div class="profile-banner-container">
        ${user.banner_url ? `<img src="${user.banner_url}" class="profile-banner-img" alt="Cover banner">` : ''}
        ${isSelf ? `
          <input type="file" id="cover-banner-file-input" accept="image/*" style="display:none;" onchange="handleBannerUpload(event)">
          <button type="button" class="profile-banner-upload-btn" onclick="document.getElementById('cover-banner-file-input').click()">
            📷 Edit Cover
          </button>
        ` : ''}
      </div>

      <div class="profile-main-details">
        <div class="profile-avatar-action-row" style="margin-top: -50px;">
          <div class="profile-hero-avatar" style="border: 4px solid var(--bg-surface); border-radius: 50%;">
            ${renderAvatarHTML(user, 'avatar-xl', true)}
          </div>
          <div class="profile-action-btns">
            ${isSelf ? `
              <button class="btn btn-secondary btn-sm" onclick="openEditProfileModal()">
                ✏️ Edit Profile
              </button>
            ` : `
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <button class="btn ${followBtnClass} btn-sm" id="profile-follow-btn" onclick="toggleProfileFollow('${encodeURIComponent(user.username)}')">
                  ${followBtnText}
                </button>
                <button class="btn btn-outline btn-sm" onclick="startMessageWith('${encodeURIComponent(user.username)}')">
                  💬 Message
                </button>
                <div class="dropdown">
                  <button class="btn-icon" onclick="toggleDropdown(this)">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="1"></circle>
                      <circle cx="19" cy="12" r="1"></circle>
                      <circle cx="5" cy="12" r="1"></circle>
                    </svg>
                  </button>
                  <div class="dropdown-menu">
                    <button class="dropdown-item" onclick="toggleMuteProfile('${encodeURIComponent(user.username)}')">
                      🔇 ${isMuted ? 'Unmute User' : 'Mute User'}
                    </button>
                    <button class="dropdown-item" onclick="openReportModal('user', ${user.id})">
                      🚩 Report Profile
                    </button>
                    <button class="dropdown-item text-danger" onclick="toggleProfileBlock('${encodeURIComponent(user.username)}')">
                      🚫 Block User
                    </button>
                  </div>
                </div>
              </div>
            `}
          </div>
        </div>

        <div style="margin-top: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <h1 style="font-size: 1.55rem; font-weight: 800; line-height: 1.2; letter-spacing: -0.02em;">
              ${escapeHTML(user.display_name || user.username)}
            </h1>
            ${user.is_verified ? `<span title="Verified Creator" style="color: var(--primary); font-size: 1.2rem; line-height: 1;">✦</span>` : ''}
            ${user.is_private ? `<span title="Private Account" style="color: var(--text-muted); font-size: 1rem;">🔒</span>` : ''}
          </div>
          <div class="text-muted text-sm" style="margin-top: 0.15rem;">@${escapeHTML(user.username)}</div>
          ${mutualHTML}
        </div>

        ${user.bio ? `<p style="margin: 0.85rem 0; font-size: 0.95rem; line-height: 1.6; color: var(--text-main);">${escapeHTML(user.bio)}</p>` : ''}

        <div style="display: flex; flex-wrap: wrap; gap: 1.25rem; margin-top: 0.75rem; font-size: 0.875rem; color: var(--text-secondary);">
          ${user.location ? `<span>📍 ${escapeHTML(user.location)}</span>` : ''}
          ${user.website ? `<span>🔗 <a href="${escapeHTML(user.website)}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); font-weight: 500;">${escapeHTML(user.website)}</a></span>` : ''}
          <span>📅 Joined ${new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
        </div>

        <div class="profile-metrics-pill">
          <div class="metric-item">
            <span class="metric-num" id="profile-post-count">${user.post_count}</span>
            <span class="metric-label">Posts</span>
          </div>
          <div class="metric-item" onclick="openFollowListModal('followers')">
            <span class="metric-num" id="profile-follower-count">${user.follower_count}</span>
            <span class="metric-label">Followers</span>
          </div>
          <div class="metric-item" onclick="openFollowListModal('following')">
            <span class="metric-num" id="profile-following-count">${user.following_count}</span>
            <span class="metric-label">Following</span>
          </div>
        </div>

        <!-- Story Highlights Strip -->
        <div id="profile-highlights-strip" class="story-highlights-strip">
          <!-- Loaded dynamically -->
        </div>
      </div>
    </div>
  `;

  loadStoryHighlights(user.username, isSelf);
}

// Handle Banner Upload
async function handleBannerUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 8 * 1024 * 1024) {
    showToast('Cover image must be under 8MB.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('banner', file);

  try {
    showToast('Uploading cover banner...', 'info');
    const updated = await API.upload('/users/profile/', formData, 'PATCH');
    profileUser = updated;
    showToast('Cover updated! ✨', 'success');
    renderProfileHeader(updated);
  } catch (err) {
    showToast('Failed to upload cover.', 'error');
  }
}

// Story Highlights
async function loadStoryHighlights(username, isSelf) {
  const container = document.getElementById('profile-highlights-strip');
  if (!container) return;

  try {
    const highlights = await API.get('/stories/highlights/', { user: username });
    let html = '';

    if (isSelf) {
      html += `
        <div class="highlight-item" onclick="openCreateHighlightModal()">
          <div class="highlight-add-thumb">＋</div>
          <span class="highlight-title">New</span>
        </div>
      `;
    }

    highlights.forEach(h => {
      html += `
        <div class="highlight-item" onclick="viewHighlight(${h.id}, '${escapeHTML(h.title)}')">
          <div class="highlight-thumb">
            ${h.cover_image_url ? `<img src="${h.cover_image_url}">` : `<div class="highlight-thumb-placeholder">✨</div>`}
          </div>
          <span class="highlight-title">${escapeHTML(h.title)}</span>
        </div>
      `;
    });

    if (highlights.length === 0 && !isSelf) {
      container.style.display = 'none';
    } else {
      container.style.display = 'flex';
      container.innerHTML = html;
    }
  } catch {
    container.style.display = 'none';
  }
}

function openCreateHighlightModal() {
  const modal = document.getElementById('create-highlight-modal');
  if (modal) modal.classList.add('active');
}

function closeCreateHighlightModal() {
  const modal = document.getElementById('create-highlight-modal');
  if (modal) modal.classList.remove('active');
}

async function submitCreateHighlight() {
  const title = document.getElementById('highlight-title-input')?.value.trim();
  const coverFile = document.getElementById('highlight-cover-input')?.files[0];

  if (!title) {
    showToast('Please enter a title for your highlight.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  if (coverFile) formData.append('cover_image', coverFile);

  try {
    await API.upload('/stories/highlights/', formData);
    showToast('Highlight created! ✨', 'success');
    closeCreateHighlightModal();
    if (profileUser) loadStoryHighlights(profileUser.username, profileUser.is_self);
  } catch (err) {
    showToast(err.message || 'Failed to create highlight.', 'error');
  }
}

function viewHighlight(id, title) {
  showToast(`Highlight "${title}" loaded.`, 'info');
}

async function toggleMuteProfile(username) {
  const user = decodeURIComponent(username);
  try {
    const res = await API.post(`/users/${user}/mute/`);
    showToast(res.is_muted ? `Muted @${user}.` : `Unmuted @${user}.`, 'info');
    if (profileUser) {
      profileUser.is_muted = res.is_muted;
      renderProfileHeader(profileUser);
    }
  } catch (err) {
    showToast('Failed to toggle mute.', 'error');
  }
}

async function toggleProfileBlock(username) {
  const user = decodeURIComponent(username);
  if (!confirm(`Are you sure you want to block @${user}?`)) return;
  try {
    await API.post(`/users/${user}/block/`);
    showToast(`Blocked @${user}.`, 'info');
    window.location.href = 'feed.html';
  } catch (err) {
    showToast('Failed to block user.', 'error');
  }
}

async function toggleProfileFollow(username) {
  const user = decodeURIComponent(username);
  const btn = document.getElementById('profile-follow-btn');
  const countEl = document.getElementById('profile-follower-count');

  try {
    const res = await API.post(`/users/${user}/follow/`);
    if (res.is_following) {
      btn.textContent = 'Following';
      btn.className = 'btn btn-secondary btn-sm';
    } else if (res.request_pending) {
      btn.textContent = 'Requested';
      btn.className = 'btn btn-secondary btn-sm';
      showToast('Follow request sent! 🔒', 'info');
    } else {
      btn.textContent = 'Follow';
      btn.className = 'btn btn-coral btn-sm';
    }
    if (countEl && res.follower_count !== undefined) countEl.textContent = res.follower_count;
  } catch (err) {
    showToast('Failed to update follow.', 'error');
  }
}

async function startMessageWith(username) {
  const user = decodeURIComponent(username);
  try {
    const conv = await API.post('/conversations/start/', { username: user });
    window.location.href = `messages.html?c=${conv.id}`;
  } catch (err) {
    showToast(err.message || 'Could not start conversation.', 'error');
  }
}

async function loadProfilePosts(tab) {
  const container = document.getElementById('profile-posts-container');
  if (!container || !profileUser) return;

  container.innerHTML = '<div class="text-muted text-center" style="padding: 2rem;">Loading...</div>';

  try {
    let endpoint = '';
    let params = {};

    if (tab === 'posts') {
      endpoint = '/posts/';
      params = { user: profileUser.username };
    } else if (tab === 'media') {
      endpoint = '/posts/';
      params = { user: profileUser.username, filter: 'media' };
    } else if (tab === 'replies') {
      endpoint = '/posts/';
      params = { user: profileUser.username, filter: 'replies' };
    } else if (tab === 'likes') {
      endpoint = `/users/${encodeURIComponent(profileUser.username)}/liked/`;
    } else if (tab === 'bookmarks') {
      endpoint = '/posts/bookmarks/';
    }

    const data = await API.get(endpoint, params);
    const posts = data.results || [];

    if (posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">No ${tab} yet</div>
          <p class="text-muted text-sm">Nothing shared in this section yet.</p>
        </div>
      `;
    } else {
      container.innerHTML = posts.map(renderPostCardHTML).join('');
    }
  } catch (err) {
    container.innerHTML = '<div class="text-danger text-center" style="padding: 2rem;">Failed to load posts.</div>';
  }
}

// Followers / Following Modal
async function openFollowListModal(type) {
  const modal = document.getElementById('user-list-modal');
  const title = document.getElementById('user-list-modal-title');
  const body = document.getElementById('user-list-modal-body');

  if (!modal || !title || !body || !profileUser) return;

  const isSelf = profileUser.is_self;
  title.textContent = type === 'followers' ? 'Followers' : 'Following';
  body.innerHTML = '<div class="text-muted text-center" style="padding: 1.5rem;">Loading...</div>';
  modal.classList.add('active');

  try {
    const list = await API.get(`/users/${encodeURIComponent(profileUser.username)}/${type}/`);
    if (list.length === 0) {
      body.innerHTML = `<div class="empty-state"><div class="text-muted">No ${type} found.</div></div>`;
      return;
    }
    body.innerHTML = list.map(u => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0; border-bottom: 1px solid var(--border-subtle);" id="user-row-${u.username}">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <a href="profile.html?u=${encodeURIComponent(u.username)}">
            ${renderAvatarHTML(u, 'avatar-sm', true)}
          </a>
          <div>
            <a href="profile.html?u=${encodeURIComponent(u.username)}" class="font-semibold text-sm" style="color: var(--text-main);">
              ${escapeHTML(u.display_name || u.username)}
            </a>
            <div class="text-muted text-xs">@${escapeHTML(u.username)}</div>
          </div>
        </div>
        ${type === 'followers' && isSelf ? `
          <button class="btn btn-ghost btn-xs text-danger" onclick="handleRemoveFollower('${encodeURIComponent(u.username)}')">Remove</button>
        ` : `
          <a href="profile.html?u=${encodeURIComponent(u.username)}" class="btn btn-secondary btn-xs">View</a>
        `}
      </div>
    `).join('');
  } catch (err) {
    body.innerHTML = '<div class="text-danger text-center">Failed to load user list.</div>';
  }
}

async function handleRemoveFollower(username) {
  try {
    const res = await API.post(`/users/${username}/remove-follower/`);
    showToast(res.message || 'Follower removed.', 'info');
    const row = document.getElementById(`user-row-${decodeURIComponent(username)}`);
    if (row) row.remove();
    const countEl = document.getElementById('profile-follower-count');
    if (countEl && res.follower_count !== undefined) countEl.textContent = res.follower_count;
  } catch (err) {
    showToast('Failed to remove follower.', 'error');
  }
}

// Edit Profile Modal
let editAvatarFile = null;
let removeAvatarFlag = false;

function initEditProfileModal() {
  const avatarInput = document.getElementById('edit-avatar-input');
  const previewImg = document.getElementById('edit-avatar-preview');
  const removeAvatarBtn = document.getElementById('edit-remove-avatar-btn');
  const saveBtn = document.getElementById('edit-profile-save-btn');

  avatarInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Avatar file size must be under 5MB.', 'error');
      return;
    }
    editAvatarFile = file;
    removeAvatarFlag = false;
    const reader = new FileReader();
    reader.onload = (ev) => {
      previewImg.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  removeAvatarBtn?.addEventListener('click', () => {
    editAvatarFile = null;
    removeAvatarFlag = true;
    if (avatarInput) avatarInput.value = '';
    previewImg.src = '';
    showToast('Photo will be removed upon saving.', 'info');
  });

  saveBtn?.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const firstName = document.getElementById('edit-first-name').value.trim();
    const lastName = document.getElementById('edit-last-name').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    const location = document.getElementById('edit-location').value.trim();
    const website = document.getElementById('edit-website').value.trim();

    const formData = new FormData();
    formData.append('first_name', firstName);
    formData.append('last_name', lastName);
    formData.append('bio', bio);
    formData.append('location', location);
    formData.append('website', website);

    if (editAvatarFile) {
      formData.append('avatar', editAvatarFile);
    }
    if (removeAvatarFlag) {
      formData.append('remove_avatar', 'true');
    }

    try {
      const updated = await API.upload('/users/profile/', formData, 'PATCH');
      showToast('Profile updated!', 'success');
      document.getElementById('edit-profile-modal').classList.remove('active');
      profileUser = updated;
      renderProfileHeader(updated);
    } catch (err) {
      showToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
}

function openEditProfileModal() {
  const modal = document.getElementById('edit-profile-modal');
  if (!modal || !profileUser) return;

  document.getElementById('edit-first-name').value = profileUser.first_name || '';
  document.getElementById('edit-last-name').value = profileUser.last_name || '';
  document.getElementById('edit-bio').value = profileUser.bio || '';
  document.getElementById('edit-location').value = profileUser.location || '';
  document.getElementById('edit-website').value = profileUser.website || '';

  const preview = document.getElementById('edit-avatar-preview');
  if (preview) {
    preview.src = profileUser.avatar_url || '';
  }

  editAvatarFile = null;
  removeAvatarFlag = false;
  modal.classList.add('active');
}
