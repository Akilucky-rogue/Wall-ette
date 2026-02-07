const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Icon sizes for different densities
const sizes = {
  'mdpi': 48,
  'hdpi': 72,
  'xhdpi': 96,
  'xxhdpi': 144,
  'xxxhdpi': 192
};

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

function drawLotus(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.ellipse(0, -size/3, size/4, size/2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient (Sage green to darker green)
  const bgGradient = ctx.createLinearGradient(0, 0, size, size);
  bgGradient.addColorStop(0, '#A8B89E');
  bgGradient.addColorStop(1, '#7a8a6e');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, size, size);

  // WALL-E Robot
  const centerX = size / 2;
  const centerY = size / 2;

  // Robot body (rectangular, rusty yellow/brown)
  const bodyWidth = size * 0.5;
  const bodyHeight = size * 0.4;
  const bodyY = centerY - bodyHeight / 4;
  
  ctx.fillStyle = '#D4A855'; // Rusty yellow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = size * 0.02;
  ctx.shadowOffsetY = size * 0.01;
  roundRect(ctx, centerX - bodyWidth/2, bodyY, bodyWidth, bodyHeight, size * 0.02);

  // Darker panel lines on body
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#9e7e3d';
  ctx.lineWidth = size * 0.012;
  ctx.strokeRect(centerX - bodyWidth/2 + size * 0.05, bodyY + size * 0.05, bodyWidth - size * 0.1, bodyHeight - size * 0.1);

  // Compactor door (chest)
  ctx.fillStyle = '#9e7e3d';
  roundRect(ctx, centerX - bodyWidth/3, bodyY + bodyHeight * 0.4, bodyWidth * 0.66, bodyHeight * 0.25, size * 0.01);
  
  // Rupee symbol on chest (small)
  ctx.fillStyle = '#F5EFE0';
  ctx.font = `bold ${size * 0.12}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('₹', centerX, bodyY + bodyHeight * 0.525);

  // WALL-E's iconic binocular eyes
  const eyeY = bodyY - size * 0.08;
  const eyeSpacing = size * 0.12;
  const eyeWidth = size * 0.14;
  const eyeHeight = size * 0.12;

  // Eye necks (cylinders)
  ctx.fillStyle = '#8f7034';
  roundRect(ctx, centerX - eyeSpacing - eyeWidth/2, eyeY + eyeHeight * 0.3, eyeWidth, size * 0.06, size * 0.01);
  roundRect(ctx, centerX + eyeSpacing - eyeWidth/2, eyeY + eyeHeight * 0.3, eyeWidth, size * 0.06, size * 0.01);

  // Eye housings
  ctx.fillStyle = '#5a5a5a';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = size * 0.015;
  roundRect(ctx, centerX - eyeSpacing - eyeWidth/2, eyeY, eyeWidth, eyeHeight, size * 0.02);
  roundRect(ctx, centerX + eyeSpacing - eyeWidth/2, eyeY, eyeWidth, eyeHeight, size * 0.02);

  // Eye lenses (bright, expressive)
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#4A9EAF'; // Blue lens color
  ctx.beginPath();
  ctx.arc(centerX - eyeSpacing, eyeY + eyeHeight/2, eyeWidth * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + eyeSpacing, eyeY + eyeHeight/2, eyeWidth * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Eye pupils (give character/expression)
  ctx.fillStyle = '#1a3a44';
  ctx.beginPath();
  ctx.arc(centerX - eyeSpacing + size * 0.01, eyeY + eyeHeight/2, eyeWidth * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + eyeSpacing + size * 0.01, eyeY + eyeHeight/2, eyeWidth * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // Eye highlights (makes eyes "alive")
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(centerX - eyeSpacing - size * 0.01, eyeY + eyeHeight/2 - size * 0.01, eyeWidth * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + eyeSpacing - size * 0.01, eyeY + eyeHeight/2 - size * 0.01, eyeWidth * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Tank treads at bottom
  const treadY = bodyY + bodyHeight;
  const treadWidth = bodyWidth * 0.4;
  const treadHeight = size * 0.1;

  ctx.fillStyle = '#3a3a3a';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = size * 0.01;
  roundRect(ctx, centerX - bodyWidth/2 + size * 0.05, treadY, treadWidth, treadHeight, size * 0.015);
  roundRect(ctx, centerX + bodyWidth/2 - treadWidth - size * 0.05, treadY, treadWidth, treadHeight, size * 0.015);

  // Tread details
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#5a5a5a';
  ctx.lineWidth = size * 0.008;
  for (let i = 0; i < 4; i++) {
    const x1 = centerX - bodyWidth/2 + size * 0.05 + (i * treadWidth / 4);
    const x2 = centerX + bodyWidth/2 - treadWidth - size * 0.05 + (i * treadWidth / 4);
    ctx.beginPath();
    ctx.moveTo(x1, treadY + size * 0.02);
    ctx.lineTo(x1, treadY + treadHeight - size * 0.02);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, treadY + size * 0.02);
    ctx.lineTo(x2, treadY + treadHeight - size * 0.02);
    ctx.stroke();
  }

  // Name text below
  ctx.fillStyle = '#F5EFE0';
  ctx.font = `bold ${size * 0.07}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('WALL-E', centerX, treadY + treadHeight + size * 0.08);

  return canvas;
}

// Generate icons for all densities
console.log('🎨 Generating WALL-E app icons...\n');

Object.entries(sizes).forEach(([density, size]) => {
  const canvas = generateIcon(size);
  const outputPath = path.join(__dirname, 'android', 'app', 'src', 'main', 'res', `mipmap-${density}`, 'ic_launcher.png');
  const outputDir = path.dirname(outputPath);
  
  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Save PNG
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  
  console.log(`✅ Generated ${density} (${size}x${size}): ${outputPath}`);
});

// Generate 512x512 for Play Store
const largeCanvas = generateIcon(512);
const playStorePath = path.join(__dirname, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher_512.png');
fs.writeFileSync(playStorePath, largeCanvas.toBuffer('image/png'));
console.log(`✅ Generated Play Store icon (512x512): ${playStorePath}`);

console.log('\n🚀 All icons generated successfully!');
console.log('💡 Rebuild your APK with: npm run android:build');
