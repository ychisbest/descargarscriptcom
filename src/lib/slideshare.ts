export type SlideShareInfo = {
  title: string;
  totalSlides: number;
  images: string[];
};

type SlideImageSize = {
  quality?: number;
  width?: number;
  format?: string;
};

type SlideShareData = {
  title?: string;
  totalSlides?: number;
  slides?: {
    host?: string;
    title?: string;
    imageLocation?: string;
    imageSizes?: SlideImageSize[];
  };
};

const SLIDESHARE_HOST_RE = /(^|\.)slideshare\.(net|com)$/i;

export function validateSlideShareUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    throw new Error('URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Invalid URL');
  }

  if (!SLIDESHARE_HOST_RE.test(parsed.hostname)) {
    throw new Error('Not a SlideShare URL');
  }

  if (!parsed.pathname.startsWith('/slideshow/')) {
    throw new Error('Please enter a SlideShare presentation URL, not the SlideShare homepage');
  }

  return parsed.toString();
}

export function validateSlideImageUrls(rawImages: unknown): string[] {
  if (!Array.isArray(rawImages)) {
    return [];
  }

  return rawImages
    .filter((image): image is string => typeof image === 'string')
    .map((image) => {
      try {
        return new URL(image);
      } catch {
        return null;
      }
    })
    .filter((image): image is URL => {
      return Boolean(image)
        && image.protocol === 'https:'
        && image.hostname === 'image.slidesharecdn.com'
        && /-\d+-(320|638|1024|2048)\.(jpg|jpeg|webp)$/i.test(image.pathname);
    })
    .map((image) => image.toString());
}

export async function fetchSlideShareInfo(url: string): Promise<SlideShareInfo> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://www.slideshare.net/',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch SlideShare page');
  }

  const html = await response.text();
  const fromNextData = parseNextData(html);
  if (fromNextData.images.length > 0) {
    return fromNextData;
  }

  const fallback = parseImageUrlsFromHtml(html);
  if (fallback.images.length > 0) {
    return fallback;
  }

  if (html.includes('fastly-challenge') || html.toLowerCase().includes('captcha')) {
    throw new Error('SlideShare returned a verification page. Please try again later');
  }

  throw new Error('Could not extract slides. The presentation might be private or restricted');
}

function parseNextData(html: string): SlideShareInfo {
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) {
    return { title: 'SlideShare Presentation', totalSlides: 0, images: [] };
  }

  try {
    const data = JSON.parse(unescapeHtml(match[1]));
    const slideshow = data?.props?.pageProps?.slideshow as SlideShareData | undefined;
    const title = normalizeTitle(slideshow?.title);
    const totalSlides = Number(slideshow?.totalSlides) || 0;
    const images = buildSlideImageUrls(slideshow).slice(0, totalSlides || undefined);

    return {
      title,
      totalSlides: totalSlides || images.length,
      images,
    };
  } catch {
    return { title: 'SlideShare Presentation', totalSlides: 0, images: [] };
  }
}

function buildSlideImageUrls(slideshow?: SlideShareData): string[] {
  const slides = slideshow?.slides;
  const totalSlides = Number(slideshow?.totalSlides) || 0;
  if (!slides?.host || !slides.imageLocation || !slides.title || totalSlides <= 0) {
    return [];
  }

  const size = chooseImageSize(slides.imageSizes);
  const host = slides.host.replace(/\/+$/, '');
  const location = encodePathSegment(slides.imageLocation);
  const title = encodePathSegment(slides.title);

  return Array.from({ length: totalSlides }, (_, index) => {
    const slideNumber = index + 1;
    return `${host}/${location}/${size.quality}/${title}-${slideNumber}-${size.width}.${size.format}`;
  });
}

function chooseImageSize(sizes: SlideImageSize[] = []): Required<SlideImageSize> {
  const jpgSizes = sizes
    .filter((size) => size.format === 'jpg' && size.width && size.quality)
    .sort((a, b) => Number(b.width) - Number(a.width));

  const selected = jpgSizes[0] ?? sizes.find((size) => size.width && size.quality && size.format);

  return {
    quality: Number(selected?.quality) || 85,
    width: Number(selected?.width) || 638,
    format: selected?.format || 'jpg',
  };
}

function parseImageUrlsFromHtml(html: string): SlideShareInfo {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = normalizeTitle(titleMatch?.[1]);
  const matches = html.match(/https?:\/\/image\.slidesharecdn\.com\/[^"'\s<>)]+/gi) ?? [];
  const images = [...new Set(matches.map((url) => url.replace(/&amp;/g, '&')))]
    .filter((url) => /-\d+-(320|638|1024|2048)\.(jpg|jpeg|webp)(\?|$)/i.test(url))
    .filter((url) => !/thumbnail/i.test(url))
    .sort(sortSlideUrls);

  return {
    title,
    totalSlides: images.length,
    images,
  };
}

function sortSlideUrls(a: string, b: string): number {
  const slideA = Number(a.match(/-(\d+)-\d+\.(?:jpg|jpeg|webp)/i)?.[1]) || 0;
  const slideB = Number(b.match(/-(\d+)-\d+\.(?:jpg|jpeg|webp)/i)?.[1]) || 0;
  return slideA - slideB || a.localeCompare(b);
}

function normalizeTitle(title?: string): string {
  return unescapeHtml(title || 'SlideShare Presentation')
    .replace(/\s*\|\s*PDF\s*$/i, '')
    .replace(/\s*-\s*SlideShare\s*$/i, '')
    .trim();
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function encodePathSegment(value: string): string {
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}
