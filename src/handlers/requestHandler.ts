import { getOptimizedImagePath, isImagePath, getBestImageFormat, getOrCreateImage } from '../utils/imageUtils';
import { config } from '../config';

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  console.log('Worker started processing request');
  console.log('Request URL:', request.url);

  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (targetUrl) {
    console.log('Target URL:', targetUrl);
    const targetResponse = await fetch(targetUrl);
    const contentType = targetResponse.headers.get('Content-Type');

    if (contentType && contentType.includes('text/html')) {
      console.log('Modifying HTML from target URL');
      let html = await targetResponse.text();
      const imagePromises = [];

      html = html.replace(/<img[^>]+src="([^"]+)"[^>]*>/g, (match, src) => {
        if (isImagePath(src) && !src.includes('slider') && !src.includes('slider4')) {
          const bestFormat = getBestImageFormat(request.headers.get('Accept') || '');
          const optimizedSrc = getOptimizedImagePath(src, bestFormat);
          console.log('Replacing image src:', src, 'with:', optimizedSrc);

          // Queue image processing
          imagePromises.push(getOrCreateImage(src, env, bestFormat));

          // Modify srcset
          let newMatch = match.replace(src, `${config.R2_PUB}/${optimizedSrc}`);
          newMatch = newMatch.replace(/srcset="([^"]+)"/g, (srcsetMatch, srcset) => {
            const newSrcset = srcset.split(',').map(srcItem => {
              const [itemSrc, size] = srcItem.trim().split(' ');
              if (isImagePath(itemSrc)) {
                const optimizedItemSrc = getOptimizedImagePath(itemSrc, bestFormat);
                imagePromises.push(getOrCreateImage(itemSrc, env, bestFormat));
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

      // Wait for all image processing to complete
      await Promise.all(imagePromises);

      console.log('Returning modified HTML');
      return new Response(html, {
        headers: targetResponse.headers,
      });
    }

    console.log('Returning original response from target URL');
    return targetResponse;
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
