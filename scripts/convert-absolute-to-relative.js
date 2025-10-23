#!/usr/bin/env node
// Convert leading-slash asset references to relative paths per-file
// Usage: node scripts/convert-absolute-to-relative.js [--dry-run]
// - dry-run: show diffs, do not write files
// Requires Node.js (12+)

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const excludeDirs = ['.git', 'node_modules'];
const assetFolders = ['js', 'css', 'images', 'img', 'assets', 'fonts'];
const fileGlobs = ['.html', '.htm', '.css', '.js'];
const dryRun = process.argv.includes('--dry-run');

function walk(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (excludeDirs.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, cb);
    else cb(full);
  }
}

function makePattern() {
  // src="../js/..., href="/css/..., url('../images/...')
  const folders = assetFolders.join('|');
  const patterns = [
    { re: new RegExp(`(src|href)=["']\\/(${folders})\\/([^"']+)["']`, 'g'), type: 'attr' },
    { re: new RegExp(`url\\(['"]?\\/(${folders})\\/([^'")]+)['"]?\\)`, 'g'), type: 'cssurl' }
  ];
  return patterns;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function computeRelative(filePath, assetPath) {
  // filePath: absolute path to file; assetPath: path starting with e.g. 'js/foo.js'
  const fileDir = path.dirname(filePath);
  const absAsset = path.join(repoRoot, assetPath);
  let rel = path.relative(fileDir, absAsset);
  if (!rel) rel = path.basename(assetPath);
  rel = toPosix(rel);
  // Ensure relative-looking path: prefix ./ if no ../ and does not start with .
  if (!rel.startsWith('../') && !rel.startsWith('./')) rel = './' + rel;
  return rel;
}

function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!fileGlobs.includes(ext)) return null;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  const patterns = makePattern();

  patterns.forEach(p => {
    content = content.replace(p.re, function (...args) {
      if (p.type === 'attr') {
        const whole = args[0];
        const attr = args[1];
        const folder = args[2];
        const rest = args[3];
        const assetPath = path.posix.join(folder, rest);
        const rel = computeRelative(filePath, assetPath);
        return `${attr}="${rel}"`;
      } else if (p.type === 'cssurl') {
        const matched = args[0];
        const folder = args[1];
        const rest = args[2];
        const assetPath = path.posix.join(folder, rest);
        const rel = computeRelative(filePath, assetPath);
        return `url('${rel}')`;
      }
      return args[0];
    });
  });

  if (content !== original) {
    const diffPreview = createPreviewDiff(original, content);
    return { filePath, original, content, diffPreview };
  }
  return null;
}

function createPreviewDiff(oldStr, newStr) {
  // Simple preview: show first 5 lines removed and added where changed
  const oldLines = oldStr.split(/\r?\n/);
  const newLines = newStr.split(/\r?\n/);
  const max = Math.max(oldLines.length, newLines.length);
  const lines = [];
  for (let i = 0; i < max; i++) {
    const o = oldLines[i] || '';
    const n = newLines[i] || '';
    if (o !== n) {
      lines.push(`- ${o}`);
      lines.push(`+ ${n}`);
    } else {
      lines.push(`  ${o}`);
    }
    if (lines.length > 200) break;
  }
  return lines.slice(0, 200).join('\n');
}

// Main
const changes = [];
walk(repoRoot, (file) => {
  const res = processFile(file);
  if (res) changes.push(res);
});

if (changes.length === 0) {
  console.log('No leading-slash asset references found that match the configured folders.');
  process.exit(0);
}

console.log('Files that will be changed:');
changes.forEach(c => {
  console.log('-', path.relative(repoRoot, c.filePath));
  console.log('--- preview ---');
  console.log(c.diffPreview);
  console.log('---------------\n');
});

if (!dryRun) {
  changes.forEach(c => {
    fs.writeFileSync(c.filePath, c.content, 'utf8');
  });
  console.log('Applied changes to files. Please review, test, and commit the changes.');
} else {
  console.log('Dry run complete. No files were written. Rerun without --dry-run to apply changes.');
}
