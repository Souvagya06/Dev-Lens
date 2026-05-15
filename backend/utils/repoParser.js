const simpleGit = require("simple-git");
const fs = require("fs");
const path = require("path");

// Clone the repo into backend/repos/repoName
async function cloneRepo(repoUrl, repoName) {
  const repoPath = path.join(__dirname, "../repos", repoName);

  // If already cloned, skip
  if (fs.existsSync(repoPath)) {
    console.log(`✅ Repo already exists: ${repoName}`);
    return repoPath;
  }

  console.log(`📥 Cloning repo: ${repoUrl}`);
  const git = simpleGit();
  await git.clone(repoUrl, repoPath);
  console.log(`✅ Cloned successfully: ${repoName}`);

  return repoPath;
}

// Recursively get all files, skip node_modules/.git/dist
function getAllFiles(dirPath, arrayOfFiles = []) {
  const IGNORE_FOLDERS = [
    "node_modules", ".git", "dist", "build",
    ".next", "__pycache__", ".cache", "coverage"
  ];

  const ALLOWED_EXTENSIONS = [
    ".js", ".ts", ".jsx", ".tsx",
    ".py", ".go", ".java", ".rb",
    ".php", ".cs", ".cpp", ".c",
    ".json", ".env.example", ".md"
  ];

  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);

    if (fs.statSync(fullPath).isDirectory()) {
      if (!IGNORE_FOLDERS.includes(file)) {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      const ext = path.extname(file);
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

module.exports = { cloneRepo, getAllFiles };