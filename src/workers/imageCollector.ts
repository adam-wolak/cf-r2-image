import { Env } from '../types';

const MAX_CONCURRENT_REQUESTS = 5;
const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES = 1000; // 1 sekunda między partiami

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

      const processedImages = await processImagesInBatches(imageUrls, env);

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

async function processImagesInBatches(imageUrls: string[], env: Env): Promise<(string | null)[]> {
  const results: (string | null)[] = [];
  for (let i = 0; i < imageUrls.length; i += BATCH_SIZE) {
    const batch = imageUrls.slice(i, i + BATCH_SIZE);
    const batchResults = await processImagesWithSemaphore(batch, env, MAX_CONCURRENT_REQUESTS);
    results.push(...batchResults);
    if (i + BATCH_SIZE < imageUrls.length) {
      await delay(DELAY_BETWEEN_BATCHES);
    }
  }
  return results;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processImagesWithSemaphore(imageUrls: string[], env: Env, maxConcurrent: number): Promise<(string | null)[]> {
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

function extractImageUrls(html: string, baseUrl: string): string[] {
  const imgRegex = /<img[^>]+src=["']?([^"'\s]+)["']?[^>]*>|<source[^>]+srcset=["']?([^"'\s]+)["']?[^>]*>/g;
  const urls: string[] = [];
  let match;
  let filteredCount = 0;

  while ((match = imgRegex.exec(html)) !== null) {
    let url = match[1] || match[2];
    if (!url) continue;
    
    url = new URL(url, baseUrl).href;
    
    if (url.toLowerCase().endsWith('.svg') || 
        url.toLowerCase().includes('favicon') || 
        url.toLowerCase().endsWith('.ico') ||
        url.startsWith('data:') ||
        url.includes('wp-includes') ||
        url.includes('wp-content/plugins')) {
      console.log(`Filtered out: ${url}`);
      filteredCount++;
      continue;
    }

    urls.push(url);
  }

  console.log(`Total images found: ${urls.length + filteredCount}`);
  console.log(`Filtered out: ${filteredCount}`);
  console.log(`Processed: ${urls.length}`);

  return [...new Set(urls)];
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
  // Dodatkowe sprawdzenie dla SVG, favicon i data URL
  if (imageUrl.toLowerCase().endsWith('.svg') || 
      imageUrl.toLowerCase().includes('favicon') || 
      imageUrl.startsWith('data:')) {
    console.log(`Skipping SVG, favicon or data URL: ${imageUrl}`);
    return null;
  }

  const url = new URL(imageUrl);
  let imagePath = url.pathname;
  
  // Usuwamy początkowy slash, jeśli istnieje
  if (imagePath.startsWith('/')) {
    imagePath = imagePath.slice(1);
  }

  // Usuwamy parametry URL z nazwy pliku
  imagePath = imagePath.split('?')[0];

  // Sprawdź, czy obraz istnieje w R2
  const existingObject = await env.R2_BUCKET.head(imagePath);
  
  if (existingObject) {
    console.log(`Image ${imagePath} already exists in R2`);
    return `${env.WORKER_URL}/${imagePath}`;
  }

  try {
    // Pobierz obraz
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('Content-Type') || 'image/jpeg';

    // Zapisz w R2
    await env.R2_BUCKET.put(imagePath, arrayBuffer, {
      httpMetadata: {
        contentType: contentType
      }
    });

    console.log(`Successfully uploaded ${imagePath} to R2`);
    console.log(`Successfully processed: ${imagePath}`);
    return `${env.WORKER_URL}/${imagePath}`;
  } catch (error) {
    console.error(`Error processing image ${imageUrl}:`, error);
    return null;
  }
}
