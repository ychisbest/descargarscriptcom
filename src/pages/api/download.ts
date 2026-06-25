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

    // Fetch the SlideShare page to extract image URLs
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

    // Extract slide images
    const slideImages: string[] = [];

    // Try multiple extraction methods
    const scriptMatch = html.match(/window\.__SSKS\s*=\s*(\{[\s\S]*?\});/);
    if (scriptMatch) {
      try {
        const data = JSON.parse(scriptMatch[1]);
        if (data.imageUrls) slideImages.push(...data.imageUrls);
      } catch { /* ignore */ }
    }

    if (slideImages.length === 0) {
      const imgRegex = /<img[^>]+class="[^"]*slide[^"]*"[^>]+src="([^"]+)"/gi;
      let match;
      while ((match = imgRegex.exec(html)) !== null) {
        slideImages.push(match[1]);
      }
    }

    if (slideImages.length === 0) {
      const allImgRegex = /https?:\/\/image\.slidesharecdn\.com\/[^"'\s)]+/gi;
      const matches = html.match(allImgRegex);
      if (matches) {
        slideImages.push(...[...new Set(matches)].sort());
      }
    }

    if (slideImages.length === 0) {
      return new Response(JSON.stringify({ error: 'Could not extract slides' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Download all images and return as base64
    const images = await Promise.all(
      slideImages.map(async (imgUrl, index) => {
        try {
          const imgResponse = await fetch(imgUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://slideshare.net/',
            },
          });

          if (!imgResponse.ok) return null;

          const buffer = await imgResponse.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';

          return {
            index,
            data: `data:${contentType};base64,${base64}`,
            width: 0, // Will be determined client-side
            height: 0,
          };
        } catch {
          return null;
        }
      })
    );

    const validImages = images.filter(Boolean);

    if (validImages.length === 0) {
      return new Response(JSON.stringify({ error: 'Failed to download slide images' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      images: validImages,
      total: validImages.length,
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
