const sharp = require('sharp');
const fs = require('fs');

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 255, g: 255, b: 255 };
}

function removeBgFromBuffer(buffer, width, height, targetColor, tolerance, mode) {
  const result = Buffer.from(buffer);
  const channels = 4;

  if (mode === 'global') {
    for (let i = 0; i < result.length; i += channels) {
      if (result[i + 3] === 0) continue;
      const dist = Math.sqrt((result[i] - targetColor.r) ** 2 + (result[i + 1] - targetColor.g) ** 2 + (result[i + 2] - targetColor.b) ** 2);
      if (dist <= tolerance) {
        const edgeDist = tolerance * 0.8;
        result[i + 3] = dist > edgeDist ? Math.round(255 * (dist - edgeDist) / (tolerance - edgeDist)) : 0;
      }
    }
  } else if (mode === 'flood') {
    const visited = new Uint8Array(width * height);
    const queue = [];
    for (let x = 0; x < width; x++) { queue.push(x); queue.push((height - 1) * width + x); }
    for (let y = 0; y < height; y++) { queue.push(y * width); queue.push(y * width + (width - 1)); }
    while (queue.length > 0) {
      const idx = queue.pop();
      if (visited[idx]) continue;
      visited[idx] = 1;
      const px = idx * channels;
      if (result[px + 3] === 0) continue;
      const dist = Math.sqrt((result[px] - targetColor.r) ** 2 + (result[px + 1] - targetColor.g) ** 2 + (result[px + 2] - targetColor.b) ** 2);
      if (dist <= tolerance) {
        const edgeDist = tolerance * 0.8;
        result[px + 3] = dist > edgeDist ? Math.round(255 * (dist - edgeDist) / (tolerance - edgeDist)) : 0;
        const x = idx % width;
        const y = Math.floor(idx / width);
        if (x > 0) queue.push(idx - 1);
        if (x < width - 1) queue.push(idx + 1);
        if (y > 0) queue.push(idx - width);
        if (y < height - 1) queue.push(idx + width);
      }
    }
  } else {
    for (let i = 0; i < result.length; i += channels) {
      if (result[i + 3] === 0) continue;
      if (result[i] === targetColor.r && result[i + 1] === targetColor.g && result[i + 2] === targetColor.b) {
        result[i + 3] = 0;
      }
    }
  }
  return result;
}

async function processImage(inputPath, outputPath, bgColor, tolerance, mode) {
  const targetColor = hexToRgb(bgColor);
  const buffer = fs.readFileSync(inputPath);
  const meta = await sharp(buffer).metadata();
  const width = meta.width;
  const height = meta.height;

  const rawBuffer = await sharp(buffer).ensureAlpha().raw().toBuffer();
  const processedBuffer = removeBgFromBuffer(rawBuffer, width, height, targetColor, Number(tolerance), mode);
  const outputPng = await sharp(processedBuffer, { raw: { width, height, channels: 4 } }).png().toBuffer();
  fs.writeFileSync(outputPath, outputPng);
}

const args = process.argv.slice(2);
if (args.length < 5) {
  console.error('Usage: node bg-remover.js <input> <output> <color> <tolerance> <mode>');
  process.exit(1);
}
const [inputPath, outputPath, bgColor, tolerance, mode] = args;
processImage(inputPath, outputPath, bgColor, tolerance, mode)
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
