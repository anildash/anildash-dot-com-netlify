#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create images directory
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

// Function to extract image URLs from markdown files
function extractGlitchUrls(directory) {
  const urls = new Set();
  
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else if (file.endsWith('.md') || file.endsWith('.njk')) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Find Glitch CDN URLs
        const glitchMatches = content.match(/https:\/\/cdn\.glitch\.global\/[^\s\)"\]]+/g);
        if (glitchMatches) {
          glitchMatches.forEach(url => {
            // Clean up any trailing characters
            const cleanUrl = url.replace(/["\)\]]+$/, '');
            urls.add(cleanUrl);
          });
        }
      }
    });
  }
  
  scanDirectory(directory);
  return Array.from(urls);
}

// Main function
async function main() {
  console.log('🔍 Scanning for Glitch CDN URLs...');
  
  const postsDir = path.join(__dirname, 'src', 'posts');
  const srcDir = path.join(__dirname, 'src');
  
  // Extract URLs from posts and other source files
  let urls = [];
  if (fs.existsSync(postsDir)) {
    urls.push(...extractGlitchUrls(postsDir));
  }
  urls.push(...extractGlitchUrls(srcDir));
  
  // Remove duplicates
  urls = [...new Set(urls)];
  
  console.log(`📊 Found ${urls.length} unique Glitch CDN URLs`);
  
  if (urls.length === 0) {
    console.log('No Glitch CDN URLs found.');
    return;
  }
  
  // Download each image
  const downloadedFiles = [];
  
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
      downloadedFiles.push({
        originalUrl: url,
        newFilename: downloaded,
        localPath: `/images/${downloaded}`
      });
    }
    
    // Be nice to the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Save mapping for reference
  const mappingFile = path.join(__dirname, 'image-mapping.json');
  fs.writeFileSync(mappingFile, JSON.stringify(downloadedFiles, null, 2));
  
  console.log(`\n✅ Downloaded ${downloadedFiles.length} images`);
  console.log(`📄 Mapping saved to: image-mapping.json`);
  console.log(`📁 Images saved to: src/images/`);
  
  // Show next steps
  console.log(`\n🔄 Next steps:`);
  console.log(`1. Review the downloaded images in src/images/`);
  console.log(`2. Run the URL replacement script to update your posts`);
  console.log(`3. Set up responsive image processing with @11ty/eleventy-img`);
}

main().catch(console.error);