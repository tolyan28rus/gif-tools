const fs = require('fs');
const p = require('path');

const standalone = '.next/standalone';

// Find project subdirectory
const subdirs = fs.readdirSync(standalone, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules' && d.name !== 'public' && d.name !== 'tmp');

if (subdirs.length === 0) {
  console.error('No project subdirectory found in standalone');
  process.exit(1);
}

const projDir = p.join(standalone, subdirs[0].name);
const targetNext = p.join(projDir, '.next');

fs.mkdirSync(targetNext, { recursive: true });

// Copy .next/static -> standalone/project/.next/static
const staticSrc = '.next/static';
const staticDst = p.join(targetNext, 'static');
if (fs.existsSync(staticSrc)) {
  if (fs.existsSync(staticDst)) fs.rmSync(staticDst, { recursive: true });
  fs.cpSync(staticSrc, staticDst, { recursive: true });
  console.log('Copied .next/static ->', staticDst);
} else {
  console.error('Source .next/static not found!');
}

// Copy public -> standalone/project/public
const publicSrc = 'public';
const publicDst = p.join(projDir, 'public');
if (fs.existsSync(publicSrc)) {
  if (fs.existsSync(publicDst)) fs.rmSync(publicDst, { recursive: true });
  fs.cpSync(publicSrc, publicDst, { recursive: true });
  console.log('Copied public ->', publicDst);
} else {
  console.error('Source public/ not found!');
}

// Copy missing sharp native DLLs (libvips) that Next.js trace-based bundler skips
const sharpDllSrc = p.join('node_modules', '@img', 'sharp-win32-x64', 'lib');
const sharpDllDst = p.join(projDir, 'node_modules', '@img', 'sharp-win32-x64', 'lib');
if (fs.existsSync(sharpDllSrc)) {
  const dlls = fs.readdirSync(sharpDllSrc).filter(f => f.endsWith('.dll'));
  fs.mkdirSync(sharpDllDst, { recursive: true });
  for (const dll of dlls) {
    fs.cpSync(p.join(sharpDllSrc, dll), p.join(sharpDllDst, dll));
    console.log('Copied sharp DLL:', dll);
  }
}

console.log('Done copying standalone files');
