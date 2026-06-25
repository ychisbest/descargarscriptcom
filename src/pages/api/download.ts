import type { APIRoute } from 'astro';
import { fetchSlideShareInfo, validateSlideImageUrls, validateSlideShareUrl } from '../../lib/slideshare';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { url, images: requestedImages } = await request.json();
    const normalizedUrl = validateSlideShareUrl(url);
    const slideImages = validateSlideImageUrls(requestedImages);
    if (slideImages.length === 0) {
      const info = await fetchSlideShareInfo(normalizedUrl);
      slideImages.push(...info.images);
    }

    // Download all images and return as base64
    const downloadedImages = await mapWithConcurrency(slideImages, 4, async (imgUrl, index) => {
      try {
        const imgResponse = await fetch(imgUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Referer: 'https://www.slideshare.net/',
          },
        });

        if (!imgResponse.ok) return null;

        const buffer = await imgResponse.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);
        const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';

        return {
          index,
          data: `data:${contentType};base64,${base64}`,
          width: 0,
          height: 0,
        };
      } catch {
        return null;
      }
    });

    const validImages = downloadedImages.filter(Boolean);

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
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('URL') || message.includes('SlideShare presentation') ? 400 : 502;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}
