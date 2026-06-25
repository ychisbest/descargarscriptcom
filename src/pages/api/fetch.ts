import type { APIRoute } from 'astro';
import { fetchSlideShareInfo, validateSlideShareUrl } from '../../lib/slideshare';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { url } = await request.json();
    const normalizedUrl = validateSlideShareUrl(url);
    const info = await fetchSlideShareInfo(normalizedUrl);

    return new Response(JSON.stringify({
      title: info.title,
      totalSlides: info.totalSlides,
      images: info.images,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('URL') || message.includes('SlideShare presentation') ? 400 : 502;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
