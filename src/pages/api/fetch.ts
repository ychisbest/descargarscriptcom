import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate SlideShare URL
    const isSlideShare = url.includes('slideshare.net') || url.includes('slideshare.com');
    if (!isSlideShare) {
      return new Response(JSON.stringify({ error: 'Not a SlideShare URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch the SlideShare page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch SlideShare page' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/ - SlideShare$/i, '').trim() : 'SlideShare Presentation';

    // Extract slide images from the page
    // SlideShare embeds slides as images in various formats
    const slideImages: string[] = [];

    // Method 1: Look for data in script tags (SSKS data)
    const scriptMatch = html.match(/window\.__SSKS\s*=\s*(\{[\s\S]*?\});/);
    if (scriptMatch) {
      try {
        const data = JSON.parse(scriptMatch[1]);
        if (data.imageUrls) {
          slideImages.push(...data.imageUrls);
        }
      } catch { /* ignore parse errors */ }
    }

    // Method 2: Look for image tags with slide class
    if (slideImages.length === 0) {
      const imgRegex = /<img[^>]+class="[^"]*slide[^"]*"[^>]+src="([^"]+)"/gi;
      let match;
      while ((match = imgRegex.exec(html)) !== null) {
        slideImages.push(match[1]);
      }
    }

    // Method 3: Look for meta og:image or other image patterns
    if (slideImages.length === 0) {
      // Try to find images from the slide content area
      const contentMatch = html.match(/class="[^"]*slide_content[^"]*"[\s\S]*?<\/div>/);
      if (contentMatch) {
        const imgRegex = /src="([^"]*(?:image|slide)[^"]*)"/gi;
        let match;
        while ((match = imgRegex.exec(contentMatch[0])) !== null) {
          slideImages.push(match[1]);
        }
      }
    }

    // Method 4: Look for high-res image URLs in the page
    if (slideImages.length === 0) {
      const allImgRegex = /https?:\/\/image\.slidesharecdn\.com\/[^"'\s)]+/gi;
      const matches = html.match(allImgRegex);
      if (matches) {
        // Deduplicate and sort
        const unique = [...new Set(matches)].sort();
        slideImages.push(...unique);
      }
    }

    if (slideImages.length === 0) {
      return new Response(JSON.stringify({
        error: 'Could not extract slides. The presentation might be private or have special restrictions.',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      title,
      totalSlides: slideImages.length,
      images: slideImages,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
