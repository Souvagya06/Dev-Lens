require("dotenv").config();
const express = require("express");
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ MIDDLEWARE FIRST — before everything
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// STATIC FILES
app.use(express.static(path.join(__dirname, "../frontend")));
app.use("/assets", express.static(path.join(__dirname, "../frontend/assets")));
app.use("/js", express.static(path.join(__dirname, "../frontend/js")));

// PAGE ROUTES
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "../frontend/pages/index.html")));
app.get("/login.html", (req, res) => res.sendFile(path.join(__dirname, "../frontend/pages/login.html")));
app.get("/dashboard.html", (req, res) => res.sendFile(path.join(__dirname, "../frontend/pages/dashboard.html")));
app.get("/home.html", (req, res) => res.sendFile(path.join(__dirname, "../frontend/pages/home.html")));

// ✅ API ROUTES — after middleware
const authRoutes = require("./routes/auth");
const repoRoutes = require("./routes/repoRoutes");
const authMiddleware = require("./middleware/authMiddleware");
const db = require("./db/tursoClient"); // exports client directly

app.use("/api/auth", authRoutes);
app.use("/api/repo", repoRoutes);

// ── DASHBOARD DATA ROUTES ────────────────────────────────────────────────────
// Note: GET /api/repo/:id is handled inside repoRoutes.js already

// GET all files for a repo (path, summary, importance, danger_score)
app.get("/api/repo/:id/files", authMiddleware, async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT * FROM files WHERE repo_id = ?",
      args: [req.params.id],
    });
    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/repo/:id/files", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET all dependency edges for a repo (from_file, to_file)
app.get("/api/repo/:id/edges", authMiddleware, async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT * FROM edges WHERE repo_id = ?",
      args: [req.params.id],
    });
    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/repo/:id/edges", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET onboarding path for a role (returns roadmap_json if already saved)
app.get("/api/repo/:id/onboarding", authMiddleware, async (req, res) => {
  try {
    const { role } = req.query;
    const result = await db.execute({
      sql: "SELECT * FROM onboarding_paths WHERE analysis_id = ? AND role = ?",
      args: [req.params.id, role],
    });
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error("GET /api/repo/:id/onboarding", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST save AI-generated onboarding path
app.post("/api/repo/:id/onboarding", authMiddleware, async (req, res) => {
  try {
    const { role, roadmap_json } = req.body;
    const id = randomUUID();
    await db.execute({
      sql: "INSERT OR REPLACE INTO onboarding_paths (id, analysis_id, role, roadmap_json) VALUES (?, ?, ?, ?)",
      args: [id, req.params.id, role, roadmap_json],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/repo/:id/onboarding", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST save a QnA exchange to history
app.post("/api/repo/:id/qna", authMiddleware, async (req, res) => {
  try {
    const { question, answer } = req.body;
    const id = randomUUID();
    await db.execute({
      sql: "INSERT INTO qna_history (id, analysis_id, question, answer) VALUES (?, ?, ?, ?)",
      args: [id, req.params.id, question, answer],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/repo/:id/qna", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── AI CHAT PROXY — uses same Gemini/Groq stack as repo analysis ─────────────
app.post("/api/ai/chat", authMiddleware, async (req, res) => {
  try {
    const axios = require("axios");
    const { prompt } = req.body;

    if (!prompt) return res.status(400).json({ error: "prompt required" });

    // Try Gemini first (same model used during repo analysis)
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: prompt }] }]
        }
      );
      const text = response.data.candidates[0].content.parts[0].text;
      res.json({ text });
    } catch (geminiErr) {
      console.warn("⚠️ Gemini chat failed, falling back to Groq:", geminiErr.message);

      // Fallback to Groq
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You are DevLens AI, an expert at explaining codebases." },
            { role: "user", content: prompt }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );
      const text = response.data.choices[0].message.content;
      res.json({ text });
    }
  } catch (err) {
    console.error("AI chat proxy error:", err.response?.data || err.message);
    res.status(500).json({ error: "AI request failed" });
  }
});

// ── TEST ─────────────────────────────────────────────────────────────────────
app.get("/api/test", (req, res) => {
  res.json({ success: true, message: "DevLens backend running 🚀" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});