const express = require("express");
const fs = require("fs");
const path = require("path");
const { cloneRepo, getAllFiles } = require("../utils/repoParser");
const { buildDependencyGraph } = require("../utils/dependencyGraph");
const { analyzeCode } = require("../agents/repoAgent");
const client = require("../db/tursoClient");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// ── 0. DEPENDENCY GRAPH ──────────────────────────────────
// POST /api/repo/graph
router.post("/graph", authMiddleware, async (req, res) => {
  try {
    const repoUrl = req.body.repoUrl;

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

    console.log(`\n🧭 Building dependency graph: ${repoName}`);

    const repoPath = await cloneRepo(repoUrl, repoName);
    const graph = buildDependencyGraph(repoPath);

    console.log(`✅ Dependency graph ready: ${graph.nodes.length} nodes, ${graph.links.length} links`);

    res.json({
      success: true,
      repo: repoName,
      nodes: graph.nodes,
      links: graph.links
    });
  } catch (error) {
    console.error("❌ Graph error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to build dependency graph",
      error: error.message
    });
  }
});

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

    // ✅ FIX 1: properly extract owner and repo name separately
    const slugFull = repoUrl
      .replace("https://github.com/", "")
      .replace(".git", "")
      .replace(/\/$/, "");
    const [repoOwner, repoNameOnly] = slugFull.split("/");
    const repoName = slugFull.replace("/", "-"); // used for cloning folder

    console.log(`\n🚀 Starting analysis: ${slugFull}`);

    // Clone repo
    const repoPath = await cloneRepo(repoUrl, repoName);
    const allFiles = getAllFiles(repoPath);
    console.log(`📁 Found ${allFiles.length} files`);

    // Build relative paths list for AI context
    const allRelativePaths = allFiles.map(f =>
      f.replace(repoPath, "").replace(/\\/g, "/")
    );

    // Analyze first 15 files
    const filesToAnalyze = allFiles.slice(0, 15);
    const results = [];

    for (const filePath of filesToAnalyze) {
      const code = fs.readFileSync(filePath, "utf-8");

      if (code.length > 5000) {
        console.log(`⏭️ Skipping large file: ${path.basename(filePath)}`);
        continue;
      }

      const relativePath = filePath
        .replace(repoPath, "")
        .replace(/\\/g, "/");

      console.log(`🔍 Analyzing: ${relativePath}`);

      const aiResponse = await analyzeCode(code, relativePath, allRelativePaths);

      let parsed;
      try {
        parsed = typeof aiResponse === "string" ? JSON.parse(aiResponse) : aiResponse;
      } catch {
        parsed = {
          summary: String(aiResponse),
          importance: "medium",
          danger_score: 5,
          dependencies: []
        };
      }

      // Ensure summary is a string
      if (parsed.summary && typeof parsed.summary === "object") {
        parsed.summary = JSON.stringify(parsed.summary);
      }

      // Resolve dependencies: match AI output against real file paths
      const rawDeps = Array.isArray(parsed.dependencies) ? parsed.dependencies : [];
      parsed.dependencies = rawDeps
        .map(dep => {
          // If it already exactly matches a known path, use it
          if (allRelativePaths.includes(dep)) return dep;
          // Try matching by basename
          const depBase = dep.split("/").pop().replace(/\.[^.]+$/, ""); // strip extension
          const match = allRelativePaths.find(p => {
            const pBase = p.split("/").pop().replace(/\.[^.]+$/, "");
            return pBase === depBase;
          });
          return match || null;
        })
        .filter(Boolean) // remove nulls
        .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

      results.push({ path: relativePath, ...parsed });
    }

    // Calculate health score
    const avgDanger = results.reduce(
      (sum, f) => sum + (f.danger_score || 5), 0
    ) / (results.length || 1);
    const healthScore = Math.round(100 - avgDanger * 10);

    // Save to Turso
    const analysisId = require("crypto").randomUUID();

    // ✅ FIX 3: save owner and name as separate columns
    await client.execute({
      sql: `INSERT INTO repos (id, user_id, url, owner, name, status, health_score, repo_context, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        analysisId,
        userId,
        repoUrl,
        repoOwner,      // e.g. "facebook"
        repoNameOnly,   // e.g. "react"
        "complete",
        healthScore,
        JSON.stringify(results)
      ]
    });

    // Save individual files + extract edges
    const edgePairs = new Set(); // deduplicate

    for (const file of results) {
      const fileId = require("crypto").randomUUID();
      await client.execute({
        sql: `INSERT INTO files (id, repo_id, path, summary, importance, danger_score, blast_radius)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          fileId,
          analysisId,
          file.path,
          typeof file.summary === "string" ? file.summary : JSON.stringify(file.summary),
          file.importance,
          file.danger_score,
          JSON.stringify(file.dependencies || [])
        ]
      });

      // Save dependency edges: file.dependencies is array of paths this file imports
      const deps = Array.isArray(file.dependencies) ? file.dependencies : [];
      for (const dep of deps) {
        const edgeKey = `${file.path}|${dep}`;
        if (!edgePairs.has(edgeKey)) {
          edgePairs.add(edgeKey);
          const edgeId = require("crypto").randomUUID();
          await client.execute({
            sql: `INSERT INTO edges (id, repo_id, from_file, to_file) VALUES (?, ?, ?, ?)`,
            args: [edgeId, analysisId, file.path, dep]
          });
        }
      }
    }

    console.log(`✅ Saved to DB. Analysis ID: ${analysisId}`);

    // ── CLEANUP: delete cloned repo from disk ──────────────
    try {
      fs.rmSync(repoPath, { recursive: true, force: true });
      console.log(`🗑️ Cleaned up temp repo: ${repoName}`);
    } catch (cleanupErr) {
      console.warn(`⚠️ Cleanup warning: ${cleanupErr.message}`);
    }

    res.json({
      success: true,
      analysisId,
      repo: repoNameOnly,
      totalFiles: allFiles.length,
      analyzedFiles: results.length
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
    try {
      const failedPath = path.join(__dirname, "../temp", repoName);
      fs.rmSync(failedPath, { recursive: true, force: true });
    } catch (_) {}

    res.status(500).json({
      success: false,
      message: "Analysis failed",
      error: error.message
    });
  }
});

// ── 2. GET HISTORY ────────────────────────────────────────
// GET /api/repo/history  ⚠️ MUST be before /:analysisId
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const result = await client.execute({
      sql: `SELECT 
              id,
              url as repo_url,
              COALESCE(owner || '/' || name, name, url) as repo_name,
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
    res.status(500).json({ success: false, message: "Failed to fetch history" });
  }
});

// ── 3. GET SINGLE ANALYSIS ────────────────────────────────
// GET /api/repo/:analysisId  ⚠️ MUST be after /history
router.get("/:analysisId", authMiddleware, async (req, res) => {
  try {
    const { analysisId } = req.params;

    const repoResult = await client.execute({
      sql: `SELECT * FROM repos WHERE id = ? AND user_id = ?`,
      args: [analysisId, req.userId]
    });

    if (repoResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Analysis not found" });
    }

    const repo = repoResult.rows[0];
    const files = JSON.parse(repo.repo_context || "[]");

    res.json({ success: true, repo, files });

  } catch (error) {
    console.error("❌ Fetch error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch analysis" });
  }
});

module.exports = router;