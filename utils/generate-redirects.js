#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const __dirname = process.cwd();

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
  
  return {
    filePath,
    title,
    slug,
    datePublished,
    actualUrl: generateUrl(datePublished, slug)
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

// Generate smart redirects using Netlify's splat and placeholder syntax
function generateSmartRedirects() {
  console.log('🔍 Generating smart redirects for timezone shifts...');
  
  const posts = scanPosts();
  console.log(`📊 Found ${posts.length} posts`);
  
  // Group posts by slug for pattern-based redirects
  const slugGroups = new Map();
  
  posts.forEach(post => {
    if (!slugGroups.has(post.slug)) {
      slugGroups.set(post.slug, []);
    }
    slugGroups.get(post.slug).push(post);
  });
  
  const redirects = [
    '# Smart timezone-shift redirects',
    '# These handle the systematic UTC->EST date shifts',
    ''
  ];
  
  // For each unique slug, generate redirects for common date shifts
  slugGroups.forEach((posts, slug) => {
    if (posts.length === 1) {
      const post = posts[0];
      
      // Generate +1 day redirect (most common timezone shift)
      const nextDay = new Date(post.datePublished);
      nextDay.setDate(post.datePublished.getDate() + 1);
      const nextDayUrl = generateUrl(nextDay, slug);
      
      redirects.push(`${nextDayUrl} ${post.actualUrl} 301`);
      
      // Also generate -1 day redirect for edge cases
      const prevDay = new Date(post.datePublished);
      prevDay.setDate(post.datePublished.getDate() - 1);
      const prevDayUrl = generateUrl(prevDay, slug);
      
      redirects.push(`${prevDayUrl} ${post.actualUrl} 301`);
    }
  });
  
  // Add a fallback pattern for any remaining misses
  redirects.push('');
  redirects.push('# Fallback: Try to guess URLs by matching slugs');
  redirects.push('# This uses Netlify Functions for complex pattern matching');
  
  // Write redirects file
  const redirectsContent = redirects.join('\n');
  
  fs.writeFileSync(path.join(__dirname, '_redirects'), redirectsContent);
  
  const actualRedirects = redirects.filter(line => line.includes(' 301')).length;
  console.log(`\n✅ Generated ${actualRedirects} smart redirects`);
  console.log(`📄 Saved to _redirects file`);
  
  if (actualRedirects > 1000) {
    console.warn(`⚠️  Warning: ${actualRedirects} redirects exceeds Netlify's 1000 limit`);
    console.log('💡 Consider using Netlify Functions for pattern-based redirects');
  }
  
  return actualRedirects;
}

// Main function
generateSmartRedirects();