import { Env } from '../types';

const MAX_CONCURRENT_TRANSFORMATIONS = 3;
const TIMEOUT = 30000; // 30 seconds

interface CollectorData {
  images: string[];
}

interface TransformedImage {
  originalUrl: string;
  avifUrl: string;
  webpUrl: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const collectorData = await request.json() as CollectorData;
      const transformPromise = transformImages(collectorData.images, env);
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Transformation timeout')), TIMEOUT);
      });

      const transformedImages = await Promise.race([transformPromise, timeoutPromise]);
      
      return new Response(JSON.stringify(transformedImages), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error in Image Transformer:', error);
      const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: errorMessage === 'Transformation timeout' ? 504 : 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

async function transformImages(images: string[], env: Env): Promise<TransformedImage[]> {
  const transformedImages: TransformedImage[] = [];
  const semaphore = new Semaphore(MAX_CONCURRENT_TRANSFORMATIONS);

  await Promise.all(images.map(async (imageUrl) => {
    await semaphore.acquire();
    try {
      const avifImage = await transformImageIfNeeded(imageUrl, 'avif', env);
      const webpImage = await transformImageIfNeeded(imageUrl, 'webp', env);
      
      transformedImages.push({
        originalUrl: imageUrl,
        avifUrl: avifImage.url,
        webpUrl: webpImage.url,
      });
    } catch (error) {
      console.error(`Error transforming image ${imageUrl}:`, error);
    } finally {
      semaphore.release();
    }
  }));

  return transformedImages;
}


async function transformImageIfNeeded(imageUrl: string, format: 'avif' | 'webp', env: Env) {
  const key = `transformed/${format}/${new URL(imageUrl).pathname}`;
  
  // Check if the image already exists in R2
  const existingImage = await env.R2_BUCKET.get(key);
  if (existingImage) {
    return {
      url: `${env.R2_PUB}/${key}`,
      size: existingImage.size,
    };
  }

  // If the image doesn't exist, transform it
  const transformedImageUrl = getTransformedImageUrl(imageUrl, format);
  const response = await fetch(transformedImageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch transformed image: ${response.statusText}`);
  }

  const transformedImage = await response.arrayBuffer();
  
  await env.R2_BUCKET.put(key, transformedImage, {
    httpMetadata: {
      contentType: `image/${format}`,
    },
  });

  return {
    url: `${env.R2_PUB}/${key}`,
    size: transformedImage.byteLength,
  };
}

function getTransformedImageUrl(imageUrl: string, format: 'avif' | 'webp'): string {
  const url = new URL(imageUrl);
  url.searchParams.set('format', format);
  url.searchParams.set('quality', '80');
  // Dodaj inne parametry transformacji, jeśli są potrzebne
  return url.toString();
}

class Semaphore {
  private permits: number;
  private promiseResolvers: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.promiseResolvers.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.permits > 0 && this.promiseResolvers.length > 0) {
      this.permits--;
      const resolve = this.promiseResolvers.shift();
      if (resolve) resolve();
    }
  }
}
