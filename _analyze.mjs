import sharp from 'sharp';
import fs from 'fs';

const buf = fs.readFileSync('frontend/public/logo.png');
const img = sharp(buf);
const meta = await img.metadata();
console.log('Meta:', JSON.stringify(meta, null, 2));

const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width, h = info.height;
console.log('Raw:', JSON.stringify(info));

// Find background color (sample corners)
const corners = [
  {x: 5, y: 5},
  {x: w-5, y: 5},
  {x: 5, y: h-5},
  {x: w-5, y: h-5},
];
console.log('\nCorner colors:');
for (const c of corners) {
  const idx = (c.y * w + c.x) * 4;
  console.log(`  (${c.x},${c.y}): RGBA(${data[idx]},${data[idx+1]},${data[idx+2]},${data[idx+3]})`);
}

// Find dominant colors
const colorMap = new Map();
for (let i = 0; i < data.length; i += 48) { // sample every 12th pixel (4 channels)
  const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
  const key = `${Math.round(r/32)*32},${Math.round(g/32)*32},${Math.round(b/32)*32},${a}`;
  colorMap.set(key, (colorMap.get(key) || 0) + 1);
}

const sorted = [...colorMap.entries()].sort((a,b) => b[1]-a[1]);
console.log('\nDominant colors (quantized):');
for (const [color, count] of sorted.slice(0, 10)) {
  const pct = (count / Math.ceil(data.length/48) * 100).toFixed(1);
  console.log(`  RGBA(${color}) - ${pct}%`);
}

// Scan center rows to detect shapes
console.log('\n=== Horizontal scan at y=25%, 50%, 75% ===');
for (const pct of [0.25, 0.5, 0.75]) {
  const y = Math.floor(h * pct);
  let line = '';
  for (let x = 0; x < w; x += 4) {
    const idx = (y * w + x) * 4;
    const r = data[idx], g = data[idx+1], b = data[idx+2];
    const brightness = (r + g + b) / 3;
    if (brightness > 220) line += '#';
    else if (brightness < 40) line += '@';
    else if (brightness < 100) line += 'x';
    else if (r > 150 && g < 100) line += 'R';
    else if (g > 150 && r < 100) line += 'G';
    else if (b > 150) line += 'B';
    else line += '.';
  }
  console.log(`  y=${y} (${Math.round(pct*100)}%): ${line.substring(0, 160)}`);
}

// Detect if there's text/shapes in the logo
console.log('\n=== Edge detection (vertical differences) ===');
let edgeCount = 0;
for (let y = 100; y < h - 100; y += 2) {
  for (let x = 100; x < w - 100; x += 2) {
    const idx1 = (y * w + x) * 4;
    const idx2 = (y * w + x + 2) * 4;
    const diff = Math.abs(data[idx1] - data[idx2]) + Math.abs(data[idx1+1] - data[idx2+1]) + Math.abs(data[idx1+2] - data[idx2+2]);
    if (diff > 100) edgeCount++;
  }
}
console.log(`Edge pixels (high contrast): ${edgeCount}`);
console.log(`Total sampled: ${Math.floor((h-200)/2) * Math.floor((w-200)/2)}`);
