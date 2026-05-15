const express = require("express");
const fs = require("fs");
const path = require("path");
const { cloneRepo, getAllFiles } = require("../utils/repoParser");
const { analyzeCode } = require("../agents/repoAgent");

const router = express.Router();

router.post("/analyze", async (req, res) => {
  try {
    const { repoUrl } = req.body;

    if (!repoUrl || !repoUrl.includes("github.com")) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid GitHub URL"
      });
    }

    // Extract repo name from URL
    const repoName = repoUrl
      .replace("https://github.com/", "")
      .replace(".git", "")
      .replace("/", "-");

    console.log(`\n🚀 Starting analysis for: ${repoName}`);

    // Step 1 — Clone
    const repoPath = await cloneRepo(repoUrl, repoName);

    // Step 2 — Get all files
    const allFiles = getAllFiles(repoPath);
    console.log(`📁 Found ${allFiles.length} files`);

    // Step 3 — Limit to first 10 files for now (safe for testing)
    const filesToAnalyze = allFiles.slice(0, 10);

    // Step 4 — Analyze each file
    const results = [];

    for (const filePath of filesToAnalyze) {
      const code = fs.readFileSync(filePath, "utf-8");

      // Skip files larger than 5KB to save tokens
      if (code.length > 5000) {
        console.log(`⏭️ Skipping large file: ${path.basename(filePath)}`);
        continue;
      }

      const relativePath = filePath.replace(repoPath, "").replace(/\\/g, "/");
      console.log(`🔍 Analyzing: ${relativePath}`);

      const aiResponse = await analyzeCode(code, relativePath);

      // Parse JSON response from AI
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

      results.push({
        path: relativePath,
        ...parsed
      });
    }

    console.log(`\n✅ Analysis complete. ${results.length} files analyzed.`);

    res.json({
      success: true,
      repo: repoName,
      totalFiles: allFiles.length,
      analyzedFiles: results.length,
      files: results
    });

  } catch (error) {
    console.error("❌ Analysis error:", error.message);
    res.status(500).json({
      success: false,
      message: "Analysis failed",
      error: error.message
    });
  }
});

module.exports = router;