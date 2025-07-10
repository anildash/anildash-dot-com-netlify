#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = process.cwd(); // Use current working directory instead

// Function to extract post info from file path and content
function extractPostInfo(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Extract front matter
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontMatterMatch) return null;
  
  const frontMatter = frontMatterMatch[1];
  
  // Extract fields
  const titleMatch = frontMatter.match(/^title:\s*(.+)$/m);
  const slugMatch = frontMatter.match(/^slug:\s*(.+)$/m);
  const dateMatch = frontMatter.match(/^date_published:\s*(.+)$/m);
  
  if (!titleMatch || !dateMatch) return null;
  
  const title = titleMatch[1].replace(/^["']|["']$/g, '');
  const slug = slugMatch ? slugMatch[1] : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const datePublished = new Date(dateMatch[1]);
  
  // Extract file date from path (YYYY-MM-DD format in filename)
  const fileNameMatch = path.basename(filePath).match(/^(\d{4})-(\d{2})-(\d{2})-/);
  let fileDate = null;
  if (fileNameMatch) {
    fileDate = new Date(fileNameMatch[1], fileNameMatch[2] - 1, fileNameMatch[3]);
  }
  
  return {
    filePath,
    title,
    slug,
    datePublished,
    fileDate,
    actualUrl: generateUrl(datePublished, slug),
    fileUrl: fileDate ? generateUrl(fileDate, slug) : null
  };
}

function generateUrl(date, slug) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `/${year}/${month}/${day}/${slug}`;
}

// Scan all posts
function scanPosts() {
  const posts = [];
  
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else if (file.endsWith('.md')) {
        const postInfo = extractPostInfo(filePath);
        if (postInfo) {
          posts.push(postInfo);
        }
      }
    });
  }
  
  const postsDir = path.join(__dirname, 'src', 'posts');
  if (fs.existsSync(postsDir)) {
    scanDirectory(postsDir);
  }
  
  return posts;
}

// Generate redirects
function generateRedirects() {
  console.log('🔍 Scanning posts for date mismatches...');
  console.log(`📁 Looking in: ${path.join(__dirname, 'src', 'posts')}`);
  
  const postsDir = path.join(__dirname, 'src', 'posts');
  if (!fs.existsSync(postsDir)) {
    console.error(`❌ Posts directory not found: ${postsDir}`);
    console.log('📁 Current directory contents:');
    fs.readdirSync(__dirname).forEach(item => console.log(`   ${item}`));
    return [];
  }
  
  const posts = scanPosts();
  const redirects = [];
  
  console.log(`📊 Found ${posts.length} posts`);
  
  posts.forEach(post => {
    if (post.fileDate && post.fileUrl !== post.actualUrl) {
      // The file date URL differs from the published date URL
      redirects.push(`${post.fileUrl} ${post.actualUrl} 301`);
      console.log(`📝 Redirect: ${post.fileUrl} → ${post.actualUrl}`);
      
      // Also generate redirects for ±1 day around the file date
      for (let dayOffset = -1; dayOffset <= 1; dayOffset++) {
        if (dayOffset === 0) continue;
        
        const testDate = new Date(post.fileDate);
        testDate.setDate(post.fileDate.getDate() + dayOffset);
        const testUrl = generateUrl(testDate, post.slug);
        
        if (testUrl !== post.actualUrl && testUrl !== post.fileUrl) {
          redirects.push(`${testUrl} ${post.actualUrl} 301`);
          console.log(`📝 Near-miss redirect: ${testUrl} → ${post.actualUrl}`);
        }
      }
    }
  });
  
  // Write redirects file
  const redirectsContent = [
    '# Date correction redirects for blog posts',
    '# Generated automatically - do not edit manually',
    '',
    ...redirects,
    '',
    '# Catch-all 404 handling',
    '/* /404.html 404'
  ].join('\n');
  
  fs.writeFileSync(path.join(__dirname, '_redirects'), redirectsContent);
  
  console.log(`\n✅ Generated ${redirects.length} redirects`);
  console.log(`📄 Saved to _redirects file`);
  
  return redirects;
}

// Main function
generateRedirects();