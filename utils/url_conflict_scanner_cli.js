#!/usr/bin/env node

// URL Conflict Scanner - One-time script to find all post URL conflicts
// Usage: node scan-url-conflicts.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const postsDir = path.join(__dirname, 'src', 'posts');

function parseMarkdownFrontmatter(content) {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
  const match = content.match(frontmatterRegex);
  
  if (!match) return {};
  
  const frontmatter = {};
  const lines = match[1].split(/\r?\n/);
  
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    frontmatter[key] = value;
  }
  
  return frontmatter;
}

function extractDateFromFilename(filename) {
  // Match patterns like 2025-05-01-title.md
  const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
  if (match) {
    return {
      year: match[1],
      month: match[2],
      day: match[3],
      slug: match[4].replace(/-/g, '_') // Convert to underscores
    };
  }
  return null;
}

function extractDateFromPublished(dateString) {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  
  return {
    year: date.getUTCFullYear().toString(),
    month: String(date.getUTCMonth() + 1).padStart(2, '0'),
    day: String(date.getUTCDate()).padStart(2, '0')
  };
}

function generateURL(year, month, day, slug) {
  return `/${year}/${month}/${day}/${slug}/`;
}

async function getAllMarkdownFiles(dir) {
  const files = [];
  
  async function traverse(currentDir) {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }
  
  await traverse(dir);
  return files;
}

async function scanPosts() {
  console.log('🔍 Scanning posts for URL conflicts...\n');
  
  try {
    const allFiles = await getAllMarkdownFiles(postsDir);
    console.log(`Found ${allFiles.length} markdown files\n`);
    
    const conflicts = [];
    
    for (const filePath of allFiles) {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const frontmatter = parseMarkdownFrontmatter(content);
      const filename = path.basename(filePath);
      
      // Skip if not a dated post
      const filenameData = extractDateFromFilename(filename);
      if (!filenameData) {
        console.log(`⏭️  Skipping ${filename} (not a dated post)`);
        continue;
      }
      
      // Extract data from published date
      const publishedData = extractDateFromPublished(frontmatter.date_published);
      
      // Generate possible URLs
      const possibleUrls = new Set();
      
      // URL from filename
      const filenameUrl = generateURL(
        filenameData.year,
        filenameData.month, 
        filenameData.day,
        filenameData.slug
      );
      possibleUrls.add(filenameUrl);
      
      // URL from published date + filename slug
      if (publishedData) {
        const publishedUrl = generateURL(
          publishedData.year,
          publishedData.month,
          publishedData.day,
          filenameData.slug
        );
        possibleUrls.add(publishedUrl);
      }
      
      // URL from published date + frontmatter slug
      if (publishedData && frontmatter.slug) {
        let frontmatterSlug = frontmatter.slug;
        // Convert hyphens to underscores to match your URL structure
        if (frontmatterSlug.includes('-')) {
          frontmatterSlug = frontmatterSlug.replace(/-/g, '_');
        }
        const frontmatterUrl = generateURL(
          publishedData.year,
          publishedData.month,
          publishedData.day,
          frontmatterSlug
        );
        possibleUrls.add(frontmatterUrl);
      }
      
      // If there are multiple possible URLs, we have a conflict
      if (possibleUrls.size > 1) {
        const urlArray = Array.from(possibleUrls);
        
        // The "correct" URL is the one using published date + frontmatter slug (if available)
        let correctUrl;
        if (publishedData && frontmatter.slug) {
          const frontmatterSlug = frontmatter.slug.replace(/-/g, '_');
          correctUrl = generateURL(
            publishedData.year,
            publishedData.month,
            publishedData.day,
            frontmatterSlug
          );
        } else if (publishedData) {
          correctUrl = generateURL(
            publishedData.year,
            publishedData.month,
            publishedData.day,
            filenameData.slug
          );
        } else {
          correctUrl = filenameUrl;
        }
        
        // Create redirects for all other URLs
        const redirects = urlArray
          .filter(url => url !== correctUrl)
          .map(wrongUrl => `${wrongUrl} ${correctUrl} 301`);
        
        conflicts.push({
          file: path.relative(process.cwd(), filePath),
          title: frontmatter.title || 'No title',
          possibleUrls: urlArray,
          correctUrl,
          redirects,
          details: {
            filenameDate: `${filenameData.year}-${filenameData.month}-${filenameData.day}`,
            publishedDate: frontmatter.date_published,
            slug: frontmatter.slug
          }
        });
      }
    }
    
    return conflicts;
    
  } catch (error) {
    console.error('❌ Error scanning posts:', error.message);
    process.exit(1);
  }
}

// Main execution
async function main() {
  const conflicts = await scanPosts();
  
  console.log(`\n📊 Results: Found ${conflicts.length} posts with URL conflicts\n`);
  
  if (conflicts.length === 0) {
    console.log('✅ No URL conflicts found! All posts have consistent URLs.');
    return;
  }
  
  // Display detailed results
  console.log('📋 DETAILED RESULTS:\n');
  conflicts.forEach((conflict, index) => {
    console.log(`${index + 1}. ${conflict.file}`);
    console.log(`   Title: ${conflict.title}`);
    console.log(`   Filename date: ${conflict.details.filenameDate}`);
    console.log(`   Published date: ${conflict.details.publishedDate}`);
    console.log(`   Slug: ${conflict.details.slug}`);
    console.log(`   ✅ Correct URL: ${conflict.correctUrl}`);
    console.log(`   ❌ Wrong URLs: ${conflict.possibleUrls.filter(url => url !== conflict.correctUrl).join(', ')}`);
    console.log('');
  });
  
  // Output all redirects
  const allRedirects = conflicts.flatMap(c => c.redirects);
  
  console.log('\n🔧 REDIRECTS TO ADD TO _redirects FILE:\n');
  console.log('# Date correction redirects (add these to your _redirects file)');
  allRedirects.forEach(redirect => console.log(redirect));
  
  console.log(`\n✨ Done! Found ${conflicts.length} conflicts requiring ${allRedirects.length} redirects.`);
}

// Check if posts directory exists
if (!fs.existsSync(postsDir)) {
  console.error(`❌ Posts directory not found: ${postsDir}`);
  console.error('Make sure you\'re running this script from your site\'s root directory.');
  process.exit(1);
}

main().catch(console.error);