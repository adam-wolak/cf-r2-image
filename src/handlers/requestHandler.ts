import { getOptimizedImagePath, isImagePath, getBestImageFormat, getOrCreateImage } from '../utils/imageUtils';
import { config } from '../config';
import { Queue } from '../utils/queue';

const MAX_CONCURRENT_REQUESTS = 10;

import { getOptimizedImagePath, isImagePath, getBestImageFormat, getOrCreateImage } from '../utils/imageUtils';
import { config } from '../config';

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  console.log('Worker started processing request');
  console.log('Request URL:', request.url);

  const url = new URL(request.url);

  if (url.pathname === '/favicon.ico') {
    return new Response(null, { status: 404 });
  }

  const targetUrl = url.searchParams.get('url');

  if (targetUrl) {
    console.log('Target URL:', targetUrl);
    const targetResponse = await fetch(targetUrl);
    const contentType = targetResponse.headers.get('Content-Type');

    if (contentType && contentType.includes('text/html')) {
      console.log('Modifying HTML from target URL');
      let html = await targetResponse.text();
      const imagePromises = [];

      // Usuń sekcję slidera
      html = html.replace(/<div[^>]*class="[^"]*slider[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');

      html = html.replace(/<img[^>]+src="([^"]+)"[^>]*>/g, async (match, src) => {
        if (isImagePath(src) && !src.includes('/slider/')) {
          const bestFormat = getBestImageFormat(request.headers.get('Accept') || '');
          const optimizedSrc = getOptimizedImagePath(src, bestFormat);
          console.log('Processing image:', src, 'to format:', bestFormat);

          // Queue image processing
          imagePromises.push(getOrCreateImage(src, env, bestFormat));

          // Modify srcset
          let newMatch = match.replace(src, `${config.R2_PUB}/${optimizedSrc}`);
          newMatch = newMatch.replace(/srcset="([^"]+)"/g, (srcsetMatch, srcset) => {
            const newSrcset = srcset.split(',').map(srcItem => {
              const [itemSrc, size] = srcItem.trim().split(' ');
              if (isImagePath(itemSrc)) {
                const [width, height] = size.split('x').map(Number);
                const optimizedItemSrc = getOptimizedImagePath(itemSrc, bestFormat, width, height);
                imagePromises.push(getOrCreateImage(itemSrc, env, bestFormat, width, height));
                return `${config.R2_PUB}/${optimizedItemSrc} ${size}`;
              }
              return srcItem;
            }).join(', ');
            return `srcset="${newSrcset}"`;
          });

          return newMatch;
        }
        return match;
      });

      // Process images
      await Promise.all(imagePromises);

      console.log('Returning modified HTML');
      return new Response(html, {
        headers: targetResponse.headers,
      });
    }
  }

  // Handle direct image requests
  const imagePath = url.pathname.replace(/^\//, '');
  console.log('Image path:', imagePath);

  if (isImagePath(imagePath)) {
    console.log('Processing image:', imagePath);
    const bestFormat = getBestImageFormat(request.headers.get('Accept') || '');
    const optimizedImagePath = getOptimizedImagePath(imagePath, bestFormat);

    console.log('Best format:', bestFormat);
    console.log('Optimized image path:', optimizedImagePath);

    try {
      const imageBuffer = await getOrCreateImage(imagePath, env, bestFormat);
      if (imageBuffer) {
        console.log('Returning optimized image');
        return new Response(imageBuffer, {
          headers: {
            'Content-Type': `image/${bestFormat}`,
            'Cache-Control': config.R2_CACHE_CONTROL,
          },
        });
      }
    } catch (error) {
      console.error('Error processing image:', error);
    }
  }

  console.log('No matching conditions, returning 404');
  return new Response('Not Found', { status: 404 });
}
