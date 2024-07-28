import { getOptimizedImagePath, isImagePath, getBestImageFormat, getOrCreateImage } from '../utils/imageUtils';
import { config } from '../config';
import pLimit from 'p-limit';

async function modifyHtml(html: string, accept: string, env: Env): Promise<string> {
  const bestFormat = getBestImageFormat(accept);
  console.log('Best format:', bestFormat);

  const limit = pLimit(5);

  const processImage = async (src: string) => {
    if (isImagePath(src)) {
      const fullSrc = new URL(src, config.ORIGIN).pathname.replace(/^\/+/, '');
      console.log('Processing image:', fullSrc);
      
      try {
        const newSrc = await limit(() => getOrCreateImage(env.R2_BUCKET, fullSrc, bestFormat));
        console.log('New src:', newSrc);
        return newSrc;
      } catch (error) {
        console.error('Error processing image:', error);
        return src;
      }
    }
    return src;
  };

  const promises: Promise<string>[] = [];

  // Funkcja do przetwarzania pojedynczego tagu img
  const processImgTag = async (match: string): Promise<string> => {
    const srcMatch = match.match(/src=["']([^"']+)["']/i);
    const srcsetMatch = match.match(/srcset=["']([^"']+)["']/i);

    if (srcsetMatch) {
      const srcset = srcsetMatch[1];
      const newSrcset = await Promise.all(
        srcset.split(',').map(async (src) => {
          const [url, size] = src.trim().split(' ');
          const newUrl = await processImage(url);
          return `${newUrl} ${size}`;
        })
      );
      match = match.replace(srcset, newSrcset.join(', '));
    }

    if (srcMatch) {
      const src = srcMatch[1];
      const newSrc = await processImage(src);
      match = match.replace(src, newSrc);
    }

    return match;
  };

  // Znajdź wszystkie tagi img i przetwórz je
  const imgTags = html.match(/<img[^>]+>/gi) || [];
  for (const imgTag of imgTags) {
    const promise = processImgTag(imgTag).then(newImgTag => {
      html = html.replace(imgTag, newImgTag);
    });
    promises.push(promise);
  }

  // Poczekaj na zakończenie wszystkich operacji przetwarzania obrazów
  await Promise.all(promises);

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
      const newSrc = await getOrCreateImage(env.R2_BUCKET, path, bestFormat);
      return Response.redirect(newSrc, 301);
    }

    console.log('Not an image path, fetching original');
    return fetch(targetUrl);
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response('Error processing request', { status: 500 });
  }
}
