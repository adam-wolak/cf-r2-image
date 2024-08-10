import { Env } from '../types';

const MAX_CONCURRENT_TRANSFORMATIONS = 3;
const TIMEOUT = 30000; // 30 seconds

interface TransformedImage {
  originalUrl: string;
  avifUrl: string;
  webpUrl: string;
}

class Semaphore {
  private permits: number;
  private waiting: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }
    return new Promise<void>(resolve => this.waiting.push(resolve));
  }

  release(): void {
    this.permits++;
    if (this.waiting.length > 0 && this.permits > 0) {
      this.permits--;
      const next = this.waiting.shift();
      if (next) next();
    }
  }
}

export default {

async fetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const imageUrl = url.searchParams.get('url');

  if (!imageUrl) {
    return new Response('Missing URL parameter', { status: 400 });
  }

  try {
    if (imageUrl.startsWith('http')) {
      // Jeśli to URL strony, pobierz obrazy z tej strony
      const pageImages = await this.getImagesFromPage(imageUrl);
      const transformedImages = await this.transformImages(pageImages, env);
      return new Response(JSON.stringify(transformedImages), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Jeśli to pojedynczy obraz, przetwórz go
      const transformedImage = await this.transformSingleImage(imageUrl, env);
      return new Response(JSON.stringify([transformedImage]), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response('Error processing image(s): ' + errorMessage, { status: 500 });
  }
},
  async getImagesFromPage(pageUrl: string): Promise<string[]> {
    const response = await fetch(pageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const imageUrls = new Set<string>();

    // Regex do wyodrębniania URL-i obrazów
    const imgRegex = /<img[^>]+src=["']?([^"'\s>]+)["']?[^>]*>/gi;
    const backgroundRegex = /background-image:\s*url\(['"]?([^'"]+)['"]?\)/gi;

    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      if (match[1]) {
        imageUrls.add(new URL(match[1], pageUrl).href);
      }
    }

    while ((match = backgroundRegex.exec(html)) !== null) {
      if (match[1]) {
        imageUrls.add(new URL(match[1], pageUrl).href);
      }
    }

    console.log(`Found ${imageUrls.size} unique images on the page`);

    return Array.from(imageUrls);
  },

  async transformImages(images: string[], env: Env): Promise<TransformedImage[]> {
    const transformedImages: TransformedImage[] = [];
    const semaphore = new Semaphore(MAX_CONCURRENT_TRANSFORMATIONS);

    await Promise.all(images.map(async (imageUrl) => {
      await semaphore.acquire();
      try {
        const transformedImage = await this.transformSingleImage(imageUrl, env);
        if (transformedImage) {
          transformedImages.push(transformedImage);
        }
      } catch (error) {
        console.error(`Error transforming image ${imageUrl}:`, error);
      } finally {
        semaphore.release();
      }
    }));

    return transformedImages;
  },

async transformSingleImage(imageUrl: string, env: Env): Promise<TransformedImage | null> {
  try {
    const avifUrl = await this.transformImageIfNeeded(imageUrl, 'avif', env);
    const webpUrl = await this.transformImageIfNeeded(imageUrl, 'webp', env);

    return {
      originalUrl: imageUrl,
      avifUrl: avifUrl || imageUrl,
      webpUrl: webpUrl || imageUrl
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`Error transforming image ${imageUrl}:`, errorMessage);
    return null;
  }
},

  async transformImageIfNeeded(imageUrl: string, format: 'avif' | 'webp', env: Env): Promise<string | null> {
    // Implementacja transformacji obrazu
    // Zwróć URL przetworzonego obrazu lub null w przypadku błędu
    // Ta funkcja powinna zawierać logikę sprawdzania, czy obraz już istnieje w R2 i transformacji jeśli nie
    return null; // Tymczasowo zwracamy null
  }
};
