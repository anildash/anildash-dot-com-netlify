#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const __dirname = process.cwd();

function extractPostInfo(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontMatterMatch) return null;
  
  const frontMatter = frontMatterMatch[1];
  
  const titleMatch = frontMatter.match(/^title:\s*(.+)$/m);
  const slugMatch = frontMatter.match(/^slug:\s*(.+)$/m);
  const dateMatch = frontMatter.match(/^date_published:\s*(.+)$/m);
  
  if (!titleMatch || !dateMatch) return null;
  
  const title = titleMatch[1].replace(/^["']|["']$/g, '');
  const slug = slugMatch ? slugMatch[1] : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const datePublished = new Date(dateMatch[1]);
  
  // Extract file date from filename (YYYY-MM-DD pattern)
  const fileName = path.basename(filePath);
  const fileNameMatch = fileName.match(/^(\d{4})-(\d{2})-(\d{2})-/);
  
  if (!fileNameMatch) return null;
  
  const fileDate = new Date(fileNameMatch[1], fileNameMatch[2] - 1, fileNameMatch[3]);
  
  const publishedUrl = generateUrl(datePublished, slug);
  const fileUrl = generateUrl(fileDate, slug);
  
  return {
    filePath,
    title,
    slug,
    datePublished,
    fileDate,
    publishedUrl,
    fileUrl,
    hasChanged: publishedUrl !== fileUrl
  };
}

function generateUrl(date, slug) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `/${year}/${month}/${day}/${slug}/`;
}

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

function generateActualRedirects() {
  console.log('🔍 Finding posts that actually changed URLs...');
  
  const posts = scanPosts();
  const changedPosts = posts.filter(post => post.hasChanged);
  
  console.log(`📊 Total posts: ${posts.length}`);
  console.log(`📊 Posts with changed URLs: ${changedPosts.length}`);
  
  // Debug: Show some examples
  console.log('\n🔍 Sample posts (first 5):');
  posts.slice(0, 5).forEach(post => {
    console.log(`  File: ${post.filePath}`);
    console.log(`  File date: ${post.fileDate.toISOString().split('T')[0]}`);
    console.log(`  Published: ${post.datePublished.toISOString().split('T')[0]}`);
    console.log(`  File URL: ${post.fileUrl}`);
    console.log(`  Pub URL: ${post.publishedUrl}`);
    console.log(`  Changed: ${post.hasChanged}`);
    console.log('');
  });
  
  if (changedPosts.length === 0) {
    console.log('✅ No posts have changed URLs!');
    console.log('💡 This might mean:');
    console.log('   - File dates match published dates');
    console.log('   - Date parsing is incorrect');
    console.log('   - Slug generation is different than expected');
    return;
  }
  
  const redirects = [
    '# Redirects for posts with changed URLs due to date corrections',
    '# Only includes posts that actually moved',
    ''
  ];
  
  changedPosts.forEach(post => {
    redirects.push(`${post.fileUrl} ${post.publishedUrl} 301`);
    console.log(`📝 ${post.fileUrl} → ${post.publishedUrl}`);
  });
  
  redirects.push('');
  redirects.push('# Catch-all 404');
  redirects.push('/* /404.html 404');
  
  fs.writeFileSync(path.join(__dirname, '_redirects'), redirects.join('\n'));
  
  console.log(`\n✅ Generated ${changedPosts.length} redirects for actually changed URLs`);
  console.log('📄 Saved to _redirects file');
  
  if (changedPosts.length > 1000) {
    console.warn(`⚠️  Warning: ${changedPosts.length} redirects might exceed Netlify's limit`);
  }
}

generateActualRedirects();