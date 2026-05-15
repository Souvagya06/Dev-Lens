const client = require("./tursoClient");
const fs = require("fs");
const path = require("path");

async function initDB() {
  const schema = fs.readFileSync(
    path.join(__dirname, "schema.sql"),
    "utf8"
  );

  // Split by semicolon and run each statement
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await client.execute(statement);
    console.log("✅ Executed:", statement.substring(0, 50) + "...");
  }

  console.log("🎉 Database initialized successfully");
  process.exit(0);
}

initDB().catch((err) => {
  console.error("❌ DB init failed:", err);
  process.exit(1);
});