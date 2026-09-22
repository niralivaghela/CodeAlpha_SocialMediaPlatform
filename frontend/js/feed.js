/**
 * VIBELY FEED & POST INTERACTIONS
 */

let currentFeedPage = 1;
let currentFeedFilter = 'for_you';
let hasMorePosts = true;
let isFeedLoading = false;

function initFeed() {
  loadFeed(true);
  loadTrendingWidget();
  loadSuggestedUsersWidget();

  // Feed tabs (For You vs Following)
  document.querySelectorAll('.feed-filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.feed-filter-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      currentFeedFilter = e.target.dataset.filter;
      loadFeed(true);
    });
  });

  // Infinite scroll trigger
  window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 400) {
      if (!isFeedLoading && hasMorePosts) {
        loadFeed(false);
      }
    }
  });
}

async function loadFeed(reset = false) {
  if (isFeedLoading) return;
  isFeedLoading = true;

  const container = document.getElementById('feed-posts-container');
  const loadingIndicator = document.getElementById('feed-loading-spinner');

  if (reset) {
    currentFeedPage = 1;
    hasMorePosts = true;
    if (container) container.innerHTML = '';
  }

  if (loadingIndicator) loadingIndicator.style.display = 'block';

  try {
    const data = await API.get('/posts/', {
      page: currentFeedPage,
      filter: currentFeedFilter,
    });

    const posts = data.results || [];
    hasMorePosts = !!data.next;

    if (reset && posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✨</div>
          <div class="empty-state-title">Your feed is quiet</div>
          <p class="text-muted">Follow creators or share your thoughts to start connecting!</p>
        </div>
      `;
    } else {
      posts.forEach(post => {
        container.insertAdjacentHTML('beforeend', renderPostCardHTML(post));
      });
      currentFeedPage++;
    }
  } catch (err) {
    if (reset && container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title text-danger">Failed to load feed</div>
          <p class="text-muted">Please check your connection and refresh.</p>
        </div>
      `;
    }
  } finally {
    isFeedLoading = false;
    if (loadingIndicator) loadingIndicator.style.display = 'none';
  }
}

function formatPostContentWithHashtags(text) {
  if (!text) return '';
  const escaped = escapeHTML(text);
  // Match #hashtag and turn into clickable link
  return escaped.replace(/#(\w+)/g, (match, tag) => {
    return `<a href="explore.html?tag=${encodeURIComponent(tag)}" class="hashtag-pill">${match}</a>`;
  });
}

function renderPostCardHTML(post) {
  const author = post.author;
  const authorName = escapeHTML(author.display_name || author.username);
  const isLiked = post.is_liked;
  const isBookmarked = post.is_bookmarked;
  const isOwn = post.is_own_post;

  // Reaction mapping
  const reactionIcons = {
    'like': '❤️',
    'love': '💖',
    'funny': '😂',
    'celebrate': '👏',
    'wow': '😮',
    'sad': '😢'
  };
  const activeReactionIcon = post.user_reaction ? (reactionIcons[post.user_reaction] || '❤️') : null;

  // Pinned post badge
  const pinnedBadgeHTML = post.is_pinned ? `
    <div class="post-pinned-pill">
      <span>📌</span> Pinned to Profile
    </div>
  ` : '';

  // Location & feeling meta
  let extraMetaHTML = '';
  if (post.location || post.feeling) {
    extraMetaHTML = `
      <div class="post-meta-extra">
        ${post.location ? `<span>📍 ${escapeHTML(post.location)}</span>` : ''}
        ${post.location && post.feeling ? '<span>•</span>' : ''}
        ${post.feeling ? `<span>✨ ${escapeHTML(post.feeling)}</span>` : ''}
      </div>
    `;
  }

  // Quote post embed
  let quotePostHTML = '';
  const orig = post.repost_of_data || (typeof post.repost_of === 'object' ? post.repost_of : null);
  if (orig && orig.author) {
    quotePostHTML = `
      <div class="quote-post-card" onclick="window.location.href='feed.html#post-${orig.id}'">
        <div class="quote-post-header">
          ${renderAvatarHTML(orig.author, 'avatar-xs', false)}
          <span class="quote-post-author">${escapeHTML(orig.author.display_name || orig.author.username)}</span>
          <span class="text-muted text-xs">@${escapeHTML(orig.author.username)}</span>
        </div>
        <div class="quote-post-content">${formatPostContentWithHashtags(orig.content || '')}</div>
        ${orig.image_url ? `<img src="${orig.image_url}" class="quote-post-thumbnail" loading="lazy" onclick="event.stopPropagation(); openLightbox('${orig.image_url}')">` : ''}
      </div>
    `;
  }

  // Render Poll
  let pollHTML = '';
  if (post.poll) {
    const poll = post.poll;
    const hasVoted = poll.user_voted_option_id !== null;
    const optionsHTML = poll.options.map(opt => {
      const isSelected = poll.user_voted_option_id === opt.id;
      return `
        <div class="poll-option-row ${hasVoted ? 'voted' : ''} ${isSelected ? 'selected' : ''}"
             onclick="votePoll(${post.id}, ${opt.id}, ${hasVoted})">
          ${hasVoted ? `<div class="poll-option-progress" style="width: ${opt.percentage}%"></div>` : ''}
          <div class="poll-option-content">
            <span>${escapeHTML(opt.text)} ${isSelected ? '✓' : ''}</span>
            ${hasVoted ? `<span class="font-bold">${opt.percentage}%</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    pollHTML = `
      <div class="poll-card" id="poll-card-${post.id}">
        <div class="poll-question">📊 ${escapeHTML(poll.question)}</div>
        <div class="poll-options-list">${optionsHTML}</div>
        <div class="poll-stats">${poll.total_votes} ${poll.total_votes === 1 ? 'vote' : 'votes'}</div>
      </div>
    `;
  }

  // Render Media with Double-Tap Heart Burst & Lightbox Zoom
  let mediaHTML = '';
  if (post.image_url) {
    mediaHTML = `
      <div class="post-media-container" style="position: relative; overflow: hidden; cursor: pointer;"
           ondblclick="handleMediaDoubleTap(event, ${post.id})"
           onclick="openLightbox('${post.image_url}')"
           title="Click to view full size">
        <img src="${post.image_url}" alt="Post attachment" loading="lazy">
        <div class="double-tap-heart-overlay" id="double-tap-heart-${post.id}">
          <div class="double-tap-heart-icon">❤️</div>
          <div class="double-tap-sparkles">✨ ✨ ✨</div>
        </div>
      </div>
    `;
  }

  return `
    <article class="post-card stagger-card" id="post-card-${post.id}">
      ${pinnedBadgeHTML}
      <header class="post-header">
        <div class="post-author-info">
          <a href="profile.html?u=${encodeURIComponent(author.username)}">
            ${renderAvatarHTML(author, 'avatar-md', true)}
          </a>
          <div>
            <div>
              <a href="profile.html?u=${encodeURIComponent(author.username)}" class="post-meta-name">${authorName}</a>
              <span class="post-meta-username">@${escapeHTML(author.username)}</span>
            </div>
            <div class="post-meta-time">
              ${formatTimeAgo(post.created_at)} ${post.is_edited ? '• <span class="text-muted">Edited</span>' : ''}
            </div>
            ${extraMetaHTML}
          </div>
        </div>

        <div class="dropdown">
          <button class="btn-icon" onclick="toggleDropdown(this)" title="More options">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
          </button>
          <div class="dropdown-menu">
            ${isOwn ? `
              <button class="dropdown-item" onclick="togglePinPost(${post.id})">
                📌 ${post.is_pinned ? 'Unpin from Profile' : 'Pin to Profile'}
              </button>
              <button class="dropdown-item" onclick="openEditPostModal(${post.id}, '${encodeURIComponent(post.content)}')">
                ✏️ Edit Post
              </button>
              <button class="dropdown-item text-danger" onclick="deletePost(${post.id})">
                🗑️ Delete Post
              </button>
            ` : `
              <button class="dropdown-item" onclick="hidePost(${post.id})">
                🙈 Hide Post
              </button>
              <button class="dropdown-item" onclick="openCollectionModal(${post.id})">
                📁 Save to Collection...
              </button>
              <button class="dropdown-item" onclick="muteUserFromPost('${encodeURIComponent(author.username)}')">
                🔇 Mute @${escapeHTML(author.username)}
              </button>
              <button class="dropdown-item" onclick="openReportModal('post', ${post.id})">
                🚩 Report Post
              </button>
              <button class="dropdown-item text-danger" onclick="blockUserFromPost('${encodeURIComponent(author.username)}')">
                🚫 Block @${escapeHTML(author.username)}
              </button>
            `}
          </div>
        </div>
      </header>

      <div class="post-content" id="post-content-${post.id}">
        ${formatPostContentWithHashtags(post.content)}
      </div>

      ${mediaHTML}
      ${pollHTML}
      ${quotePostHTML}

      <footer class="post-actions">
        <!-- Multi-Reaction Button with Popover -->
        <div class="reaction-container">
          <div class="reaction-picker-popover" id="reaction-picker-${post.id}">
            <button type="button" class="reaction-btn-option" title="Like" onclick="reactToPost(${post.id}, 'like')">❤️</button>
            <button type="button" class="reaction-btn-option" title="Love" onclick="reactToPost(${post.id}, 'love')">💖</button>
            <button type="button" class="reaction-btn-option" title="Funny" onclick="reactToPost(${post.id}, 'funny')">😂</button>
            <button type="button" class="reaction-btn-option" title="Celebrate" onclick="reactToPost(${post.id}, 'celebrate')">👏</button>
            <button type="button" class="reaction-btn-option" title="Wow" onclick="reactToPost(${post.id}, 'wow')">😮</button>
            <button type="button" class="reaction-btn-option" title="Sad" onclick="reactToPost(${post.id}, 'sad')">😢</button>
          </div>
          <button class="action-btn like-ripple ${isLiked ? 'liked' : ''}" id="like-btn-${post.id}" onclick="toggleLike(${post.id})">
            ${activeReactionIcon ? `<span style="font-size: 1.1rem; line-height: 1;">${activeReactionIcon}</span>` : `
              <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            `}
            <span id="post-like-count-${post.id}">${post.like_count}</span>
          </button>
        </div>

        <button class="action-btn" onclick="toggleComments(${post.id})" title="Comments">
          <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          <span id="post-comment-count-${post.id}">${post.comment_count}</span>
        </button>

        <button class="action-btn" onclick="openQuoteModal(${post.id}, '${encodeURIComponent(author.username)}', '${encodeURIComponent(post.content || '')}', '${post.image_url || ''}')" title="Quote / Repost">
          <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
            <polyline points="17 1 21 5 17 9"></polyline>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
            <polyline points="7 23 3 19 7 15"></polyline>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
          </svg>
        </button>

        <button class="action-btn" onclick="sharePost(${post.id})" title="Share">
          <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
        </button>

        <button class="action-btn ${isBookmarked ? 'bookmarked' : ''}" id="bookmark-btn-${post.id}" onclick="toggleBookmark(${post.id})" title="Bookmark">
          <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
      </footer>

      <!-- Comments Container -->
      <div class="comments-container" id="comments-box-${post.id}"></div>
    </article>
  `;
}

// Double-Tap Heart Burst on Media
function handleMediaDoubleTap(event, postId) {
  event.stopPropagation();
  const overlay = document.getElementById(`double-tap-heart-${postId}`);
  if (overlay) {
    overlay.classList.remove('animate');
    void overlay.offsetWidth;
    overlay.classList.add('animate');
  }

  const btn = document.getElementById(`like-btn-${postId}`);
  if (btn && !btn.classList.contains('liked')) {
    toggleLike(postId);
  }
}

// Multi-Reactions
async function reactToPost(postId, reactionType) {
  try {
    const data = await API.post(`/posts/${postId}/react/`, { reaction_type: reactionType });
    const btn = document.getElementById(`like-btn-${postId}`);
    const countEl = document.getElementById(`post-like-count-${postId}`);

    const reactionIcons = {
      'like': '❤️', 'love': '💖', 'funny': '😂', 'celebrate': '👏', 'wow': '😮', 'sad': '😢'
    };

    if (data.is_liked && data.user_reaction) {
      btn.classList.add('liked');
      btn.innerHTML = `<span style="font-size: 1.1rem; line-height: 1;">${reactionIcons[data.user_reaction] || '❤️'}</span> <span id="post-like-count-${postId}">${data.like_count}</span>`;
    } else {
      btn.classList.remove('liked');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
        <span id="post-like-count-${postId}">${data.like_count}</span>
      `;
    }
  } catch (err) {
    showToast('Failed to save reaction.', 'error');
  }
}

// Post Actions
async function toggleLike(postId) {
  const btn = document.getElementById(`like-btn-${postId}`);
  const countEl = document.getElementById(`post-like-count-${postId}`);
  if (!btn) return;

  btn.classList.add('burst');
  setTimeout(() => btn.classList.remove('burst'), 500);

  try {
    const data = await API.post(`/posts/${postId}/like/`);
    if (data.is_liked) {
      btn.classList.add('liked');
    } else {
      btn.classList.remove('liked');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
        <span id="post-like-count-${postId}">${data.like_count}</span>
      `;
    }
    if (countEl) countEl.textContent = data.like_count;
  } catch (err) {
    showToast('Failed to update like.', 'error');
  }
}

async function hidePost(postId) {
  try {
    await API.post(`/posts/${postId}/hide/`);
    showToast('Post hidden from your feed.', 'info');
    const card = document.getElementById(`post-card-${postId}`);
    if (card) {
      card.style.transition = 'all 0.3s ease';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      setTimeout(() => card.remove(), 300);
    }
  } catch (err) {
    showToast('Failed to hide post.', 'error');
  }
}

async function togglePinPost(postId) {
  try {
    const res = await API.post(`/posts/${postId}/pin/`);
    showToast(res.message, 'success');
    setTimeout(() => loadFeed(true), 400);
  } catch (err) {
    showToast('Failed to pin post.', 'error');
  }
}

async function muteUserFromPost(username) {
  const user = decodeURIComponent(username);
  try {
    const res = await API.post(`/users/${user}/mute/`);
    if (res.is_muted) {
      showToast(`Muted @${user}. Their posts are hidden.`, 'info');
      setTimeout(() => loadFeed(true), 400);
    } else {
      showToast(`Unmuted @${user}.`, 'info');
    }
  } catch (err) {
    showToast('Failed to mute user.', 'error');
  }
}

async function toggleBookmark(postId) {
  const btn = document.getElementById(`bookmark-btn-${postId}`);
  if (!btn) return;

  try {
    const data = await API.post(`/posts/${postId}/bookmark/`);
    if (data.is_bookmarked) {
      btn.classList.add('bookmarked');
      showToast('Saved to bookmarks ✓', 'success');
    } else {
      btn.classList.remove('bookmarked');
      showToast('Removed from saved', 'info');
    }
  } catch (err) {
    showToast('Failed to bookmark post.', 'error');
  }
}

// Universal Lightbox
function openLightbox(imageUrl) {
  const modal = document.getElementById('media-lightbox-modal');
  const imgTarget = document.getElementById('lightbox-image-target');
  if (modal && imgTarget) {
    imgTarget.src = imageUrl;
    modal.classList.add('active');
  }
}

function closeLightbox(e) {
  if (!e || e.target.id === 'media-lightbox-modal' || e.target.classList.contains('lightbox-close-btn')) {
    const modal = document.getElementById('media-lightbox-modal');
    if (modal) modal.classList.remove('active');
  }
}

// Quote Post Modal
let activeQuotePostId = null;

function openQuoteModal(postId, username, content, imageUrl) {
  activeQuotePostId = postId;
  const modal = document.getElementById('quote-post-modal');
  const previewTarget = document.getElementById('quote-preview-target');
  const commentInput = document.getElementById('quote-comment-input');

  if (commentInput) commentInput.value = '';
  if (previewTarget) {
    previewTarget.innerHTML = `
      <div class="quote-post-header">
        <span class="quote-post-author">@${escapeHTML(decodeURIComponent(username || ''))}</span>
      </div>
      <div class="quote-post-content">${decodeURIComponent(content || '')}</div>
      ${imageUrl ? `<img src="${imageUrl}" class="quote-post-thumbnail">` : ''}
    `;
  }
  if (modal) modal.classList.add('active');
}

function closeQuoteModal() {
  const modal = document.getElementById('quote-post-modal');
  if (modal) modal.classList.remove('active');
  activeQuotePostId = null;
}

async function submitInstantRepost() {
  if (!activeQuotePostId) return;
  try {
    const res = await API.post('/posts/', { repost_of: activeQuotePostId, content: '' });
    showToast('Reposted to your profile! 🔁', 'success');
    closeQuoteModal();
    const container = document.getElementById('feed-posts-container');
    if (container) container.insertAdjacentHTML('afterbegin', renderPostCardHTML(res));
  } catch (err) {
    showToast('Failed to repost.', 'error');
  }
}

async function submitQuotePost() {
  if (!activeQuotePostId) return;
  const comment = document.getElementById('quote-comment-input').value.trim();
  if (!comment) {
    showToast('Please add your thoughts or use direct repost.', 'error');
    return;
  }

  try {
    const res = await API.post('/posts/', { repost_of: activeQuotePostId, content: comment });
    showToast('Quote post published! 💬', 'success');
    closeQuoteModal();
    const container = document.getElementById('feed-posts-container');
    if (container) container.insertAdjacentHTML('afterbegin', renderPostCardHTML(res));
  } catch (err) {
    showToast('Failed to quote post.', 'error');
  }
}

// Bookmark Collections
let activeCollectionPostId = null;

async function openCollectionModal(postId) {
  activeCollectionPostId = postId;
  const modal = document.getElementById('collection-modal');
  const target = document.getElementById('collections-list-target');
  if (!modal || !target) return;

  modal.classList.add('active');
  target.innerHTML = '<div class="text-muted text-sm" style="text-align:center; padding: 1rem;">Loading collections...</div>';

  try {
    const collections = await API.get('/posts/collections/');
    if (collections.length === 0) {
      target.innerHTML = '<div class="text-muted text-sm" style="text-align:center; padding: 1rem;">No custom collections yet. Create one above!</div>';
      return;
    }
    target.innerHTML = collections.map(col => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-bottom: 1px solid var(--border-color);">
        <div>
          <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">📁 ${escapeHTML(col.name)}</div>
          <div class="text-muted text-xs">${col.items_count || 0} items</div>
        </div>
        <button class="btn btn-outline btn-xs" onclick="togglePostInCollection(${col.id}, ${postId}, this)">
          Add
        </button>
      </div>
    `).join('');
  } catch {
    target.innerHTML = '<div class="text-danger text-sm">Failed to load collections.</div>';
  }
}

function closeCollectionModal() {
  const modal = document.getElementById('collection-modal');
  if (modal) modal.classList.remove('active');
  activeCollectionPostId = null;
}

async function createNewCollection() {
  const input = document.getElementById('new-collection-name');
  const name = input ? input.value.trim() : '';
  if (!name) return;

  try {
    await API.post('/posts/collections/', { name });
    input.value = '';
    showToast('Collection created!', 'success');
    if (activeCollectionPostId) openCollectionModal(activeCollectionPostId);
  } catch (err) {
    showToast('Failed to create collection.', 'error');
  }
}

async function togglePostInCollection(collectionId, postId, btn) {
  try {
    const res = await API.post(`/posts/${postId}/collection/`, { collection_id: collectionId });
    showToast(res.message, 'success');
    if (btn) btn.textContent = res.in_collection ? '✓ Added' : 'Add';
  } catch (err) {
    showToast('Failed to update collection item.', 'error');
  }
}

async function votePoll(postId, optionId, alreadyVoted) {
  if (alreadyVoted) {
    showToast('You have already voted in this poll.', 'info');
    return;
  }

  try {
    const updatedPoll = await API.post(`/posts/${postId}/vote/`, { option_id: optionId });
    showToast('Vote counted!', 'success');
    
    // Refresh single post poll HTML
    const pollCard = document.getElementById(`poll-card-${postId}`);
    if (pollCard) {
      const optionsHTML = updatedPoll.options.map(opt => {
        const isSelected = updatedPoll.user_voted_option_id === opt.id;
        return `
          <div class="poll-option-row voted ${isSelected ? 'selected' : ''}">
            <div class="poll-option-progress" style="width: ${opt.percentage}%"></div>
            <div class="poll-option-content">
              <span>${escapeHTML(opt.text)} ${isSelected ? '✓' : ''}</span>
              <span class="font-bold">${opt.percentage}%</span>
            </div>
          </div>
        `;
      }).join('');

      pollCard.querySelector('.poll-options-list').innerHTML = optionsHTML;
      pollCard.querySelector('.poll-stats').textContent = `${updatedPoll.total_votes} ${updatedPoll.total_votes === 1 ? 'vote' : 'votes'}`;
    }
  } catch (err) {
    showToast(err.message || 'Failed to vote.', 'error');
  }
}

function sharePost(postId) {
  const postUrl = `${window.location.origin}/feed.html#post-${postId}`;
  if (typeof openShareSheet === 'function') {
    openShareSheet(postUrl, 'Check out this post on Vibely!');
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(postUrl).then(() => {
      showToast('Post link copied to clipboard! ✓', 'success');
    });
  } else {
    showToast('Copy this link: ' + postUrl, 'info');
  }
}

async function deletePost(postId) {
  if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;

  try {
    await API.delete(`/posts/${postId}/`);
    showToast('Post deleted.', 'info');
    const card = document.getElementById(`post-card-${postId}`);
    if (card) {
      card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      card.style.opacity = '0';
      card.style.transform = 'translateY(-10px)';
      setTimeout(() => card.remove(), 300);
    }
  } catch (err) {
    showToast(err.message || 'Failed to delete post.', 'error');
  }
}

function openEditPostModal(postId, encodedContent) {
  const modal = document.getElementById('edit-post-modal');
  const textarea = document.getElementById('edit-post-content');
  const saveBtn = document.getElementById('edit-post-save-btn');

  if (!modal || !textarea || !saveBtn) return;

  textarea.value = decodeURIComponent(encodedContent);
  modal.classList.add('active');

  saveBtn.onclick = async () => {
    const newContent = textarea.value.trim();
    if (!newContent) {
      showToast('Post content cannot be empty.', 'error');
      return;
    }

    try {
      const updated = await API.patch(`/posts/${postId}/`, { content: newContent });
      showToast('Post updated!', 'success');
      modal.classList.remove('active');
      
      const contentEl = document.getElementById(`post-content-${postId}`);
      if (contentEl) {
        contentEl.innerHTML = formatPostContentWithHashtags(updated.content);
      }
    } catch (err) {
      showToast('Failed to update post.', 'error');
    }
  };
}

async function blockUserFromPost(username) {
  const user = decodeURIComponent(username);
  if (!confirm(`Are you sure you want to block @${user}? Their posts and messages will no longer appear.`)) return;

  try {
    await API.post(`/users/${user}/block/`);
    showToast(`Blocked @${user}. Refreshing feed...`, 'info');
    setTimeout(() => {
      loadFeed(true);
    }, 600);
  } catch (err) {
    showToast('Failed to block user.', 'error');
  }
}

// Dropdown Helper
function toggleDropdown(button) {
  const menu = button.nextElementSibling;
  const isOpen = menu.classList.contains('active');
  document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active'));
  if (!isOpen) {
    menu.classList.add('active');
  }
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active'));
  }
});

// Sidebar Widgets
async function loadTrendingWidget() {
  const container = document.getElementById('trending-widget-list');
  if (!container) return;

  try {
    const tags = await API.get('/explore/trending/');
    if (tags.length === 0) {
      container.innerHTML = '<div class="text-muted text-sm">No trending topics yet.</div>';
      return;
    }
    container.innerHTML = tags.slice(0, 5).map(tag => `
      <div class="trending-topic-item" onclick="window.location.href='explore.html?tag=${encodeURIComponent(tag.name)}'">
        <div>
          <span class="hashtag-pill">#${escapeHTML(tag.name)}</span>
          <div class="text-muted text-xs">${tag.post_count} ${tag.post_count === 1 ? 'post' : 'posts'}</div>
        </div>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<div class="text-muted text-sm">Trending unavailable.</div>';
  }
}

async function loadSuggestedUsersWidget() {
  const container = document.getElementById('suggested-users-list');
  if (!container) return;

  try {
    const users = await API.get('/users/suggested/');
    if (users.length === 0) {
      container.innerHTML = '<div class="text-muted text-sm">No suggestions right now.</div>';
      return;
    }
    container.innerHTML = users.map(u => `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; min-width: 0;">
          <a href="profile.html?u=${encodeURIComponent(u.username)}">
            ${renderAvatarHTML(u, 'avatar-sm', true)}
          </a>
          <div style="min-width: 0; line-height: 1.2;">
            <a href="profile.html?u=${encodeURIComponent(u.username)}" class="font-semibold text-sm" style="display: block; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHTML(u.display_name || u.username)}
            </a>
            <span class="text-muted text-xs">@${escapeHTML(u.username)}</span>
          </div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="quickFollowUser('${encodeURIComponent(u.username)}', this)">Follow</button>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<div class="text-muted text-sm">Suggestions unavailable.</div>';
  }
}

async function quickFollowUser(username, button) {
  const user = decodeURIComponent(username);
  try {
    const res = await API.post(`/users/${user}/follow/`);
    if (res.is_following) {
      button.textContent = 'Following';
      button.className = 'btn btn-secondary btn-sm';
    } else {
      button.textContent = 'Follow';
      button.className = 'btn btn-outline btn-sm';
    }
  } catch (err) {
    showToast('Failed to update follow.', 'error');
  }
}

function openReportModal(targetType, targetId) {
  const modal = document.getElementById('report-modal');
  const submitBtn = document.getElementById('report-submit-btn');
  if (!modal || !submitBtn) return;
  modal.classList.add('active');

  submitBtn.onclick = async () => {
    const reasonSelect = document.getElementById('report-reason-select');
    const detailsInput = document.getElementById('report-details-input');
    const reason = reasonSelect ? reasonSelect.value : 'other';
    const details = detailsInput ? detailsInput.value.trim() : '';

    try {
      await API.post('/reports/', {
        target_type: targetType,
        target_id: targetId,
        reason,
        details,
      });
      showToast('Report submitted. Thank you for keeping Vibely safe.', 'success');
      modal.classList.remove('active');
    } catch (err) {
      showToast('Failed to submit report.', 'error');
    }
  };
}

let currentEditingPostId = null;

function openEditPostModal(postId, encodedContent) {
  let modal = document.getElementById('edit-post-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'edit-post-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title">Edit Post</h3>
          <button class="btn-icon" onclick="closeEditPostModal()">&times;</button>
        </div>
        <div class="modal-body">
          <textarea id="edit-post-content-input" class="form-control" rows="4" placeholder="Edit your post caption..."></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" onclick="closeEditPostModal()">Cancel</button>
          <button class="btn btn-coral btn-sm" onclick="saveEditedPost()">Save Changes</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  currentEditingPostId = postId;
  const input = document.getElementById('edit-post-content-input');
  if (input) {
    input.value = decodeURIComponent(encodedContent || '');
  }
  modal.classList.add('active');
}

function closeEditPostModal() {
  const modal = document.getElementById('edit-post-modal');
  if (modal) modal.classList.remove('active');
  currentEditingPostId = null;
}

async function saveEditedPost() {
  if (!currentEditingPostId) return;

  const input = document.getElementById('edit-post-content-input');
  const content = input ? input.value.trim() : '';

  try {
    const updated = await API.patch(`/posts/${currentEditingPostId}/`, { content });
    showToast('Post updated! ✨', 'success');
    closeEditPostModal();
    const postEl = document.getElementById(`post-${currentEditingPostId}`);
    if (postEl) {
      const contentEl = postEl.querySelector('.post-content');
      if (contentEl) contentEl.innerHTML = formatPostContentWithHashtags(updated.content);
    }
  } catch (err) {
    showToast(err.message || 'Failed to edit post.', 'error');
  }
}

