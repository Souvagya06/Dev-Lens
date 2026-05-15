const express = require("express");
const fs = require("fs");
const path = require("path");
const { cloneRepo, getAllFiles } = require("../utils/repoParser");
const { analyzeCode } = require("../agents/repoAgent");
const client = require("../db/tursoClient");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// ── 1. ANALYZE REPO ──────────────────────────────────────
// POST /api/repo/analyze
router.post("/analyze", authMiddleware, async (req, res) => {
  try {
    const repoUrl = req.body.repoUrl;
    const role = req.body.role || "fullstack";
    const userId = req.userId;

    if (!repoUrl || !repoUrl.includes("github.com")) {
      return res.status(400).json({
        success: false,
        message: "Valid GitHub URL required"
      });
    }

    const repoName = repoUrl
      .replace("https://github.com/", "")
      .replace(".git", "")
      .replace(/\//g, "-");

    console.log(`\n🚀 Starting analysis: ${repoName}`);

    // Clone repo
    const repoPath = await cloneRepo(repoUrl, repoName);
    const allFiles = getAllFiles(repoPath);
    console.log(`📁 Found ${allFiles.length} files`);

    // Analyze first 15 files
    const filesToAnalyze = allFiles.slice(0, 15);
    const results = [];

    for (const filePath of filesToAnalyze) {
      const code = fs.readFileSync(filePath, "utf-8");

      // Skip files larger than 5KB
      if (code.length > 5000) {
        console.log(`⏭️ Skipping large file: ${path.basename(filePath)}`);
        continue;
      }

      const relativePath = filePath
        .replace(repoPath, "")
        .replace(/\\/g, "/");

      console.log(`🔍 Analyzing: ${relativePath}`);

      const aiResponse = await analyzeCode(code, relativePath);

      let parsed;
      try {
        parsed = JSON.parse(aiResponse);
      } catch {
        parsed = {
          summary: aiResponse,
          importance: "medium",
          danger_score: 5,
          dependencies: []
        };
      }

      results.push({ path: relativePath, ...parsed });
    }

    // Calculate health score
    const avgDanger = results.reduce(
      (sum, f) => sum + (f.danger_score || 5), 0
    ) / (results.length || 1);
    const healthScore = Math.round(100 - avgDanger * 10);

    // Save to Turso
    const analysisId = require("crypto").randomUUID();

    await client.execute({
      sql: `INSERT INTO repos (id, user_id, url, name, status, health_score, repo_context, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        analysisId,
        userId,
        repoUrl,
        repoName,
        "complete",
        healthScore,
        JSON.stringify(results)
      ]
    });

    // Save individual files
    for (const file of results) {
      const fileId = require("crypto").randomUUID();
      await client.execute({
        sql: `INSERT INTO files (id, repo_id, path, summary, importance, danger_score, blast_radius)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          fileId,
          analysisId,
          file.path,
          file.summary,
          file.importance,
          file.danger_score,
          JSON.stringify(file.dependencies || [])
        ]
      });
    }

    console.log(`✅ Saved to DB. Analysis ID: ${analysisId}`);

    res.json({
      success: true,
      analysisId,
      repo: repoName,
      totalFiles: allFiles.length,
      analyzedFiles: results.length
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Analysis failed",
      error: error.message
    });
  }
});

// ── 2. GET HISTORY ────────────────────────────────────────
// GET /api/repo/history
// ⚠️ MUST be before /:analysisId route
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const result = await client.execute({
      sql: `SELECT 
              id,
              url as repo_url,
              name as repo_name,
              health_score,
              status,
              created_at,
              (SELECT COUNT(*) FROM files WHERE repo_id = repos.id) as total_files
            FROM repos
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 10`,
      args: [req.userId]
    });

    res.json({ success: true, analyses: result.rows });

  } catch (error) {
    console.error("❌ History error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch history"
    });
  }
});

// ── 3. GET SINGLE ANALYSIS ────────────────────────────────
// GET /api/repo/:analysisId
// ⚠️ MUST be after /history route
router.get("/:analysisId", authMiddleware, async (req, res) => {
  try {
    const { analysisId } = req.params;

    const repoResult = await client.execute({
      sql: `SELECT * FROM repos WHERE id = ? AND user_id = ?`,
      args: [analysisId, req.userId]
    });

    if (repoResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Analysis not found"
      });
    }

    const repo = repoResult.rows[0];
    const files = JSON.parse(repo.repo_context || "[]");

    res.json({ success: true, repo, files });

  } catch (error) {
    console.error("❌ Fetch error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch analysis"
    });
  }
});

module.exports = router;