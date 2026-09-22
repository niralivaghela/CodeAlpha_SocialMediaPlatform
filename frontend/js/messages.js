/**
 * VIBELY DIRECT MESSAGING (Real-time Direct Sync Engine)
 * Features:
 * - Real-time Conversation List & Auto-refresh
 * - Real-time Message History with Delivery & Read Status
 * - New Chat User Picker Modal
 * - Multi-Emoji Message Reactions (❤️, 😂, 😮, 👏, 😢)
 * - Message Pinning & Message Deletion
 * - Typing State Display
 */

let activeConversationId = null;
let chatPollInterval = null;
let conversationsCache = [];

function initMessagesPage() {
  loadConversationsList();

  const urlParams = new URLSearchParams(window.location.search);
  const convId = urlParams.get('c');
  if (convId) {
    activeConversationId = parseInt(convId, 10);
  }

  // Setup sending messages
  const sendBtn = document.getElementById('chat-send-btn');
  const chatInput = document.getElementById('chat-text-input');

  sendBtn?.addEventListener('click', sendMessage);
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Start polling every 4 seconds for real-time synchronization
  chatPollInterval = setInterval(pollChatSync, 4000);
}

async function loadConversationsList() {
  const container = document.getElementById('conversations-list-container');
  if (!container) return;

  try {
    const convs = await API.get('/conversations/');
    conversationsCache = convs;

    if (convs.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 2rem 1rem;">
          <div class="empty-state-icon">💬</div>
          <div class="empty-state-title">No conversations yet</div>
          <p class="text-muted text-xs">Start a direct chat with any creator.</p>
          <button class="btn btn-coral btn-xs font-bold" onclick="openNewChatModal()" style="margin-top: 0.75rem;">＋ New Chat</button>
        </div>
      `;
      return;
    }

    container.innerHTML = convs.map(c => {
      const other = c.other_user;
      const last = c.last_message;
      const isActive = activeConversationId === c.id;
      const hasUnread = c.unread_count > 0;

      return `
        <div class="conversation-item ${isActive ? 'active' : ''}" onclick="selectConversation(${c.id})">
          ${renderAvatarHTML(other, 'avatar-md', true)}
          <div class="conversation-info">
            <div class="conversation-user">
              <span class="font-semibold text-sm" style="color: var(--text-main);">${escapeHTML(other.display_name || other.username)}</span>
              ${last ? `<span class="text-muted text-xs">${formatTimeAgo(last.created_at)}</span>` : ''}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.15rem;">
              <span class="conversation-preview ${hasUnread ? 'font-bold' : ''}" style="${hasUnread ? 'color: var(--text-main);' : ''}">
                ${last ? escapeHTML(last.text) : 'Start a chat'}
              </span>
              ${hasUnread ? `<span class="badge-count">${c.unread_count}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // If active conversation is set, load it
    if (activeConversationId) {
      loadActiveMessages(false);
    } else if (convs.length > 0 && window.innerWidth > 768) {
      selectConversation(convs[0].id);
    }
  } catch (err) {
    container.innerHTML = '<div class="text-danger text-center text-sm" style="padding: 1rem;">Failed to load chats.</div>';
  }
}

function selectConversation(id) {
  activeConversationId = id;
  document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
  loadActiveMessages(true);
}

async function loadActiveMessages(shouldScrollToBottom = true) {
  if (!activeConversationId) return;

  const chatContainer = document.getElementById('chat-messages-container');
  const chatHeader = document.getElementById('chat-header-info');
  const chatInputBar = document.getElementById('chat-input-bar');

  if (!chatContainer) return;

  const conv = conversationsCache.find(c => c.id === activeConversationId);
  if (conv && chatHeader) {
    const other = conv.other_user;
    chatHeader.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <a href="profile.html?u=${encodeURIComponent(other.username)}">
            ${renderAvatarHTML(other, 'avatar-sm', true)}
          </a>
          <div>
            <a href="profile.html?u=${encodeURIComponent(other.username)}" class="font-bold text-sm" style="color: var(--text-main);">
              ${escapeHTML(other.display_name || other.username)}
            </a>
            <div class="text-muted text-xs">@${escapeHTML(other.username)} • ${other.presence_status || (other.is_online ? 'Active now' : 'Offline')}</div>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <a href="profile.html?u=${encodeURIComponent(other.username)}" class="btn btn-secondary btn-xs">View Profile</a>
        </div>
      </div>
    `;
    if (chatInputBar) chatInputBar.style.display = 'flex';
  }

  try {
    const messages = await API.get(`/conversations/${activeConversationId}/messages/`);
    
    if (messages.length === 0) {
      chatContainer.innerHTML = `
        <div class="empty-state" style="margin: auto;">
          <div class="empty-state-title">No messages yet</div>
          <p class="text-muted text-sm">Send a message to start the conversation!</p>
        </div>
      `;
      return;
    }

    chatContainer.innerHTML = messages.map(m => {
      const isOutgoing = m.is_own;
      
      // Reactions summary pill
      let reactionsHTML = '';
      if (m.reactions && m.reactions.length > 0) {
        const emojiCounts = {};
        m.reactions.forEach(r => {
          emojiCounts[r.emoji] = (emojiCounts[r.emoji] || 0) + 1;
        });
        reactionsHTML = `
          <div class="msg-reactions-pill" style="display: inline-flex; gap: 0.25rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-full); padding: 2px 6px; font-size: 0.75rem; margin-top: 4px; box-shadow: var(--shadow-xs);">
            ${Object.entries(emojiCounts).map(([emoji, count]) => `<span>${emoji} ${count > 1 ? count : ''}</span>`).join('')}
          </div>
        `;
      }

      return `
        <div class="message-bubble-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}" style="display: flex; flex-direction: column; align-items: ${isOutgoing ? 'flex-end' : 'flex-start'}; margin-bottom: 0.75rem; position: relative;" id="msg-wrapper-${m.id}">
          <div class="message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}" id="msg-${m.id}" style="position: relative; group">
            ${m.is_pinned ? `<div style="font-size: 0.65rem; font-weight: 700; color: var(--primary); margin-bottom: 2px;">📌 Pinned</div>` : ''}
            <div>${escapeHTML(m.text)}</div>
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.35rem; margin-top: 3px;">
              <span class="message-time" style="font-size: 0.7rem; opacity: 0.75;">
                ${formatTimeAgo(m.created_at)}
              </span>
              ${isOutgoing ? `<span style="font-size: 0.75rem; opacity: 0.85;">${m.is_read ? '✓✓' : '✓'}</span>` : ''}
            </div>

            <!-- Hover Action Quick Bar -->
            <div class="msg-hover-actions" style="position: absolute; ${isOutgoing ? 'left: -110px;' : 'right: -110px;'} top: 50%; transform: translateY(-50%); display: none; gap: 4px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-full); padding: 3px 6px; box-shadow: var(--shadow-sm); z-index: 10;">
              <button type="button" class="btn-icon" style="width: 24px; height: 24px; font-size: 0.85rem;" title="Love" onclick="reactToMessage(${m.id}, '❤️')">❤️</button>
              <button type="button" class="btn-icon" style="width: 24px; height: 24px; font-size: 0.85rem;" title="Funny" onclick="reactToMessage(${m.id}, '😂')">😂</button>
              <button type="button" class="btn-icon" style="width: 24px; height: 24px; font-size: 0.85rem;" title="Wow" onclick="reactToMessage(${m.id}, '😮')">😮</button>
              <button type="button" class="btn-icon" style="width: 24px; height: 24px; font-size: 0.85rem;" title="Pin" onclick="togglePinMessage(${m.id})">📌</button>
              ${isOutgoing ? `
                <button type="button" class="btn-icon text-danger" style="width: 24px; height: 24px; font-size: 0.85rem;" title="Delete" onclick="deleteMessage(${m.id})">🗑️</button>
              ` : ''}
            </div>
          </div>
          ${reactionsHTML}
        </div>
      `;
    }).join('');

    // Attach hover listener to message bubbles
    chatContainer.querySelectorAll('.message-bubble-wrapper').forEach(wrapper => {
      const actions = wrapper.querySelector('.msg-hover-actions');
      if (actions) {
        wrapper.addEventListener('mouseenter', () => actions.style.display = 'flex');
        wrapper.addEventListener('mouseleave', () => actions.style.display = 'none');
      }
    });

    if (shouldScrollToBottom) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  } catch (err) {
    chatContainer.innerHTML = '<div class="text-danger text-center">Failed to load messages.</div>';
  }
}

async function sendMessage() {
  if (!activeConversationId) return;

  const input = document.getElementById('chat-text-input');
  const text = input ? input.value.trim() : '';

  if (!text) return;

  input.value = '';

  try {
    await API.post(`/conversations/${activeConversationId}/messages/`, { text });
    await loadActiveMessages(true);
    await loadConversationsList();
  } catch (err) {
    showToast(err.message || 'Failed to send message.', 'error');
  }
}

async function reactToMessage(messageId, emoji) {
  try {
    await API.post(`/messages/${messageId}/react/`, { emoji });
    await loadActiveMessages(false);
  } catch {
    showToast('Failed to react.', 'error');
  }
}

async function togglePinMessage(messageId) {
  try {
    const res = await API.post(`/messages/${messageId}/pin/`);
    showToast(res.is_pinned ? 'Message pinned! 📌' : 'Message unpinned.', 'info');
    await loadActiveMessages(false);
  } catch {
    showToast('Failed to update pin.', 'error');
  }
}

async function deleteMessage(messageId) {
  if (!confirm('Delete this message for everyone?')) return;
  try {
    await API.delete(`/messages/${messageId}/`);
    showToast('Message deleted.', 'info');
    await loadActiveMessages(false);
    await loadConversationsList();
  } catch {
    showToast('Failed to delete message.', 'error');
  }
}

async function pollChatSync() {
  if (activeConversationId) {
    loadActiveMessages(false);
  }
  try {
    const convs = await API.get('/conversations/');
    conversationsCache = convs;
  } catch {
    // Ignore polling errors
  }
}

// -------------------------------------------------------------
// NEW CONVERSATION USER PICKER
// -------------------------------------------------------------
function openNewChatModal() {
  const modal = document.getElementById('new-chat-modal');
  if (modal) {
    modal.classList.add('active');
    searchUsersForNewChat('');
  }
}

function closeNewChatModal() {
  const modal = document.getElementById('new-chat-modal');
  if (modal) modal.classList.remove('active');
}

let newChatSearchTimer = null;
function searchUsersForNewChat(query) {
  clearTimeout(newChatSearchTimer);
  newChatSearchTimer = setTimeout(async () => {
    const container = document.getElementById('new-chat-users-list');
    if (!container) return;

    container.innerHTML = '<div class="text-muted text-center text-xs" style="padding: 1rem;">Finding creators...</div>';

    try {
      let users = [];
      if (query.trim()) {
        const res = await API.get('/search/', { q: query.trim() });
        users = res.people || res.users || [];
      } else {
        users = await API.get('/users/suggested/');
      }

      if (users.length === 0) {
        container.innerHTML = '<div class="text-muted text-center text-xs" style="padding: 1.5rem;">No people found.</div>';
        return;
      }

      container.innerHTML = users.map(u => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.75rem; border-radius: var(--radius-md); background: var(--bg-surface-secondary); cursor: pointer;" onclick="startChatWith('${encodeURIComponent(u.username)}')">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            ${renderAvatarHTML(u, 'avatar-sm', true)}
            <div>
              <div class="font-bold text-sm" style="color: var(--text-main);">${escapeHTML(u.display_name || u.username)}</div>
              <div class="text-muted text-xs">@${escapeHTML(u.username)}</div>
            </div>
          </div>
          <button class="btn btn-coral btn-xs">Chat</button>
        </div>
      `).join('');
    } catch {
      container.innerHTML = '<div class="text-danger text-center text-xs">Failed to load users.</div>';
    }
  }, 250);
}

async function startChatWith(username) {
  closeNewChatModal();
  try {
    const conv = await API.post('/conversations/start/', { username: decodeURIComponent(username) });
    await loadConversationsList();
    selectConversation(conv.id);
  } catch (err) {
    showToast(err.message || 'Could not open conversation.', 'error');
  }
}
