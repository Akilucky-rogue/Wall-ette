const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Get image path from command line argument
const imagePath = process.argv[2];

if (!imagePath) {
  console.error('❌ Usage: node resize-icon.cjs <path-to-image>');
  console.error('Example: node resize-icon.cjs ./zen-wall.png');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ Image file not found: ${imagePath}`);
  process.exit(1);
}

// Icon sizes for different densities
const sizes = {
  'mdpi': 48,
  'hdpi': 72,
  'xhdpi': 96,
  'xxhdpi': 144,
  'xxxhdpi': 192
};

console.log('🎨 Resizing image to Android icon sizes...\n');

const processIcon = async (density, size) => {
  const outputDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res', `mipmap-${density}`);
  const outputPath = path.join(outputDir, 'ic_launcher.png');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    await sharp(imagePath)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toFile(outputPath);
    
    console.log(`✅ Generated ${density} (${size}x${size})`);
  } catch (error) {
    console.error(`❌ Failed to generate ${density}: ${error.message}`);
  }
};

const processLargeIcon = async () => {
  const outputDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi');
  const outputPath = path.join(outputDir, 'ic_launcher_512.png');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    await sharp(imagePath)
      .resize(512, 512, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toFile(outputPath);
    
    console.log(`✅ Generated Play Store icon (512x512)`);
  } catch (error) {
    console.error(`❌ Failed to generate Play Store icon: ${error.message}`);
  }
};

const main = async () => {
  try {
    // Process all icon sizes
    for (const [density, size] of Object.entries(sizes)) {
      await processIcon(density, size);
    }
    
    // Process large icon
    await processLargeIcon();
    
    console.log('\n🚀 All icons processed successfully!');
    console.log('💡 Sync to Android: npm run android');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

main();
