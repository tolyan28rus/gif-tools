const fs = require('fs');
const path = require('path');

const dir = 'src/app/api/gif';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Add rm and readdir to imports if needed
  if (content.includes("execFileAsync('rm'") && !content.includes('rm,') && !content.includes('rm }')) {
    content = content.replace(
      /from 'fs\/promises'/,
      m => m
    );
    // Add rm to existing import
    if (content.includes("import { readFile, writeFile, unlink, mkdir, rename } from 'fs/promises'")) {
      content = content.replace(
        "import { readFile, writeFile, unlink, mkdir, rename } from 'fs/promises'",
        "import { readFile, writeFile, unlink, mkdir, readdir, rm, rename } from 'fs/promises'"
      );
      changed = true;
    } else if (content.includes("import { readFile, writeFile, unlink, mkdir } from 'fs/promises'")) {
      content = content.replace(
        "import { readFile, writeFile, unlink, mkdir } from 'fs/promises'",
        "import { readFile, writeFile, unlink, mkdir, readdir, rm } from 'fs/promises'"
      );
      changed = true;
    }
  }

  // Replace execFileAsync('mkdir', ['-p', dir]) with mkdir(dir, { recursive: true })
  if (content.includes("execFileAsync('mkdir'")) {
    content = content.replace(/await execFileAsync\('mkdir', \['-p', (\w+)\]\)/g, 'await mkdir($1, { recursive: true })');
    changed = true;
  }

  // Replace ls with readdir
  if (content.includes("execFileAsync('ls'")) {
    content = content.replace(
      /const \{ stdout \} = await execFileAsync\('ls', \[(\w+)\]\)\s*\n\s*const (\w+) = stdout\.trim\(\)\.split\('\\n'\)\.filter\(Boolean\)\.sort\(\)/g,
      'const $2 = (await readdir($1)).filter(f => f.endsWith(\'.png\')).sort()'
    );
    changed = true;
  }

  // Replace rm -rf with fs.rm
  if (content.includes("execFileAsync('rm'")) {
    content = content.replace(
      /try \{ await execFileAsync\('rm', \['-rf', (\w+)\]\) \} catch \{\}/g,
      'try { await rm($1, { recursive: true, force: true }) } catch {}'
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${file}`);
  }
}

console.log('Done');
