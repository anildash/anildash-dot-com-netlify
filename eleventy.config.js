import { DateTime } from "luxon";
import fs, { readFileSync } from "fs";
import { execSync } from "child_process"; // Add this import
import pluginSEO from "eleventy-plugin-seo";
import pluginRss from "@11ty/eleventy-plugin-rss";
import Image from "@11ty/eleventy-img";

const seo = JSON.parse(readFileSync("./src/seo.json", "utf-8"));

export default function (eleventyConfig) {
  eleventyConfig.setTemplateFormats([
    // Templates:
    "html",
    "njk",
    "md",
    // Static Assets:
    "css",
    "jpeg",
    "jpg",
    "png",
    "svg",
    "woff",
    "woff2",
  ]);
  eleventyConfig.addPassthroughCopy("public");
  eleventyConfig.addPassthroughCopy("src/admin");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/manifest.json");
  eleventyConfig.addPassthroughCopy("src/favicon.svg");
  eleventyConfig.addPassthroughCopy("src/sw.js");
  eleventyConfig.addPassthroughCopy("_redirects");

  /* From: https://github.com/artstorm/eleventy-plugin-seo
  
  Adds SEO settings to the top of all pages

  */

  if (seo.url === "glitch-default") {
    seo.url = `https://www.anildash.com`;
  }
  eleventyConfig.addPlugin(pluginSEO, seo);
  eleventyConfig.addPlugin(pluginRss);

  // Filters let you modify the content https://www.11ty.dev/docs/filters/
  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
  });

  eleventyConfig.addFilter("dateToIso", (dateString) => {
    return new Date(dateString).toISOString();
  });

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(
      "dd LLL yyyy"
    );
  });

  // Helper for ISO date formatting for structured data
  eleventyConfig.addFilter("dateToISOString", function (date) {
    if (!date) return "";
    return new Date(date).toISOString();
  });

  // Helper for absolute URLs
  eleventyConfig.addFilter("absoluteUrl", function (url, base) {
    if (!url) return "";
    if (!base) base = "https://anildash.com";

    // Remove trailing slash from base if present
    if (base.endsWith("/")) {
      base = base.slice(0, -1);
    }

    // Ensure url starts with slash
    if (!url.startsWith("/")) {
      url = "/" + url;
    }

    return base + url;
  });

  // Current year helper for copyright
  eleventyConfig.addGlobalData("helpers", {
    currentYear: () => new Date().getFullYear(),
  });
  
  // Enhanced excerpt functionality for meta descriptions
  eleventyConfig.addFilter("excerpt", function (content) {
    if (!content) return "";

    // Handle when content is a string (from post content)
    if (typeof content === 'string') {
      // Remove HTML tags and get the first 160 characters
      const plainText = content.replace(/<[^>]+>/gi, " ");
      return plainText.substring(0, 160).trim() + "...";
    }
    
    // The original implementation for post objects
    try {
      const plainText = content.replace(/(<([^>]+)>)/gi, "");
      return plainText.substr(0, plainText.lastIndexOf(" ", 250)) + "...";
    } catch (e) {
      return "";
    }
  });

  // Convert tags to comma-separated list
  eleventyConfig.addFilter("join", function (array, separator) {
    if (!array || !Array.isArray(array)) return "";
    return array.join(separator || ", ");
  });

  // Truncate strings for SEO titles (Google displays ~70 chars)
  eleventyConfig.addFilter("truncate", function (string, length) {
    if (!string) return "";
    length = length || 70;
    if (string.length <= length) return string;
    return string.substring(0, length) + "...";
  });

  // Unique filter to remove duplicate tags
  eleventyConfig.addFilter("unique", (array) => {
    return [...new Set(array)];
  });

  // Flatten filter to merge nested arrays into a single array
  eleventyConfig.addFilter("flatten", (array) => {
    return array.reduce((flat, toFlatten) => flat.concat(toFlatten), []);
  });

  // Map filter to retrieve a specific property from each object in an array
  eleventyConfig.addFilter("map", (array, key) => {
    return array.map((item) => item[key]);
  });

  eleventyConfig.addFilter("head", (array, n) => {
    if (n < 0) {
      return array.slice(n);
    }
    return array.slice(0, n);
  });

  eleventyConfig.addCollection("tagList", function (collection) {
    let tagSet = new Set();
    collection.getAll().forEach(function (item) {
      if ("tags" in item.data) {
        let tags = item.data.tags;

        tags = tags.filter(function (item) {
          switch (item) {
            case "all":
            case "nav":
            case "post":
            case "posts":
              return false;
          }

          return true;
        });

        for (const tag of tags) {
          tagSet.add(tag);
        }
      }
    });

    return [...tagSet];
  });

  eleventyConfig.addFilter("pageTags", (tags) => {
    const generalTags = ["all", "nav", "post", "posts"];

    return tags
      .toString()
      .split(",")
      .filter((tag) => {
        return !generalTags.includes(tag);
      });
  });

  // Date-based weighting for search results
  eleventyConfig.addFilter("dateWeight", function(dateObj) {
    if (!dateObj) return 1;
    
    const postDate = new Date(dateObj);
    const currentDate = new Date();
    const daysDifference = (currentDate - postDate) / (1000 * 60 * 60 * 24);
    
    // Weight calculation for recency:
    // - Posts from last 30 days: weight 10
    // - Posts from last 6 months: weight 8
    // - Posts from last year: weight 6
    // - Posts from last 2 years: weight 4
    // - Posts from last 5 years: weight 2
    // - Older posts: weight 1
    
    if (daysDifference <= 30) {
      return 10;
    } else if (daysDifference <= 180) { // 6 months
      return 8;
    } else if (daysDifference <= 365) { // 1 year
      return 6;
    } else if (daysDifference <= 730) { // 2 years
      return 4;
    } else if (daysDifference <= 1825) { // 5 years
      return 2;
    } else {
      return 1;
    }
  });

  // Combined weight calculation for content priority
  eleventyConfig.addFilter("searchWeight", function(tags, dateObj) {
    if (!tags || !Array.isArray(tags)) return 1;
    
    const hasBestOf = tags.includes("Best Of");
    const hasMostPopular = tags.includes("Most Popular");
    const dateWeight = this.getFilter("dateWeight")(dateObj);
    
    // Base multipliers for content categories
    let categoryMultiplier = 1;
    
    if (hasBestOf && hasMostPopular) {
      // Highest priority: both Best Of AND Most Popular
      categoryMultiplier = 5;
    } else if (hasBestOf) {
      // High priority: Best Of content
      categoryMultiplier = 3;
    } else if (hasMostPopular) {
      // High priority: Most Popular content
      categoryMultiplier = 3;
    }
    
    // Combine category importance with recency
    // For premium content (Best Of/Most Popular), even old posts should rank well
    if (categoryMultiplier > 1) {
      // Premium content: minimum weight of 5, maximum weight of 50
      return Math.max(5, Math.min(50, categoryMultiplier * dateWeight));
    } else {
      // Regular content: use date weight as-is (1-10)
      return dateWeight;
    }
  });

  // Content type weights for different elements
  eleventyConfig.addFilter("titleWeight", function(tags) {
    if (!tags || !Array.isArray(tags)) return 1.5;
    
    const hasBestOf = tags.includes("Best Of");
    const hasMostPopular = tags.includes("Most Popular");
    
    if (hasBestOf && hasMostPopular) {
      return 5; // Super high title weight
    } else if (hasBestOf || hasMostPopular) {
      return 3; // High title weight
    } else {
      return 1.5; // Normal title weight
    }
  });

  eleventyConfig.addFilter("contentWeight", function(tags) {
    if (!tags || !Array.isArray(tags)) return 1;
    
    const hasBestOf = tags.includes("Best Of");
    const hasMostPopular = tags.includes("Most Popular");
    
    if (hasBestOf && hasMostPopular) {
      return 3; // High content weight
    } else if (hasBestOf || hasMostPopular) {
      return 2; // Medium-high content weight
    } else {
      return 1; // Normal content weight
    }
  });
// Add these filters to your existing eleventy.config.js
// Insert after your existing filters, before the collections

// Date-based weighting for search results
eleventyConfig.addFilter("dateWeight", function(dateObj) {
  if (!dateObj) return 1;
  
  const postDate = new Date(dateObj);
  const currentDate = new Date();
  const daysDifference = (currentDate - postDate) / (1000 * 60 * 60 * 24);
  
  // Weight calculation for recency
  if (daysDifference <= 30) {
    return 10;
  } else if (daysDifference <= 180) { // 6 months
    return 8;
  } else if (daysDifference <= 365) { // 1 year
    return 6;
  } else if (daysDifference <= 730) { // 2 years
    return 4;
  } else if (daysDifference <= 1825) { // 5 years
    return 2;
  } else {
    return 1;
  }
});

// Combined weight calculation for content priority
eleventyConfig.addFilter("searchWeight", function(tags, dateObj) {
  if (!tags || !Array.isArray(tags)) return 1;
  
  const hasBestOf = tags.includes("Best Of");
  const hasMostPopular = tags.includes("Most Popular");
  
  // Calculate date weight manually here to avoid filter reference issues
  let dateWeight = 1;
  if (dateObj) {
    const postDate = new Date(dateObj);
    const currentDate = new Date();
    const daysDifference = (currentDate - postDate) / (1000 * 60 * 60 * 24);
    
    if (daysDifference <= 30) {
      dateWeight = 10;
    } else if (daysDifference <= 180) {
      dateWeight = 8;
    } else if (daysDifference <= 365) {
      dateWeight = 6;
    } else if (daysDifference <= 730) {
      dateWeight = 4;
    } else if (daysDifference <= 1825) {
      dateWeight = 2;
    } else {
      dateWeight = 1;
    }
  }
  
  // Base multipliers for content categories
  let categoryMultiplier = 1;
  
  if (hasBestOf && hasMostPopular) {
    categoryMultiplier = 5;
  } else if (hasBestOf) {
    categoryMultiplier = 3;
  } else if (hasMostPopular) {
    categoryMultiplier = 3;
  }
  
  // Combine category importance with recency
  if (categoryMultiplier > 1) {
    return Math.max(5, Math.min(50, categoryMultiplier * dateWeight));
  } else {
    return dateWeight;
  }
});

// Content type weights for different elements
eleventyConfig.addFilter("titleWeight", function(tags) {
  if (!tags || !Array.isArray(tags)) return 1.5;
  
  const hasBestOf = tags.includes("Best Of");
  const hasMostPopular = tags.includes("Most Popular");
  
  if (hasBestOf && hasMostPopular) {
    return 5;
  } else if (hasBestOf || hasMostPopular) {
    return 3;
  } else {
    return 1.5;
  }
});

eleventyConfig.addFilter("contentWeight", function(tags) {
  if (!tags || !Array.isArray(tags)) return 1;
  
  const hasBestOf = tags.includes("Best Of");
  const hasMostPopular = tags.includes("Most Popular");
  
  if (hasBestOf && hasMostPopular) {
    return 3;
  } else if (hasBestOf || hasMostPopular) {
    return 2;
  } else {
    return 1;
  }
});

  /* Build the collection of posts to list in the site
     - Read the Next Steps post to learn how to extend this
  */
     eleventyConfig.addCollection("posts", function (collection) {
      const coll = collection.getFilteredByTag("posts");
        
      // Sort by date_published (but don't override the date field)
      coll.sort((a, b) => {
        const dateA = new Date(a.data.date_published || a.data.date);
        const dateB = new Date(b.data.date_published || b.data.date);
        return dateA - dateB; // Try this if the above shows oldest first
      });
    
      // Keep the prev/next logic
      for (let i = 0; i < coll.length; i++) {
        const prevPost = coll[i - 1];
        const nextPost = coll[i + 1];
        coll[i].data["prevPost"] = prevPost;
        coll[i].data["nextPost"] = nextPost;
      }
      
      return coll;
    });
    
  // Add this before your return statement
  eleventyConfig.addGlobalData("eleventyComputed", {
    date: (data) => {
      // For posts, use date_published as the date
      if (data.date_published && data.tags && data.tags.includes("posts")) {
        return new Date(data.date_published);
      }
      return data.date;
    },
    
    permalink: (data) => {
  // For posts, generate permalink from date_published
      if (data.date_published && data.slug && data.tags && data.tags.includes("posts")) {
        const date = new Date(data.date_published);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        
        // Ensure slug keeps underscores - don't let Eleventy convert them
        const slug = data.slug.replace(/-/g, '_'); // Convert any hyphens to underscores
        
        return `/${year}/${month}/${day}/${slug}/`;
      }
      return data.permalink;
    }
  });

    eleventyConfig.on('eleventy.after', () => {
    try {
      execSync(`npx pagefind --site build --glob "**/*.html"`, {
        encoding: 'utf-8',
        stdio: 'inherit' // This will show the output
      });
      console.log('✅ Pagefind index created successfully');
    } catch (error) {
      console.error('❌ Pagefind indexing failed:', error.message);
    }
  });


  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "data",
      output: "build",
    },
  };
  eleventyConfig.addAsyncShortcode("image", async function(src, alt, sizes) {
  let metadata = await Image(src, {
    widths: [300, 600, 900, 1200],
    formats: ["webp", "jpeg"],
    outputDir: "./build/img/",
    urlPath: "/img/",
  });
  
  let imageAttributes = {
    alt,
    sizes,
    loading: "lazy",
    decoding: "async",
  };
  
  return Image.generateHTML(metadata, imageAttributes);
});
};
