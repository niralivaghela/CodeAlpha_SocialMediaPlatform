/**
 * VIBELY API CLIENT & CORE UTILITIES
 */

const API_BASE = window.location.port === '8000' || window.location.pathname.startsWith('/api')
  ? '/api'
  : 'http://127.0.0.1:8000/api';

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Global Toast System
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// HTTP Client
const API = {
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers = options.headers || {};
    
    // Automatically inject CSRF token if not GET/HEAD
    if (!['GET', 'HEAD'].includes((options.method || 'GET').toUpperCase())) {
      const csrf = getCookie('csrftoken');
      if (csrf) {
        headers['X-CSRFToken'] = csrf;
      }
    }

    const fetchConfig = {
      credentials: 'include',
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, fetchConfig);
      
      // Handle No Content
      if (response.status === 204) {
        return null;
      }

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        // Collect error message
        let errMsg = 'An unexpected error occurred.';
        if (typeof data === 'object' && data !== null) {
          if (data.error) errMsg = data.error;
          else if (data.detail) errMsg = data.detail;
          else if (data.errors) {
            errMsg = Object.values(data.errors).flat().join(' ');
          } else {
            errMsg = Object.values(data).flat().join(' ');
          }
        }
        const error = new Error(errMsg);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`API Error [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  },

  get(endpoint, params = null) {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          searchParams.append(k, v);
        }
      });
      const qs = searchParams.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }
    return this.request(url, { method: 'GET' });
  },

  post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  patch(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  upload(endpoint, formData, method = 'POST') {
    return this.request(endpoint, {
      method: method,
      body: formData,
    });
  },

  // Get current logged-in user profile
  async getCurrentUser() {
    try {
      const data = await this.get('/auth/me/');
      return data.authenticated ? data : null;
    } catch {
      return null;
    }
  },
};

// Utilities
function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderAvatarHTML(user, sizeClass = 'avatar-md', showPresence = false) {
  if (!user) return `<div class="avatar ${sizeClass}">?</div>`;

  const initials = user.initials || (user.username ? user.username.substring(0, 2).toUpperCase() : 'U');
  const avatarContent = user.avatar_url
    ? `<img src="${user.avatar_url}" alt="${escapeHTML(user.username)}" class="avatar ${sizeClass}" onerror="this.outerHTML='<div class=\\'avatar ${sizeClass}\\'>${initials}</div>'">`
    : `<div class="avatar ${sizeClass}">${initials}</div>`;

  if (!showPresence) return avatarContent;

  const presence = user.presence_status || (user.is_online ? 'online' : 'offline');
  return `
    <div class="avatar-container">
      ${avatarContent}
      <span class="presence-dot ${presence}" title="${presence}"></span>
    </div>
  `;
}
