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

  // Add subtle texture
  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.03})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }

  // Wallet shape
  const centerX = size / 2;
  const centerY = size / 2;
  const walletWidth = size * 0.6;
  const walletHeight = size * 0.45;
  const radius = size * 0.05;

  // Main wallet body with shadow
  ctx.fillStyle = '#2d3a28';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = size * 0.02;
  ctx.shadowOffsetY = size * 0.01;
  
  roundRect(ctx, centerX - walletWidth/2, centerY - walletHeight/2, walletWidth, walletHeight, radius);

  // Wallet flap (top part)
  ctx.fillStyle = '#3a4a35';
  roundRect(ctx, centerX - walletWidth/2, centerY - walletHeight/2 - size * 0.08, walletWidth, size * 0.15, radius);

  // Rupee symbol
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#F5EFE0';
  ctx.font = `bold ${size * 0.35}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('₹', centerX, centerY + size * 0.02);

  // WALL-E text
  ctx.fillStyle = '#F5EFE0';
  ctx.font = `bold ${size * 0.08}px monospace`;
  ctx.fillText('WALL-E', centerX, centerY + walletHeight/2 + size * 0.12);

  // Decorative lotus petals in corners
  ctx.fillStyle = 'rgba(245, 239, 224, 0.15)';
  drawLotus(ctx, size * 0.12, size * 0.12, size * 0.06);
  drawLotus(ctx, size * 0.88, size * 0.12, size * 0.06);
  drawLotus(ctx, size * 0.12, size * 0.88, size * 0.06);
  drawLotus(ctx, size * 0.88, size * 0.88, size * 0.06);

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
