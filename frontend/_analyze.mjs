import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const img = sharp('public/logo.png');
const meta = await img.metadata();
console.log('Width:', meta.width, 'Height:', meta.height, 'Format:', meta.format, 'Channels:', meta.channels);

const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const w = info.width, h = info.height;

// Check corners
for (const [cx,cy] of [[5,5],[w-5,5],[5,h-5],[w-5,h-5]]) {
  const idx = (cy * w + cx) * 3;
  console.log('Corner at', cx, cy, ':', data[idx], data[idx+1], data[idx+2]);
}

// Dominant colors  
const cm = new Map();
for (let i = 0; i < data.length; i += 24) {
  const key = Math.round(data[i]/32)*32 + ',' + Math.round(data[i+1]/32)*32 + ',' + Math.round(data[i+2]/32)*32;
  cm.set(key, (cm.get(key)||0)+1);
}
const sorted = [...cm.entries()].sort((a,b)=>b[1]-a[1]);
console.log('Top colors:');
for (const [c, n] of sorted.slice(0, 8)) {
  console.log('  rgb(' + c + ') -', (n / (data.length/24) * 100).toFixed(1) + '%');
}

// Detect content boundaries (crop to content)
let minX = w, maxX = 0, minY = h, maxY = 0;
// Check if mostly transparent (white/light bg)
const bgR = data[0], bgG = data[1], bgB = data[2];
console.log('\nBackground guess: RGB(' + bgR + ',' + bgG + ',' + bgB + ')');

for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const idx = (y * w + x) * 3;
    const dr = Math.abs(data[idx] - bgR), dg = Math.abs(data[idx+1] - bgG), db = Math.abs(data[idx+2] - bgB);
    if (dr + dg + db > 60) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
console.log('Content bounding box:', minX, minY, maxX, maxY);
console.log('Content size:', (maxX-minX+1), 'x', (maxY-minY+1));

// Scan a horizontal strip at 25%, 50%, 75% of content height
const contentH = maxY - minY + 1;
console.log('\n=== Shape analysis ===');
for (const pct of [0.2, 0.35, 0.5, 0.65, 0.8]) {
  const y = minY + Math.floor(contentH * pct);
  let line = '';
  for (let x = minX; x <= maxX; x += 3) {
    const idx = (y * w + x) * 3;
    const r = data[idx], g = data[idx+1], b = data[idx+2];
    const dr = Math.abs(r - bgR), dg = Math.abs(g - bgG), db = Math.abs(b - bgB);
    const diff = dr + dg + db;
    if (diff < 30) line += ' ';
    else if (r < 50 && g < 50 && b < 50) line += '@';
    else if (r > 200 && g > 200 && b > 200) line += '#';
    else if (r > 100) line += 'x';
    else line += '.';
  }
  console.log('y=' + y + ' (' + Math.round(pct*100) + '%): ' + line.substring(0, 120));
}
