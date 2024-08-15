import { XMLParser } from 'fast-xml-parser';
import { Env, DurableObjectState } from '../types';
import { CONFIG } from '../config';

const BATCH_SIZE = 10;
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second

interface ProcessingRequest {
  env: Env;
  domain: string;
}

export class SitemapProcessor {
  state: DurableObjectState;
  parser: XMLParser;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.parser = new XMLParser({ ignoreAttributes: false });
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
    const data = await request.json() as ProcessingRequest;
    this.state.blockConcurrencyWhile(async () => {
      await this.processEntireSitemap(data.env, data.domain);
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

  async processEntireSitemap(env: Env, domain: string) {
    await this.state.storage.put('status', 'Processing');
    const sitemapIndexUrl = `${domain}${CONFIG.SITEMAP_INDEX_PATH}`;
    const sitemaps = await this.getSitemapsFromIndex(sitemapIndexUrl);
    
    const relevantSitemaps = CONFIG.RELEVANT_SITEMAPS.map(path => `${domain}${path}`);
    
    for (const sitemapUrl of sitemaps.filter(url => relevantSitemaps.includes(url))) {
      await this.processSitemap(sitemapUrl, env);
    }

    await this.state.storage.put('status', 'Completed');
  }

  async getSitemapsFromIndex(indexUrl: string): Promise<string[]> {
    const response = await fetch(indexUrl);
    const xmlData = await response.text();
    const result = this.parser.parse(xmlData);
    return result.sitemapindex.sitemap.map((item: any) => item.loc);
  }

  async processSitemap(sitemapUrl: string, env: Env) {
    const response = await fetch(sitemapUrl);
    const xmlData = await response.text();
    const result = this.parser.parse(xmlData);
    const urls = result.urlset.url.map((item: any) => item.loc);

    for (const url of urls) {
      console.log(`Processing page: ${url}`);
      await this.processPage(url, env);
      const processedUrls = await this.state.storage.get('processedUrls') || [];
      processedUrls.push(url);
      await this.state.storage.put('processedUrls', processedUrls);
    }
  }

  async processPage(url: string, env: Env) {
    const images = await processAllImages(url, env);
    console.log(`Processed ${images.length} images for ${url}`);
  }
}

async function processAllImages(url: string, env: Env): Promise<any[]> {
  const response = await fetch(url);
  const html = await response.text();
  const imageUrls = extractImageUrls(html, url);

  let processedImages: any[] = [];
  let savedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < imageUrls.length; i += BATCH_SIZE) {
    const batch = imageUrls.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((imageUrl: string) => processImageWithRetry(imageUrl, env)));
    
    batchResults.forEach((result: any) => {
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

async function processImageWithRetry(imageUrl: string, env: Env, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await processImage(imageUrl, env);
    } catch (error) {
      console.error(`Error processing image ${imageUrl}, attempt ${i + 1}:`, error);
      if (i === retries - 1) {
        return { status: 'error', message: `Failed to process image after ${retries} attempts`, url: imageUrl };
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
    }
  }
}

async function processImage(imageUrl: string, env: Env): Promise<any> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();

  const objectKey = new URL(imageUrl).pathname.slice(1);
  
  try {
    const existingObject = await env.IMAGE_BUCKET.head(objectKey);
    
    if (existingObject) {
      const existingSize = existingObject.size;
      const newSize = arrayBuffer.byteLength;
      
      if (existingSize === newSize) {
        return { status: 'unchanged', message: 'Image already exists and has the same size', url: imageUrl };
      }
      
      console.log(`Size difference detected for ${objectKey}. Existing: ${existingSize}, New: ${newSize}`);
    }

    await env.IMAGE_BUCKET.put(objectKey, arrayBuffer, {
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
    throw error;
  }
}

function extractImageUrls(html: string, baseUrl: string): string[] {
  const imgRegex = /<img[^>]+src="?([^"\s]+)"?\s*\/>/g;
  const urls: string[] = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith('//')) {
      url = 'https:' + url;
    } else if (url.startsWith('/')) {
      url = new URL(url, baseUrl).href;
    } else if (!url.startsWith('http')) {
      url = new URL(url, baseUrl).href;
    }
    urls.push(url);
  }
  return urls;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'start';
    const domain = url.searchParams.get('domain');

    if (!domain) {
      return new Response('Missing domain parameter', { status: 400 });
    }

    const id = env.SITEMAP_PROCESSOR.idFromName('default');
    const obj = env.SITEMAP_PROCESSOR.get(id);

    if (action === 'start') {
      const newRequest = new Request(request.url, {
      method: 'POST',
      body: JSON.stringify({ env, domain }),
    });
  return obj.fetch(newRequest);
  }
}
};

