/**
 * VIBELY MOMENTS (STORIES) SYSTEM
 * 24-Hour Expiration, Real Database Storage, Interactive Story Player
 */

let activeStoryGroups = [];
let currentGroupIndex = 0;
let currentStoryIndex = 0;
let storyTimer = null;
let storyProgressInterval = null;
let isStoryPaused = false;

async function initMomentsStrip() {
  const container = document.getElementById('moments-scroll-container');
  if (!container) return;

  try {
    const groups = await API.get('/stories/');
    activeStoryGroups = groups || [];
    renderMomentsStrip(activeStoryGroups);
  } catch (err) {
    console.error('Failed to load moments:', err);
  }
}

function renderMomentsStrip(groups) {
  const container = document.getElementById('moments-scroll-container');
  if (!container) return;

  const currentU = window.currentUser;

  let html = `
    <!-- Your Moment Add Item -->
    <div class="moment-item" onclick="openCreateMomentModal()">
      <div class="moment-ring add-moment">
        <div class="moment-avatar-inner" style="background: var(--bg-surface-secondary); color: var(--primary);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
      </div>
      <span class="moment-username">Your Moment</span>
    </div>
  `;

  groups.forEach((group, gIdx) => {
    const u = group.user;
    const isSelf = currentU && currentU.username === u.username;
    const displayName = isSelf ? 'You' : escapeHTML(u.display_name.split(' ')[0] || u.username);

    html += `
      <div class="moment-item" onclick="openStoryViewer(${gIdx}, 0)">
        <div class="moment-ring">
          ${u.avatar_url ? `
            <img src="${escapeHTML(u.avatar_url)}" alt="${escapeHTML(u.username)}" class="moment-avatar-inner">
          ` : `
            <div class="moment-avatar-inner">${escapeHTML(u.initials || u.username.slice(0, 2).toUpperCase())}</div>
          `}
        </div>
        <span class="moment-username">${displayName}</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

/* -------------------------------------------------------------
   STORY VIEWER PLAYER
   ------------------------------------------------------------- */
function openStoryViewer(groupIndex, storyIndex = 0) {
  if (!activeStoryGroups[groupIndex] || !activeStoryGroups[groupIndex].stories[storyIndex]) return;

  currentGroupIndex = groupIndex;
  currentStoryIndex = storyIndex;

  const modal = document.getElementById('story-viewer-modal');
  if (modal) modal.classList.add('active');

  renderCurrentStory();
}

function closeStoryViewer() {
  clearStoryTimers();
  const modal = document.getElementById('story-viewer-modal');
  if (modal) modal.classList.remove('active');
}

function clearStoryTimers() {
  clearTimeout(storyTimer);
  clearInterval(storyProgressInterval);
}

function renderCurrentStory() {
  clearStoryTimers();

  const group = activeStoryGroups[currentGroupIndex];
  if (!group) {
    closeStoryViewer();
    return;
  }

  const stories = group.stories;
  if (currentStoryIndex >= stories.length) {
    // Advance to next group
    if (currentGroupIndex + 1 < activeStoryGroups.length) {
      currentGroupIndex++;
      currentStoryIndex = 0;
      renderCurrentStory();
    } else {
      closeStoryViewer();
    }
    return;
  }

  const story = stories[currentStoryIndex];
  const user = group.user;

  // Render progress segments
  const progressBox = document.getElementById('story-progress-box');
  if (progressBox) {
    progressBox.innerHTML = stories.map((s, idx) => `
      <div class="story-progress-seg">
        <div class="story-progress-fill" id="story-fill-${idx}" style="width: ${idx < currentStoryIndex ? '100%' : '0%'}"></div>
      </div>
    `).join('');
  }

  // Render author info
  const authorInfo = document.getElementById('story-author-info');
  if (authorInfo) {
    authorInfo.innerHTML = `
      <div style="font-weight: 700; font-size: 0.95rem;">${escapeHTML(user.display_name || user.username)}</div>
      <div style="font-size: 0.75rem; opacity: 0.85;">${formatTimeAgo(story.created_at)}</div>
    `;
  }

  // Render Canvas
  const canvas = document.getElementById('story-canvas');
  if (canvas) {
    if (story.media_url) {
      canvas.style.background = '#000000';
      canvas.innerHTML = `
        <img src="${escapeHTML(story.media_url)}" class="story-image-bg" alt="Moment">
        ${story.caption ? `<div class="story-caption-large" style="position: absolute; bottom: 3rem; left: 1.5rem; right: 1.5rem;">${escapeHTML(story.caption)}</div>` : ''}
      `;
    } else {
      canvas.style.background = story.background_color || 'linear-gradient(135deg, #FF6B6B, #FF8E72)';
      canvas.innerHTML = `
        <div class="story-caption-large">${escapeHTML(story.caption)}</div>
      `;
    }
  }

  // Start progress timer (5 seconds)
  const duration = 5000;
  const start = Date.now();
  const fillEl = document.getElementById(`story-fill-${currentStoryIndex}`);

  storyProgressInterval = setInterval(() => {
    if (isStoryPaused) return;
    const elapsed = Date.now() - start;
    const pct = Math.min(100, (elapsed / duration) * 100);
    if (fillEl) fillEl.style.width = `${pct}%`;
  }, 50);

  storyTimer = setTimeout(() => {
    currentStoryIndex++;
    renderCurrentStory();
  }, duration);
}

function nextStory() {
  clearStoryTimers();
  const group = activeStoryGroups[currentGroupIndex];
  if (group && currentStoryIndex + 1 < group.stories.length) {
    currentStoryIndex++;
    renderCurrentStory();
  } else if (currentGroupIndex + 1 < activeStoryGroups.length) {
    currentGroupIndex++;
    currentStoryIndex = 0;
    renderCurrentStory();
  } else {
    closeStoryViewer();
  }
}

function prevStory() {
  clearStoryTimers();
  if (currentStoryIndex > 0) {
    currentStoryIndex--;
    renderCurrentStory();
  } else if (currentGroupIndex > 0) {
    currentGroupIndex--;
    currentStoryIndex = 0;
    renderCurrentStory();
  }
}

/* -------------------------------------------------------------
   CREATE MOMENT MODAL
   ------------------------------------------------------------- */
let selectedMomentColor = 'linear-gradient(135deg, #FF6B6B, #FF8E72)';
let selectedMomentFile = null;

function openCreateMomentModal() {
  const modal = document.getElementById('create-moment-modal');
  if (modal) {
    modal.classList.add('active');
    selectedMomentFile = null;
    const preview = document.getElementById('moment-file-preview');
    if (preview) preview.style.display = 'none';
  }
}

function closeCreateMomentModal() {
  const modal = document.getElementById('create-moment-modal');
  if (modal) modal.classList.remove('active');
}

function setMomentBackground(gradient) {
  selectedMomentColor = gradient;
  const card = document.getElementById('moment-preview-card');
  if (card) card.style.background = gradient;
}

async function publishMoment() {
  const textInput = document.getElementById('moment-caption-input');
  const caption = textInput ? textInput.value.trim() : '';

  if (!caption && !selectedMomentFile) {
    showToast('Please type a caption or attach a photo.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('caption', caption);
  formData.append('background_color', selectedMomentColor);
  if (selectedMomentFile) {
    formData.append('media', selectedMomentFile);
  }

  try {
    await API.upload('/stories/', formData, 'POST');
    showToast('Your Moment was published! ✨', 'success');
    closeCreateMomentModal();
    if (textInput) textInput.value = '';
    initMomentsStrip();
  } catch (err) {
    showToast(err.message || 'Failed to publish moment.', 'error');
  }
}
