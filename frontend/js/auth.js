/**
 * VIBELY AUTHENTICATION (Register & Login)
 */

document.addEventListener('DOMContentLoaded', () => {
  initRegisterForm();
  initLoginForm();
});

function calculatePasswordStrength(password) {
  let score = 0;
  if (!password) return { score: 0, label: '', color: '' };

  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 15;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 25;
  if (/\d/.test(password)) score += 20;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;

  if (score < 40) return { score, label: 'Weak', color: '#ef4444' };
  if (score < 75) return { score, label: 'Medium', color: '#f59e0b' };
  return { score: 100, label: 'Strong', color: '#10b981' };
}

function initRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  const passwordInput = document.getElementById('reg-password');
  const confirmInput = document.getElementById('reg-confirm-password');
  const meterFill = document.getElementById('password-meter-fill');
  const meterText = document.getElementById('password-meter-text');
  const confirmFeedback = document.getElementById('confirm-feedback');
  const submitBtn = document.getElementById('register-submit-btn');

  // Real-time password strength
  passwordInput?.addEventListener('input', () => {
    const pwd = passwordInput.value;
    const { score, label, color } = calculatePasswordStrength(pwd);
    if (meterFill) {
      meterFill.style.width = `${score}%`;
      meterFill.style.backgroundColor = color;
    }
    if (meterText) {
      meterText.textContent = label ? `Strength: ${label}` : '';
      meterText.style.color = color;
    }
  });

  // Real-time match verification
  confirmInput?.addEventListener('input', () => {
    if (!confirmFeedback) return;
    if (confirmInput.value && confirmInput.value !== passwordInput.value) {
      confirmFeedback.textContent = 'Passwords do not match.';
      confirmFeedback.className = 'input-feedback error';
    } else {
      confirmFeedback.textContent = '';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);

    const fullName = document.getElementById('reg-fullname').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;

    if (password !== confirmPassword) {
      showFieldError('reg-confirm-password', 'Passwords do not match.');
      return;
    }

    setBtnLoading(submitBtn, true, 'Creating account...');

    try {
      await API.post('/auth/register/', {
        full_name: fullName,
        username,
        email,
        password,
        confirm_password: confirmPassword,
      });

      showToast('Account created successfully! Welcome to Vibely.', 'success');
      setTimeout(() => {
        window.location.href = 'feed.html';
      }, 700);
    } catch (err) {
      setBtnLoading(submitBtn, false, 'Sign Up');
      if (err.data && err.data.errors) {
        Object.entries(err.data.errors).forEach(([field, msg]) => {
          showFieldError(`reg-${field}`, Array.isArray(msg) ? msg[0] : msg);
        });
      } else {
        showToast(err.message || 'Registration failed.', 'error');
      }
    }
  });
}

function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  const passwordInput = document.getElementById('login-password');
  const toggleEyeBtn = document.getElementById('toggle-password-btn');
  const submitBtn = document.getElementById('login-submit-btn');

  // Show/Hide password toggle
  toggleEyeBtn?.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleEyeBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
    } else {
      passwordInput.type = 'password';
      toggleEyeBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);

    const username = document.getElementById('login-username').value.trim();
    const password = passwordInput.value;

    setBtnLoading(submitBtn, true, 'Signing in...');

    try {
      await API.post('/auth/login/', { username, password });
      showToast('Welcome back!', 'success');
      setTimeout(() => {
        window.location.href = 'feed.html';
      }, 500);
    } catch (err) {
      setBtnLoading(submitBtn, false, 'Sign In');
      showFieldError('login-username', 'Invalid username or password.');
      showToast('Invalid username or password.', 'error');
    }
  });
}

function showFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.classList.add('error');
  let feedback = input.parentElement.querySelector('.input-feedback');
  if (!feedback) {
    feedback = document.createElement('div');
    feedback.className = 'input-feedback error';
    input.parentElement.appendChild(feedback);
  }
  feedback.textContent = message;
}

function clearErrors(form) {
  form.querySelectorAll('.input-feedback').forEach(el => el.textContent = '');
  form.querySelectorAll('.form-control').forEach(el => el.classList.remove('error'));
}

function setBtnLoading(button, isLoading, text) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = text;
}
