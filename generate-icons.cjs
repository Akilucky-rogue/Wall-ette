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

  // Dark green gradient background (ZEN-R inspired)
  const bgGradient = ctx.createLinearGradient(0, 0, size, size);
  bgGradient.addColorStop(0, '#1a3a2a');
  bgGradient.addColorStop(1, '#0d1f18');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, size, size);

  const centerX = size / 2;
  const centerY = size / 2;

  // TURBAN/HEAD (Orange)
  const turbanY = centerY * 0.5;
  ctx.fillStyle = '#FF9D3D';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = size * 0.03;
  ctx.shadowOffsetY = size * 0.01;
  
  // Turban shape
  ctx.beginPath();
  ctx.ellipse(centerX, turbanY - size * 0.05, size * 0.25, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Turban folds
  ctx.fillStyle = '#FF8C00';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(centerX - size * 0.1 + (i * size * 0.1), turbanY - size * 0.03, size * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }

  // Turban jewel (green dot)
  ctx.fillStyle = '#2CC99D';
  ctx.shadowColor = 'rgba(44, 201, 157, 0.6)';
  ctx.shadowBlur = size * 0.04;
  ctx.beginPath();
  ctx.arc(centerX, turbanY - size * 0.08, size * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // BINOCULAR EYES (Large, prominent)
  const eyeY = turbanY + size * 0.08;
  const eyeRadius = size * 0.1;
  const eyeSpacing = size * 0.15;

  // Eye frames (gold/brass)
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#D4A855';
  ctx.beginPath();
  ctx.arc(centerX - eyeSpacing, eyeY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + eyeSpacing, eyeY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();

  // Connecting bridge
  ctx.fillStyle = '#9e7e3d';
  ctx.fillRect(centerX - eyeSpacing + eyeRadius * 0.6, eyeY - size * 0.02, (eyeSpacing - eyeRadius) * 2, size * 0.04);

  // Eye lenses (dark)
  ctx.fillStyle = '#001a1a';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = size * 0.02;
  ctx.beginPath();
  ctx.arc(centerX - eyeSpacing, eyeY, eyeRadius * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + eyeSpacing, eyeY, eyeRadius * 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Pupils (bright blue)
  ctx.fillStyle = '#00D9FF';
  ctx.shadowColor = 'rgba(0, 217, 255, 0.8)';
  ctx.shadowBlur = size * 0.02;
  ctx.beginPath();
  ctx.arc(centerX - eyeSpacing, eyeY, eyeRadius * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + eyeSpacing, eyeY, eyeRadius * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // BODY (Green)
  const bodyY = eyeY + size * 0.15;
  const bodyWidth = size * 0.45;
  const bodyHeight = size * 0.35;

  // Main body (green)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = size * 0.02;
  ctx.fillStyle = '#2CC99D';
  roundRect(ctx, centerX - bodyWidth/2, bodyY, bodyWidth, bodyHeight, size * 0.03);

  // Body panel lines
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#1a8a6b';
  ctx.lineWidth = size * 0.008;
  ctx.strokeRect(centerX - bodyWidth/2 + size * 0.03, bodyY + size * 0.03, bodyWidth - size * 0.06, bodyHeight - size * 0.06);

  // Chest display (green screen)
  const screenWidth = bodyWidth * 0.5;
  const screenHeight = bodyHeight * 0.25;
  ctx.fillStyle = '#1a6b52';
  roundRect(ctx, centerX - screenWidth/2, bodyY + bodyHeight * 0.15, screenWidth, screenHeight, size * 0.015);

  // Rupee symbol on chest (golden)
  ctx.fillStyle = '#FFD700';
  ctx.font = `bold ${size * 0.16}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('₹', centerX, bodyY + bodyHeight * 0.275);

  // Gold shoulders
  ctx.fillStyle = '#D4A855';
  ctx.beginPath();
  ctx.arc(centerX - bodyWidth/2 - size * 0.06, bodyY + size * 0.1, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + bodyWidth/2 + size * 0.06, bodyY + size * 0.1, size * 0.06, 0, Math.PI * 2);
  ctx.fill();

  // LEGS
  const legY = bodyY + bodyHeight;
  const legSpacing = bodyWidth * 0.25;

  // Left leg
  ctx.fillStyle = '#2CC99D';
  roundRect(ctx, centerX - legSpacing - size * 0.04, legY, size * 0.08, size * 0.12, size * 0.01);
  ctx.fillStyle = '#D4A855';
  ctx.beginPath();
  ctx.arc(centerX - legSpacing, legY + size * 0.14, size * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Right leg
  ctx.fillStyle = '#2CC99D';
  roundRect(ctx, centerX + legSpacing - size * 0.04, legY, size * 0.08, size * 0.12, size * 0.01);
  ctx.fillStyle = '#D4A855';
  ctx.beginPath();
  ctx.arc(centerX + legSpacing, legY + size * 0.14, size * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Ornamental base (Gold)
  const baseY = legY + size * 0.14;
  ctx.fillStyle = '#D4A855';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  roundRect(ctx, centerX - bodyWidth/2 - size * 0.05, baseY, bodyWidth + size * 0.1, size * 0.04, size * 0.01);

  // Base ornament
  ctx.shadowColor = 'transparent';
  for (let i = 0; i < 3; i++) {
    const peakX = centerX - bodyWidth/2 + size * 0.1 + (i * bodyWidth * 0.4);
    ctx.beginPath();
    ctx.moveTo(peakX, baseY);
    ctx.lineTo(peakX + size * 0.03, baseY - size * 0.05);
    ctx.lineTo(peakX + size * 0.06, baseY);
    ctx.fill();
  }

  // WALL-E text
  ctx.fillStyle = '#FFD700';
  ctx.font = `bold ${size * 0.06}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('WALL-E', centerX, baseY + size * 0.1);

  return canvas;
}

// Generate icons for all densities
console.log('🎨 Generating WALL-E app icons (ZEN-R style)...\n');

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
