import { getOptimizedImagePath, isImagePath, getBestImageFormat, getOrCreateImage } from '../utils/imageUtils';
import { config } from '../config';
import pLimit from 'p-limit';

async function modifyHtml(html: string, accept: string, env: Env): Promise<string> {
  const bestFormat = getBestImageFormat(accept);
  console.log('Best format:', bestFormat);

const limit = pLimit(3); // Ograniczenie do 3 jednoczesnych żądań
const isLazy = match.includes('loading="lazy"');
const newSrc = await processImage(value, isLazy);

const processImage = async (src: string, isLazy: boolean) => {
  if (isImagePath(src)) {
    const fullSrc = new URL(src, config.ORIGIN).pathname.replace(/^\/+/, '');
    console.log('Processing image:', fullSrc);
    
    if (isLazy) {
      // Dla leniwych obrazów, zwróć oryginalny URL i zaplanuj przetwarzanie w tle
      setTimeout(() => {
        getOrCreateImage(env.R2_BUCKET, fullSrc, bestFormat).catch(console.error);
      }, 0);
      return src;
    }

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

  // Modyfikacja src i srcset
  const promises = [];
  html = html.replace(
  /<img[^>]+(?:src|srcset)=["']([^"']+)["']/gi,
  async (match, value) => {
    if (match.includes('srcset')) {
      const newSrcset = await Promise.all(
        value.split(',').map(async (src) => {
          const [url, size] = src.trim().split(' ');
          const newUrl = await processImage(url);
          return `${newUrl} ${size}`;
        })
      );
      return match.replace(value, newSrcset.join(', '));
    } else {
      const newSrc = await processImage(value);
      return match.replace(value, newSrc);
    }
  }
);

      promises.push(promise);
      return match;
    }
  );

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
