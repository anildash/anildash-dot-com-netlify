export async function handler(event, context) {
    const requestedPath = event.path;
    
    console.log('Function called with path:', requestedPath);
    
    // Only handle blog post URLs that match the pattern /YYYY/MM/DD/slug/
    const blogPostMatch = requestedPath.match(/^\/(\d{4})\/(\d{2})\/(\d{2})\/([^\/]+)\/?$/);
    
    if (!blogPostMatch) {
      console.log('No blog post match for:', requestedPath);
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'text/html'
        },
        body: `<h1>Not Found</h1><p>Path: ${requestedPath}</p>`
      };
    }
    
    const [, year, month, day, slug] = blogPostMatch;
    const requestedDate = new Date(year, month - 1, day);
    
    // CONSERVATIVE APPROACH: Only redirect for recent dates and common patterns
    // Most timezone issues happen with recent posts (last 2 years)
    const now = new Date();
    const daysDiff = Math.abs((now - requestedDate) / (24 * 60 * 60 * 1000));
    
    if (daysDiff > 730) { // More than 2 years old
      console.log('Date too old, returning 404 instead of redirecting');
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'text/html'
        },
        body: `<h1>Post Not Found</h1><p>No post found for "${slug.replace(/-/g, ' ')}"</p>`
      };
    }
    
    // For recent posts, try the timezone correction (one day earlier)
    const oneDayEarlier = new Date(requestedDate.getTime() - 24 * 60 * 60 * 1000);
    
    const redirectYear = oneDayEarlier.getFullYear();
    const redirectMonth = String(oneDayEarlier.getMonth() + 1).padStart(2, '0');
    const redirectDay = String(oneDayEarlier.getDate()).padStart(2, '0');
    const redirectUrl = `/${redirectYear}/${redirectMonth}/${redirectDay}/${slug}/`;
    
    console.log('Redirecting recent post to one day earlier:', redirectUrl);
    
    // Add a special header to indicate this was a timezone correction
    return {
      statusCode: 301,
      headers: {
        'Location': redirectUrl,
        'Cache-Control': 'public, max-age=86400',
        'X-Redirect-Reason': 'timezone-correction'
      }
    };
  }