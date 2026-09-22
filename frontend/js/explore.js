/**
 * VIBELY DISCOVER & EXPLORE
 * 5 Database-Backed Discovery Modules:
 * 1. Featured Spotlight Hero
 * 2. Trending Hashtags Strip
 * 3. Recommended Creators Spotlight
 * 4. Visual Media Discovery Gallery
 * 5. Popular & Category Masonry Feed
 */

let searchDebounceTimer = null;
let currentCategory = 'all';
let currentCategoryPosts = [];

function initExplorePage() {
  const searchInput = document.getElementById('explore-search-input');
  const catPills = document.querySelectorAll('.cat-pill');

  const urlParams = new URLSearchParams(window.location.search);
  const tagParam = urlParams.get('tag');
  const qParam = urlParams.get('q');

  // Load all 4 top modules
  loadFeaturedSpotlight();
  loadTrendingTags();
  loadRecommendedCreators();
  loadMediaGrid();

  if (tagParam) {
    if (searchInput) searchInput.value = `#${tagParam}`;
    loadCategoryFeed(tagParam, 'tag');
  } else if (qParam) {
    if (searchInput) searchInput.value = qParam;
    performSearch(qParam);
  } else {
    loadCategoryFeed('all');
  }

  // Debounced search
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    const q = searchInput.value.trim();

    if (!q) {
      loadCategoryFeed('all');
      return;
    }

    searchDebounceTimer = setTimeout(() => {
      performSearch(q);
    }, 300);
  });

  // Category filter tabs
  catPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      catPills.forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      currentCategory = e.target.dataset.cat || 'all';
      loadCategoryFeed(currentCategory);
    });
  });
}

// 1. Featured Content Spotlight Hero
async function loadFeaturedSpotlight() {
  const container = document.getElementById('discover-featured-container');
  if (!container) return;

  try {
    const posts = await API.get('/explore/popular/');
    if (!posts || posts.length === 0) {
      container.style.display = 'none';
      return;
    }

    const post = posts[0];
    const author = post.author;

    container.innerHTML = `
      <div class="featured-hero-card" style="background: linear-gradient(135deg, rgba(255, 107, 107, 0.08), rgba(255, 142, 114, 0.14)); border: 1px solid rgba(255, 107, 107, 0.25); border-radius: var(--radius-xl); padding: 2rem; position: relative; overflow: hidden; cursor: pointer;" onclick="window.location.href='feed.html#post-${post.id}'">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <span class="badge badge-coral font-bold" style="padding: 0.35rem 0.85rem; border-radius: var(--radius-full);">✨ Editor's Choice</span>
          <span class="text-muted text-xs">Trending this week</span>
        </div>

        <div style="display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 280px;">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
              <a href="profile.html?u=${encodeURIComponent(author.username)}" onclick="event.stopPropagation();">
                ${renderAvatarHTML(author, 'avatar-md', true)}
              </a>
              <div>
                <a href="profile.html?u=${encodeURIComponent(author.username)}" class="font-bold text-sm" style="color: var(--text-main);" onclick="event.stopPropagation();">
                  ${escapeHTML(author.display_name || author.username)}
                </a>
                <div class="text-muted text-xs">@${escapeHTML(author.username)}</div>
              </div>
            </div>

            <p style="font-size: 1.25rem; font-weight: 700; line-height: 1.5; color: var(--text-main); margin-bottom: 1rem;">
              "${escapeHTML(post.content ? (post.content.length > 220 ? post.content.slice(0, 220) + '...' : post.content) : 'Visual Moment')}"
            </p>

            <div style="display: flex; gap: 1.25rem; font-size: 0.875rem; color: var(--text-muted);">
              <span>❤️ <strong>${post.like_count || 0}</strong> likes</span>
              <span>💬 <strong>${post.comment_count || 0}</strong> comments</span>
              ${post.location ? `<span>📍 ${escapeHTML(post.location)}</span>` : ''}
            </div>
          </div>

          ${post.image_url ? `
            <div style="width: 240px; height: 160px; border-radius: var(--radius-lg); overflow: hidden; flex-shrink: 0; box-shadow: var(--shadow-md);">
              <img src="${post.image_url}" alt="Featured preview" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } catch {
    container.style.display = 'none';
  }
}

// 2. Trending Hashtags Strip
async function loadTrendingTags() {
  const container = document.getElementById('discover-trending-tags-container');
  if (!container) return;

  try {
    const tags = await API.get('/explore/trending/');
    if (!tags || tags.length === 0) {
      container.innerHTML = '<span class="text-muted text-sm">No trending tags yet.</span>';
      return;
    }

    container.innerHTML = tags.map(t => `
      <button class="cat-pill font-bold" onclick="loadCategoryFeed('${encodeURIComponent(t.name)}', 'tag')" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem;">
        <span style="color: var(--primary);">#</span>${escapeHTML(t.name)}
        <span style="font-size: 0.75rem; opacity: 0.65; font-weight: 500;">${t.post_count}</span>
      </button>
    `).join('');
  } catch {
    container.innerHTML = '<span class="text-muted text-sm">Could not load trending tags.</span>';
  }
}

// 3. Recommended Creators Spotlight
async function loadRecommendedCreators() {
  const container = document.getElementById('discover-creators-container');
  if (!container) return;

  try {
    const creators = await API.get('/users/suggested/');
    if (!creators || creators.length === 0) {
      container.innerHTML = '<div class="text-muted text-sm" style="grid-column: 1/-1;">Explore and connect with new creators as the community expands!</div>';
      return;
    }

    container.innerHTML = creators.slice(0, 4).map(c => `
      <div class="creator-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-xl); padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: var(--shadow-xs);">
        <div style="display: flex; align-items: center; gap: 0.85rem; margin-bottom: 0.85rem;">
          <a href="profile.html?u=${encodeURIComponent(c.username)}">
            ${renderAvatarHTML(c, 'avatar-md', true)}
          </a>
          <div style="min-width: 0; flex: 1;">
            <a href="profile.html?u=${encodeURIComponent(c.username)}" class="font-bold text-sm text-truncate" style="display: block; color: var(--text-main);">
              ${escapeHTML(c.display_name || c.username)}
            </a>
            <div class="text-muted text-xs text-truncate">@${escapeHTML(c.username)}</div>
          </div>
        </div>

        <p class="text-xs text-secondary text-truncate-2" style="margin-bottom: 1rem; line-height: 1.4; min-height: 2.8em;">
          ${c.bio ? escapeHTML(c.bio) : 'Vibely creator sharing thoughts and ideas.'}
        </p>

        <button class="btn btn-coral btn-sm" style="width: 100%; font-size: 0.85rem;" onclick="handleCreatorFollow(this, '${encodeURIComponent(c.username)}')">
          Follow
        </button>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<div class="text-muted text-sm">Failed to load creators.</div>';
  }
}

async function handleCreatorFollow(btn, username) {
  try {
    const res = await API.post(`/users/${username}/follow/`);
    if (res.is_following) {
      btn.textContent = 'Following';
      btn.className = 'btn btn-secondary btn-sm';
      showToast('Following! ✨', 'success');
    } else {
      btn.textContent = 'Follow';
      btn.className = 'btn btn-coral btn-sm';
    }
  } catch (err) {
    showToast('Failed to update follow.', 'error');
  }
}

// 4. Visual Media Discovery Gallery
async function loadMediaGrid() {
  const container = document.getElementById('discover-media-grid');
  if (!container) return;

  try {
    const res = await API.get('/posts/', { filter: 'media' });
    const posts = res.results || [];

    if (posts.length === 0) {
      container.innerHTML = '<div class="text-muted text-sm" style="grid-column: 1/-1;">No photos published yet. Be the first to share an image moment!</div>';
      return;
    }

    container.innerHTML = posts.slice(0, 6).map(p => `
      <div class="media-tile-item" style="position: relative; border-radius: var(--radius-lg); overflow: hidden; aspect-ratio: 1; cursor: pointer; background: var(--bg-surface-secondary); box-shadow: var(--shadow-sm);" onclick="openLightbox('${p.image_url}')">
        <img src="${p.image_url}" alt="Community photo" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;">
        <div class="media-tile-overlay" style="position: absolute; inset: 0; background: linear-gradient(transparent 50%, rgba(0,0,0,0.65)); display: flex; align-items: flex-end; padding: 0.75rem; color: #fff; opacity: 0; transition: opacity 0.2s ease;">
          <div style="font-size: 0.8rem; font-weight: 700;">@${escapeHTML(p.author.username)} • ❤️ ${p.like_count}</div>
        </div>
      </div>
    `).join('');

    // Hover effect
    container.querySelectorAll('.media-tile-item').forEach(tile => {
      tile.addEventListener('mouseenter', () => {
        const overlay = tile.querySelector('.media-tile-overlay');
        const img = tile.querySelector('img');
        if (overlay) overlay.style.opacity = '1';
        if (img) img.style.transform = 'scale(1.05)';
      });
      tile.addEventListener('mouseleave', () => {
        const overlay = tile.querySelector('.media-tile-overlay');
        const img = tile.querySelector('img');
        if (overlay) overlay.style.opacity = '0';
        if (img) img.style.transform = 'scale(1)';
      });
    });
  } catch {
    container.innerHTML = '<div class="text-muted text-sm">Failed to load media.</div>';
  }
}

// 5. Popular & Filter Feed
async function loadCategoryFeed(category, type = 'category') {
  const grid = document.getElementById('discover-masonry-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="text-muted text-center" style="grid-column: 1/-1; padding: 3rem 0;">Curating discovery stream...</div>';

  try {
    let posts = [];

    if (type === 'tag') {
      const data = await API.get(`/explore/tags/${encodeURIComponent(category)}/`);
      posts = data.results || [];
    } else if (category === 'trending') {
      const trending = await API.get('/explore/trending/');
      renderTrendingGrid(trending);
      return;
    } else if (category === 'photography') {
      const data = await API.get('/posts/', { filter: 'media' });
      posts = data.results || [];
    } else if (category === 'tech') {
      const data = await API.get('/explore/tags/technology/');
      posts = data.results || [];
      if (posts.length === 0) {
        const fallback = await API.get('/explore/popular/');
        posts = fallback || [];
      }
    } else if (category === 'design') {
      const data = await API.get('/explore/tags/design/');
      posts = data.results || [];
      if (posts.length === 0) {
        const fallback = await API.get('/explore/popular/');
        posts = fallback || [];
      }
    } else {
      // Default / For You: popular posts
      posts = await API.get('/explore/popular/');
    }

    currentCategoryPosts = posts;

    if (posts.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🌿</div>
          <div class="font-extrabold" style="font-size: 1.25rem;">Nothing here yet</div>
          <p class="text-muted">Be the first to publish a post in this category!</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = posts.map(renderMasonryTileHTML).join('');
  } catch (err) {
    grid.innerHTML = '<div class="text-danger text-center" style="grid-column: 1/-1;">Failed to load discovery feed.</div>';
  }
}

function renderMasonryTileHTML(post) {
  const author = post.author;
  const authorName = escapeHTML(author.display_name || author.username);
  const snippet = escapeHTML(post.content ? post.content.slice(0, 160) : '');

  let mediaBox = '';
  if (post.image_url) {
    mediaBox = `
      <div style="overflow: hidden; max-height: 400px; background: var(--bg-surface-secondary);">
        <img src="${post.image_url}" alt="Discovery item" loading="lazy" style="width: 100%; object-fit: cover; display: block;">
      </div>
    `;
  }

  let pollBadge = '';
  if (post.poll) {
    pollBadge = `
      <div style="margin: 0.75rem 0; padding: 0.65rem 0.9rem; background: var(--bg-surface-secondary); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        <div style="font-weight: 700; font-size: 0.85rem;">📊 ${escapeHTML(post.poll.question)}</div>
        <div class="text-muted text-xs" style="margin-top: 2px;">${post.poll.total_votes} votes</div>
      </div>
    `;
  }

  return `
    <div class="masonry-item" onclick="window.location.href='feed.html#post-${post.id}'" style="cursor: pointer;">
      ${mediaBox}
      <div class="masonry-caption-body">
        <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.75rem;">
          <a href="profile.html?u=${encodeURIComponent(author.username)}" onclick="event.stopPropagation();">
            ${renderAvatarHTML(author, 'avatar-xs', true)}
          </a>
          <div>
            <a href="profile.html?u=${encodeURIComponent(author.username)}" class="font-bold text-xs" style="color: var(--text-main);" onclick="event.stopPropagation();">
              ${authorName}
            </a>
            <div class="text-muted text-xs">${formatTimeAgo(post.created_at)}</div>
          </div>
        </div>

        ${snippet ? `<p class="text-sm" style="margin-bottom: 0.6rem; color: var(--text-main);">${snippet}</p>` : ''}
        ${pollBadge}

        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.85rem; padding-top: 0.75rem; border-top: 1px solid var(--border-subtle); font-size: 0.8125rem; color: var(--text-muted);">
          <span>❤️ ${post.like_count || 0}</span>
          <span>💬 ${post.comment_count || 0}</span>
        </div>
      </div>
    </div>
  `;
}

function renderTrendingGrid(tags) {
  const grid = document.getElementById('discover-masonry-grid');
  if (!grid) return;

  if (tags.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;">No trending topics right now.</div>';
    return;
  }

  grid.innerHTML = tags.map(t => `
    <div class="masonry-item" style="padding: 1.75rem; cursor: pointer;" onclick="loadCategoryFeed('${encodeURIComponent(t.name)}', 'tag')">
      <span class="badge badge-coral" style="margin-bottom: 0.75rem;">Trending Topic</span>
      <h3 style="font-size: 1.45rem; font-weight: 900; margin-bottom: 0.4rem; color: var(--primary);">#${escapeHTML(t.name)}</h3>
      <p class="text-muted text-sm">${t.post_count} ${t.post_count === 1 ? 'post' : 'posts'} in discussion</p>
      <div style="margin-top: 1rem; color: var(--text-main); font-weight: 700; font-size: 0.875rem;">Explore Posts →</div>
    </div>
  `).join('');
}

async function performSearch(query) {
  const grid = document.getElementById('discover-masonry-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="text-muted text-center" style="grid-column: 1/-1; padding: 3rem 0;">Searching Vibely...</div>';

  try {
    const results = await API.get('/search/', { q: query });
    const { people, posts, hashtags } = results;

    const hasResults = (people && people.length > 0) || (posts && posts.length > 0) || (hashtags && hashtags.length > 0);
    if (!hasResults) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
          <div class="font-bold" style="font-size: 1.15rem;">No results found for "${escapeHTML(query)}"</div>
          <p class="text-muted">Try searching with a different keyword, name, or hashtag.</p>
        </div>
      `;
      return;
    }

    let html = '';

    // People cards
    if (people && people.length > 0) {
      html += `
        <div class="masonry-item" style="padding: 1.5rem;">
          <h4 style="margin-bottom: 1rem; font-size: 1.1rem;">👥 People</h4>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${people.map(p => `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.65rem;">
                  <a href="profile.html?u=${encodeURIComponent(p.username)}">
                    ${renderAvatarHTML(p, 'avatar-sm', true)}
                  </a>
                  <div>
                    <a href="profile.html?u=${encodeURIComponent(p.username)}" class="font-bold text-sm" style="color: var(--text-main);">
                      ${escapeHTML(p.display_name || p.username)}
                    </a>
                    <div class="text-muted text-xs">@${escapeHTML(p.username)}</div>
                  </div>
                </div>
                <a href="profile.html?u=${encodeURIComponent(p.username)}" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 0.25rem 0.65rem;">View</a>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Hashtags card
    if (hashtags && hashtags.length > 0) {
      html += `
        <div class="masonry-item" style="padding: 1.5rem;">
          <h4 style="margin-bottom: 1rem; font-size: 1.1rem;">🏷️ Hashtags</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${hashtags.map(t => `
              <button class="cat-pill" onclick="loadCategoryFeed('${encodeURIComponent(t.name)}', 'tag')">
                #${escapeHTML(t.name)} (${t.post_count})
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Posts
    if (posts && posts.length > 0) {
      posts.forEach(p => {
        html += renderMasonryTileHTML(p);
      });
    }

    grid.innerHTML = html;
  } catch (err) {
    grid.innerHTML = '<div class="text-danger text-center" style="grid-column: 1/-1;">Search failed.</div>';
  }
}
