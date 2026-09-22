/**
 * VIBELY ADMIN & MODERATION DASHBOARD
 * Live statistics, reports queue, post removal, and user suspension management.
 */

let allReports = [];
let currentReportFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await initNavigation(true);
  if (!user) return;

  if (!user.is_staff && !user.is_superuser) {
    document.body.innerHTML = `
      <div style="max-width: 600px; margin: 5rem auto; text-align: center; padding: 2rem;">
        <h2 style="font-size: 2rem; margin-bottom: 1rem;">🚫 Access Restricted</h2>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
          The Admin & Moderation Hub is only accessible to platform administrators and staff members.
        </p>
        <a href="feed.html" class="btn btn-coral">Return to Feed</a>
      </div>
    `;
    return;
  }

  loadAdminData();
});

async function loadAdminData() {
  await Promise.all([
    fetchStats(),
    fetchReports()
  ]);
}

async function fetchStats() {
  try {
    const stats = await API.get('/admin-panel/stats/');
    if (stats) {
      document.getElementById('stat-total-users').textContent = Number(stats.total_users || 0).toLocaleString();
      document.getElementById('stat-total-posts').textContent = Number(stats.total_posts || 0).toLocaleString();
      document.getElementById('stat-total-comments').textContent = Number(stats.total_comments || 0).toLocaleString();
      document.getElementById('stat-active-stories').textContent = Number(stats.active_stories || 0).toLocaleString();
      document.getElementById('stat-pending-reports').textContent = Number(stats.pending_reports || 0).toLocaleString();
    }
  } catch (err) {
    console.error('Failed to load admin stats:', err);
  }
}

async function fetchReports(statusFilter = '') {
  const tbody = document.getElementById('reports-table-body');
  try {
    let url = '/admin-panel/reports/';
    if (statusFilter && statusFilter !== 'all') {
      url += `?status=${encodeURIComponent(statusFilter)}`;
    }
    const reports = await API.get(url);
    allReports = Array.isArray(reports) ? reports : (reports?.results || []);
    renderReportsTable(allReports);
  } catch (err) {
    console.error('Failed to load reports:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-danger); padding: 2rem;">
          Failed to load reports queue. Check server connection.
        </td>
      </tr>
    `;
  }
}

function filterReports(status, btn) {
  currentReportFilter = status;
  // Update active pill
  document.querySelectorAll('#report-filter-pills .pill-btn').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');

  fetchReports(status);
}

function renderReportsTable(reports) {
  const tbody = document.getElementById('reports-table-body');
  if (!reports || reports.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
          🎉 No reports found matching current filter. All quiet on the platform!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = reports.map(r => {
    const isPending = r.status === 'pending';
    const isResolved = r.status === 'resolved';
    const badgeClass = isPending ? 'admin-badge-pending' : (isResolved ? 'admin-badge-resolved' : '');
    const badgeStyle = !isPending && !isResolved ? 'background: var(--bg-surface-secondary); color: var(--text-muted); padding: 0.25rem 0.6rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700;' : '';

    const reporterUsername = r.reporter?.username || r.reporter_username || 'anonymous';
    const isPost = r.target_type === 'post' || !!r.post_id;
    const isUser = r.target_type === 'user' || !!r.reported_user_username;
    const postId = r.target_type === 'post' ? r.target_id : r.post_id;
    const reportedUsername = r.reported_user_username || (r.target_type === 'user' ? `user_${r.target_id}` : null);

    let targetInfo = '';
    if (isPost && postId) {
      targetInfo = `
        <div>
          <span style="font-weight: 700; color: var(--coral-primary);">Post #${postId}</span>
          ${r.post_snippet ? `<div class="text-xs text-muted" style="margin-top: 2px;">"${escapeHTML(r.post_snippet)}"</div>` : ''}
        </div>
      `;
    } else if (isUser) {
      targetInfo = `
        <div>
          <a href="profile.html?user=${encodeURIComponent(reportedUsername)}" style="font-weight: 700; color: var(--text-main);">
            @${escapeHTML(reportedUsername)}
          </a>
          <div class="text-xs text-muted">User Account</div>
        </div>
      `;
    } else {
      targetInfo = `<span class="text-muted text-xs">${escapeHTML(r.target_type || 'General')} #${r.target_id || ''}</span>`;
    }

    const createdDate = new Date(r.created_at).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return `
      <tr>
        <td style="font-weight: 700; color: var(--text-muted);">#${r.id}</td>
        <td>
          <a href="profile.html?user=${encodeURIComponent(reporterUsername)}" style="font-weight: 600; color: var(--text-main);">
            @${escapeHTML(reporterUsername)}
          </a>
        </td>
        <td>${targetInfo}</td>
        <td>
          <span style="font-weight: 700; color: var(--text-main); font-size: 0.85rem; text-transform: capitalize;">${escapeHTML(r.reason)}</span>
          ${r.details ? `<div class="text-xs text-secondary" style="margin-top: 3px; max-width: 240px; word-break: break-word;">${escapeHTML(r.details)}</div>` : ''}
        </td>
        <td class="text-xs text-muted" style="white-space: nowrap;">${createdDate}</td>
        <td>
          <span class="${badgeClass}" style="${badgeStyle}">
            ${escapeHTML(r.status.toUpperCase())}
          </span>
          ${r.resolved_by_username ? `<div class="text-xs text-muted" style="margin-top: 3px;">by @${escapeHTML(r.resolved_by_username)}</div>` : ''}
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
            ${isPending ? `
              <button class="btn btn-sm btn-outline" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="resolveReport(${r.id}, 'resolved')">
                ✓ Resolve
              </button>
              <button class="btn btn-sm btn-outline" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="resolveReport(${r.id}, 'dismissed')">
                ✕ Dismiss
              </button>
            ` : ''}
            ${postId ? `
              <button class="btn btn-sm btn-danger" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="deleteReportedPost(${postId}, ${r.id})">
                🗑️ Remove Post
              </button>
            ` : ''}
            ${reportedUsername ? `
              <button class="btn btn-sm btn-danger" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="quickBanUser('${escapeHTML(reportedUsername)}')">
                ⛔ Suspend User
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function resolveReport(reportId, actionStatus) {
  try {
    await API.post(`/admin-panel/reports/${reportId}/resolve/`, { status: actionStatus });
    showToast(`Report #${reportId} marked as ${actionStatus}`);
    fetchReports(currentReportFilter);
    fetchStats();
  } catch (err) {
    alert(err.message || 'Failed to update report status');
  }
}

async function deleteReportedPost(postId, reportId) {
  if (!confirm(`Are you sure you want to remove Post #${postId}? This action cannot be undone.`)) return;

  try {
    await API.delete(`/admin-panel/posts/${postId}/`);
    showToast(`Post #${postId} deleted successfully`);
    if (reportId) {
      await API.post(`/admin-panel/reports/${reportId}/resolve/`, { status: 'resolved' });
    }
    fetchReports(currentReportFilter);
    fetchStats();
  } catch (err) {
    alert(err.message || 'Failed to delete post');
  }
}

async function quickBanUser(username) {
  if (!confirm(`Are you sure you want to toggle suspension for user @${username}?`)) return;

  try {
    const res = await API.post(`/admin-panel/users/${username}/ban/`);
    showToast(res.message || `User @${username} status updated`);
    fetchStats();
    fetchReports(currentReportFilter);
  } catch (err) {
    alert(err.message || 'Failed to update user status');
  }
}

// User Lookup Tool
async function handleUserLookup(e) {
  e.preventDefault();
  const input = document.getElementById('admin-user-input');
  const username = input.value.trim();
  if (!username) return;

  const detailsContainer = document.getElementById('admin-user-details');
  detailsContainer.style.display = 'block';
  detailsContainer.innerHTML = '<span class="text-muted text-xs">Looking up user...</span>';

  try {
    const profile = await API.get(`/users/${encodeURIComponent(username)}/`);
    const isDeactivated = profile.is_deactivated;
    const isStaff = profile.is_staff || profile.is_superuser;

    detailsContainer.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <div style="font-weight: 800; font-size: 1rem; color: var(--text-main);">
            ${escapeHTML(profile.display_name)} (@${escapeHTML(profile.username)})
          </div>
          <div class="text-xs text-secondary" style="margin-top: 2px;">
            ${profile.post_count || 0} posts • ${profile.follower_count || 0} followers
            ${isStaff ? ' • <span style="color: var(--coral-primary); font-weight: 700;">STAFF</span>' : ''}
          </div>
          <div style="margin-top: 6px;">
            Status: 
            <span style="font-weight: 700; color: ${isDeactivated ? 'var(--text-danger)' : '#15803D'};">
              ${isDeactivated ? '⛔ DEACTIVATED / BANNED' : '✅ ACTIVE'}
            </span>
          </div>
        </div>
        <div>
          <button class="btn btn-sm ${isDeactivated ? 'btn-coral' : 'btn-danger'}" onclick="toggleUserBan('${escapeHTML(profile.username)}', ${isDeactivated})">
            ${isDeactivated ? 'Reactivate Account' : 'Suspend / Ban Account'}
          </button>
        </div>
      </div>
    `;
  } catch (err) {
    detailsContainer.innerHTML = `
      <div style="color: var(--text-danger); font-size: 0.85rem;">
        User @${escapeHTML(username)} not found.
      </div>
    `;
  }
}

async function toggleUserBan(username, currentlyDeactivated) {
  const actionText = currentlyDeactivated ? 'reactivate' : 'suspend';
  if (!confirm(`Are you sure you want to ${actionText} user @${username}?`)) return;

  try {
    const res = await API.post(`/admin-panel/users/${username}/ban/`);
    showToast(res.message);
    document.getElementById('admin-user-lookup-form').dispatchEvent(new Event('submit'));
    fetchStats();
  } catch (err) {
    alert(err.message || 'Failed to update user status');
  }
}

// Content Moderation Tool (direct post deletion)
async function handleAdminPostDelete(e) {
  e.preventDefault();
  const input = document.getElementById('admin-post-id-input');
  const postId = input.value.trim();
  if (!postId) return;

  if (!confirm(`Are you sure you want to permanently delete Post #${postId}?`)) return;

  try {
    await API.delete(`/admin-panel/posts/${postId}/`);
    showToast(`Post #${postId} deleted successfully`);
    input.value = '';
    fetchStats();
    fetchReports(currentReportFilter);
  } catch (err) {
    alert(err.message || `Failed to delete post #${postId}`);
  }
}
