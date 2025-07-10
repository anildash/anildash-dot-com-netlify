// netlify/functions/log-404.js

export async function handler(event, context) {
    const requestedPath = event.path;
    const timestamp = new Date().toISOString();
    const userAgent = event.headers['user-agent'] || 'unknown';
    const referer = event.headers.referer || 'direct';
    
    // Create log entry
    const logEntry = {
      timestamp,
      path: requestedPath,
      userAgent,
      referer,
      ip: event.headers['x-forwarded-for'] || 'unknown'
    };
    
    console.log('404 LOG:', JSON.stringify(logEntry));
    
    // Simple text format log for easy reading
    const textLog = `${timestamp} | ${requestedPath} | ${referer}`;
    console.log('404 TEXT:', textLog);
    
    // Return a nice 404 page
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      },
      body: `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page Not Found - Anil Dash</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        max-width: 600px;
        margin: 100px auto;
        padding: 20px;
        line-height: 1.6;
        color: #292029;
      }
      h1 {
        color: #800080;
        font-size: 2.5rem;
      }
      .search-suggestion {
        background: #f5f5f5;
        padding: 1rem;
        border-radius: 8px;
        margin: 1rem 0;
      }
      a {
        color: #800080;
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <h1>Page Not Found</h1>
    <p>Sorry, the page you're looking for doesn't exist.</p>
    
    <div class="search-suggestion">
      <strong>Looking for something specific?</strong><br>
      Try searching from the <a href="/">homepage</a> or browse by <a href="/tags/">tags</a>.
    </div>
    
    <p>If you followed a link from another site that should work, I'd appreciate knowing about it. You can <a href="mailto:a@anildash.com">drop me a line</a> and I'll fix it!</p>
    
    <p><a href="/">← Back to homepage</a></p>
  </body>
  </html>
      `
    };
  }