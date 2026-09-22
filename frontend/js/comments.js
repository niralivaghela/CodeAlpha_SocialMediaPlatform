/**
 * VIBELY COMMENTS & NESTED REPLIES (Slide-in Drawer & Inline)
 */

let activeCommentDrawerPostId = null;

async function toggleComments(postId) {
  const drawer = document.getElementById('comment-drawer');
  const backdrop = document.getElementById('drawer-backdrop');

  if (drawer && backdrop) {
    activeCommentDrawerPostId = postId;
    backdrop.classList.add('active');
    drawer.classList.add('active');

    const drawerList = document.getElementById('comment-drawer-list');
    if (drawerList) {
      drawerList.innerHTML = '<div class="text-muted text-sm text-center" style="padding: 2rem 0;">Loading thoughts...</div>';
    }

    try {
      const comments = await API.get(`/posts/${postId}/comments/`);
      renderDrawerComments(postId, comments);
    } catch (err) {
      if (drawerList) drawerList.innerHTML = '<div class="text-danger text-sm text-center">Failed to load comments.</div>';
    }
    return;
  }

  // Fallback to inline container
  const container = document.getElementById(`comments-box-${postId}`);
  if (!container) return;

  if (container.style.display === 'block') {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = '<div class="text-muted text-sm" style="padding: 0.5rem 0;">Loading comments...</div>';

  try {
    const comments = await API.get(`/posts/${postId}/comments/`);
    renderComments(postId, comments);
  } catch (err) {
    container.innerHTML = '<div class="text-danger text-sm">Failed to load comments.</div>';
  }
}

function closeCommentDrawer() {
  const drawer = document.getElementById('comment-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  if (drawer) drawer.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
  activeCommentDrawerPostId = null;
}

function renderDrawerComments(postId, comments) {
  const drawerList = document.getElementById('comment-drawer-list');
  if (!drawerList) return;

  if (comments.length === 0) {
    drawerList.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">💬</div>
        <div style="font-weight: 700; color: var(--text-main); margin-bottom: 0.25rem;">No comments yet</div>
        <p class="text-sm">Be the first to share your thoughts on this post!</p>
      </div>
    `;
  } else {
    drawerList.innerHTML = comments.map(comment => renderSingleComment(comment, postId)).join('');
  }
}

function renderComments(postId, comments) {
  const container = document.getElementById(`comments-box-${postId}`);
  if (!container) return;

  let commentsHTML = '';

  if (comments.length === 0) {
    commentsHTML = '<div class="text-muted text-sm" style="padding: 0.5rem 0;">No comments yet. Be the first to comment!</div>';
  } else {
    commentsHTML = comments.map(comment => renderSingleComment(comment, postId)).join('');
  }

  const inputBarHTML = `
    <div style="display: flex; gap: 0.5rem; margin-top: 0.85rem;">
      <input type="text" id="comment-input-${postId}" class="form-control" placeholder="Write a comment..." style="padding: 0.5rem 0.85rem; font-size: 0.875rem;">
      <button class="btn btn-primary btn-sm" onclick="submitComment(${postId})">Reply</button>
    </div>
  `;

  container.innerHTML = `
    <div class="comments-list" id="comments-list-${postId}">
      ${commentsHTML}
    </div>
    ${inputBarHTML}
  `;
}

function renderSingleComment(comment, postId) {
  const author = comment.author;
  const authorName = escapeHTML(author.display_name || author.username);
  const repliesHTML = (comment.replies || []).map(reply => `
    <div class="comment-item" id="comment-${reply.id}" style="display: flex; gap: 0.75rem; margin-top: 0.75rem; padding-left: 1.25rem; border-left: 2px solid var(--border-subtle);">
      <a href="profile.html?u=${encodeURIComponent(reply.author.username)}">
        ${renderAvatarHTML(reply.author, 'avatar-xs')}
      </a>
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <a href="profile.html?u=${encodeURIComponent(reply.author.username)}" class="font-bold text-xs" style="color: var(--text-main);">
            ${escapeHTML(reply.author.display_name || reply.author.username)}
          </a>
          <span class="text-muted text-xs">${formatTimeAgo(reply.created_at)}</span>
        </div>
        <div class="text-sm" style="margin-top: 2px; color: var(--text-main);">${escapeHTML(reply.content)}</div>
        ${reply.is_own_comment ? `
          <button class="btn-ghost text-xs text-danger" style="padding: 0; margin-top: 4px; cursor: pointer; border: none; background: transparent;" onclick="deleteComment(${reply.id}, ${postId})">Delete</button>
        ` : ''}
      </div>
    </div>
  `).join('');

  return `
    <div class="comment-item" id="comment-${comment.id}" style="display: flex; gap: 0.85rem; padding: 0.75rem 0; border-bottom: 1px solid var(--border-subtle);">
      <a href="profile.html?u=${encodeURIComponent(author.username)}">
        ${renderAvatarHTML(author, 'avatar-sm')}
      </a>
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <a href="profile.html?u=${encodeURIComponent(author.username)}" class="font-bold text-sm" style="color: var(--text-main);">
            ${authorName}
          </a>
          <span class="text-muted text-xs">${formatTimeAgo(comment.created_at)}</span>
        </div>
        <div class="text-sm" style="margin-top: 4px; line-height: 1.5; color: var(--text-main);">${escapeHTML(comment.content)}</div>
        
        <div style="margin-top: 0.45rem; display: flex; gap: 1rem; align-items: center;">
          <button class="btn-ghost text-xs" style="padding: 0; cursor: pointer; border: none; background: transparent; font-weight: 600; color: ${comment.is_liked ? 'var(--primary)' : 'var(--text-secondary)'};" onclick="toggleCommentLike(${comment.id}, this)">
            ${comment.is_liked ? '❤️' : '🤍'} <span class="c-like-count">${comment.likes_count || 0}</span>
          </button>
          <button class="btn-ghost text-xs" style="padding: 0; cursor: pointer; border: none; background: transparent; font-weight: 600;" onclick="showReplyInput(${comment.id}, ${postId})">Reply</button>
          ${comment.is_own_comment ? `
            <button class="btn-ghost text-xs text-danger" style="padding: 0; cursor: pointer; border: none; background: transparent;" onclick="deleteComment(${comment.id}, ${postId})">Delete</button>
          ` : ''}
        </div>

        <div id="reply-input-box-${comment.id}" style="display: none; margin-top: 0.65rem;">
          <div style="display: flex; gap: 0.5rem;">
            <input type="text" id="reply-input-${comment.id}" class="form-control" placeholder="Reply to ${authorName}..." style="padding: 0.4rem 0.75rem; font-size: 0.85rem;">
            <button class="btn btn-coral btn-sm" onclick="submitReply(${comment.id}, ${postId})">Send</button>
          </div>
        </div>

        <div class="comment-replies" id="comment-replies-${comment.id}">
          ${repliesHTML}
        </div>
      </div>
    </div>
  `;
}

function showReplyInput(commentId, postId) {
  const box = document.getElementById(`reply-input-box-${commentId}`);
  if (box) {
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
    const input = document.getElementById(`reply-input-${commentId}`);
    if (box.style.display === 'block' && input) input.focus();
  }
}

async function submitComment(postId) {
  // Check if submitted from drawer or inline
  const drawerInput = document.getElementById('drawer-comment-input');
  const inlineInput = document.getElementById(`comment-input-${postId}`);
  const input = (activeCommentDrawerPostId === postId && drawerInput) ? drawerInput : inlineInput;

  const content = input ? input.value.trim() : '';
  if (!content) return;

  try {
    const newComment = await API.post(`/posts/${postId}/comments/`, { content });
    showToast('Comment added!', 'success');
    if (input) input.value = '';

    // Increment count on card
    const countEl = document.getElementById(`post-comment-count-${postId}`);
    if (countEl) {
      countEl.textContent = parseInt(countEl.textContent || '0', 10) + 1;
    }

    // Refresh comments
    const comments = await API.get(`/posts/${postId}/comments/`);
    if (activeCommentDrawerPostId === postId) {
      renderDrawerComments(postId, comments);
    } else {
      renderComments(postId, comments);
    }
  } catch (err) {
    showToast(err.message || 'Failed to post comment.', 'error');
  }
}

async function submitReply(parentCommentId, postId) {
  const input = document.getElementById(`reply-input-${parentCommentId}`);
  const content = input ? input.value.trim() : '';
  if (!content) return;

  try {
    await API.post(`/posts/${postId}/comments/`, {
      content,
      parent: parentCommentId,
    });
    showToast('Reply posted!', 'success');

    const comments = await API.get(`/posts/${postId}/comments/`);
    if (activeCommentDrawerPostId === postId) {
      renderDrawerComments(postId, comments);
    } else {
      renderComments(postId, comments);
    }
  } catch (err) {
    showToast(err.message || 'Failed to post reply.', 'error');
  }
}

async function deleteComment(commentId, postId) {
  if (!confirm('Delete this comment?')) return;

  try {
    await API.delete(`/comments/${commentId}/`);
    showToast('Comment deleted.', 'info');

    const countEl = document.getElementById(`post-comment-count-${postId}`);
    if (countEl) {
      countEl.textContent = Math.max(0, parseInt(countEl.textContent || '1', 10) - 1);
    }

    const comments = await API.get(`/posts/${postId}/comments/`);
    if (activeCommentDrawerPostId === postId) {
      renderDrawerComments(postId, comments);
    } else {
      renderComments(postId, comments);
    }
  } catch (err) {
    showToast('Failed to delete comment.', 'error');
  }
}

async function toggleCommentLike(commentId, btn) {
  try {
    const res = await API.post(`/comments/${commentId}/like/`);
    const countSpan = btn.querySelector('.c-like-count');
    if (countSpan) countSpan.textContent = res.like_count;
    if (res.is_liked) {
      btn.innerHTML = `❤️ <span class="c-like-count">${res.like_count}</span>`;
      btn.style.color = 'var(--primary)';
    } else {
      btn.innerHTML = `🤍 <span class="c-like-count">${res.like_count}</span>`;
      btn.style.color = 'var(--text-secondary)';
    }
  } catch {
    showToast('Failed to update comment like.', 'error');
  }
}
