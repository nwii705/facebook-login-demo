const { execSync } = require('child_process');
const fs = require('fs');

// Build steps for Render
console.log('🚀 Starting build process...');

// Install dependencies
console.log('📦 Installing dependencies...');
execSync('npm ci', { stdio: 'inherit' });

// Create data directory for SQLite
console.log('📁 Creating data directory...');
if (!fs.existsSync('/tmp')) {
  fs.mkdirSync('/tmp', { recursive: true });
}

console.log('✅ Build completed successfully!');
