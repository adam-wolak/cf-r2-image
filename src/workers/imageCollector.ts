import { parse } from 'fast-xml-parser';
import { Env, DurableObjectState } from './types';

export class SitemapProcessor {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'start':
        return this.startProcessing(request);
      case 'status':
        return this.getStatus();
      default:
        return new Response('Invalid action', { status: 400 });
    }
  }

  async startProcessing(request: Request) {
    const env = await request.json() as Env;
    if (!env.ORIGIN || !env.ORIGIN.startsWith('http')) {
      return new Response('Invalid domain', { status: 400 });
    }

    this.state.blockConcurrencyWhile(async () => {
      await this.processEntireWebsite(env);
    });
    return new Response('Processing started', { status: 202 });
  }

  async getStatus() {
    const status = await this.state.storage.get('status') || 'Not started';
    const processedUrls = await this.state.storage.get('processedUrls') || [];
    return new Response(JSON.stringify({ status, processedUrls }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async processEntireWebsite(env: Env) {
    await this.state.storage.put('status', 'Processing');
    const sitemapIndexUrl = `${env.ORIGIN}/sitemap_index.xml`;
    const sitemaps = await this.getSitemapsFromIndex(sitemapIndexUrl);
    
    const relevantSitemaps = [
      `${env.ORIGIN}/page-sitemap.xml`,
      `${env.ORIGIN}/cpt_services-sitemap.xml`,
      `${env.ORIGIN}/cpt_team-sitemap.xml`
    ];

    for (const sitemapUrl of sitemaps.filter(url => relevantSitemaps.includes(url))) {
      await this.processSitemap(sitemapUrl, env);
    }

    await this.state.storage.put('status', 'Completed');
  }

  async getSitemapsFromIndex(indexUrl: string): Promise<string[]> {
    const response = await fetch(indexUrl);
    const xmlData = await response.text();
    const result = parse(xmlData, { ignoreAttributes: false });
    return result.sitemapindex.sitemap.map((item: any) => item.loc);
  }

  async processSitemap(sitemapUrl: string, env: Env) {
    const response = await fetch(sitemapUrl);
    const xmlData = await response.text();
    const result = parse(xmlData, { ignoreAttributes: false });
    const urls = result.urlset.url.map((item: any) => item.loc);

    for (const url of urls) {
      console.log(`Processing page: ${url}`);
      await processAllImages(url, env);
      const processedUrls = await this.state.storage.get('processedUrls') || [];
      processedUrls.push(url);
      await this.state.storage.put('processedUrls', processedUrls);
    }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'start';
    const domain = url.searchParams.get('domain');

    if (!domain) {
      return new Response('Missing domain parameter', { status: 400 });
    }

    const id = env.SITEMAP_PROCESSOR.idFromName('default');
    const obj = env.SITEMAP_PROCESSOR.get(id);

    if (action === 'start') {
      const processingEnv = {
        ...env,
        ORIGIN: domain
      };
      const newRequest = new Request(request.url, {
        method: 'POST',
        body: JSON.stringify(processingEnv),
      });
      return obj.fetch(newRequest);
    } else {
      return obj.fetch(request);
    }
  }
};

async function processAllImages(url: string, env: Env): Promise<any[]> {
  const response = await fetch(url);
  const html = await response.text();
  const imageUrls = extractImageUrls(html, url);
  console.log(`Found ${imageUrls.length} image URLs on the page`);

  let processedImages: any[] = [];
  let savedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < imageUrls.length; i += BATCH_SIZE) {
    const batch = imageUrls.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(imageUrl => processImageWithRetry(imageUrl, env)));
    
    batchResults.forEach(result => {
      switch(result.status) {
        case 'saved':
          savedCount++;
          break;
        case 'updated':
          updatedCount++;
          break;
        case 'unchanged':
          unchangedCount++;
          break;
        case 'error':
          errorCount++;
          break;
      }
    });
    
    processedImages.push(...batchResults);
    
    // Dodajemy opóźnienie między partiami
    if (i + BATCH_SIZE < imageUrls.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }
  }

  console.log(`New images saved: ${savedCount}`);
  console.log(`Images updated: ${updatedCount}`);
  console.log(`Images unchanged: ${unchangedCount}`);
  console.log(`Failed to process: ${errorCount}`);
  console.log(`Total processed images: ${processedImages.length}`);
  return processedImages;
}

async function processImageWithRetry(imageUrl: string, env: Env, maxRetries = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await processImage(imageUrl, env);
    } catch (error: any) {
      if (attempt === maxRetries) {
        console.error(`Failed to process ${imageUrl} after ${maxRetries} attempts: ${error.message}`);
        return { status: 'error', message: error.message, url: imageUrl };
      }
      console.log(`Retrying ${imageUrl} (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
    }
  }
}

async function processImage(imageUrl: string, env: Env): Promise<any> {
  try {
    console.log(`Processing image: ${imageUrl}`);
    const imageBuffer = await downloadImage(imageUrl);
    console.log(`Downloaded image: ${imageUrl}, size: ${imageBuffer.byteLength} bytes`);
    const result = await processAndUploadImage(env.IMAGE_BUCKET, imageUrl, imageBuffer, env);
    console.log(`Processed and uploaded image: ${imageUrl}, result:`, result);
    return result;
  } catch (error: any) {
    console.error(`Error processing image ${imageUrl}:`, error);
    return { status: 'error', message: error.message, url: imageUrl };
  }
}

async function downloadImage(imageUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  return await response.arrayBuffer();
}

async function processAndUploadImage(bucket: R2Bucket, imageUrl: string, imageBuffer: ArrayBuffer, env: Env): Promise<any> {
  const urlObj = new URL(imageUrl);
  const objectKey = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;

  try {
    // Sprawdź, czy obraz już istnieje w R2
    const existingObject = await bucket.head(objectKey);
    
    if (existingObject) {
      // Jeśli obraz istnieje, porównaj rozmiary
      const existingSize = existingObject.size;
      const newSize = imageBuffer.byteLength;
      
      if (existingSize === newSize) {
        // Jeśli rozmiary są takie same, nie aktualizuj
        return { status: 'unchanged', message: 'Image already exists and has the same size', url: imageUrl };
      }
      
      console.log(`Size difference detected for ${objectKey}. Existing: ${existingSize}, New: ${newSize}`);
    }

    // Zapisz lub zaktualizuj obraz w R2
    await bucket.put(objectKey, imageBuffer, {
      httpMetadata: {
        cacheControl: env.R2_CACHE_CONTROL,
      },
    });

    return { 
      status: existingObject ? 'updated' : 'saved', 
      message: existingObject ? 'Image successfully updated in R2' : 'Image successfully saved to R2', 
      url: imageUrl 
    };
  } catch (error: any) {
    console.error(`Error processing image ${imageUrl}: ${error.message}`);
    return { status: 'error', message: `Failed to process image: ${error.message}`, url: imageUrl };
  }
}

