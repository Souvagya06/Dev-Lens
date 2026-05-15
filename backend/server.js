require("dotenv").config();
const express = require("express");
const path = require("path");

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

app.use("/api/auth", authRoutes);
app.use("/api/repo", repoRoutes);

// TEST
app.get("/api/test", (req, res) => {
  res.json({ success: true, message: "DevLens backend running 🚀" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});