import { Env } from '../types';

const MAX_CONCURRENT_REQUESTS = 5; // Ustaw odpowiednią wartość

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pageUrl = url.searchParams.get('url');

    if (!pageUrl) {
      return new Response('Missing URL parameter', { status: 400 });
    }

    try {
      const response = await fetch(pageUrl);
      const html = await response.text();

      const imageUrls = extractImageUrls(html, new URL(pageUrl).origin);
      console.log(`Found ${imageUrls.length} images on the page`);

      const processedImages = await processImagesWithSemaphore(imageUrls, env, MAX_CONCURRENT_REQUESTS);

      return new Response(JSON.stringify({
        totalImages: imageUrls.length,
        processedImages: processedImages.filter(Boolean).length,
        images: processedImages
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error in handleRequest:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};

async function processImagesWithSemaphore(imageUrls: string[], env: Env, maxConcurrent: number): Promise<(string | null)[]> {

 if (imageUrl.toLowerCase().endsWith('.svg') || imageUrl.toLowerCase().includes('favicon')) {
    console.log(`Skipping SVG or favicon: ${imageUrl}`);
    return null;
  }

  const imageName = new URL(imageUrl).pathname.split('/').pop() || '';
  const semaphore = new Semaphore(maxConcurrent);
  const promises = imageUrls.map(async (url) => {
    await semaphore.acquire();
    try {
      return await processImage(url, env);
    } finally {
      semaphore.release();
    }
  });
  return Promise.all(promises);
}

class Semaphore {
  private permits: number;
  private queue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.queue.push(resolve));
  }

  release(): void {
    this.permits++;
    if (this.queue.length > 0 && this.permits > 0) {
      this.permits--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

async function processImage(imageUrl: string, env: Env): Promise<string | null> {
  const imageName = new URL(imageUrl).pathname.split('/').pop() || '';
  
  // Sprawdź, czy obraz istnieje w R2
  const existingObject = await env.R2_BUCKET.head(imageName);
  
  if (existingObject) {
    console.log(`Image ${imageName} already exists in R2`);
    return `${env.WORKER_URL}/${imageName}`;
  }

  try {
    // Pobierz obraz
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('Content-Type') || 'image/jpeg';

    // Zapisz w R2
    await env.R2_BUCKET.put(imageName, arrayBuffer, {
      httpMetadata: {
        contentType: contentType
      }
    });

    console.log(`Successfully uploaded ${imageName} to R2`);
    return `${env.WORKER_URL}/${imageName}`;
  } catch (error) {
    console.error(`Error processing image ${imageUrl}:`, error);
    return null;
  }
}

function extractImageUrls(html: string, baseUrl: string): string[] {
  const imgRegex = /<img[^>]+src=["']?([^"'\s]+)["']?[^>]*>|<source[^>]+srcset=["']?([^"'\s]+)["']?[^>]*>/g;
  const urls: string[] = [];
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    let url = match[1] || match[2];
    if (!url) continue;
    if (!url.startsWith('http')) {
      url = new URL(url, baseUrl).href;
    }
    
    // Pomijamy SVG i favicon
    if (url.toLowerCase().endsWith('.svg') || url.toLowerCase().includes('favicon')) {
      continue;
    }

    urls.push(url);
  }

  return [...new Set(urls)]; // Usuwamy duplikaty
}

