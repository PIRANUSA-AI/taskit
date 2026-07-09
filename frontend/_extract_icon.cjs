const sharp = require('sharp');
const fs = require('fs');
const potrace = require('potrace');

async function main() {
  const img = sharp('public/logo.png');
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

  // Find where the actual dark content starts on each row
  // to detect the icon region (left side)
  const rowProfiles = [];
  for (let y = 0; y < h; y++) {
    let firstDark = -1, lastDark = -1;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 3;
      if (data[idx] < 200) { // dark pixel
        if (firstDark === -1) firstDark = x;
        lastDark = x;
      }
    }
    if (firstDark !== -1) rowProfiles.push({ y, first: firstDark, last: lastDark });
  }

  // Find min/max x for the overall content
  const minContentX = Math.min(...rowProfiles.map(r => r.first));
  const maxContentX = Math.max(...rowProfiles.map(r => r.last));
  const minContentY = rowProfiles[0].y;
  const maxContentY = rowProfiles[rowProfiles.length - 1].y;
  
  console.log('Content bounds: x=[' + minContentX + '-' + maxContentX + '] y=[' + minContentY + '-' + maxContentY + ']');

  // Find the gap between icon and text by looking at row first-dark x values
  // The icon starts at minContentX, text starts at some later x
  // Find the rightmost x where most rows have their first dark pixel
  const firstDarkValues = rowProfiles.map(r => r.first);
  const histogram = {};
  for (const x of firstDarkValues) {
    histogram[x] = (histogram[x] || 0) + 1;
  }
  
  const sorted = Object.entries(histogram).sort((a,b) => b[1]-a[1]);
  console.log('\nMost common first-dark x positions:');
  for (const [x, count] of sorted.slice(0, 5)) {
    console.log('  x=' + x + ': ' + count + ' rows (' + (count/rowProfiles.length*100).toFixed(1) + '%)');
  }

  // The text starts at the second most common first-dark position
  // The first is the icon start
  const iconStart = minContentX;
  // Find text start - look at first-dark values that are significantly different
  const distinctGroups = [];
  let currentGroup = [parseInt(sorted[0][0])];
  for (let i = 1; i < sorted.length; i++) {
    const x = parseInt(sorted[i][0]);
    const prevAvg = currentGroup.reduce((a,b)=>a+b,0)/currentGroup.length;
    if (Math.abs(x - prevAvg) < 40) {
      currentGroup.push(x);
    } else {
      distinctGroups.push(currentGroup);
      currentGroup = [x];
    }
  }
  distinctGroups.push(currentGroup);
  
  console.log('\nContent groups:');
  for (const g of distinctGroups) {
    console.log('  x range: [' + Math.min(...g) + '-' + Math.max(...g) + '] avg=' + Math.round(g.reduce((a,b)=>a+b,0)/g.length));
  }

  // Extract icon: from minContentX to the start of text
  const iconEndX = distinctGroups.length > 1 
    ? Math.min(...distinctGroups[1]) - 5
    : Math.round((minContentX + maxContentX) / 3);
  
  console.log('\nIcon bounds: x=[' + iconStart + '-' + iconEndX + ']');
  console.log('Text starts at approximately x=' + (iconEndX + 5));

  // Crop icon
  await sharp('public/logo.png')
    .extract({ 
      left: iconStart, 
      top: minContentY, 
      width: iconEndX - iconStart + 10, 
      height: maxContentY - minContentY + 1 
    })
    .threshold(128)
    .toFile('public/_icon-crop.png');

  // Trace icon to SVG
  const iconBuf = fs.readFileSync('public/_icon-crop.png');
  potrace.trace(iconBuf, {
    color: '#1E1B4B',
    background: 'transparent',
    threshold: 140,
  }, (err, svg) => {
    if (err) { console.error('Icon trace error:', err); return; }
    fs.writeFileSync('public/_icon-traced.svg', svg);
    console.log('Icon SVG saved, size:', svg.length, 'bytes');
    console.log('SVG:', svg);
  });

  // Also trace full logo and render just the text portion
  await sharp('public/logo.png')
    .extract({ 
      left: iconEndX + 5, 
      top: minContentY, 
      width: maxContentX - iconEndX - 5 + 10, 
      height: maxContentY - minContentY + 1 
    })
    .threshold(128)
    .toFile('public/_text-crop.png');
  
  const textBuf = fs.readFileSync('public/_text-crop.png');
  potrace.trace(textBuf, {
    color: '#1E1B4B',
    background: 'transparent',
    threshold: 140,
  }, (err, svg) => {
    if (err) { console.error('Text trace error:', err); return; }
    fs.writeFileSync('public/_text-traced.svg', svg);
    console.log('Text SVG saved');
    console.log('SVG:', svg.substring(0, 300));
  });
}

main().catch(console.error);
