const express = require("express");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================
// STATIC FILES
// =============================
app.use(express.static(path.join(__dirname, "../frontend")));
app.use("/assets", express.static(path.join(__dirname, "../frontend/assets")));
app.use("/js", express.static(path.join(__dirname, "../frontend/js")));

// =============================
// PAGE ROUTES
// =============================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "../frontend/pages/index.html")));
app.get("/index.html", (req, res) => res.sendFile(path.join(__dirname, "../frontend/pages/index.html")));
app.get("/login.html", (req, res) => res.sendFile(path.join(__dirname, "../frontend/pages/login.html")));
app.get("/dashboard.html", (req, res) => res.sendFile(path.join(__dirname, "../frontend/pages/dashboard.html")));
app.get("/home.html", (req, res) => res.sendFile(path.join(__dirname, "../frontend/pages/home.html")));

// =============================
// API ROUTES
// =============================
app.use("/api/auth", authRoutes);  // ← NEW

app.get("/api/test", (req, res) => {
  res.json({ success: true, message: "DevLens backend running successfully 🚀" });
});

// =============================
// START SERVER
// =============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});