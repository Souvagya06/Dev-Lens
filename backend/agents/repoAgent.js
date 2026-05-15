const axios = require("axios");
require("dotenv").config();

// ── GEMINI ───────────────────────────────────────────────
async function callGemini(prompt) {
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json"   // ✅ CHANGE 1: strict JSON mode
      }
    }
  );
  return response.data.candidates[0].content.parts[0].text;
}

// ── GROQ ─────────────────────────────────────────────────
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
        {
          role: "user",
          content: prompt
        }
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

// ── AI CLIENT WITH FALLBACK ───────────────────────────────
async function analyzeCode(codeSnippet, filePath) {
  const trimmedCode = codeSnippet.slice(0, 12000); // ✅ CHANGE 2: limit code size

  const prompt = `
You are an expert software architect. Analyze this file from a GitHub repository.

File: ${filePath}

Code:
${trimmedCode}

Return a JSON object with exactly these fields:
{
  "summary": "one sentence describing what this file does",
  "importance": "high or medium or low",
  "danger_score": a number from 1 to 10 indicating how risky it is to modify this file,
  "dependencies": ["list of files or modules this file imports"]
}

Respond with ONLY the JSON. No explanation. No markdown. No backticks.
`;

  try {
    console.log("🤖 Trying Gemini...");
    const result = await callGemini(prompt);
    console.log("✅ Gemini responded");
    return JSON.parse(result); // ✅ CHANGE 3: parse JSON (Gemini)
  } catch (err) {
    console.warn("⚠️ Gemini failed, switching to Groq:", err.message);
    try {
      const result = await callGroq(prompt);
      console.log("✅ Groq responded");
      return JSON.parse(result); // ✅ CHANGE 3: parse JSON (Groq)
    } catch (groqErr) {
      console.error("❌ Both AI APIs failed:", groqErr.message);
      return {
        summary: "Could not analyze this file",
        importance: "unknown",
        danger_score: 0,
        dependencies: []
      };
    }
  }
}

module.exports = { analyzeCode };