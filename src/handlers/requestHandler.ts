import { config } from '../config';
import { getOptimizedImagePath, isImagePath, getBestImageFormat, getOrCreateImage } from '../utils/imageUtils';

import { Env } from '../types';

async function modifyHtml(html: string, accept: string, env: Env): Promise<string> {
  const bestFormat = getBestImageFormat(accept);
  console.log('Best format:', bestFormat);

  const processImage = async (src: string) => {
    if (isImagePath(src)) {
      const fullSrc = new URL(src, config.ORIGIN).pathname;
      const newSrc = getOptimizedImagePath(fullSrc, bestFormat);
      console.log('Processing image:', fullSrc);
      console.log('New src:', newSrc);
      
      // Przetwórz i zapisz obraz w R2
      try {
        await getOrCreateImage(env.R2_BUCKET, fullSrc, bestFormat);
        console.log('Image processed and saved to R2');
      } catch (error) {
        console.error('Error processing image:', error);
      }

      return newSrc;
    }
    return src;
  };

  // Modyfikacja src
  const srcPromises = [];
  html = html.replace(
    /<img[^>]+src=["']([^"']+)["']/gi,
    (match, src) => {
      const promise = processImage(src).then(newSrc => {
        console.log('Replacing src:', src, 'with:', newSrc);
        return match.replace(src, newSrc);
      });
      srcPromises.push(promise);
      return match;
    }
  );

  // Modyfikacja srcset
  const srcsetPromises = [];
  html = html.replace(
    /<img[^>]+srcset=["']([^"']+)["']/gi,
    (match, srcset) => {
      const promise = Promise.all(
        srcset.split(',').map(async (src) => {
          const [url, size] = src.trim().split(' ');
          const newUrl = await processImage(url);
          console.log('Replacing srcset url:', url, 'with:', newUrl);
          return `${newUrl} ${size}`;
        })
      ).then(newSrcset => {
        return match.replace(srcset, newSrcset.join(', '));
      });
      srcsetPromises.push(promise);
      return match;
    }
  );

  // Poczekaj na zakończenie wszystkich operacji przetwarzania obrazów
  await Promise.all([...srcPromises, ...srcsetPromises]);

  return html;
}


export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  
  console.log('Received request for URL:', targetUrl);

  if (!targetUrl) {
    console.log('No target URL provided');
    return new Response('No URL provided', { status: 400 });
  }

  try {
    const targetUrlObject = new URL(targetUrl);
    const path = targetUrlObject.pathname;

    console.log('Extracted path:', path);

  if (path === '/' || path.endsWith('.html')) {
    console.log('Processing HTML');
    const response = await fetch(targetUrl);
    const html = await response.text();
    const accept = request.headers.get('Accept') || '';
    const modifiedHtml = await modifyHtml(html, accept, env);
    return new Response(modifiedHtml, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

    if (isImagePath(path)) {
      console.log('Processing image:', path);
      const accept = request.headers.get('Accept') || '';
      const bestFormat = getBestImageFormat(accept);
      const image = await getOrCreateImage(env.R2_BUCKET, path, bestFormat);
      console.log('Image processed successfully');

      return new Response(image, {
        headers: { 
          'Content-Type': `image/${bestFormat}`,
          'Cache-Control': config.R2_CACHE_CONTROL
        }
      });
    }

    console.log('Not an image path, fetching original');
    return fetch(targetUrl);
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response('Error processing request', { status: 500 });
  }
}
