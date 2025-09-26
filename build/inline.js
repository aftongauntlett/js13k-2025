const fs = require('fs');
const path = require('path');

// Read the minified JS
const jsContent = fs.readFileSync('dist/main.roadroller.js', 'utf8');

// Read the base HTML
const htmlContent = fs.readFileSync('index.html', 'utf8');

// Replace the script tag with inline JavaScript
const inlinedHtml = htmlContent.replace(
  /<script src=?["\']?main\.js["\']?><\/script>/,
  `<script>${jsContent}</script>`
);
const finalHtml = inlinedHtml;

// Write the final HTML
fs.writeFileSync('dist/index.html', finalHtml);

// Copy other necessary files
if (fs.existsSync('favicon.ico')) {
  fs.copyFileSync('favicon.ico', 'dist/favicon.ico');
}

console.log('✅ Build complete! Files inlined into dist/index.html');
