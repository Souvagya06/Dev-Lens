const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================
// STATIC FILES
// =============================

// Serve frontend folder
app.use(express.static(path.join(__dirname, "../frontend")));

// CSS
app.use(
  "/assets",
  express.static(path.join(__dirname, "../frontend/assets"))
);

// JS
app.use(
  "/js",
  express.static(path.join(__dirname, "../frontend/js"))
);

// =============================
// PAGE ROUTES
// =============================

// Landing Page
app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../frontend/pages/index.html")
  );
});

// Index.html
app.get("/index.html", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../frontend/pages/index.html")
  );
});

// Login.html
app.get("/login.html", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../frontend/pages/login.html")
  );
});

// Dashboard.html
app.get("/dashboard.html", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../frontend/pages/dashboard.html")
  );
});

// Home.html
app.get("/home.html", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../frontend/pages/home.html")
  );
});

// =============================
// TEST API
// =============================

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "DevLens backend running successfully 🚀",
  });
});

// =============================
// START SERVER
// =============================

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});