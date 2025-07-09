import { DateTime } from "luxon";
import fs, { readFileSync } from "fs";
import pluginSEO from "eleventy-plugin-seo";
import pluginRss from "@11ty/eleventy-plugin-rss";
import Image from "@11ty/eleventy-img";
const seo = JSON.parse(readFileSync("./src/seo.json", "utf-8"));
const NOT_FOUND_PATH = "/app/build/404.html";

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
  eleventyConfig.addPassthroughCopy("src/manifest.json");
  eleventyConfig.addPassthroughCopy("src/sw.js");

  /* From: https://github.com/artstorm/eleventy-plugin-seo
  
  Adds SEO settings to the top of all pages
  The "glitch-default" bit allows someone to set the url in seo.json while
  still letting it have a proper glitch.me address via PROJECT_DOMAIN
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

  /* Build the collection of posts to list in the site
     - Read the Next Steps post to learn how to extend this
  */
  eleventyConfig.addCollection("posts", function (collection) {
    const coll = collection.getFilteredByTag("posts");

    // Map date_published to date and sort by date_published
    for (let i = 0; i < coll.length; i++) {
      if (coll[i].data.date_published) {
        // Use date_published as the canonical date
        coll[i].data.date = new Date(coll[i].data.date_published);
      }
    }

    // Sort by date_published (now mapped to date)
    coll.sort((a, b) => {
      const dateA = new Date(a.data.date_published || a.data.date);
      const dateB = new Date(b.data.date_published || b.data.date);
      return dateA - dateB; // Try this if the above shows oldest first
    });

    // Add prev/next relationships
    for (let i = 0; i < coll.length; i++) {
      const prevPost = coll[i - 1];
      const nextPost = coll[i + 1];
      coll[i].data["prevPost"] = prevPost;
      coll[i].data["nextPost"] = nextPost;
    }
    
    return coll;
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
