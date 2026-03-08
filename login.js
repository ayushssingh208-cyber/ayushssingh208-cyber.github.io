const AUTH_KEY = 'zombie-api-auth-v1';
const DEMO_USER = 'admin';
const DEMO_PASS = 'Admin123';

const loginForm = document.getElementById('loginForm');
const messageEl = document.getElementById('loginMessage');

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `login-message ${type}`;
}

function saveSession(username) {
  const session = {
    username,
    loginAt: new Date().toISOString()
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

function isAuthenticated() {
  return Boolean(localStorage.getItem(AUTH_KEY));
}

if (isAuthenticated()) {
  window.location.replace('index.html');
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showMessage('Please enter username and password.', 'error');
    return;
  }

  if (username !== DEMO_USER || password !== DEMO_PASS) {
    showMessage('Invalid credentials. Try admin / Admin@123', 'error');
    return;
  }

  saveSession(username);
  showMessage('Login successful. Redirecting...', 'success');

  setTimeout(() => {
    window.location.href = 'index.html';
  }, 500);
});

