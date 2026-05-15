const patterns = [
  /import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g,
  /from\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s+import/g,
  /from\s+(\.[\.a-zA-Z0-9_]*)\s+import/g
];

const code = `import json
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import bcrypt
from . import config
from ..core import constants
from app.api import interview`;

const matches = new Set();
for (const pattern of patterns) {
  pattern.lastIndex = 0;
  let match = pattern.exec(code);
  while (match) {
    matches.add(match[1]);
    console.log(`Pattern matched: "${match[1]}"`);
    match = pattern.exec(code);
  }
}

console.log('\nAll matched imports:');
[...matches].forEach(m => console.log('  -', m));
console.log('\nTotal matches:', matches.size);
