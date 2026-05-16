// ── API BASE ──────────────────────────────────────────────
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : 'https://dev-lens-39k6.onrender.com/api';

// ── ROLE SELECTION ────────────────────────────────────────
let selectedRole = "fullstack";

function selectRole(role) {
  selectedRole = role;
  document.querySelectorAll(".role-btn").forEach((btn) => {
    btn.classList.remove("bg-purple-600", "text-white", "border-purple-600");
    btn.classList.add("text-gray-400", "border-[#1e1e2e]");
  });
  const selected = document.getElementById(`role-${role}`);
  selected.classList.add("bg-purple-600", "text-white", "border-purple-600");
  selected.classList.remove("text-gray-400", "border-[#1e1e2e]");
}

// ── ANALYZE REPO ──────────────────────────────────────────
async function analyzeRepo() {
  const repoUrl = document.getElementById("repoUrl").value.trim();

  if (!repoUrl) {
    showPopup("Please paste a GitHub URL", "error");
    return;
  }

  if (!repoUrl.includes("github.com")) {
    showPopup("Please enter a valid GitHub URL", "error");
    return;
  }

  // Show loading screen
  document.getElementById("main-section").classList.add("hidden");
  document.getElementById("loading-section").classList.remove("hidden");

  startAgentLogs();

  try {
    const token = localStorage.getItem("devlens_token");

    const response = await fetch(`${API_BASE}/repo/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ repoUrl, role: selectedRole })
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem("devlens_analysisId", data.analysisId);
      localStorage.setItem("devlens_repoUrl", repoUrl);
      localStorage.setItem("devlens_repoName", data.repo);
      showPopup("Analysis complete! Loading dashboard...", "success");
      // Restore main section before redirect so Back button lands here correctly
      document.getElementById("main-section").classList.remove("hidden");
      document.getElementById("loading-section").classList.add("hidden");
      history.replaceState(null, "", window.location.href);
      setTimeout(() => {
        window.location.href = `/dashboard.html?repo_id=${data.analysisId}`;
      }, 1000);
    } else if (data.message === "Invalid token" || data.message === "Unauthorized") {
      logout();
    } else {
      showError(data.message || "Analysis failed");
    }
  } catch (err) {
    showError("Server error. Make sure backend is running.");
  }
}

function showError(message) {
  document.getElementById("main-section").classList.remove("hidden");
  document.getElementById("loading-section").classList.add("hidden");
  showPopup(message, "error");
}

// ── AGENT LOG ANIMATION ───────────────────────────────────
function startAgentLogs() {
  const logs = [
    "[Repo Agent] Fetching repository file tree...",
    "[Repo Agent] Cloning repository...",
    "[Dependency Agent] Parsing import statements...",
    "[Dependency Agent] Building dependency graph...",
    "[AI Agent] Sending files to Gemini...",
    "[AI Agent] Generating file summaries...",
    "[Blast Radius Agent] Computing impact chains...",
    "[Onboarding Agent] Building your learning path...",
    "[Risk Agent] Calculating danger scores...",
    "[Coordinator] Assembling final analysis...",
  ];

  const logBox = document.getElementById("agent-logs");
  logBox.innerHTML = "";
  let i = 0;

  const interval = setInterval(() => {
    if (i >= logs.length) {
      clearInterval(interval);
      return;
    }
    const line = document.createElement("div");
    line.textContent = logs[i];
    line.style.opacity = "0";
    line.style.transition = "opacity 0.4s ease";
    logBox.appendChild(line);
    setTimeout(() => (line.style.opacity = "1"), 50);
    logBox.scrollTop = logBox.scrollHeight;

    const progress = Math.round(((i + 1) / logs.length) * 100);
    document.getElementById("progress-bar").style.width = `${progress}%`;

    i++;
  }, 2500);
}

// ── LOAD PAST ANALYSES ────────────────────────────────────
async function loadPastAnalyses() {
  try {
    const token = localStorage.getItem("devlens_token");
    const res = await fetch(`${API_BASE}/repo/history`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await res.json();

    const container = document.getElementById("past-analyses");

    // If the server says the token is invalid/expired, log out silently
    if (res.status === 401 || data.message === "Invalid token" || data.message === "Unauthorized") {
      logout();
      return;
    }

    if (!data.success || data.analyses.length === 0) {
      container.innerHTML = `
        <p class="text-gray-500 text-sm col-span-3">
          No analyses yet. Paste a GitHub URL above to get started.
        </p>`;
      return;
    }

    container.innerHTML = data.analyses.map((a) => `
      <div onclick="openAnalysis('${a.id}', '${a.repo_name}')"
        class="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5 cursor-pointer
               hover:border-purple-500 hover:shadow-[0_0_20px_rgba(124,58,237,0.15)]
               transition-all duration-200">
        <div class="flex justify-between items-start mb-2">
          <h3 class="text-white font-bold text-sm">${a.repo_name}</h3>
          <span class="text-xs px-2 py-1 rounded-full font-bold ${getHealthColor(a.health_score)}">
            ${a.health_score ?? "—"}
          </span>
        </div>
        <p class="text-gray-500 text-xs mb-3 truncate">${a.repo_url}</p>
        <div class="flex gap-4 text-gray-500 text-xs mb-3">
          <span>📄 ${a.total_files ?? 0} files</span>
          <span>🕐 ${formatDate(a.created_at)}</span>
        </div>
        <div class="text-purple-400 text-xs font-medium">View Dashboard →</div>
      </div>
    `).join("");

  } catch (err) {
    console.error("Failed to load past analyses:", err);
  }
}

function openAnalysis(id, repo) {
  window.location.href = `/dashboard.html?repo_id=${id}`;
}

function getHealthColor(score) {
  if (!score) return "bg-gray-800 text-gray-400";
  if (score >= 70) return "bg-green-900 text-green-300";
  if (score >= 40) return "bg-yellow-900 text-yellow-300";
  return "bg-red-900 text-red-300";
}

function formatDate(dateStr) {
  if (!dateStr) return "Recently";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── POPUP ─────────────────────────────────────────────────
function showPopup(message, type = "error") {
  const existing = document.getElementById("devlens-popup");
  if (existing) existing.remove();

  const popup = document.createElement("div");
  popup.id = "devlens-popup";
  popup.style.cssText = `
    position: fixed; top: 24px; left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px; border-radius: 8px;
    font-family: Inter, sans-serif; font-size: 14px; font-weight: 500;
    z-index: 9999; box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    transition: opacity 0.4s ease; white-space: nowrap;
    ${type === "success"
      ? "background:#10b981;color:#fff;border:1px solid #059669;"
      : "background:#ef4444;color:#fff;border:1px solid #dc2626;"}
  `;
  popup.textContent = message;
  document.body.appendChild(popup);

  setTimeout(() => {
    popup.style.opacity = "0";
    setTimeout(() => popup.remove(), 400);
  }, 3000);
}

// ── LOGOUT ────────────────────────────────────────────────
function logout() {
  localStorage.removeItem("devlens_token");
  localStorage.removeItem("devlens_user");
  localStorage.removeItem("devlens_analysisId");
  localStorage.removeItem("devlens_repoName");
  window.location.href = "/";
}

// ── PROTECT PAGE ──────────────────────────────────────────
const token = localStorage.getItem("devlens_token");
if (!token) {
  window.location.href = "/";
}

// Always reset to main section visible on load (handles browser Back from dashboard)
document.getElementById("main-section").classList.remove("hidden");
document.getElementById("loading-section").classList.add("hidden");

// Show user email in navbar
const user = JSON.parse(localStorage.getItem("devlens_user") || "{}");
if (user.email) {
  const emailEl = document.getElementById("user-email");
  if (emailEl) emailEl.textContent = user.email;
}

// Wire logout button (works for both dashboard.html and home.html)
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", logout);
}

// Load past analyses on page load
loadPastAnalyses();