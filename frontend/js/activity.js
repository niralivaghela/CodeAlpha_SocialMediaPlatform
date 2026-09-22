/**
 * VIBELY USER REAL ACTIVITY & ANALYTICS
 * 100% Real Database Metrics & Chronological Action Log
 */

async function initActivityPage() {
  const container = document.getElementById('activity-content-container');
  if (!container) return;

  try {
    const data = await API.get('/users/me/activity/');
    renderActivityPage(data);
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title text-danger">Failed to load activity</div>
        <p class="text-muted">Please refresh to try again.</p>
      </div>
    `;
  }
}

function renderActivityPage(data) {
  const { stats, timeline } = data;

  // Render metric tiles
  const metricsContainer = document.getElementById('activity-metrics-grid');
  if (metricsContainer) {
    metricsContainer.innerHTML = `
      <div class="stat-tile">
        <div class="stat-icon-circle" style="background: var(--accent-coral-bg); color: var(--accent-coral);">📝</div>
        <div>
          <div class="stat-number-display">${stats.posts_count}</div>
          <div class="text-muted text-xs font-bold" style="text-transform: uppercase; letter-spacing: 0.05em;">Posts Published</div>
        </div>
      </div>

      <div class="stat-tile">
        <div class="stat-icon-circle" style="background: var(--accent-coral-bg); color: var(--color-like);">❤️</div>
        <div>
          <div class="stat-number-display">${stats.likes_received}</div>
          <div class="text-muted text-xs font-bold" style="text-transform: uppercase; letter-spacing: 0.05em;">Likes Received</div>
        </div>
      </div>

      <div class="stat-tile">
        <div class="stat-icon-circle" style="background: var(--accent-sky-bg); color: #0284C7;">💬</div>
        <div>
          <div class="stat-number-display">${stats.comments_written}</div>
          <div class="text-muted text-xs font-bold" style="text-transform: uppercase; letter-spacing: 0.05em;">Comments Written</div>
        </div>
      </div>

      <div class="stat-tile">
        <div class="stat-icon-circle" style="background: var(--accent-violet-bg); color: var(--accent-violet);">👥</div>
        <div>
          <div class="stat-number-display">${stats.followers_count}</div>
          <div class="text-muted text-xs font-bold" style="text-transform: uppercase; letter-spacing: 0.05em;">Followers</div>
        </div>
      </div>

      <div class="stat-tile">
        <div class="stat-icon-circle" style="background: var(--accent-honey-bg); color: #B45309;">🔖</div>
        <div>
          <div class="stat-number-display">${stats.saved_posts_count}</div>
          <div class="text-muted text-xs font-bold" style="text-transform: uppercase; letter-spacing: 0.05em;">Saved Posts</div>
        </div>
      </div>

      <div class="stat-tile">
        <div class="stat-icon-circle" style="background: var(--accent-mint-bg); color: var(--accent-mint);">⚡</div>
        <div>
          <div class="stat-number-display">${stats.active_moments_count}</div>
          <div class="text-muted text-xs font-bold" style="text-transform: uppercase; letter-spacing: 0.05em;">Active Moments</div>
        </div>
      </div>
    `;
  }

  // Render chronological timeline
  const timelineContainer = document.getElementById('activity-timeline-list');
  if (timelineContainer) {
    if (timeline.length === 0) {
      timelineContainer.innerHTML = `
        <div class="empty-state" style="padding: 2rem 0;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🌱</div>
          <div style="font-weight: 700;">No activity yet</div>
          <p class="text-muted text-sm">Create a post, like someone's update, or leave a comment to build your journey!</p>
        </div>
      `;
    } else {
      timelineContainer.innerHTML = timeline.map(ev => `
        <div class="timeline-event-row">
          <div style="font-size: 1.35rem; line-height: 1; padding-top: 2px;">${ev.icon}</div>
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
              <a href="${escapeHTML(ev.target_url)}" class="font-semibold text-sm" style="color: var(--text-main);">
                ${escapeHTML(ev.action)}
              </a>
              <span class="text-muted text-xs" style="white-space: nowrap;">${formatTimeAgo(ev.created_at)}</span>
            </div>
          </div>
        </div>
      `).join('');
    }
  }
}
