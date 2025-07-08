#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load existing mapping to avoid duplicates
const mappingFile = path.join(__dirname, 'image-mapping.json');
let existingUrls = new Set();

if (fs.existsSync(mappingFile)) {
  const existingMapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
  existingMapping.forEach(item => existingUrls.add(item.originalUrl));
  console.log(`📄 Loaded ${existingUrls.size} already downloaded URLs`);
}

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

// Function to extract image URLs from ALL files
function extractGlitchUrls(directory) {
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
      } else if (file.endsWith('.md') || file.endsWith('.njk') || file.endsWith('.html') || file.endsWith('.js')) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Find Glitch CDN URLs
          const glitchMatches = content.match(/https:\/\/cdn\.glitch\.global\/[^\s\)"\]']+/g);
          if (glitchMatches) {
            glitchMatches.forEach(url => {
              // Clean up any trailing characters
              const cleanUrl = url.replace(/["\)\]']+$/, '');
              if (!existingUrls.has(cleanUrl)) {
                urls.add(cleanUrl);
                console.log(`🆕 Found new URL in ${filePath}: ${cleanUrl}`);
              }
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
  console.log('🔍 Scanning entire project for missed Glitch CDN URLs...');
  
  // Scan from project root
  const urls = extractGlitchUrls(__dirname);
  
  console.log(`📊 Found ${urls.length} new Glitch CDN URLs to download`);
  
  if (urls.length === 0) {
    console.log('✅ No missing images found!');
    return;
  }
  
  // Download each new image
  const newDownloads = [];
  
  for (const url of urls) {
    // Extract filename from URL
    const urlParts = url.split('/');
    let filename = urlParts[urlParts.length - 1];
    
    // Remove query parameters if they exist
    filename = filename.split('?')[0];
    
    // If no file extension, try to determine from URL or default to .jpg
    if (!path.extname(filename)) {
      filename += '.jpg';
    }
    
    // Avoid filename conflicts
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
      newDownloads.push({
        originalUrl: url,
        newFilename: downloaded,
        localPath: `/images/${downloaded}`
      });
    }
    
    // Be nice to the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Update the mapping file
  if (newDownloads.length > 0) {
    let allDownloads = [];
    
    if (fs.existsSync(mappingFile)) {
      const existingMapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
      allDownloads = [...existingMapping, ...newDownloads];
    } else {
      allDownloads = newDownloads;
    }
    
    fs.writeFileSync(mappingFile, JSON.stringify(allDownloads, null, 2));
    
    console.log(`\n✅ Downloaded ${newDownloads.length} additional images`);
    console.log(`📄 Updated mapping with ${allDownloads.length} total images`);
    console.log(`📁 All images saved to: src/images/`);
    
    console.log(`\n🔄 Next step: Run the replacement script again`);
    console.log(`   node replace-urls.js`);
  }
}

main().catch(console.error);