import { handleImageRequest } from './imageHandler';
import { modifyHtmlContent } from '../transformers/imageHandler';
import { getBestImageFormat } from '../utils/deviceUtils';
import { config } from '../config';

export async function handleRequest(request: Request, r2Bucket: R2Bucket): Promise<Response> {
  console.log('Received request:', request.url);
  const url = new URL(request.url);
  const path = url.pathname.slice(1); // Remove leading slash

  if (path.startsWith('http')) {
    // This is a request for an image
    const imageUrl = decodeURIComponent(path);
    return handleImageRequest(request, r2Bucket, imageUrl);
  } else {
    // This is a request for HTML modification
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      console.log('Missing URL parameter');
      return new Response('Missing URL parameter', { status: 400 });
    }
    return handleHtmlRequest(request, r2Bucket, targetUrl);
  }
}

async function handleHtmlRequest(request: Request, r2Bucket: R2Bucket, targetUrl: string): Promise<Response> {
  console.log('Handling HTML request:', targetUrl);
  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch HTML: ${response.statusText}`);
    }
    const html = await response.text();
    const bestFormat = getBestImageFormat(request);
    const modifiedHtml = await modifyHtmlContent(html, targetUrl, r2Bucket, bestFormat);
    return new Response(modifiedHtml, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': config.R2_CACHE_CONTROL,
      },
    });
  } catch (error) {
    console.error('Error in handleHtmlRequest:', error);
    return new Response('Error processing HTML', { status: 500 });
  }
}
