const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const { join } = require('node:path');

function collectTestFiles(dir) {
  const out = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      out.push(...collectTestFiles(p));
    } else if (dirent.name.endsWith('.test.js')) {
      out.push(p);
    }
  }
  return out;
}

const testsDir = join(__dirname, '..', 'tests');
const files = collectTestFiles(testsDir);

if (files.length === 0) {
  console.error('No *.test.js files found under tests/');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
