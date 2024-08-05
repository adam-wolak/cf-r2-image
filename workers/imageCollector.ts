import { Env, R2Bucket, R2Object } from '../types';
import { parseImageDimensions } from '../utils/htmlUtils';

async function collectImageUrls(targetUrl: string, env: Env): Promise<string[]> {
  console.log('Image Collector: Fetching content from:', targetUrl);
  const response = await fetch(targetUrl);
  const html = await response.text();

  console.log('Image Collector: Extracting image URLs');
  const imageUrls = extractImageUrls(html, targetUrl);
  console.log('Image Collector: Found image URLs:', imageUrls.length);

  for (const imageUrl of imageUrls) {
    try {
      const existsInR2 = await checkImageExistsInR2(imageUrl, env.R2_BUCKET);
      if (existsInR2) {
        console.log(`Image Collector: Image already exists in R2: ${imageUrl}`);
      } else {
        console.log(`Image Collector: Downloading and saving image to R2: ${imageUrl}`);
        await downloadAndSaveImageToR2(imageUrl, env.R2_BUCKET);
      }
    } catch (error) {
      console.error(`Image Collector: Error processing image ${imageUrl}:`, error);
    }
  }

  return imageUrls;
}

async function checkImageExistsInR2(imageUrl: string, bucket: R2Bucket): Promise<boolean> {
  const url = new URL(imageUrl);
  const key = url.pathname.slice(1);
  const object: R2Object | null = await bucket.head(key);
  return object !== null;
}

async function downloadAndSaveImageToR2(imageUrl: string, bucket: R2Bucket): Promise<void> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const url = new URL(imageUrl);
  const key = url.pathname.slice(1);
  await bucket.put(key, arrayBuffer, {
    httpMetadata: response.headers
  });
}

function extractImageUrls(html: string, baseUrl: string): string[] {
  const root = parse(html);
  const images = root.querySelectorAll('img');
  const imageUrls = images.map(img => {
    const src = img.getAttribute('src');
    if (!src) return null;
    try {
      return new URL(src, baseUrl).href;
    } catch (error) {
      console.error(`Invalid image URL: ${src}`);
      return null;
    }
  }).filter((url): url is string => url !== null);

  // Dodajemy obrazy z tła CSS
  const elementsWithBackgroundImage = root.querySelectorAll('*[style*="background-image"]');
  elementsWithBackgroundImage.forEach(element => {
    const style = element.getAttribute('style');
    if (style) {
      const match = style.match(/background-image:\s*url\(['"]?([^'"()]+)['"]?\)/i);
      if (match && match[1]) {
        try {
          const fullUrl = new URL(match[1], baseUrl).href;
          if (!imageUrls.includes(fullUrl)) {
            imageUrls.push(fullUrl);
          }
        } catch (error) {
          console.error(`Invalid background image URL: ${match[1]}`);
        }
      }
    }
  });

  return [...new Set(imageUrls)]; // Usuwamy duplikaty
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
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

    const imageUrls = await collectImageUrls(targetUrl, env);

    return new Response(JSON.stringify({ imageUrls }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in Image Collector:', error);
    return new Response(JSON.stringify({ 
      error: 'Error in Image Collector', 
      details: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default {
  fetch: handleRequest
};
