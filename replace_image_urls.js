#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the image mapping
const mappingFile = path.join(__dirname, 'image-mapping.json');
if (!fs.existsSync(mappingFile)) {
  console.error('❌ image-mapping.json not found. Run download-images.js first.');
  process.exit(1);
}

const imageMapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
console.log(`📄 Loaded mapping for ${imageMapping.length} images`);

// Create a lookup map for faster searching
const urlToPath = new Map();
imageMapping.forEach(item => {
  urlToPath.set(item.originalUrl, item.localPath);
});

// Function to process a file
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let changes = 0;

  // Process each mapped URL
  for (const [originalUrl, localPath] of urlToPath) {
    // Escape special regex characters in the URL
    const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Replace in front matter (image: url)
    const frontMatterRegex = new RegExp(`image:\\s*${escapedUrl}`, 'g');
    if (frontMatterRegex.test(newContent)) {
      newContent = newContent.replace(frontMatterRegex, `image: ${localPath}`);
      changes++;
    }
    
    // Replace in markdown image syntax ![alt](url)
    const markdownRegex = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedUrl}\\)`, 'g');
    const markdownMatches = newContent.match(markdownRegex);
    if (markdownMatches) {
      newContent = newContent.replace(markdownRegex, `![$1](${localPath})`);
      changes += markdownMatches.length;
    }
    
    // Replace in HTML img tags
    const htmlRegex = new RegExp(`src=["']${escapedUrl}["']`, 'g');
    if (htmlRegex.test(newContent)) {
      newContent = newContent.replace(htmlRegex, `src="${localPath}"`);
      changes++;
    }
    
    // Replace standalone URLs (in case any exist)
    const standaloneRegex = new RegExp(`(?<!["'\\(])${escapedUrl}(?!["'\\)])`, 'g');
    if (standaloneRegex.test(newContent)) {
      newContent = newContent.replace(standaloneRegex, localPath);
      changes++;
    }
  }

  // Write back if there were changes
  if (changes > 0) {
    fs.writeFileSync(filePath, newContent);
    console.log(`✓ Updated ${path.relative(__dirname, filePath)} (${changes} changes)`);
    return changes;
  }
  
  return 0;
}

// Function to scan directory recursively
function processDirectory(directory) {
  let totalChanges = 0;
  let filesProcessed = 0;
  
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and build directories
        if (file !== 'node_modules' && file !== 'build' && file !== '_site') {
          scanDirectory(filePath);
        }
      } else if (file.endsWith('.md') || file.endsWith('.njk') || file.endsWith('.html')) {
        const changes = processFile(filePath);
        totalChanges += changes;
        filesProcessed++;
      }
    });
  }
  
  scanDirectory(directory);
  return { totalChanges, filesProcessed };
}

// Main function
async function main() {
  console.log('🔄 Starting URL replacement...');
  
  // Process the src directory
  const srcDir = path.join(__dirname, 'src');
  if (!fs.existsSync(srcDir)) {
    console.error('❌ src directory not found');
    process.exit(1);
  }
  
  const { totalChanges, filesProcessed } = processDirectory(srcDir);
  
  console.log('\n📊 Summary:');
  console.log(`   Files processed: ${filesProcessed}`);
  console.log(`   URLs replaced: ${totalChanges}`);
  
  if (totalChanges > 0) {
    console.log('\n✅ URL replacement complete!');
    console.log('\n🔄 Next steps:');
    console.log('1. Review the changes with: git diff');
    console.log('2. Test your site locally: npm start');
    console.log('3. Set up responsive images with @11ty/eleventy-img');
    console.log('4. Commit the changes when satisfied');
  } else {
    console.log('\n🤔 No URLs were replaced. This could mean:');
    console.log('   - URLs have already been replaced');
    console.log('   - The image mapping doesn\'t match the URLs in your files');
    console.log('   - The URLs are in a different format than expected');
  }
}

main().catch(console.error);