import { Env, ProcessedImage } from '../types';
import { extractImageUrls } from '../utils/htmlUtils';

async function processImages(imageUrls: string[], env: Env): Promise<ProcessedImage[]> {
  const processedImages: ProcessedImage[] = [];
  for (const url of imageUrls) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      processedImages.push({ url, base64 });
    } catch (error) {
      console.error(`Error processing image ${url}:`, error);
    }
  }
  return processedImages;
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  console.log('Image Collector: Received request');
  try {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      console.log('Image Collector: Missing url parameter');
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Image Collector: Fetching content from:', targetUrl);
    const response = await fetch(targetUrl);
    const html = await response.text();

    console.log('Image Collector: Extracting image URLs');
    const imageUrls = extractImageUrls(html, targetUrl);
    console.log('Image Collector: Found image URLs:', imageUrls);

    console.log('Image Collector: Processing images');
    const processedImages = await processImages(imageUrls, env);
    console.log('Image Collector: Processed images:', processedImages.length);

    return new Response(JSON.stringify({ processedImages }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in Image Collector:', error);
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = String(error);
    }
    return new Response(JSON.stringify({ error: 'Error in Image Collector', details: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default {
  fetch: handleRequest,
} as const;
