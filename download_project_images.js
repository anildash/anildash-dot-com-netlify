#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Target project ID
const targetProjectId = '34934a9e-03cb-409c-b529-b489bc6e5d0a';

// Images directory
const imagesDir = path.join(__dirname, 'src', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Function to download an image
async function downloadImage(url, filename) {
  try {
    console.log(`Downloading: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    const filePath = path.join(imagesDir, filename);
    
    fs.writeFileSync(filePath, Buffer.from(buffer));
    console.log(`✓ Saved: ${filename}`);
    
    return filename;
  } catch (error) {
    console.error(`✗ Failed to download ${url}:`, error.message);
    return null;
  }
}

// Function to find URLs with specific project ID
function findProjectUrls(directory) {
  const urls = new Set();
  
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      // Skip these directories
      if (['node_modules', 'build', '_site', '.git'].includes(file)) {
        return;
      }
      
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Look specifically for URLs with our target project ID
          const projectRegex = new RegExp(`https://cdn\\.glitch\\.global/${targetProjectId}/[^\\s\\)"'\\]]+`, 'g');
          const matches = content.match(projectRegex);
          
          if (matches) {
            matches.forEach(url => {
              const cleanUrl = url.replace(/["\)\]']+$/, '');
              urls.add(cleanUrl);
              console.log(`🎯 Found in ${filePath}: ${cleanUrl}`);
            });
          }
        } catch (error) {
          // Skip files that can't be read as text
        }
      }
    });
  }
  
  scanDirectory(directory);
  return Array.from(urls);
}

// Main function
async function main() {
  console.log(`🔍 Scanning for images with project ID: ${targetProjectId}`);
  
  const urls = findProjectUrls(__dirname);
  
  console.log(`📊 Found ${urls.length} URLs with project ID ${targetProjectId}`);
  
  if (urls.length === 0) {
    console.log('❌ No URLs found with that project ID');
    return;
  }
  
  // Show all found URLs
  console.log('\n📋 URLs found:');
  urls.forEach((url, index) => {
    console.log(`   ${index + 1}. ${url}`);
  });
  
  // Download each image
  const downloads = [];
  
  for (const url of urls) {
    const urlParts = url.split('/');
    let filename = urlParts[urlParts.length - 1];
    
    // Remove query parameters
    filename = filename.split('?')[0];
    
    // Handle missing extension
    if (!path.extname(filename)) {
      filename += '.jpg';
    }
    
    // Avoid conflicts
    let counter = 1;
    let finalFilename = filename;
    while (fs.existsSync(path.join(imagesDir, finalFilename))) {
      const ext = path.extname(filename);
      const name = path.basename(filename, ext);
      finalFilename = `${name}-${counter}${ext}`;
      counter++;
    }
    
    const downloaded = await downloadImage(url, finalFilename);
    if (downloaded) {
      downloads.push({
        originalUrl: url,
        newFilename: downloaded,
        localPath: `/images/${downloaded}`
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n✅ Downloaded ${downloads.length} images`);
  
  // Show replacement suggestions
  if (downloads.length > 0) {
    console.log('\n🔄 Manual replacements needed:');
    downloads.forEach(item => {
      console.log(`Replace: ${item.originalUrl}`);
      console.log(`With:    ${item.localPath}`);
      console.log('');
    });
  }
}

main().catch(console.error);