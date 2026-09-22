/**
 * VIBELY NOTIFICATIONS SYSTEM
 */

let allNotifications = [];
let notifFilter = 'all';

async function initNotificationsPage() {
  loadNotifications();

  document.getElementById('mark-all-read-btn')?.addEventListener('click', markAllNotificationsRead);

  document.querySelectorAll('.notif-filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.notif-filter-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      notifFilter = e.target.dataset.filter;
      renderNotificationsList();
    });
  });
}

async function loadNotifications() {
  const container = document.getElementById('notifications-list-container');
  if (!container) return;

  container.innerHTML = '<div class="text-muted text-center" style="padding: 2rem;">Loading notifications...</div>';

  try {
    const data = await API.get('/notifications/');
    allNotifications = data.results || [];
    renderNotificationsList();
  } catch (err) {
    container.innerHTML = '<div class="text-danger text-center">Failed to load notifications.</div>';
  }
}

function renderNotificationsList() {
  const container = document.getElementById('notifications-list-container');
  if (!container) return;

  let filtered = allNotifications;
  if (notifFilter === 'unread') {
    filtered = allNotifications.filter(n => !n.is_read);
  } else if (notifFilter !== 'all') {
    filtered = allNotifications.filter(n => n.category === notifFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔔</div>
        <div class="empty-state-title">You're all caught up!</div>
        <p class="text-muted">No ${notifFilter !== 'all' ? notifFilter + ' ' : ''}notifications at the moment.</p>
      </div>
    `;
    return;
  }

  const icons = {
    like: '❤️',
    reaction: '✨',
    comment: '💬',
    reply: '↩️',
    repost: '🔁',
    follow: '👤',
    follow_request: '🔒',
    mention: '📣',
    story_view: '⚡',
    message: '✉️'
  };

  container.innerHTML = filtered.map(n => {
    const actor = n.actor;
    const actorName = escapeHTML(actor.display_name || actor.username);
    const actionDesc = n.action_type === 'like' ? 'liked your post'
      : n.action_type === 'reaction' ? 'reacted to your post'
      : n.action_type === 'comment' ? 'commented on your post'
      : n.action_type === 'reply' ? 'replied to your comment'
      : n.action_type === 'repost' ? 'reposted your post'
      : n.action_type === 'follow' ? 'started following you'
      : n.action_type === 'follow_request' ? 'requested to follow you'
      : n.action_type === 'story_view' ? 'viewed your Moment'
      : n.action_type === 'mention' ? 'mentioned you'
      : n.action_type === 'message' ? 'sent you a message'
      : 'interacted with you';

    const linkTarget = n.action_type === 'follow_request'
      ? 'settings.html#privacy'
      : n.post_id ? `feed.html#post-${n.post_id}`
      : `profile.html?u=${encodeURIComponent(actor.username)}`;

    return `
      <div class="widget-card" style="margin-bottom: 0.75rem; padding: 1rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; ${!n.is_read ? 'border-left: 4px solid var(--primary); background: var(--bg-surface-secondary);' : ''}"
           onclick="handleNotificationClick(${n.id}, '${linkTarget}')">
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <span style="font-size: 1.25rem;">${icons[n.action_type] || '🔔'}</span>
          <a href="profile.html?u=${encodeURIComponent(actor.username)}" onclick="event.stopPropagation();">
            ${renderAvatarHTML(actor, 'avatar-sm', true)}
          </a>
          <div>
            <div>
              <strong style="color: var(--text-main);">${actorName}</strong>
              <span class="text-secondary">${actionDesc}</span>
            </div>
            <div class="text-muted text-xs">${formatTimeAgo(n.created_at)}</div>
          </div>
        </div>

        ${!n.is_read ? `
          <button class="btn-ghost btn-sm" onclick="event.stopPropagation(); markSingleNotificationRead(${n.id})" title="Mark read">
            ✓
          </button>
        ` : ''}
      </div>
    `;
  }).join('');
}

async function handleNotificationClick(notifId, targetUrl) {
  try {
    await API.patch(`/notifications/${notifId}/read/`);
  } catch {
    // Continue navigation
  }
  window.location.href = targetUrl;
}

async function markSingleNotificationRead(notifId) {
  try {
    await API.patch(`/notifications/${notifId}/read/`);
    const notif = allNotifications.find(n => n.id === notifId);
    if (notif) notif.is_read = true;
    renderNotificationsList();
    showToast('Marked as read.', 'info');
  } catch {
    showToast('Failed to update notification.', 'error');
  }
}

async function markAllNotificationsRead() {
  try {
    await API.post('/notifications/read-all/');
    allNotifications.forEach(n => n.is_read = true);
    renderNotificationsList();
    showToast('All notifications marked as read.', 'success');
  } catch {
    showToast('Failed to mark all as read.', 'error');
  }
}
