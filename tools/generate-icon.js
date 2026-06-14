const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [16, 32, 48, 64, 128, 256];
const outputDir = path.join(__dirname);
fs.mkdirSync(outputDir, { recursive: true });

function svgContent(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="48" ry="48" fill="url(#bg)"/>
  <text x="128" y="125" text-anchor="middle" dominant-baseline="central"
        font-family="Arial, sans-serif" font-weight="bold" font-size="76"
        fill="white">GIF</text>
  <text x="128" y="200" text-anchor="middle" dominant-baseline="central"
        font-family="Arial, sans-serif" font-weight="600" font-size="28"
        fill="rgba(255,255,255,0.85)">Tools</text>
</svg>`;
}

async function createPNG(size) {
  return sharp(Buffer.from(svgContent(size))).resize(size, size).png().toBuffer();
}

async function main() {
  // Create PNGs for all sizes
  const pngs = [];
  for (const s of sizes) {
    const png = await createPNG(s);
    pngs.push({ size: s, data: png });
    console.log('PNG ' + s + 'x' + s + ' = ' + png.length + ' bytes');
  }

  // Also create 512x512 PNG for public/icon.png and high-res
  const png512 = await createPNG(512);
  const publicIconPath = path.join(__dirname, '..', 'public', 'icon.png');
  fs.writeFileSync(publicIconPath, png512);
  console.log('Written ' + publicIconPath + ' (' + png512.length + ' bytes)');

  // Build .ico file
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + pngs.length * 16;
  const dirs = [];
  const allData = [];

  for (const p of pngs) {
    const w = p.size >= 256 ? 0 : p.size;
    const h = p.size >= 256 ? 0 : p.size;
    const dir = Buffer.alloc(16);
    dir.writeUInt8(w, 0);
    dir.writeUInt8(h, 1);
    dir.writeUInt8(0, 2);
    dir.writeUInt8(0, 3);
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(p.data.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirs.push(dir);
    allData.push(p.data);
    offset += p.data.length;
  }

  const ico = Buffer.concat([header, ...dirs, ...allData]);
  const icoPath = path.join(outputDir, 'icon.ico');
  fs.writeFileSync(icoPath, ico);
  console.log('Written ' + icoPath + ' (' + ico.length + ' bytes)');
}

main().catch(console.error);
