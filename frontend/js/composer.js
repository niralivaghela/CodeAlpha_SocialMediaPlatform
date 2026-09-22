/**
 * VIBELY POST COMPOSER
 */

let selectedMediaFile = null;
let pollActive = false;

function initComposer(onPostCreated) {
  const textarea = document.getElementById('composer-text');
  const mediaInput = document.getElementById('composer-media-input');
  const mediaPreview = document.getElementById('composer-media-preview');
  const mediaImg = document.getElementById('composer-preview-img');
  const mediaRemoveBtn = document.getElementById('composer-media-remove');
  const pollToggleBtn = document.getElementById('composer-poll-toggle');
  const pollBox = document.getElementById('composer-poll-box');
  const submitBtn = document.getElementById('composer-submit-btn');
  const addOptionBtn = document.getElementById('poll-add-option-btn');
  const pollOptionsContainer = document.getElementById('poll-options-container');

  if (!textarea || !submitBtn) return;

  // Media file handling
  mediaInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image cannot exceed 10MB.', 'error');
      mediaInput.value = '';
      return;
    }

    selectedMediaFile = file;
    const reader = new FileReader();
    reader.onload = (event) => {
      mediaImg.src = event.target.result;
      mediaPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  mediaRemoveBtn?.addEventListener('click', () => {
    selectedMediaFile = null;
    if (mediaInput) mediaInput.value = '';
    if (mediaImg) mediaImg.src = '';
    mediaPreview.style.display = 'none';
  });

  // Poll toggle
  pollToggleBtn?.addEventListener('click', () => {
    pollActive = !pollActive;
    if (pollActive) {
      pollBox.classList.add('active');
      pollToggleBtn.classList.add('active');
    } else {
      pollBox.classList.remove('active');
      pollToggleBtn.classList.remove('active');
    }
  });

  // Add poll option
  addOptionBtn?.addEventListener('click', () => {
    const currentOptions = pollOptionsContainer.querySelectorAll('.poll-option-input');
    if (currentOptions.length >= 4) {
      showToast('Maximum 4 options allowed.', 'info');
      return;
    }
    const nextIdx = currentOptions.length + 1;
    const optDiv = document.createElement('div');
    optDiv.className = 'form-group poll-option-row-input';
    optDiv.style.marginBottom = '0.5rem';
    optDiv.innerHTML = `
      <input type="text" class="form-control poll-option-input" placeholder="Option ${nextIdx}">
    `;
    pollOptionsContainer.appendChild(optDiv);
  });

  // Drag and Drop media support on composer card
  const composerCard = document.querySelector('.floating-composer-card, .composer-card');
  if (composerCard) {
    composerCard.addEventListener('dragover', (e) => {
      e.preventDefault();
      composerCard.style.borderColor = 'var(--primary)';
      composerCard.style.background = 'var(--primary-light)';
    });
    composerCard.addEventListener('dragleave', (e) => {
      e.preventDefault();
      composerCard.style.borderColor = '';
      composerCard.style.background = '';
    });
    composerCard.addEventListener('drop', (e) => {
      e.preventDefault();
      composerCard.style.borderColor = '';
      composerCard.style.background = '';
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          if (file.size > 10 * 1024 * 1024) {
            showToast('Image cannot exceed 10MB.', 'error');
            return;
          }
          selectedMediaFile = file;
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (mediaImg) mediaImg.src = ev.target.result;
            if (mediaPreview) mediaPreview.style.display = 'block';
          };
          reader.readAsDataURL(file);
          showToast('Image attached via drag & drop! 📸', 'info');
        }
      }
    });
  }

  // Character counter
  const charCounterEl = document.getElementById('composer-char-count');
  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    if (charCounterEl) {
      charCounterEl.textContent = `${len}/500`;
      if (len > 450) {
        charCounterEl.style.color = 'var(--accent-coral)';
      } else {
        charCounterEl.style.color = 'var(--text-muted)';
      }
    }
  });

  // Submit Post
  submitBtn.addEventListener('click', async () => {
    const content = textarea.value.trim();

    if (!content && !selectedMediaFile && !pollActive) {
      showToast('Please add text, an image, or a poll to post.', 'error');
      return;
    }

    let pollQuestion = '';
    let pollOptions = [];
    if (pollActive) {
      const qInput = document.getElementById('poll-question-input');
      pollQuestion = qInput ? qInput.value.trim() : '';
      if (!pollQuestion) {
        showToast('Please provide a question for your poll.', 'error');
        return;
      }
      const optInputs = pollOptionsContainer.querySelectorAll('.poll-option-input');
      optInputs.forEach(input => {
        const val = input.value.trim();
        if (val) pollOptions.push(val);
      });
      if (pollOptions.length < 2) {
        showToast('Polls require at least 2 options.', 'error');
        return;
      }
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Publishing...';

    try {
      const formData = new FormData();
      formData.append('content', content);
      if (selectedMediaFile) {
        formData.append('image', selectedMediaFile);
      }
      if (pollActive && pollQuestion) {
        formData.append('poll_question', pollQuestion);
        formData.append('poll_options', JSON.stringify(pollOptions));
      }

      // Pro features: Location, Feeling, Visibility
      const locInput = document.getElementById('composer-location-input');
      const feelInput = document.getElementById('composer-feeling-input');
      const visSelect = document.getElementById('composer-visibility-select');

      if (locInput && locInput.value.trim()) {
        formData.append('location', locInput.value.trim());
      }
      if (feelInput && feelInput.value.trim()) {
        formData.append('feeling', feelInput.value.trim());
      }
      if (visSelect) {
        formData.append('visibility', visSelect.value);
      }

      const newPost = await API.upload('/posts/', formData);
      
      submitBtn.textContent = '✓ Posted!';
      submitBtn.style.background = 'var(--accent-mint)';
      showToast('Post published to Vibely! ✓', 'success');

      // Reset composer after short delay
      setTimeout(() => {
        textarea.value = '';
        if (charCounterEl) charCounterEl.textContent = '0/500';
        if (mediaRemoveBtn) mediaRemoveBtn.click();
        if (pollActive) pollToggleBtn.click();
        if (locInput) locInput.value = '';
        if (feelInput) feelInput.value = '';
        const drawer = document.getElementById('composer-extras-drawer');
        if (drawer) drawer.style.display = 'none';
        const qInput = document.getElementById('poll-question-input');
        if (qInput) qInput.value = '';
        if (pollOptionsContainer) {
          pollOptionsContainer.innerHTML = `
            <div class="form-group poll-option-row-input" style="margin-bottom: 0.5rem;">
              <input type="text" class="form-control poll-option-input" placeholder="Option 1">
            </div>
            <div class="form-group poll-option-row-input" style="margin-bottom: 0.5rem;">
              <input type="text" class="form-control poll-option-input" placeholder="Option 2">
            </div>
          `;
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish';
        submitBtn.style.background = '';
      }, 700);

      if (onPostCreated) {
        onPostCreated(newPost);
      }
    } catch (err) {
      showToast(err.message || 'Failed to create post.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Publish';
      submitBtn.style.background = '';
    }
  });

  // Load initial drafts count
  updateDraftsCount();
}

function toggleComposerExtras() {
  const drawer = document.getElementById('composer-extras-drawer');
  if (drawer) {
    drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
  }
}

async function updateDraftsCount() {
  try {
    const drafts = await API.get('/posts/drafts/');
    const badge = document.getElementById('drafts-count-badge');
    if (badge) badge.textContent = drafts.length || 0;
  } catch {}
}

async function saveCurrentDraft() {
  const content = document.getElementById('composer-text')?.value.trim();
  const location = document.getElementById('composer-location-input')?.value.trim() || '';
  const feeling = document.getElementById('composer-feeling-input')?.value.trim() || '';

  if (!content) {
    showToast('Add some text before saving as a draft.', 'info');
    return;
  }

  try {
    await API.post('/posts/drafts/', { content, location, feeling });
    showToast('Draft saved securely! 💾', 'success');
    updateDraftsCount();
  } catch (err) {
    showToast('Failed to save draft.', 'error');
  }
}

async function openDraftsModal() {
  const modal = document.getElementById('drafts-modal');
  const container = document.getElementById('drafts-list-container');
  if (!modal || !container) return;

  modal.classList.add('active');
  container.innerHTML = '<div class="text-muted text-sm" style="text-align:center; padding: 1.5rem;">Loading drafts...</div>';

  try {
    const drafts = await API.get('/posts/drafts/');
    if (drafts.length === 0) {
      container.innerHTML = '<div class="text-muted text-sm" style="text-align:center; padding: 1.5rem;">No saved drafts.</div>';
      return;
    }

    container.innerHTML = drafts.map(d => `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 0.85rem; border-bottom: 1px solid var(--border-color); gap: 0.75rem;">
        <div style="flex: 1; cursor: pointer;" onclick="useDraft('${encodeURIComponent(d.content)}', '${encodeURIComponent(d.location || '')}', '${encodeURIComponent(d.feeling || '')}', ${d.id})">
          <div style="font-size: 0.9rem; color: var(--text-main); font-weight: 500; margin-bottom: 0.25rem;">
            ${escapeHTML(d.content.slice(0, 80))}${d.content.length > 80 ? '...' : ''}
          </div>
          <div class="text-muted text-xs">
            ${d.location ? `📍 ${escapeHTML(d.location)} ` : ''}
            ${d.feeling ? `✨ ${escapeHTML(d.feeling)} ` : ''}
            • ${formatTimeAgo(d.updated_at)}
          </div>
        </div>
        <button class="btn-icon text-danger" title="Delete draft" onclick="deleteDraft(${d.id}, this)">&times;</button>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<div class="text-danger text-sm">Failed to load drafts.</div>';
  }
}

function closeDraftsModal() {
  const modal = document.getElementById('drafts-modal');
  if (modal) modal.classList.remove('active');
}

function useDraft(encodedContent, encodedLocation, encodedFeeling, draftId) {
  const textarea = document.getElementById('composer-text');
  const locInput = document.getElementById('composer-location-input');
  const feelInput = document.getElementById('composer-feeling-input');

  if (textarea) textarea.value = decodeURIComponent(encodedContent);
  if (locInput) locInput.value = decodeURIComponent(encodedLocation);
  if (feelInput) feelInput.value = decodeURIComponent(encodedFeeling);

  closeDraftsModal();
  focusComposer();
  showToast('Draft restored into composer!', 'info');
}

async function deleteDraft(draftId, btn) {
  try {
    await API.delete(`/posts/drafts/${draftId}/`);
    showToast('Draft deleted.', 'info');
    const row = btn.closest('div');
    if (row) row.remove();
    updateDraftsCount();
  } catch (err) {
    showToast('Failed to delete draft.', 'error');
  }
}
