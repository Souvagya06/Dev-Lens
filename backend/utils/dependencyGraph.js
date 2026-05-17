const fs = require("fs");
const path = require("path");

const SUPPORTED_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".json",
  ".py" // Python support
]);

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".cache",
  ".turbo",
  "out",
  "bin",
  "target",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
  ".egg-info",
  "*.egg-info"
]);

const DEPENDENCY_PATTERNS = [
  // JavaScript/TypeScript patterns
  /import\s+(?:type\s+)?(?:[\w*\s{},]*?\s+from\s+)?["']([^"']+)["']/g,
  /export\s+[\w*\s{},]*?\s+from\s+["']([^"']+)["']/g,
  /require\s*\(\s*["']([^"']+)["']\s*\)/g,
  /import\s*\(\s*["']([^"']+)["']\s*\)/g,
  // Python patterns - ONLY match module paths, not imported names
  /^import\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gm,
  /^from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import/gm,
  /^from\s+(\.[\.a-zA-Z0-9_]*)\s+import/gm
];

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function isProbablyBinary(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));

  for (const byte of sample) {
    if (byte === 0) {
      return true;
    }
  }

  return false;
}

function walkRepositoryFiles(rootDir, currentDir = rootDir, filePaths = []) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      walkRepositoryFiles(rootDir, fullPath, filePaths);
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      continue;
    }

    filePaths.push(fullPath);
  }

  return filePaths;
}

function registerLookupKey(lookup, relativePath) {
  const normalized = normalizePath(relativePath);
  lookup.set(normalized, normalized);

  const extension = path.posix.extname(normalized);
  if (extension) {
    lookup.set(normalized.slice(0, -extension.length), normalized);
  }

  const indexSuffix = `/index${extension}`;
  if (extension && normalized.endsWith(indexSuffix)) {
    lookup.set(normalized.slice(0, -indexSuffix.length), normalized);
  }
}

function buildFileLookup(repoPath, absoluteFiles) {
  const lookup = new Map();
  const relativeFiles = [];

  for (const absoluteFile of absoluteFiles) {
    const relativeFile = normalizePath(path.relative(repoPath, absoluteFile));
    relativeFiles.push(relativeFile);
    registerLookupKey(lookup, relativeFile);
  }

  relativeFiles.sort((left, right) => left.localeCompare(right));

  return { lookup, relativeFiles };
}

function extractDependencySpecifiers(sourceCode) {
  const specifiers = new Set();

  for (const pattern of DEPENDENCY_PATTERNS) {
    pattern.lastIndex = 0;

    let match = pattern.exec(sourceCode);
    while (match) {
      const specifier = match[1] && match[1].trim();
      if (specifier) {
        specifiers.add(specifier);
      }
      match = pattern.exec(sourceCode);
    }
  }

  return [...specifiers];
}

function resolveRelativeDependency(sourceFile, dependencySpecifier, lookup) {
  const sourceDir = path.posix.dirname(sourceFile);
  const normalizedSpecifier = normalizePath(dependencySpecifier);
  
  // Handle JavaScript relative imports
  if (normalizedSpecifier.startsWith(".") || normalizedSpecifier.startsWith("/")) {
    const joinedPath = normalizedSpecifier.startsWith("/")
      ? normalizedSpecifier.slice(1)
      : path.posix.normalize(path.posix.join(sourceDir, normalizedSpecifier));

    const candidatePaths = new Set([joinedPath]);
    const basePaths = [joinedPath];

    if (!path.posix.extname(joinedPath)) {
      const extensions = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts", ".json", ".py"];

      for (const extension of extensions) {
        basePaths.push(`${joinedPath}${extension}`);
        basePaths.push(`${joinedPath}/index${extension}`);
      }
    }

    for (const candidate of basePaths) {
      candidatePaths.add(candidate);
    }

    for (const candidate of candidatePaths) {
      const mapped = lookup.get(candidate);
      if (mapped) {
        return mapped;
      }
    }

    return null;
  }
  
  // Handle Python absolute imports (e.g., "app.models" -> "app/models.py")
  const parts = normalizedSpecifier.split(".");
  const filePath = parts.join("/");
  
  // Try with .py extension
  for (const candidate of [filePath + ".py", filePath + "/index.py", filePath + "/init.py"]) {
    const mapped = lookup.get(candidate);
    if (mapped) {
      return mapped;
    }
  }
  
  // Also try __init__.py for package imports
  const initCandidate = filePath + "/__init__.py";
  const mapped = lookup.get(initCandidate);
  if (mapped) {
    return mapped;
  }
  
  return null;
}

function buildDependencyGraph(repoPath) {
  const absoluteFiles = walkRepositoryFiles(repoPath);
  const { lookup, relativeFiles } = buildFileLookup(repoPath, absoluteFiles);
  const linkSet = new Set();

  for (const absoluteFile of absoluteFiles) {
    let fileBuffer;

    try {
      fileBuffer = fs.readFileSync(absoluteFile);
    } catch {
      continue;
    }

    if (isProbablyBinary(fileBuffer)) {
      continue;
    }

    const sourceCode = fileBuffer.toString("utf8");
    const sourceFile = normalizePath(path.relative(repoPath, absoluteFile));
    const specifiers = extractDependencySpecifiers(sourceCode);

    for (const specifier of specifiers) {
      const targetFile = resolveRelativeDependency(sourceFile, specifier, lookup);
      if (!targetFile || targetFile === sourceFile) {
        continue;
      }

      linkSet.add(`${sourceFile} -> ${targetFile}`);
    }
  }

  const links = [...linkSet].map((entry) => {
    const [source, target] = entry.split(" -> ");
    return { source, target };
  });

  // Calculate blast radius (incoming dependencies count)
  const blastRadius = new Map();
  for (const file of relativeFiles) {
    blastRadius.set(file, 0);
  }
  for (const link of links) {
    const count = blastRadius.get(link.target) || 0;
    blastRadius.set(link.target, count + 1);
  }

  // Build adjacency maps for incoming/outgoing connections
  const incomingMap = new Map();
  const outgoingMap = new Map();
  
  for (const file of relativeFiles) {
    incomingMap.set(file, []);
    outgoingMap.set(file, []);
  }
  
  for (const link of links) {
    outgoingMap.get(link.source).push(link.target);
    incomingMap.get(link.target).push(link.source);
  }

  // Detect orphan nodes and classify them
  const isOrphanNode = new Map();
  
  for (const file of relativeFiles) {
    const hasIncoming = incomingMap.get(file).length > 0;
    const hasOutgoing = outgoingMap.get(file).length > 0;
    
    // A node is potentially orphan if it has NO connections at all
    isOrphanNode.set(file, !hasIncoming && !hasOutgoing);
  }

  // Create nodes with enhanced metadata
  const nodes = relativeFiles.map((id) => ({
    id,
    blastRadius: blastRadius.get(id) || 0,
    incomingCount: incomingMap.get(id).length,
    outgoingCount: outgoingMap.get(id).length,
    isIsolated: isOrphanNode.get(id),
    isolationReason: null // Will be set by AI analysis
  }));

  return { nodes, links };
}

module.exports = { buildDependencyGraph };