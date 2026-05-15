const axios = require("axios");
require("dotenv").config();

// ── GEMINI ────────────────────────────────────────────────
async function callGemini(prompt) {
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    }
  );
  return response.data.candidates[0].content.parts[0].text;
}

// ── GROQ ──────────────────────────────────────────────────
async function callGroq(prompt) {
  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an expert software architect analyzing repositories."
        },
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
  return response.data.choices[0].message.content;
}

// ── MAIN ANALYZE FUNCTION ─────────────────────────────────
async function analyzeCode(codeSnippet, filePath, allFilePaths = []) {
  const trimmedCode = codeSnippet.slice(0, 12000);

  // Build a short list of known repo files to help the AI resolve imports
  const knownFiles = allFilePaths.slice(0, 80).join("\n");

  const prompt = `
You are an expert software architect. Analyze this file from a GitHub repository.

File: ${filePath}

Code:
${trimmedCode}

Known files in this repo (use these to resolve import paths):
${knownFiles}

Return a JSON object with exactly these fields:
{
  "summary": "one sentence describing what this file does",
  "importance": "high or medium or low",
  "danger_score": a number from 1 to 10 indicating how risky it is to modify this file,
  "dependencies": ["array of repo-relative paths this file imports, e.g. /backend/models/User.js — ONLY include files that exist in the known files list above, skip node_modules and external packages"]
}

Rules for dependencies:
- Only include files from the known files list
- Use the exact path format from the known files list
- Skip node_modules, npm packages, built-in modules
- If no local file imports exist, return an empty array []

Respond with ONLY the JSON. No explanation. No markdown. No backticks.
`;

  try {
    console.log("🤖 Trying Gemini...");
    const result = await callGemini(prompt);
    console.log("✅ Gemini responded");
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    return parsed;
  } catch (err) {
    console.warn("⚠️ Gemini failed, switching to Groq:", err.message);
    try {
      const result = await callGroq(prompt);
      console.log("✅ Groq responded");
      const clean = result.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch (groqErr) {
      console.error("❌ Both AI models failed:", groqErr.message);
      return {
        summary: `File at ${filePath}`,
        importance: "medium",
        danger_score: 5,
        dependencies: []
      };
    }
  }
}

module.exports = { analyzeCode };