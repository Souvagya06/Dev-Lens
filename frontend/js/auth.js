// ── API BASE ─────────────────────────────────────────────
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : 'https://dev-lens-39k6.onrender.com/api';

// ── POPUP NOTIFICATION ───────────────────────────────────
function showPopup(message, type = "error") {
  const existing = document.getElementById("devlens-popup");
  if (existing) existing.remove();

  const popup = document.createElement("div");
  popup.id = "devlens-popup";
  popup.style.cssText = `
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    border-radius: 8px;
    font-family: Inter, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 9999;
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    transition: opacity 0.4s ease;
    white-space: nowrap;
    ${
      type === "success"
        ? "background: #10b981; color: #fff; border: 1px solid #059669;"
        : "background: #ef4444; color: #fff; border: 1px solid #dc2626;"
    }
  `;
  popup.textContent = message;
  document.body.appendChild(popup);

  // Auto dismiss after 3 seconds
  setTimeout(() => {
    popup.style.opacity = "0";
    setTimeout(() => popup.remove(), 400);
  }, 3000);
}

// ── SIGNUP ──────────────────────────────────────────────
async function handleSignup() {
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;

  if (!name || !email || !password) {
    return showPopup("All fields are required");
  }

  try {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem("devlens_token", data.token);
      localStorage.setItem("devlens_user", JSON.stringify(data.user));
      showPopup("New user created", "success");
      setTimeout(() => {
        window.location.href = "/home.html";
      }, 1000);
    } else if (data.message === "Email already registered") {
      showPopup("Email already registered");
    } else {
      showPopup(data.message || "Something went wrong");
    }
  } catch (err) {
    showPopup("Something went wrong. Try again.");
  }
}

// ── LOGIN ───────────────────────────────────────────────
async function handleLogin() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    return showPopup("Email and password are required");
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem("devlens_token", data.token);
      localStorage.setItem("devlens_user", JSON.stringify(data.user));
      showPopup("Login successful", "success");
      setTimeout(() => {
        window.location.href = "/home.html";
      }, 1000);
    } else if (res.status === 401) {
      showPopup("User doesn't exist");
    } else {
      showPopup(data.message || "Something went wrong");
    }
  } catch (err) {
    showPopup("Something went wrong. Try again.");
  }
}

// ── LOGOUT ──────────────────────────────────────────────
function logout() {
  localStorage.removeItem("devlens_token");
  localStorage.removeItem("devlens_user");
  window.location.href = "/login.html";
}

// ── PROTECT PAGES ───────────────────────────────────────
function requireAuth() {
  const token = localStorage.getItem("devlens_token");
  if (!token) {
    window.location.href = "/login.html";
  }
}

// ── REDIRECT IF ALREADY LOGGED IN ───────────────────────
function redirectIfLoggedIn() {
  const token = localStorage.getItem("devlens_token");
  if (token) {
    window.location.href = "/home.html";
  }
}

// ── GET AUTH HEADER ──────────────────────────────────────
function getAuthHeader() {
  const token = localStorage.getItem("devlens_token");
  return { Authorization: `Bearer ${token}` };
}