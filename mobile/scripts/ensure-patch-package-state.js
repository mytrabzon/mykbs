const fs = require('fs');
const path = require('path');

const cwd = process.cwd();

function ensureStateFile(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.patch-package.json'), '{}');
  } catch (_) {}
}

// Top-level (patch-package writes here)
ensureStateFile(path.join(cwd, 'node_modules', 'react-native-nfc-epassport-reader'));

// Nested (npm ls can report multiple locations)
try {
  const { execSync } = require('child_process');
  const out = execSync('npm ls react-native-nfc-epassport-reader --parseable 2>nul', { encoding: 'utf8', cwd });
  out.trim().split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && trimmed.endsWith('react-native-nfc-epassport-reader')) ensureStateFile(trimmed);
  });
} catch (_) {}
